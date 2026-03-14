use crate::sandbox;

#[tauri::command]
pub fn get_sandbox_capabilities() -> sandbox::SandboxCapabilities {
    sandbox::detect_capabilities()
}
