use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Db(#[from] rusqlite::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("PTY error: {0}")]
    Pty(String),

    #[error("Git error: {0}")]
    Git(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Channel error: {0}")]
    Channel(String),

    #[error("Lock poisoned: {0}")]
    Lock(String),

    #[error("Validation: {0}")]
    Validation(String),

    #[error("{0}")]
    Other(String),
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("AppError", 2)?;
        let kind = match self {
            AppError::Db(_) => "db",
            AppError::Io(_) => "io",
            AppError::Pty(_) => "pty",
            AppError::Git(_) => "git",
            AppError::NotFound(_) => "not_found",
            AppError::Channel(_) => "channel",
            AppError::Lock(_) => "lock",
            AppError::Validation(_) => "validation",
            AppError::Other(_) => "other",
        };
        s.serialize_field("kind", kind)?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

/// Helper to convert mutex lock errors.
pub fn lock_err<T>(err: std::sync::PoisonError<T>) -> AppError {
    AppError::Lock(err.to_string())
}
