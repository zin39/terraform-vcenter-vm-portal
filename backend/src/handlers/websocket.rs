use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    response::Response,
    routing::get,
    Router,
};
use chrono::{DateTime, Utc};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use sqlx::FromRow;
use uuid::Uuid;

use crate::models::{DeletionUpdate, ProgressMessage, ProvisioningUpdate};
use crate::utils::verify_token;
use crate::AppState;

#[derive(Debug, FromRow)]
struct DeletionProgressRow {
    current_step: String,
    step_index: i32,
    total_steps: i32,
    step_message: Option<String>,
    completed_at: Option<DateTime<Utc>>,
    error_message: Option<String>,
}

#[derive(Debug, FromRow)]
struct ProvisioningProgressRow {
    current_step: String,
    step_index: i32,
    total_steps: i32,
    step_message: Option<String>,
    completed_at: Option<DateTime<Utc>>,
    error_message: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    token: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/provisioning/:request_id", get(provisioning_ws))
        .route("/deletion/:vm_id", get(deletion_ws))
}

/// WebSocket endpoint for provisioning progress
async fn provisioning_ws(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(request_id): Path<Uuid>,
    Query(query): Query<WsQuery>,
) -> Response {
    // Verify the token
    if verify_token(&query.token, &state.config.jwt_secret).is_err() {
        tracing::warn!("Invalid token for WebSocket connection to request {}", request_id);
        return ws.on_upgrade(|mut socket| async move {
            let _ = socket
                .send(Message::Text(
                    serde_json::to_string(&ProgressMessage::Error {
                        message: "Unauthorized".to_string(),
                    })
                    .unwrap(),
                ))
                .await;
            let _ = socket.close().await;
        });
    }

    ws.on_upgrade(move |socket| handle_provisioning_socket(socket, state, request_id))
}

async fn handle_provisioning_socket(socket: WebSocket, state: AppState, request_id: Uuid) {
    let (mut sender, mut receiver) = socket.split();

    // Send connected message
    let connected_msg = ProgressMessage::Connected {
        request_id: request_id.to_string(),
    };
    if let Ok(json) = serde_json::to_string(&connected_msg) {
        if sender.send(Message::Text(json)).await.is_err() {
            return;
        }
    }

    // Query database for current provisioning progress and send immediately
    if let Some(update) = get_current_provisioning_progress(&state, request_id).await {
        let message = ProgressMessage::ProvisioningUpdate(update);
        if let Ok(json) = serde_json::to_string(&message) {
            if sender.send(Message::Text(json)).await.is_err() {
                return;
            }
        }
    }

    // Subscribe to progress updates
    let mut progress_rx = state.progress_broadcaster.subscribe_provisioning(request_id).await;

    // Spawn a task to forward progress updates to the WebSocket
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = progress_rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    });

    // Handle incoming messages (for ping/pong or close)
    let recv_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(Message::Close(_)) => break,
                Ok(Message::Ping(data)) => {
                    // Ping will be handled by the WebSocket layer
                    tracing::debug!("Received ping: {:?}", data);
                }
                Err(e) => {
                    tracing::debug!("WebSocket error: {}", e);
                    break;
                }
                _ => {}
            }
        }
    });

    // Wait for either task to complete
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    tracing::debug!("WebSocket connection closed for request {}", request_id);
}

/// Query the database for current provisioning progress
async fn get_current_provisioning_progress(state: &AppState, request_id: Uuid) -> Option<ProvisioningUpdate> {
    let row = sqlx::query_as::<_, ProvisioningProgressRow>(
        r#"
        SELECT current_step, step_index, total_steps, step_message, completed_at, error_message
        FROM provisioning_progress
        WHERE vm_request_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        "#
    )
    .bind(request_id)
    .fetch_optional(&state.db)
    .await
    .ok()??;

    let is_complete = row.completed_at.is_some() || row.current_step == "completed";
    let is_error = row.error_message.is_some() || row.current_step == "failed";

    Some(ProvisioningUpdate {
        request_id: request_id.to_string(),
        step: row.current_step,
        step_index: row.step_index,
        total_steps: row.total_steps,
        message: row.step_message.or(row.error_message).unwrap_or_default(),
        is_complete,
        is_error,
        timestamp: Utc::now(),
    })
}

/// WebSocket endpoint for deletion progress
async fn deletion_ws(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(vm_id): Path<Uuid>,
    Query(query): Query<WsQuery>,
) -> Response {
    // Verify the token
    if verify_token(&query.token, &state.config.jwt_secret).is_err() {
        tracing::warn!("Invalid token for WebSocket connection to VM {}", vm_id);
        return ws.on_upgrade(|mut socket| async move {
            let _ = socket
                .send(Message::Text(
                    serde_json::to_string(&ProgressMessage::Error {
                        message: "Unauthorized".to_string(),
                    })
                    .unwrap(),
                ))
                .await;
            let _ = socket.close().await;
        });
    }

    ws.on_upgrade(move |socket| handle_deletion_socket(socket, state, vm_id))
}

async fn handle_deletion_socket(socket: WebSocket, state: AppState, vm_id: Uuid) {
    let (mut sender, mut receiver) = socket.split();

    // Send connected message
    let connected_msg = ProgressMessage::Connected {
        request_id: vm_id.to_string(),
    };
    if let Ok(json) = serde_json::to_string(&connected_msg) {
        if sender.send(Message::Text(json)).await.is_err() {
            return;
        }
    }

    // Query database for current deletion progress and send immediately
    if let Some(update) = get_current_deletion_progress(&state, vm_id).await {
        let message = ProgressMessage::DeletionUpdate(update);
        if let Ok(json) = serde_json::to_string(&message) {
            if sender.send(Message::Text(json)).await.is_err() {
                return;
            }
        }
    }

    // Subscribe to deletion progress updates
    let mut progress_rx = state.progress_broadcaster.subscribe_deletion(vm_id).await;

    // Spawn a task to forward progress updates to the WebSocket
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = progress_rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    });

    // Handle incoming messages (for ping/pong or close)
    let recv_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(Message::Close(_)) => break,
                Ok(Message::Ping(data)) => {
                    tracing::debug!("Received ping: {:?}", data);
                }
                Err(e) => {
                    tracing::debug!("WebSocket error: {}", e);
                    break;
                }
                _ => {}
            }
        }
    });

    // Wait for either task to complete
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    tracing::debug!("WebSocket connection closed for VM {}", vm_id);
}

/// Query the database for current deletion progress
async fn get_current_deletion_progress(state: &AppState, vm_id: Uuid) -> Option<DeletionUpdate> {
    let row = sqlx::query_as::<_, DeletionProgressRow>(
        r#"
        SELECT current_step, step_index, total_steps, step_message, completed_at, error_message
        FROM deletion_progress
        WHERE provisioned_vm_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        "#
    )
    .bind(vm_id)
    .fetch_optional(&state.db)
    .await
    .ok()??;

    let is_complete = row.completed_at.is_some() || row.current_step == "completed";
    let is_error = row.error_message.is_some() || row.current_step == "failed";

    Some(DeletionUpdate {
        vm_id: vm_id.to_string(),
        step: row.current_step,
        step_index: row.step_index,
        total_steps: row.total_steps,
        message: row.step_message.or(row.error_message).unwrap_or_default(),
        is_complete,
        is_error,
        timestamp: Utc::now(),
    })
}
