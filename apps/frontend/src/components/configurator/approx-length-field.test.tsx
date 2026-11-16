import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { CURRENT_FLOW_VERSION } from '@marketplace/shared';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import ro from '@/messages/ro.json';
import { useConfiguratorStore, type RoomInstance } from '@/stores/configurator-store';
import { ApproxLengthField, ApproxLengthNote, needsApproxLength } from './approx-length-field';

// d3 (etapa 5, PO d3-2): "Lungime aproximativa (m)" cu "Am deja un proiect"
const s = () => useConfiguratorStore.getState();
const kitchen = (): RoomInstance => ({
  localId: 'k', roomType: 'KITCHEN', flowVersion: CURRENT_FLOW_VERSION.KITCHEN, answers: {}, completed: false,
});

function loadOwnProject() {
  s().loadSnapshot({
    phase: 'rooms', startMode: 'OWN_PROJECT', roomInstances: [kitchen()], activeRoomIndex: 0, activeStepIndex: 0,
    details: { hasOwnProject: true }, inspirationPhotoIds: [], updatedAt: Date.now(),
  });
}

function Field() {
  const room = useConfiguratorStore((st) => st.roomInstances[0]);
  return room ? <ApproxLengthField room={room} /> : null;
}

const renderRo = (ui: ReactElement) =>
  render(<NextIntlClientProvider locale="ro" messages={ro}>{ui}</NextIntlClientProvider>);

describe('needsApproxLength', () => {
  it('only with own project and a skipped dimensions step', () => {
    expect(needsApproxLength(kitchen(), true)).toBe(true);
    expect(needsApproxLength(kitchen(), false)).toBe(false);
    // canapeaua nu are pas de dimensiuni (lungimea vine din configuratia 3D)
    const sofa: RoomInstance = { localId: 's', roomType: 'PIECE_SOFA', flowVersion: CURRENT_FLOW_VERSION.PIECE_SOFA, answers: {}, completed: false };
    expect(needsApproxLength(sofa, true)).toBe(false);
  });
});

describe('ApproxLengthField', () => {
  beforeEach(() => {
    localStorage.clear();
    s().reset();
    loadOwnProject();
  });

  it('"8,5" reaches the store as 8.5; clearing removes it', () => {
    renderRo(<Field />);
    const input = screen.getByLabelText(ro.Configurator.approxLength.label);
    fireEvent.change(input, { target: { value: '8,5' } });
    expect(s().roomInstances[0].approxLengthM).toBe(8.5);
    fireEvent.change(input, { target: { value: '' } });
    expect(s().roomInstances[0].approxLengthM).toBeUndefined();
  });

  it('invalid text does not leave an old value behind', () => {
    renderRo(<Field />);
    const input = screen.getByLabelText(ro.Configurator.approxLength.label);
    fireEvent.change(input, { target: { value: '6' } });
    expect(s().roomInstances[0].approxLengthM).toBe(6);
    fireEvent.change(input, { target: { value: '6,5,1' } });
    expect(s().roomInstances[0].approxLengthM).toBeUndefined();
    expect(screen.getByText(ro.Configurator.validation.notANumber)).toBeVisible();
    // in afara intervalului: nici atunci nu ramane valoarea veche
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.change(input, { target: { value: '80' } });
    expect(s().roomInstances[0].approxLengthM).toBeUndefined();
  });

  // m7: cel mult 2 zecimale, ca serverul — fara rotunjire pe tacute
  it('"2,345" shows an error and sends nothing', () => {
    renderRo(<Field />);
    const input = screen.getByLabelText(ro.Configurator.approxLength.label);
    fireEvent.change(input, { target: { value: '2,34' } });
    expect(s().roomInstances[0].approxLengthM).toBe(2.34);
    fireEvent.change(input, { target: { value: '2,345' } });
    expect(s().roomInstances[0].approxLengthM).toBeUndefined();
    expect(screen.getByRole('alert')).toHaveTextContent(ro.Configurator.validation.approxLengthTooManyDecimals);
  });

  it('is not offered when hidden dimensions already give a length', () => {
    expect(needsApproxLength({ ...kitchen(), answers: { dimensions: { runA: 1.5 } } }, true)).toBe(false);
  });

  it('leaving "I already have a project" clears the value', () => {
    renderRo(<Field />);
    fireEvent.change(screen.getByLabelText(ro.Configurator.approxLength.label), { target: { value: '8,5' } });
    s().setStartMode('STANDARD');
    expect(s().roomInstances[0].approxLengthM).toBeUndefined();
  });
});

describe('ApproxLengthNote', () => {
  it('formats with a Romanian comma', () => {
    const { container } = renderRo(<ApproxLengthNote value={6.5} />);
    expect(container.textContent).toBe('Lungime aproximativă: 6,5 m');
  });
});
