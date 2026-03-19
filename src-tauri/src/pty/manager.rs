use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub struct PtySession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    master: Arc<Mutex<Box<dyn portable_pty::MasterPty + Send>>>,
    /// Keep the child alive; dropping it on some platforms signals the process.
    child: Box<dyn portable_pty::Child + Send + Sync>,
    shutdown_tx: std::sync::mpsc::Sender<()>,
    /// Join handle for the reader thread; taken during kill so it can be joined.
    reader_thread: Option<std::thread::JoinHandle<()>>,
    /// Fires once when the PTY reader thread detects process exit (EOF or error).
    exit_rx: Option<tokio::sync::oneshot::Receiver<()>>,
}

pub struct PtyManager {
    sessions: HashMap<String, PtySession>,
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn spawn(
        &mut self,
        session_id: String,
        command: String,
        args: Vec<String>,
        cwd: String,
        env: HashMap<String, String>,
        cols: u16,
        rows: u16,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        if self.sessions.contains_key(&session_id) {
            return Err(format!("Session {} already exists", session_id));
        }

        let pty_system = NativePtySystem::default();

        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        let mut cmd = CommandBuilder::new(&command);
        for arg in &args {
            cmd.arg(arg);
        }
        cmd.cwd(&cwd);
        for (key, value) in &env {
            cmd.env(key, value);
        }

        // Destructure the pair to get master and slave separately.
        // spawn_command consumes the slave, so after this call the slave is gone
        // and the master gets EOF when the child process exits.
        let master_pty = pair.master;
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {}", e))?;

        let master = Arc::new(Mutex::new(master_pty));

        // Extract both the reader and writer while holding the lock.
        // try_clone_reader gives an independent blocking reader handle;
        // take_writer gives the write half (can only be taken once).
        let (mut reader, writer) = {
            let m = master.lock().map_err(|e| format!("Lock error: {}", e))?;
            let r = m
                .try_clone_reader()
                .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;
            let w: Box<dyn Write + Send> = m
                .take_writer()
                .map_err(|e| format!("Failed to take PTY writer: {}", e))?;
            (r, w)
        };
        let writer = Arc::new(Mutex::new(writer));

        let (shutdown_tx, shutdown_rx) = std::sync::mpsc::channel::<()>();
        let (exit_tx, exit_rx) = tokio::sync::oneshot::channel::<()>();

        let sid = session_id.clone();
        let app = app_handle.clone();
        let reader_thread = std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                // Check for shutdown signal (non-blocking)
                if shutdown_rx.try_recv().is_ok() {
                    break;
                }

                match reader.read(&mut buf) {
                    Ok(0) => {
                        // EOF - child process exited
                        let _ = app.emit(&format!("pty-exit-{}", sid), 0i32);
                        let _ = exit_tx.send(());
                        break;
                    }
                    Ok(n) => {
                        let data: Vec<u8> = buf[..n].to_vec();
                        let _ = app.emit(&format!("pty-output-{}", sid), data);
                    }
                    Err(_) => {
                        let _ = app.emit(&format!("pty-exit-{}", sid), 1i32);
                        let _ = exit_tx.send(());
                        break;
                    }
                }
            }
        });

        let session = PtySession {
            writer,
            master,
            child,
            shutdown_tx,
            reader_thread: Some(reader_thread),
            exit_rx: Some(exit_rx),
        };

        self.sessions.insert(session_id, session);
        Ok(())
    }

    pub fn write(&mut self, session_id: &str, data: Vec<u8>) -> Result<(), String> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        let mut writer = session
            .writer
            .lock()
            .map_err(|e| format!("Writer lock error: {}", e))?;

        writer
            .write_all(&data)
            .map_err(|e| format!("Write error: {}", e))?;

        writer.flush().map_err(|e| format!("Flush error: {}", e))?;

        Ok(())
    }

    pub fn resize(&mut self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        let master = session
            .master
            .lock()
            .map_err(|e| format!("Master lock error: {}", e))?;

        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Resize error: {}", e))?;

        Ok(())
    }

    /// Take the oneshot receiver that fires when the PTY process exits.
    /// Can only be called once per session; returns None if already taken or session not found.
    pub fn take_exit_rx(&mut self, session_id: &str) -> Option<tokio::sync::oneshot::Receiver<()>> {
        self.sessions.get_mut(session_id)?.exit_rx.take()
    }

    pub fn kill(&mut self, session_id: &str) -> Result<(), String> {
        let mut session = self
            .sessions
            .remove(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        kill_session(&mut session);

        Ok(())
    }

    /// Kill every active session. Used during application shutdown.
    pub fn kill_all(&mut self) {
        for (_, mut session) in self.sessions.drain() {
            kill_session(&mut session);
        }
    }
}

/// Gracefully shut down a single PTY session:
/// 1. Close the writer (sends EOF / SIGHUP to the child on most platforms).
/// 2. Wait up to 3 seconds for the reader thread to report exit.
/// 3. Force-kill the child process if it has not exited yet.
/// 4. Signal the reader thread to stop.
fn kill_session(session: &mut PtySession) {
    // Step 1: drop the writer to close stdin/send EOF to the child.
    if let Ok(mut w) = session.writer.lock() {
        let _ = w.flush();
        // Replacing the writer with a no-op sink closes the underlying fd.
        *w = Box::new(std::io::sink());
    }

    // Step 2: wait up to 200 ms for the child to exit on its own.
    let exited = session
        .child
        .try_wait()
        .map(|s| s.is_some())
        .unwrap_or(false);

    if !exited {
        let deadline = std::time::Instant::now() + std::time::Duration::from_millis(200);
        loop {
            if std::time::Instant::now() >= deadline {
                break;
            }
            match session.child.try_wait() {
                Ok(Some(_)) => break,
                _ => std::thread::sleep(std::time::Duration::from_millis(50)),
            }
        }
    }

    // Step 3: force-kill if still alive.
    let still_alive = session
        .child
        .try_wait()
        .map(|s| s.is_none())
        .unwrap_or(true);

    if still_alive {
        let _ = session.child.kill();
    }

    // Step 4: signal the reader thread to stop, then join it so the OS-level
    // thread is fully cleaned up before this function returns.
    let _ = session.shutdown_tx.send(());
    if let Some(handle) = session.reader_thread.take() {
        // The thread exits quickly after receiving the shutdown signal or when
        // the PTY EOF was already delivered.  We join with a short busy-wait
        // timeout so a stuck thread never blocks the caller indefinitely.
        let deadline = std::time::Instant::now() + std::time::Duration::from_millis(500);
        loop {
            if handle.is_finished() {
                let _ = handle.join();
                break;
            }
            if std::time::Instant::now() >= deadline {
                // Thread did not exit in time — abandon the join to avoid
                // blocking. The handle is dropped here which detaches the thread.
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }
}
