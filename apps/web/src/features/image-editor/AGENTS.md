# Shared image editor

## What it is

The circular image editor used by channel details and Settings profile pictures.
It owns upload controls, file validation, crop/export, and lightbox interactions.

## Start here

- `views/image-editor.tsx`: controlled editor composition.
- `components/image-cropper.tsx`: CropperJS integration and PNG export.
- `primitives/create-image-preview.ts`: nested lightbox dismissal and focus.

## Boundaries

- Hosts own drafts, persistence, API calls, cache updates, and modal lifetime.
- Saved URLs are loaded once and inspected by GIF signature before cropping; reuse the fetched bytes and never infer format from URL suffixes.
- Local GIFs render through `pictureUrl` without re-encoding.
- Mount the preview dialog outside the editor step and guard parent dismissal with `preview.open()`.
- Load the editor and preview dialog lazily; do not import channel or Settings code here.

## Checks

- In `apps/web`: `bun run test src/features/channel/components/channel-picture-cropper.test.ts src/features/settings/profile-picture.test.ts src/features/image-editor/image-source.test.ts`.
- In `apps/web`: `bun run check`.

## Gotchas

- Key the cropper by source so replacing an image destroys the previous cropper.
- Keep the original source through failed saves; unchanged existing pictures must not upload again.
- Parent responsive dialogs use `noOutsidePointerEvents={false}` while the lightbox owns pointer locking.
