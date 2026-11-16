'use client';
import * as React from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DropzoneRejection<R extends string = string> {
  file: File;
  reason: R;
}

// Dropzone — din prototip (.dropzone). Border dashed + hover accent-soft.
// b5: cu `validate`, fisierele (alese SAU trase cu mouse-ul — atributul accept nu filtreaza
// drag & drop) se impart inainte de trimitere: `onAccept` primeste doar fisierele bune,
// `onReject` pe cele refuzate cu motivul. `onFiles` ramane lista bruta (apelanti vechi).
export function Dropzone<R extends string = string>({
  onFiles,
  onAccept,
  onReject,
  validate,
  label,
  hint,
  accept,
  multiple = true,
  className,
}: {
  onFiles?: (files: FileList) => void;
  onAccept?: (files: File[]) => void;
  onReject?: (rejected: DropzoneRejection<R>[]) => void;
  validate?: (file: File) => R | null;
  label: React.ReactNode;
  hint?: React.ReactNode;
  accept?: string;
  multiple?: boolean;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const labelId = React.useId();
  const hintId = React.useId();

  const handle = (list: FileList) => {
    onFiles?.(list);
    if (!onAccept && !onReject) return;
    const accepted: File[] = [];
    const rejected: DropzoneRejection<R>[] = [];
    for (const file of Array.from(list)) {
      const reason = validate?.(file) ?? null;
      if (reason) rejected.push({ file, reason });
      else accepted.push(file);
    }
    if (rejected.length > 0) onReject?.(rejected);
    if (accepted.length > 0) onAccept?.(accepted);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-labelledby={labelId}
      aria-describedby={hint ? hintId : undefined}
      onClick={(event) => {
        if (event.target !== inputRef.current) inputRef.current?.click();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files?.length) handle(e.dataTransfer.files);
      }}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-2 bg-surface-2 px-6 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-walnut focus-visible:ring-offset-2',
        over ? 'border-walnut bg-walnut-soft' : 'hover:border-muted-2 hover:bg-walnut-soft/50',
        className,
      )}
    >
      <UploadCloud aria-hidden className="h-6 w-6 text-muted-foreground" />
      <div id={labelId} className="text-sm font-medium">{label}</div>
      {hint && <div id={hintId} className="text-xs text-muted-foreground">{hint}</div>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handle(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
