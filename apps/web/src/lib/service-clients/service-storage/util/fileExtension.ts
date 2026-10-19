/**
 * Gets the extension of a filename, or undefined when it has no extension.
 */
export function fileExtension(
  filename: string | undefined
): string | undefined {
  if (!filename) return undefined;
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex === -1
    ? undefined
    : filename.substring(lastDotIndex + 1).toLowerCase();
}
