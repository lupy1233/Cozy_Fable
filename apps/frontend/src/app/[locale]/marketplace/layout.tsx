import type { ReactNode } from 'react';
import { AppShell } from '../_components/app-shell';

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
