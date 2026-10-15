//! Durable request event delivery; start one driver per service replica.
use crate::domain::ports::{RequestEventSink, RequestRepository};
use std::{sync::Arc, time::Duration};

/// Retry committed events until the notification and realtime sinks accept them.
pub async fn run<R: RequestRepository, S: RequestEventSink>(repository: Arc<R>, sink: S) {
    let mut interval = tokio::time::interval(Duration::from_secs(2));
    loop {
        interval.tick().await;
        let events = match repository.claim_events().await {
            Ok(events) => events,
            Err(error) => {
                tracing::error!(error=?error, "could not claim access request events");
                continue;
            }
        };
        for event in events {
            if let Err(error) = sink.deliver(&event).await {
                tracing::error!(error=?error, event_id=%event.id, "access request delivery will retry");
                continue;
            }
            if let Err(error) = repository.delivered(event.id).await {
                tracing::error!(error=?error, event_id=%event.id, "could not complete access request delivery");
            }
        }
    }
}
