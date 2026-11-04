import * as React from 'react';
import { icons, Package } from 'lucide-react';

// Rezolva un nume de icon (kebab-case din flow config) intr-un component lucide.
// Fallback: Package (evita crash daca un icon nu exista in versiunea instalata).
export function resolveConfiguratorIcon(name: string) {
  // Numele persistat in flow-urile vechi ramane stabil dupa redenumirea Lucide.
  const currentName = name === 'waves' ? 'waves-horizontal' : name;
  const pascal = currentName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return (icons as Record<string, React.ComponentType<{ className?: string }>>)[pascal];
}

export function ConfiguratorIcon({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  if (!name) return null;
  const Cmp = resolveConfiguratorIcon(name);
  const Resolved = Cmp ?? Package;
  return <Resolved className={className} />;
}
