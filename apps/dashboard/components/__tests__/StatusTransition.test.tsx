import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import StatusTransition, { type Blocker } from '../StatusTransition';

const { mockRefresh, mockGetSession, mockPacketsUpdate } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockGetSession: vi.fn(),
  mockPacketsUpdate: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock('../../lib/supabase', () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    packets: {
      update: mockPacketsUpdate,
    },
  },
}));

const PACKET_ID = 'p1';
const BLOCKERS: Blocker[] = [
  { kind: 'missing_consent', label: 'Privacy notice consent not on file' },
  { kind: 'unresolved_docs', label: 'Required documents not yet resolved', count: 2 },
];

function session() {
  return { data: { session: { access_token: 'tok' } } };
}

beforeEach(() => {
  mockGetSession.mockResolvedValue(session());
  mockPacketsUpdate.mockResolvedValue({ status: 'Ready for Handoff' });
});

afterEach(() => vi.resetAllMocks());

// ── Blocker display ───────────────────────────────────────────────────────

describe('StatusTransition blocker display', () => {
  it('shows blocker list when advancing to Ready for Handoff with blockers', () => {
    render(
      <StatusTransition
        packetId={PACKET_ID}
        nextStatuses={['Ready for Handoff']}
        blockers={BLOCKERS}
      />,
    );
    expect(screen.getByText(/cannot advance to.*ready for handoff/i)).toBeInTheDocument();
    expect(screen.getByText('Privacy notice consent not on file')).toBeInTheDocument();
    expect(screen.getByText('Required documents not yet resolved')).toBeInTheDocument();
  });

  it('does NOT show blocker panel for other status transitions', () => {
    render(
      <StatusTransition
        packetId={PACKET_ID}
        nextStatuses={['In Navigator Review']}
        blockers={BLOCKERS}
      />,
    );
    expect(screen.queryByText(/cannot advance to.*ready for handoff/i)).not.toBeInTheDocument();
  });

  it('does NOT show blocker panel when blockers list is empty', () => {
    render(
      <StatusTransition
        packetId={PACKET_ID}
        nextStatuses={['Ready for Handoff']}
        blockers={[]}
      />,
    );
    expect(screen.queryByText(/cannot advance/i)).not.toBeInTheDocument();
  });
});

// ── Button state when Ready for Handoff is blocked ────────────────────────

describe('StatusTransition button disabled state', () => {
  it('disables "Ready for Handoff" button when blockers > 0', () => {
    render(
      <StatusTransition
        packetId={PACKET_ID}
        nextStatuses={['Ready for Handoff']}
        blockers={BLOCKERS}
      />,
    );
    const btn = screen.getByRole('button', { name: /ready for handoff/i });
    expect(btn).toBeDisabled();
  });

  it('enables button when status is not "Ready for Handoff"', () => {
    render(
      <StatusTransition
        packetId={PACKET_ID}
        nextStatuses={['In Navigator Review']}
        blockers={BLOCKERS}
      />,
    );
    const btn = screen.getByRole('button', { name: /in navigator review/i });
    expect(btn).not.toBeDisabled();
  });

  it('enables "Ready for Handoff" button when no blockers', () => {
    render(
      <StatusTransition
        packetId={PACKET_ID}
        nextStatuses={['Ready for Handoff']}
        blockers={[]}
      />,
    );
    const btn = screen.getByRole('button', { name: /ready for handoff/i });
    expect(btn).not.toBeDisabled();
  });
});

// ── Transition action ─────────────────────────────────────────────────────

describe('StatusTransition action', () => {
  it('calls api.packets.update with the status on button click', async () => {
    render(
      <StatusTransition
        packetId={PACKET_ID}
        nextStatuses={['In Navigator Review']}
        blockers={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /in navigator review/i }));
    await waitFor(() => expect(mockPacketsUpdate).toHaveBeenCalledTimes(1));
    expect(mockPacketsUpdate).toHaveBeenCalledWith(
      'tok',
      PACKET_ID,
      { status: 'In Navigator Review' },
      undefined,
    );
  });

  it('passes the transition reason when the input is filled', async () => {
    render(
      <StatusTransition
        packetId={PACKET_ID}
        nextStatuses={['In Navigator Review']}
        blockers={[]}
      />,
    );
    const input = screen.getByPlaceholderText(/why are you moving/i);
    fireEvent.change(input, { target: { value: 'Documents received' } });
    fireEvent.click(screen.getByRole('button', { name: /in navigator review/i }));

    await waitFor(() => expect(mockPacketsUpdate).toHaveBeenCalledTimes(1));
    expect(mockPacketsUpdate).toHaveBeenCalledWith(
      'tok',
      PACKET_ID,
      { status: 'In Navigator Review' },
      'Documents received',
    );
  });

  it('calls router.refresh after successful transition', async () => {
    render(
      <StatusTransition
        packetId={PACKET_ID}
        nextStatuses={['In Navigator Review']}
        blockers={[]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /in navigator review/i }));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });
});
