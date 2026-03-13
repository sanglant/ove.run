use tokio::sync::mpsc;
use crate::db::init::DbPool;

pub enum MemoryWorkerEvent {
    ConsolidateProject { project_id: String, project_path: String },
    PruneProject { project_id: String },
    Shutdown,
}

pub async fn run_memory_worker(_db: DbPool, mut rx: mpsc::Receiver<MemoryWorkerEvent>) {
    while let Some(event) = rx.recv().await {
        match event {
            MemoryWorkerEvent::Shutdown => break,
            _ => {}
        }
    }
}
