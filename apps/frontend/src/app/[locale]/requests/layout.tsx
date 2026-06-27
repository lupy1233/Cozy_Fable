import type { ReactNode } from 'react';
import { AppShell } from '../_components/app-shell';

export default function RequestsLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
