# Download interaction and delivery specification

Status: proposal, 23 October 2026. Read with the [journey map](README.md) and
[interactive concept](index.html). The concept simulates transfers and system UI.

## Interaction contract

Every eligible file has an explicit action with a visible verb, a useful filename,
and a recoverable outcome. The same action works from a channel message, the
expanded viewer, and the file's Drive view. Viewing access must be checked by the
existing authorized file fetch; adding a button must not change access rules.

| Surface | Desktop | Phone |
| --- | --- | --- |
| Single channel video | Download in the file strip below the video | Save or share… in the same strip |
| Expanded image or video | Labeled Download beside the viewer controls | Save or share… in the viewer's reachable action area |
| Open file in Drive | Download beside Share | Save or share… remains visible in the file header or bottom action area |
| Single selected Drive file, next slice | Download in the selection toolbar | Save or share… for the selected file |
| Editable document | Download as… only when there is a real format choice | Format choice, then save/share destination |

Do not make hover, right-click, a keyboard shortcut, or opening a menu the only
way to discover the action. Preserve current menu routes for familiar users.
Use a visible label and an accessible name that includes the file where useful.
Allow at least a 44 by 44 CSS-pixel touch target, keyboard activation, visible
focus, and screen-reader status announcements. Restore focus after a sheet closes.
Keep controls outside the video playback hit area.

## File identity

- Prefer the original name and extension for an existing upload. Show type and
  size only when known. Long names truncate visually but remain accessible.
- Retrieve verified metadata through the existing service-client layer. The
  current channel `MediaItem` does not carry name, MIME type, or size, although the
  upload path captures these on pending attachments. Trace persistence and API
  responses before promising that old attachments can recover original names.
- If the original name is unavailable, show a descriptive label such as “Video
  attachment.” For the saved name, use a safe fallback with an extension derived
  from verified MIME metadata, not a guessed `.mp4` on every video.
- Remove path separators and unsafe control characters from download names.
  Let the system handle duplicate destination filenames.
- Default to the original bytes, not a thumbnail or video transcode. The file
  type in the label must match the actual content.

## State and copy matrix

| State | Visible copy | Available action | Transition rule |
| --- | --- | --- | --- |
| Ready, desktop | Download | Start | Set busy immediately before fetching |
| Ready, phone | Save or share… | Choose Save or Share file | Preserve the current file while the sheet is open |
| Preparing | Preparing launch-demo.mp4… | Cancel | No invented percentage; use indeterminate feedback until bytes are known |
| Receiving bytes | Downloading launch-demo.mp4 · 18 MB of 42 MB | Cancel | Percentage only when a reliable total exists |
| Browser dispatch | Download started · Check your browser's downloads. Your browser controls where files are saved. | Dismiss; Where is my file? | Do not claim a disk save or hardcode Downloads as the destination |
| Mac app handoff without save confirmation | Download requested · Check your app's download destination. | Dismiss; help matched to verified Mac behavior | Final wording and destination require a Mac smoke check |
| Native save chooser open | Choose where to save launch-demo.mp4 | System controls | Macro stays pending until the adapter returns |
| Confirmed native save | Saved launch-demo.mp4 | Dismiss | Only after the native adapter confirms the write |
| Share sheet presented | Choose an app to share launch-demo.mp4 | System controls | Do not say Sent or Saved merely because the sheet opened |
| Share handoff returned without delivery receipt | Returned to Macro | Dismiss | Share completion does not prove a recipient received the file |
| User canceled | Save canceled / Download canceled | Try again | No error toast and no completion event |
| Fetch or save failed | Couldn't save launch-demo.mp4. Try again. | Retry | Preserve file identity; retry starts one new attempt |
| File unavailable or access revoked | This file is no longer available to you. | Dismiss | No automatic retry loop; never bypass access checks |

The current `downloadFile` return type conflates browser dispatch with a saved
file and collapses cancellation/failure into a boolean. Before standardizing
success copy across callers, evolve the outcome contract to distinguish handoff,
confirmed save, cancellation, and failure. Adapt existing callers together.
Use only outcomes each platform can actually report.

## Mobile saving and sharing

| Platform | Save intent | Share intent | Dependency |
| --- | --- | --- | --- |
| iOS native | Save to Files… leading to a verified native export destination | Share file… leading to the system share sheet | Verify or implement the file-export bridge; the shared helper currently has no iOS-specific path |
| Android native | Save to device… leading to the system document picker | Share file… leading to the native chooser | Reuse `exportAndroidFileWithProgress` with save/share actions |
| Mobile browser | Download using a verified browser path | Share file… only if runtime file-sharing support is available | Detect support, handle cancellation, and preserve a working save route |

Do not show a dead share button when file sharing is unsupported. If a browser
requires a fresh user gesture after file preparation, show a Ready to share button
that opens the system sheet on that tap. An unsupported native platform needs a
tested fallback before the action ships. Save to Photos is separate future work;
do not imply that saving to Files adds media to the photo library.

## Implementation slices

### 1. Resolve the channel video gap

Add a labeled action to the message file strip and `MediaViewerDialog`. Keep media
navigation and playback unchanged; download the current attachment. Reuse the
authorized original-file path through service clients. Thread verified metadata
through `MediaItem` or resolve it on demand; old attachments retain a safe fallback.

Entry points:

- `apps/web/src/features/channel/Media/MediaGrid.tsx`
- `apps/web/src/features/channel/Media/MediaViewerDialog.tsx`
- `apps/web/src/features/channel/Media/media-items.ts`
- `apps/web/src/features/channel/Message/MediaPreview.tsx`
- `apps/web/src/features/channel/Input/upload-attachments.ts`

Acceptance: a viewer can save a video from both the message and expanded viewer;
the chosen file has matching bytes and extension; permission loss, network failure,
repeated taps, and canceling do not produce a false success or duplicate operation.
Closing the viewer must not silently lose active transfer feedback.

### 2. Make Drive's existing action visible

Promote the open file's existing download operation into its header. Reuse the
operation rather than adding a second implementation. Check the standalone video
block as well as Drive detail so opening the same file in another split preserves
the action. Follow with the single-selected-file toolbar route; keep bulk/folder
eligibility out of the single-file release.

Entry points:

- `apps/web/src/features/drive-view/views/VideoDetail.tsx`
- `apps/web/src/features/drive-view/components/file-detail-operations.tsx`
- `apps/web/src/features/drive-view/views/FileDetailBreadcrumbItem.tsx`
- `apps/web/src/features/drive-view/components/DriveDetailView.tsx`
- `apps/web/src/features/block-video/component/TopBar.tsx`
- `apps/web/src/components/app/ResponsiveBlockToolbar.tsx`

Acceptance: the action is visible with the file open, even in a narrow split;
the menu route still works; unsupported document formats do not appear.

### 3. Unify outcomes and mobile destinations

Centralize the outcome semantics at the existing filesystem boundary, with a
shared status presentation that is usable outside Drive. Reuse Android's native
adapter. Verify iOS and Mac behavior in their actual clients before fixing the
final destination wording. Trace whether the channel transport can cancel an
active fetch and handle large files without excessive Blob buffering; make
cancel and progress promises match the underlying transport.

Entry points:

- `apps/web/src/lib/filesystem/download.ts`
- `apps/web/src/features/drive-view/util/download-with-progress.tsx`
- `apps/web/src/lib/core/mobile/androidFiles.ts`
- `apps/web/src/lib/core/mobile/exportAndroidFileWithProgress.ts`

Acceptance: cancel is neutral; unsupported share destinations are not offered;
an Android save confirms only after native success; browser dispatch says Download
started; failed file writes remain errors. Test on actual iOS and Android clients,
and Mac app plus supported desktop browsers. Browser emulation alone cannot prove
native saving or sharing.

## Validation and measurement

For implementation, cover the meaningful boundaries: original vs thumbnail bytes,
current media after navigation, filename fallbacks, permission failures, unknown
content length, interrupted transfers, duplicate clicks, native cancellation, and
native failure. Exercise keyboard and touch flows and long filenames in narrow
splits. Use small and large media, including a size that exposes mobile memory
pressure. Do not use synthetic progress as evidence of a working transfer.

Proposed events: action seen, action started, preparation ready, handoff dispatched,
save confirmed where observable, canceled, and failed. Attach only surface,
platform, media kind, coarse size bucket, duration, and normalized error category.
Do not log filenames, file content, local paths, or signed URLs. Use the existing
instrumentation conventions when implementing this flow.

Track starts per eligible action impression, preparation failure rate, repeated
starts, and native confirmed saves per start. Keep browser handoff and confirmed
native saving as different metrics. No baseline or improvement percentage has
been measured for this proposal.

## Decisions to resolve before implementation

1. Which original metadata survives for existing static video attachments, and
   which authorized endpoint exposes it?
2. Which native export/share bridge can iOS support today, and what does it report
   for dismissal, save completion, and failures?
3. Where does the shipped Mac app place an anchor-triggered download, and can it
   report a confirmed save or reveal the file? Do not promise Show in Finder yet.
4. What transport handles the largest supported videos without a memory spike?
   Use that evidence to set file-size behavior, not an invented limit.

These decisions affect implementation details. They do not change the main
product decision: make getting a file onto a device visible and understandable.
