/** Quill can edit text formatting, but cannot round-trip custom HTML layouts. */
export function requiresHtmlEditing(html: string): boolean {
  const document = new DOMParser().parseFromString(html, 'text/html');
  if (document.head.querySelector('style')) return true;
  const tags = new Set([
    'P',
    'BR',
    'SPAN',
    'STRONG',
    'B',
    'EM',
    'I',
    'U',
    'S',
    'A',
    'IMG',
    'UL',
    'OL',
    'LI',
    'BLOCKQUOTE',
    'SUB',
    'SUP',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
  ]);
  const attributes = new Set([
    'style',
    'href',
    'target',
    'rel',
    'src',
    'alt',
    'width',
    'height',
  ]);
  const styles = new Set([
    'color',
    'background-color',
    'font-family',
    'font-size',
  ]);
  for (const element of document.body.querySelectorAll<HTMLElement>('*')) {
    if (!tags.has(element.tagName)) return true;
    if (
      [...element.attributes].some(
        (attribute) => !attributes.has(attribute.name)
      )
    )
      return true;
    for (const property of element.style) {
      // The editor adds this explicitly to match its line spacing in emails.
      if (property === 'margin' && element.style.margin === '0px') continue;
      if (!styles.has(property)) return true;
    }
  }
  return false;
}
