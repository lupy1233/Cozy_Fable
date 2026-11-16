import { Children, isValidElement, type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { initialPieceConfig } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import en from '@/messages/en.json';

// Etapa 9 (l1): butonul „Reincadreaza” al scenei 3D trimite o cheie noua camerei piesei.
const rig = vi.hoisted(() => ({ calls: [] as { reframeKey?: number; width: number }[] }));

vi.mock('./stable-orbit-camera', () => {
  function PieceCameraRig(props: { reframeKey?: number; width: number }) {
    rig.calls.push(props);
    return null;
  }
  return { PieceCameraRig };
});
vi.mock('@react-three/drei', () => ({ OrbitControls: () => null }));
vi.mock('@react-three/fiber', async () => {
  const camera = await import('./stable-orbit-camera');
  return {
    useThree: () => ({}),
    useFrame: () => undefined,
    // randam doar camera piesei (restul scenei e three.js, fara DOM)
    Canvas: ({ children }: { children: ReactNode }) => (
      <div data-testid="canvas">
        {Children.toArray(children).filter((c) => isValidElement(c) && c.type === camera.PieceCameraRig)}
      </div>
    ),
  };
});

import { PieceCanvas } from './piece-canvas';

function renderCanvas(locale: 'ro' | 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en}>
      <PieceCanvas kind="WARDROBE" config={initialPieceConfig('WARDROBE')} />
    </NextIntlClientProvider>,
  );
}

describe('PieceCanvas — Reincadreaza', () => {
  it('arata butonul (RO / EN) si la apasare cere o noua incadrare', () => {
    rig.calls.length = 0;
    renderCanvas('ro');
    const button = screen.getByRole('button', { name: ro.Configurator.config3d.reframeLabel });
    expect(button).toHaveTextContent('Reîncadrează');
    expect(rig.calls.at(-1)?.reframeKey).toBe(0);
    fireEvent.click(button);
    expect(rig.calls.at(-1)?.reframeKey).toBe(1);
    fireEvent.click(button);
    expect(rig.calls.at(-1)?.reframeKey).toBe(2);
  });

  it('eticheta in engleza', () => {
    renderCanvas('en');
    expect(screen.getByTestId('reframe-3d')).toHaveTextContent('Reframe');
  });
});
