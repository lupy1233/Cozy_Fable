// Salveaza un Blob ca fisier (ancora temporara cu `download`); URL-ul obiect se elibereaza dupa
// cateva secunde (revocarea imediata poate anula descarcarea in unele browsere).
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
