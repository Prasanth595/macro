# block-canvas

[Canvas Next](canvas-next/README.md) is the canvas editor for saved documents,
drive details, and embeds. It uses the pure TypeScript graphics package for
drawing, rich text/mentions, connectors, media, and document cards/embeds.

The frontend migrates legacy JSON on load and writes version 2 through the
existing storage endpoint after editing. The original JSON is retained in the
migration metadata. Unsupported legacy content and unknown versions show an
error without writing data. There is no legacy editor or downgrade path.

Embedded documents keep their existing persistence. SyncService integration is
deferred. See the [parity plan](../../../../../docs/GRAPHICS_PARITY.md) for
remaining collaboration, legacy-content support, and editing work.
