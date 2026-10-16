export const CHANNEL_PICTURE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export function channelPictureFileError(file: File): string | undefined {
  if (!CHANNEL_PICTURE_MIME_TYPES.includes(file.type) || file.size === 0) {
    return 'Choose a PNG, JPG, WebP, or GIF image';
  }
  if (file.size > 16 * 1000 * 1000) {
    return 'Choose an image smaller than 16 MB';
  }
}
