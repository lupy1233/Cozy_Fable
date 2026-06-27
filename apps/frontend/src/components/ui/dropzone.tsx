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

  return (
    <div
      onClick={() => inputRef.current?.click()}
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
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-2 bg-surface-2 px-6 py-8 text-center transition-colors',
        over ? 'border-walnut bg-walnut-soft' : 'hover:border-muted-2 hover:bg-walnut-soft/50',
        className,
      )}
    >
      <UploadCloud className="h-6 w-6 text-muted-foreground" />
      <div className="text-sm font-medium">{label}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => e.target.files?.length && onFiles?.(e.target.files)}
      />
    </div>
  );
}
