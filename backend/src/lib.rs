// Library crate for testing support
pub mod config;
pub mod db;
pub mod error;
pub mod handlers;
pub mod middleware;
pub mod models;
pub mod services;
pub mod utils;

use axum::extract::FromRef;
use sqlx::PgPool;

use crate::config::Config;
use crate::services::progress_broadcaster::ProgressBroadcaster;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    pub progress_broadcaster: ProgressBroadcaster,
}

impl FromRef<AppState> for Config {
    fn from_ref(state: &AppState) -> Self {
        state.config.clone()
    }
}
