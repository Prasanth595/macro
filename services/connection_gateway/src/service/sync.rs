//! Per-WebSocket sync routing. No shared subscription or cross-replica relay.

use crate::model::message::OutgoingMessage;
use anyhow::{Context, Result};
use std::sync::Arc;
use sync_router::{
    domain::{
        models::{ConnectionId, EdgeEvent, Event},
        ports::EdgeSink,
        router::Router,
    },
    outbound::do_downstream::DoDownstreamFactory,
};
use tokio::sync::mpsc;
use tokio_util::{
    sync::{CancellationToken, DropGuard},
    task::TaskTracker,
};
use tracing::Instrument;
use url::Url;

#[cfg(test)]
mod test;

const ROUTER_QUEUE_CAPACITY: usize = 64;

/// Routing resources owned by one authenticated client WebSocket.
pub struct SyncSession {
    connection: ConnectionId,
    events: mpsc::Sender<Event>,
    cancel: CancellationToken,
    tasks: TaskTracker,
    _cancel_on_drop: DropGuard,
}

impl SyncSession {
    /// Start a router that can deliver only to this socket's bounded queue.
    pub fn new(
        connection_id: String,
        base_url: Url,
        sender: mpsc::Sender<OutgoingMessage>,
    ) -> Self {
        let connection = ConnectionId(connection_id);
        let cancel = CancellationToken::new();
        let tasks = TaskTracker::new();
        let (events, receiver) = mpsc::channel(ROUTER_QUEUE_CAPACITY);
        let sink = Arc::new(SocketSink {
            connection: connection.clone(),
            sender,
            cancel: cancel.clone(),
        });
        let downstreams = DoDownstreamFactory::new(
            base_url,
            Arc::clone(&sink),
            events.clone(),
            cancel.clone(),
            tasks.clone(),
        );
        let router = Router::new(sink, downstreams);
        tasks.spawn(router.run(receiver, cancel.clone()).in_current_span());
        Self {
            connection,
            events,
            _cancel_on_drop: cancel.clone().drop_guard(),
            cancel,
            tasks,
        }
    }

    /// Apply backpressure only to this connection, preserving binary frame order.
    pub async fn frame(&self, payload: Vec<u8>) -> Result<()> {
        self.events
            .send(Event::Edge(EdgeEvent::Frame {
                conn: self.connection.clone(),
                payload,
            }))
            .await
            .context("sync router stopped")
    }

    /// Stop the socket if routing fails or its outbound queue stops draining.
    pub async fn closed(&self) {
        tokio::select! {
            _ = self.cancel.cancelled() => {},
            _ = self.events.closed() => {},
        }
    }

    /// Cancel dialing and established downstreams, then join every routing task.
    pub async fn shutdown(self) {
        self.cancel.cancel();
        self.tasks.close();
        self.tasks.wait().await;
    }
}

struct SocketSink {
    connection: ConnectionId,
    sender: mpsc::Sender<OutgoingMessage>,
    cancel: CancellationToken,
}

impl EdgeSink for SocketSink {
    type Err = anyhow::Error;

    #[tracing::instrument(skip_all, fields(connection.id = %conn.0), err)]
    async fn deliver(&self, conn: &ConnectionId, frame: Vec<u8>) -> Result<()> {
        anyhow::ensure!(
            conn == &self.connection,
            "sync frame targets another connection"
        );
        if self
            .sender
            .try_send(OutgoingMessage::Binary(frame))
            .is_err()
        {
            // Dropping a chunk corrupts framing. Close this socket so its virtual
            // sockets reconnect and resync instead of losing a partial message.
            self.cancel.cancel();
            anyhow::bail!("sync client outbound queue is full or closed");
        }
        Ok(())
    }
}
