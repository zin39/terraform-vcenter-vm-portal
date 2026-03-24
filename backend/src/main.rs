use axum::{routing::get, Router};
use http::HeaderValue;
use sqlx::PgPool;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use approval_portal::{
    config::Config,
    db,
    handlers,
    models::UserRole,
    services::progress_broadcaster::ProgressBroadcaster,
    utils::hash_password,
    AppState,
};

async fn seed_admin_user(pool: &PgPool) {
    let exists: Option<(i64,)> = sqlx::query_as("SELECT COUNT(*) FROM users WHERE email = $1")
        .bind("admin@example.com")
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

    if exists.map(|(count,)| count).unwrap_or(0) == 0 {
        let password_hash = hash_password("Admin123!").expect("Failed to hash password");

        sqlx::query(
            r#"
            INSERT INTO users (email, password_hash, full_name, role, is_active)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind("admin@example.com")
        .bind(&password_hash)
        .bind("System Administrator")
        .bind(UserRole::Admin)
        .bind(true)
        .execute(pool)
        .await
        .expect("Failed to seed admin user");

        tracing::info!("Created default admin user: admin@example.com / Admin123!");
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();
    config.validate_vsphere_config();
    let pool = db::create_pool(&config.database_url).await;

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    // Seed admin user
    seed_admin_user(&pool).await;

    let progress_broadcaster = ProgressBroadcaster::new();

    let state = AppState {
        db: pool,
        config: config.clone(),
        progress_broadcaster,
    };

    // Configure CORS based on allowed origins
    let cors = if config.cors_allowed_origins.iter().any(|o| o == "*") {
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any)
    } else {
        let origins: Vec<HeaderValue> = config
            .cors_allowed_origins
            .iter()
            .filter_map(|o| o.parse().ok())
            .collect();
        CorsLayer::new()
            .allow_origin(AllowOrigin::list(origins))
            .allow_methods(Any)
            .allow_headers(Any)
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .nest("/api/auth", handlers::auth::router())
        .nest("/api/users", handlers::auth::users_router())
        .nest("/api/vm-requests", handlers::vm_requests::router())
        .nest("/api/vm-requests", handlers::terraform::router())
        .nest("/api/vsphere", handlers::terraform::vsphere_router())
        .nest("/api/networks", handlers::networks::router())
        .nest("/api/os-templates", handlers::os_templates::router())
        .nest("/api/ip-addresses", handlers::ip_addresses::router())
        .nest("/api/provisioned-vms", handlers::provisioned_vms::router())
        .nest("/api/ws", handlers::websocket::router())
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> &'static str {
    "OK"
}
