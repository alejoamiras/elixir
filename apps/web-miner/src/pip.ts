// A Document Picture-in-Picture window (Chromium): the page's styles are carried over, the caller
// renders into its body. Closing it, or the page, ends it.
export interface PipApi {
  requestWindow(o: { width: number; height: number }): Promise<Window>;
}

export const pipSupported = (w: Window = window): boolean => 'documentPictureInPicture' in w;

export const PIP_SIZE = { width: 360, height: 190 };

/**
 * Copies the page's styles into the pop-out. Linked stylesheets are re-linked by URL so their relative
 * `url()`s (the self-hosted font files) resolve against the sheet, not against the pop-out's document, which
 * has no base and whose CSP forbids one; inline `<style>` elements (Radix, Sonner, the dev server) are copied
 * as text.
 */
export function copyStyles(from: Document, to: Document): void {
  for (const node of Array.from(from.querySelectorAll('link[rel="stylesheet"], style'))) {
    if (node instanceof HTMLLinkElement) {
      const link = to.createElement('link');
      link.rel = 'stylesheet';
      link.href = node.href;
      to.head.append(link);
    } else {
      const style = to.createElement('style');
      style.textContent = node.textContent;
      to.head.append(style);
    }
  }
  to.documentElement.className = from.documentElement.className;
}

export async function openPip(w: Window = window): Promise<Window> {
  const api = (w as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;
  if (!api) throw new Error('Document Picture-in-Picture is not available in this browser');
  const pip = await api.requestWindow(PIP_SIZE);
  copyStyles(w.document, pip.document);
  return pip;
}
