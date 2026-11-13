import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { localRejectReason } from '@/lib/attachment-upload';
import { Dropzone } from './dropzone';

const MB = 1024 * 1024;
function fileOf(name: string, type: string, size: number): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

// b5: fisierele trase cu mouse-ul nu trec prin atributul accept → verificarea e in zona de incarcare
describe('Dropzone validate (b5)', () => {
  it('splits dropped files into accepted and rejected with the reason', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    const onFiles = vi.fn();
    render(<Dropzone label="Drop" validate={localRejectReason} onAccept={onAccept} onReject={onReject} onFiles={onFiles} />);
    const txt = fileOf('note.txt', 'text/plain', 10);
    const big = fileOf('big.pdf', 'application/pdf', 30 * MB);
    const empty = fileOf('empty.pdf', 'application/pdf', 0);
    const noType = fileOf('plan.PDF', '', 2048);
    const heic = fileOf('poza.heic', '', 2048);
    fireEvent.drop(screen.getByRole('button'), { dataTransfer: { files: [txt, big, empty, noType, heic] } });
    expect(onReject).toHaveBeenCalledWith([
      { file: txt, reason: 'TYPE' },
      { file: big, reason: 'SIZE' },
      { file: empty, reason: 'EMPTY' },
      { file: heic, reason: 'TYPE' },
    ]);
    expect(onAccept).toHaveBeenCalledWith([noType]);
    // apelantii vechi primesc in continuare lista bruta
    expect(onFiles).toHaveBeenCalledTimes(1);
  });

  it('does not call onAccept when every file is rejected', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(<Dropzone label="Drop" validate={localRejectReason} onAccept={onAccept} onReject={onReject} />);
    fireEvent.drop(screen.getByRole('button'), { dataTransfer: { files: [fileOf('a.exe', 'application/x-msdownload', 10)] } });
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });
});
