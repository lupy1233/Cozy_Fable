// Copiere in clipboard: API modern, cu fallback pe textarea + execCommand (HTTP / browsere vechi).
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // cade pe fallback
  }
  try {
    if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    try {
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(el);
    }
  } catch {
    return false;
  }
}
