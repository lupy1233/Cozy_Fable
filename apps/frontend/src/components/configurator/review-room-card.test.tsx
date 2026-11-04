import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT_FLOW_VERSION, defaultPieceConfig, type RoomType } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import { ReviewRoomCard } from './review-room-card';

// cheia i18n ca text; linia de problema include si eticheta pasului, ca testul sa o poata vedea
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    key === 'review.issueRoomStep' && values ? `${key}:${String(values.step)}` : key,
}));

describe('new furniture review contracts', () => {
  it.each([['BED', 'PIECE_BED'], ['TABLE', 'PIECE_TABLE'], ['BENCH', 'PIECE_BENCH']] as const)('shows %s through the target config3d contract with full-answer disclosure', async (kind, roomType) => {
    const edit = vi.fn();
    render(<ReviewRoomCard room={{ localId: kind, roomType, flowVersion: CURRENT_FLOW_VERSION[roomType as RoomType], completed: true, answers: { config3d: defaultPieceConfig(kind), material: 'PAL' } }} attachments={[]} designHelp={false} onEdit={edit} />);
    expect(screen.getByRole('heading', { name: `rooms.type.${roomType}` })).toBeVisible();
    expect(screen.getAllByText('config3d.chips.size', { exact: false })[0]).toBeVisible();
    expect(screen.queryByText('config3d.chips.columns', { exact: false })).not.toBeInTheDocument();
    const disclosure = screen.getByText('review.rooms.allAnswers');
    await userEvent.click(disclosure);
    expect(disclosure.closest('details')).toHaveAttribute('open');
    await userEvent.click(screen.getByRole('button', { name: 'review.rooms.edit' }));
    expect(edit).toHaveBeenCalledOnce();
  });
  it('does not present derived defaults as chosen items for incomplete rooms', () => {
    render(<ReviewRoomCard room={{ localId: 'unfinished', roomType: 'PIECE_BED', flowVersion: 2, completed: false, answers: {} }} attachments={[]} designHelp={false} onEdit={() => {}} issue={{ problem: 'review.issueRoom' }} />);
    expect(screen.getByText('review.issueRoom')).toBeVisible();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
  it('names the blocking step and jumps to it with "Completeaza"', async () => {
    const fix = vi.fn();
    const edit = vi.fn();
    render(<ReviewRoomCard room={{ localId: 'k', roomType: 'KITCHEN', flowVersion: CURRENT_FLOW_VERSION.KITCHEN, completed: false, answers: {} }} attachments={[]} designHelp={false} onEdit={edit} issue={{ stepLabel: 'Dimensiuni', problem: 'validation.answerRequired' }} onFix={fix} />);
    expect(screen.getByText('review.issueRoomStep:Dimensiuni')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'review.fixRoom' }));
    expect(fix).toHaveBeenCalledOnce();
    expect(edit).not.toHaveBeenCalled();
  });
  it('shows no issue marker without an issue, even when the completed flag is stale', () => {
    render(<ReviewRoomCard room={{ localId: 'stale', roomType: 'PIECE_BED', flowVersion: 2, completed: false, answers: {} }} attachments={[]} designHelp={false} onEdit={() => {}} />);
    expect(screen.queryByRole('button', { name: 'review.fixRoom' })).not.toBeInTheDocument();
  });
});
