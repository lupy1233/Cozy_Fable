import * as React from 'react';
import { icons, Package } from 'lucide-react';

// Rezolva un nume de icon (kebab-case din flow config) intr-un component lucide.
// Fallback: Package (evita crash daca un icon nu exista in versiunea instalata).
function toPascal(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

export function ConfiguratorIcon({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  if (!name) return null;
  const Cmp = (icons as Record<string, React.ComponentType<{ className?: string }>>)[
    toPascal(name)
  ];
  const Resolved = Cmp ?? Package;
  return <Resolved className={className} />;
}
