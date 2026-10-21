# Shared image editor

## What it is

The circular image editor used by channel details and Settings profile pictures.
It owns upload controls, file validation, crop/export, and lightbox interactions.

## Start here

- `image-editor.tsx`: controlled editor composition.
- `image-cropper.tsx`: CropperJS integration and PNG export.
- `create-image-preview.ts`: nested lightbox dismissal and focus.

## Boundaries

- Hosts own drafts, persistence, API calls, cache updates, and modal lifetime.
- Saved URLs are loaded once and inspected by GIF signature before cropping; reuse the fetched bytes and never infer format from URL suffixes.
- Local GIFs render through `pictureUrl` without re-encoding.
- Mount the preview dialog outside the editor step and guard parent dismissal with `preview.open()`.
- Load the editor and preview dialog lazily; do not import channel or Settings code here.

## Checks

- In `apps/web`: `bun run test src/components/ui/components/Dialog.test.tsx src/components/ui/components/ImperativeDialog.test.tsx`.
- Exercise both hosts in desktop and phone browsers: crop/upload, GIF preview, Save/Cancel, retry, and nested lightbox dismissal.
- In `apps/web`: `bun run check`.

## Gotchas

- Key the cropper by source so replacing an image destroys the previous cropper.
- Keep the original source through failed saves; unchanged existing pictures must not upload again.
- Parent responsive dialogs use `noOutsidePointerEvents={false}` while the lightbox owns pointer locking.
