//! Ports the router core depends on.

use crate::domain::models::{ConnectionId, DocId};
use std::fmt::Debug;
use tokio::sync::mpsc;
use tokio_util::sync::{CancellationToken, DropGuard};

/// Delivers an already-serialized `FromRouter` envelope to a client
/// connection. The gateway implements this with the owning socket's queue.
#[cfg_attr(test, mockall::automock(type Err = anyhow::Error;))]
pub trait EdgeSink: Send + Sync + 'static {
    /// The error type returned by delivery.
    type Err: Into<anyhow::Error> + Send + Debug;

    /// Deliver `frame` to `conn`'s websocket, best effort.
    fn deliver(
        &self,
        conn: &ConnectionId,
        frame: Vec<u8>,
    ) -> impl Future<Output = Result<(), Self::Err>> + Send;
}

/// Opens the downstream for one `(connection, document)` subscription.
///
/// Returns a sender immediately; dialing happens in a background task, so
/// frames sent before the dial completes buffer in the channel. The
/// implementation delivers `RouterSubscribed` / `RouterSubscribeFailed` /
/// `RouterDocFrame` / `RouterDocClosed` to the client itself and reports
/// route teardown via [`crate::domain::models::Event::DownstreamClosed`].
///
/// Chapter 1 dials the Cloudflare Durable Object; chapter 2 consistent-hashes
/// `doc` across native sync services.
#[cfg_attr(test, mockall::automock)]
pub trait DownstreamFactory: Send + Sync + 'static {
    /// Open the downstream, returning where to send the client's inner
    /// (already-serialized `FromPeer`) frames. `epoch` identifies this route
    /// incarnation and must be echoed in the resulting
    /// [`crate::domain::models::Event::DownstreamClosed`].
    fn open(&self, conn: ConnectionId, doc: DocId, token: String, epoch: u64) -> Downstream;
}

/// A downstream route whose work is cancelled as soon as the route is removed.
pub struct Downstream {
    sender: mpsc::Sender<Vec<u8>>,
    _cancel_on_drop: DropGuard,
}

impl Downstream {
    /// Own the frame queue and cancellation of its downstream pump.
    pub fn new(sender: mpsc::Sender<Vec<u8>>, cancel: CancellationToken) -> Self {
        Self {
            sender,
            _cancel_on_drop: cancel.drop_guard(),
        }
    }

    /// Offer a frame without blocking the router on a slow downstream.
    pub fn try_send(&self, frame: Vec<u8>) -> Result<(), mpsc::error::TrySendError<Vec<u8>>> {
        self.sender.try_send(frame)
    }
}
