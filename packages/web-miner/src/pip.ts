// A Document Picture-in-Picture window (Chromium): the page's stylesheets are copied in, the caller
// renders into its body. Closing it, or the page, ends it.
export interface PipApi {
  requestWindow(o: { width: number; height: number }): Promise<Window>;
}

export const pipSupported = (w: Window = window): boolean => 'documentPictureInPicture' in w;

export async function openPip(w: Window = window): Promise<Window> {
  const api = (w as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;
  if (!api) throw new Error('Document Picture-in-Picture is not available in this browser');
  const pip = await api.requestWindow({ width: 320, height: 150 });
  for (const sheet of Array.from(w.document.styleSheets)) {
    try {
      const style = pip.document.createElement('style');
      style.textContent = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join('');
      pip.document.head.append(style);
    } catch {
      // A cross-origin sheet cannot be read; this app has none, and one must not end the loop.
    }
  }
  pip.document.documentElement.className = w.document.documentElement.className;
  return pip;
}
