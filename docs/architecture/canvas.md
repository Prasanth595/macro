# Canvas architecture

## AI editing

Ask Macro in the Drive header and standalone title menu attaches the canvas to the agent composer.
Documents owns `ReadCanvas` and `EditCanvas`, checked view/edit receipts, native
file-type validation, scoped actor-bearing document tokens, AI admission and
usage metering. Its existing tool context registers them for chat, agent
sessions and MCP; the toolset framework is unchanged.

`POST /canvas` on the AI editing worker joins the initialized shared scene using
the collaboration manager, sync engine and WAL. The model reads stable IDs,
containment/order, local/world transforms and bounds, then generates JavaScript
for `CanvasEditor` in bounded QuickJS. The host parses and validates operations,
executes a complete snippet on a disposable graphics editor, and commits its
delta once through the externally owned live Loro backend. It reads current
merged state immediately before that commit. Each snippet waits for a server
acknowledgement; an uncertain write stops the model and requires rereading
before another request. Earlier acknowledged snippets survive cancellation;
there is no transactional rollback of a whole model run.

The SDK supports boxes, text, bound connectors, world-space movement, box
resizing, styles, plain-text labels, grouping, reparenting and sibling ordering.
Existing embedded assets can move/resize/style, but new assets and reference
deletion stay in Canvas's authorized upload/mention lifecycle. Label content
remains one LWW string encoded by the shared Lexical codec, independent of pose
and appearance. Headless label heights are estimated; text shapes have explicit
layout dimensions. Initialization remains first-editor-wins in the web host;
tools ask users to open uninitialized legacy canvases rather than minting a
second seed. The scene overview is bounded to 300 items, with stable-ID filters
for inspecting items beyond that overview.

Canvas Next is the Macro host for a reusable graphics engine. The host owns
product UI and services; `@macro-inc/graphics` owns the portable scene and editing
model.

## Layers

| Layer | Responsibility |
| --- | --- |
| Canvas Next | Toolbars, inspectors, Lexical, assets, permissions, persistence, migration, and Macro embeds |
| Graphics core | Immutable document tree, affine geometry, queries, commands, selection, and local history |
| Browser adapter | Pointer, keyboard, clipboard, drag/drop, and capture behavior |
| Solid adapter | Read-only rendering and editor overlays with stable component identity |
| Loro adapter | Optional CRDT mapping, collaborative undo, and ephemeral presence |

## State boundaries

- The document stores stable IDs, ordered containment, local transforms, typed
  shape data, appearance, and durable references.
- The editor session stores selection, active tool, gesture previews, and history.
- The view stores camera, hover, focus, and other local-only state.
- Gestures preview transient state and commit one validated command when complete.

Graphics treats rich text as opaque content and assets as stable references. It
must not depend on Macro services, Lexical, the DOM, Solid, object URLs, or theme
variables. Canvas adapters resolve those concerns at the edge.

JSON is the import/export boundary and original migration seed. Once initialized,
the authoritative scene is a Loro document in SyncService. The Canvas host uses
the shared collaboration engine, local snapshot/WAL and permission-token transport;
the graphics adapter binds to that host-owned document and owns only scene history.
Only editors initialize rooms; viewers and nested canvases receive live changes
without editing. The server's serialized initializer chooses a single seed.
Copying preserves both the live room and original JSON, and downloads serialize
the current shared scene. Whole-file saves no longer run for canvas edits.

Shared presence carries cursors, selections and pending gestures on the runtime's
awareness channel, independently of document history. Geometry conflicts choose
one coherent pose; text/labels choose one complete content string. Remote commits
cancel local scene previews. Character-level text collaboration and gesture-intent
rebasing are separate work. No production participant limit has been measured.

## Principles

- Keep one authoritative representation for structure and transforms.
- Preserve world pose when moving items through the scene tree.
- Validate commands atomically and keep derived indexes out of saved data.
- Add capabilities through typed definitions and explicit adapters.
- Keep application migration and compatibility logic outside graphics core.

See the [graphics package README](../../packages/graphics/README.md),
[scene foundation](graphics-scene-foundation.md),
[Canvas Next README](../../apps/web/src/features/block-canvas/README.md),
and [collaboration notes](../../packages/graphics/src/loro/README.md).


### AI vision, fitting and parallel presentation

The Documents domain authorizes ReadCanvas/RenderCanvas/EditCanvas; the editing
worker joins the winning room seed. RenderCanvas freezes the canonical scene and
clock, sends it to an isolated real Canvas/StaticLexical render surface, and returns
native PNG content with revision/crop/object mapping. The browser loads only the
configured app bundle and fonts; embedded references are explicitly unavailable.
No render connects to sync or edits the scene. The agent adapter promotes only an
explicit bounded modelMedia envelope into native image content and rehydrates it
on history replay. Telemetry redacts image pixels.

An editing supervisor can delegate to two concurrent named writers. Actual command
reads/writes, hierarchy, connector dependencies, order and occupied regions govern
scheduling. Each batch validates, asynchronously measures text with the browser's
real TextMeasurer, presents transient awareness frames, pulls a server update barrier, then revalidates and commits
once through the canonical session's ACK queue. Human interference rejects stale
work. This coordination is session-local, not a distributed lock across independent
AI requests. Native CRDT merging and fresh dependency validation still apply there.
Requested fonts remain readable by default: persistent grow fitting increases box
height at the wrapping width; deliberate fixed sizes opt into contain or error.
Visual work receives an image before planning and a bounded final visual review.

Native creation follows the markdown lifecycle: create metadata, initialize the
canonical browser-generated `static_assets/canvas-golden.1.bin` snapshot, then mark
content ready in SyncService before returning. Manual creation and the empty
Canvas CreateDocument tool use this path; the tool rejects nonempty content before
creation and directs population through EditCanvas. Failed initialization or ready-state
updates compensate the possibly created room and metadata. The block selects
content location before requesting a blob through one Canvas query shared by the
Drive detail and block hosts, preserving legacy S3 migration.
Room existence requires an actual snapshot: a WebSocket connection alone never
marks an empty room initialized. Worker readiness errors distinguish a missing
snapshot from an initial-sync connection failure.
