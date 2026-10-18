'use client';
import * as React from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

// Dropzone — din prototip (.dropzone). Border dashed + hover accent-soft.
export function Dropzone({
  onFiles,
  label,
  hint,
  accept,
  multiple = true,
  className,
}: {
  onFiles?: (files: FileList) => void;
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
        if (e.dataTransfer.files?.length) onFiles?.(e.dataTransfer.files);
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
          if (e.target.files?.length) onFiles?.(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
