import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HandoffPanel from '../HandoffPanel';

const { mockRefresh, mockGetSession, mockHandoffList, mockHandoffCreate, mockHandoffDownload } =
  vi.hoisted(() => ({
    mockRefresh: vi.fn(),
    mockGetSession: vi.fn(),
    mockHandoffList: vi.fn(),
    mockHandoffCreate: vi.fn(),
    mockHandoffDownload: vi.fn(),
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
    handoff: {
      list: mockHandoffList,
      create: mockHandoffCreate,
      download: mockHandoffDownload,
    },
  },
}));

const PACKET_ID = 'p1';

function session() {
  return { data: { session: { access_token: 'tok' } } };
}

beforeEach(() => {
  mockGetSession.mockResolvedValue(session());
  mockHandoffList.mockResolvedValue([]);
  mockHandoffCreate.mockResolvedValue({ export_id: 'e1', format: 'json_api' });
  mockHandoffDownload.mockResolvedValue({ url: 'https://example.com/dl' });
});

afterEach(() => vi.resetAllMocks());

describe('HandoffPanel disabled states', () => {
  it('disables export button when blockerCount > 0', async () => {
    render(<HandoffPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={2} />);
    const btn = screen.getByRole('button', { name: /export packet \(json/i });
    expect(btn).toBeDisabled();
  });

  it('disables export button when status is not in allowed set', async () => {
    render(<HandoffPanel packetId={PACKET_ID} packetStatus="Draft" blockerCount={0} />);
    const btn = screen.getByRole('button', { name: /export packet \(json/i });
    expect(btn).toBeDisabled();
  });

  it('shows reason text when status is wrong', async () => {
    render(<HandoffPanel packetId={PACKET_ID} packetStatus="In Navigator Review" blockerCount={0} />);
    expect(screen.getByText(/must be in "Ready for Handoff"/i)).toBeInTheDocument();
  });

  it('shows reason text when blockers are present', async () => {
    render(<HandoffPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={1} />);
    expect(screen.getByText(/resolve all readiness blockers/i)).toBeInTheDocument();
  });
});

describe('HandoffPanel enabled state', () => {
  it('enables export button when status=Ready for Handoff and blockerCount=0', async () => {
    render(<HandoffPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />);
    const btn = screen.getByRole('button', { name: /export packet \(json/i });
    expect(btn).not.toBeDisabled();
  });

  it('also enables when status=Handed Off and blockerCount=0', async () => {
    render(<HandoffPanel packetId={PACKET_ID} packetStatus="Handed Off" blockerCount={0} />);
    const btn = screen.getByRole('button', { name: /export packet \(json/i });
    expect(btn).not.toBeDisabled();
  });
});

describe('HandoffPanel export action', () => {
  it('calls api.handoff.create with packetId and format on click', async () => {
    render(<HandoffPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />);
    const btn = screen.getByRole('button', { name: /export packet \(json/i });
    fireEvent.click(btn);

    await waitFor(() => expect(mockHandoffCreate).toHaveBeenCalledTimes(1));
    expect(mockHandoffCreate).toHaveBeenCalledWith('tok', PACKET_ID, expect.objectContaining({ format: 'json_api' }));
  });

  it('re-fetches history after a successful export', async () => {
    render(<HandoffPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: /export packet \(json/i }));

    await waitFor(() => expect(mockHandoffList).toHaveBeenCalledTimes(2)); // once on mount, once after export
  });

  it('shows download button for json_api exports in prior exports list', async () => {
    mockHandoffList.mockResolvedValue([
      { export_id: 'e1', format: 'json_api', exported_at: '2026-05-17T00:00:00Z', storage_path: 'x', checksum_sha256: 'abc', agency_reference: null },
    ]);
    render(<HandoffPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument());
  });
});
