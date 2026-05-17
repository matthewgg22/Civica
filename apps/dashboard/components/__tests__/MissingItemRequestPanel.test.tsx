import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MissingItemRequestPanel from '../MissingItemRequestPanel';

const { mockRefresh, mockGetSession, mockMissingItemsList, mockMissingItemsCreate, mockMissingItemsCancel } =
  vi.hoisted(() => ({
    mockRefresh: vi.fn(),
    mockGetSession: vi.fn(),
    mockMissingItemsList: vi.fn(),
    mockMissingItemsCreate: vi.fn(),
    mockMissingItemsCancel: vi.fn(),
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
    missingItems: {
      list: mockMissingItemsList,
      create: mockMissingItemsCreate,
      cancel: mockMissingItemsCancel,
    },
  },
}));

const PACKET_ID = 'p1';
const UNRESOLVED_ITEMS = [
  { item_id: 'i1', label: 'Proof of income', document_kind: 'paystub', resolved_at: null, waived_at: null },
];

function session() {
  return { data: { session: { access_token: 'tok' } } };
}

beforeEach(() => {
  mockGetSession.mockResolvedValue(session());
  mockMissingItemsList.mockResolvedValue([]);
  mockMissingItemsCreate.mockResolvedValue({ request_id: 'r-new', status: 'pending' });
  mockMissingItemsCancel.mockResolvedValue(undefined);
});

afterEach(() => vi.resetAllMocks());

describe('MissingItemRequestPanel validation', () => {
  it('shows validation error when neither item nor note is provided', async () => {
    render(<MissingItemRequestPanel packetId={PACKET_ID} unresolvedItems={UNRESOLVED_ITEMS} />);
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));
    await waitFor(() =>
      expect(screen.getByText(/pick a checklist item or enter a custom note/i)).toBeInTheDocument(),
    );
  });

  it('does NOT call api.missingItems.create when validation fails', async () => {
    render(<MissingItemRequestPanel packetId={PACKET_ID} unresolvedItems={UNRESOLVED_ITEMS} />);
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));
    await waitFor(() => expect(mockMissingItemsCreate).not.toHaveBeenCalled());
  });
});

describe('MissingItemRequestPanel POST shape', () => {
  it('sends bump_packet_status=true and the custom note', async () => {
    render(<MissingItemRequestPanel packetId={PACKET_ID} unresolvedItems={UNRESOLVED_ITEMS} />);
    const textarea = screen.getByPlaceholderText(/plain-language note/i);
    fireEvent.change(textarea, { target: { value: 'We need a pay stub from last month.' } });
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(mockMissingItemsCreate).toHaveBeenCalledTimes(1));
    expect(mockMissingItemsCreate).toHaveBeenCalledWith(
      'tok',
      PACKET_ID,
      expect.objectContaining({
        message_ciphertext: 'We need a pay stub from last month.',
        bump_packet_status: true,
      }),
    );
  });

  it('includes required_item_id when a checklist item is selected', async () => {
    render(<MissingItemRequestPanel packetId={PACKET_ID} unresolvedItems={UNRESOLVED_ITEMS} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'i1' } });
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(mockMissingItemsCreate).toHaveBeenCalledTimes(1));
    expect(mockMissingItemsCreate).toHaveBeenCalledWith(
      'tok',
      PACKET_ID,
      expect.objectContaining({ required_item_id: 'i1' }),
    );
  });
});

describe('MissingItemRequestPanel request list', () => {
  it('shows open requests after mount', async () => {
    mockMissingItemsList.mockResolvedValue([
      {
        request_id: 'r1',
        status: 'pending',
        sent_at: '2026-05-17T00:00:00Z',
        resolved_at: null,
        requested_by_staff_id: 'nav-001',
        required_document_items: { item_id: 'i1', label: 'Proof of income', document_kind: 'paystub' },
      },
    ]);
    render(<MissingItemRequestPanel packetId={PACKET_ID} unresolvedItems={UNRESOLVED_ITEMS} />);

    await waitFor(() => expect(screen.getByText('Proof of income')).toBeInTheDocument());
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it('shows "No requests sent yet" when list is empty', async () => {
    render(<MissingItemRequestPanel packetId={PACKET_ID} unresolvedItems={[]} />);
    await waitFor(() => expect(screen.getByText(/no requests sent yet/i)).toBeInTheDocument());
  });
});

describe('MissingItemRequestPanel cancel flow', () => {
  it('calls api.missingItems.cancel with the requestId', async () => {
    mockMissingItemsList.mockResolvedValue([
      {
        request_id: 'r1',
        status: 'pending',
        sent_at: '2026-05-17T00:00:00Z',
        resolved_at: null,
        requested_by_staff_id: 'nav-001',
        required_document_items: null,
      },
    ]);
    render(<MissingItemRequestPanel packetId={PACKET_ID} unresolvedItems={[]} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(mockMissingItemsCancel).toHaveBeenCalledWith('tok', 'r1'));
  });

  it('hides cancel button for resolved requests', async () => {
    mockMissingItemsList.mockResolvedValue([
      {
        request_id: 'r1',
        status: 'resolved',
        sent_at: '2026-05-17T00:00:00Z',
        resolved_at: '2026-05-17T01:00:00Z',
        requested_by_staff_id: 'nav-001',
        required_document_items: null,
      },
    ]);
    render(<MissingItemRequestPanel packetId={PACKET_ID} unresolvedItems={[]} />);

    await waitFor(() => expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument());
  });
});
