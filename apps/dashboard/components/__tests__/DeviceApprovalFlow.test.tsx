import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DeviceApprovalFlow from '../DeviceApprovalFlow';

// vi.hoisted() so these mock fns exist when the vi.mock factories below run
// (factories are hoisted above imports). Matches MissingItemRequestPanel.test.
const { mockGetSession, mockLookup, mockApprove, mockDeny } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockLookup: vi.fn(),
  mockApprove: vi.fn(),
  mockDeny: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}));

vi.mock('../../lib/api', () => ({
  api: {
    oauth: {
      lookup: mockLookup,
      approve: mockApprove,
      deny: mockDeny,
    },
  },
}));

const PENDING_LOOKUP = {
  status: 'pending',
  client_label: 'Chrome on macOS',
  expires_at: '2999-01-01T00:00:00Z',
};

function session() {
  return { data: { session: { access_token: 'tok' } } };
}

beforeEach(() => {
  mockGetSession.mockResolvedValue(session());
  mockLookup.mockResolvedValue(PENDING_LOOKUP);
  mockApprove.mockResolvedValue({ approved: true });
  mockDeny.mockResolvedValue({ denied: true });
});

afterEach(() => vi.resetAllMocks());

// Helper: type a complete 8-char code into the input.
function typeCode(value: string) {
  const input = screen.getByLabelText(/connection code/i);
  fireEvent.change(input, { target: { value } });
  return input;
}

describe('DeviceApprovalFlow — enter → lookup → confirm', () => {
  it('renders the code-entry form initially', () => {
    render(<DeviceApprovalFlow initialUserCode={null} signedInEmail="nav@civica.test" />);
    expect(screen.getByText(/enter the code from your browser/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/connection code/i)).toBeInTheDocument();
  });

  it('keeps Continue disabled until the code is 8 characters', () => {
    render(<DeviceApprovalFlow initialUserCode={null} signedInEmail={null} />);
    const button = screen.getByRole('button', { name: /continue/i });
    expect(button).toBeDisabled();
    typeCode('ABCD');
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    typeCode('ABCD2345');
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });

  it('looks up the typed code and shows the confirm screen', async () => {
    render(<DeviceApprovalFlow initialUserCode={null} signedInEmail="nav@civica.test" />);
    typeCode('ABCD2345');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(mockLookup).toHaveBeenCalledTimes(1));
    // Sends the JWT + the dash-formatted code; server strips the dash.
    expect(mockLookup).toHaveBeenCalledWith('tok', 'ABCD-2345');

    await waitFor(() =>
      expect(screen.getByText(/connect this browser extension\?/i)).toBeInTheDocument(),
    );
    // client_label surfaced as the device line.
    expect(screen.getByText('Chrome on macOS')).toBeInTheDocument();
    // Stakes spelled out.
    expect(screen.getByText(/read the snap packets that belong to your organization/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot submit anything on its own/i)).toBeInTheDocument();
  });
});

describe('DeviceApprovalFlow — approve', () => {
  it('approve calls api.oauth.approve with the JWT + code, then shows connected', async () => {
    render(<DeviceApprovalFlow initialUserCode={null} signedInEmail={null} />);
    typeCode('ABCD2345');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /approve & connect/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approve & connect/i }));

    await waitFor(() => expect(mockApprove).toHaveBeenCalledWith('tok', 'ABCD-2345'));
    await waitFor(() => expect(screen.getByText(/this device is now connected/i)).toBeInTheDocument());
    // Org is never sent from the client — approve only ever gets (jwt, code).
    expect(mockApprove).toHaveBeenCalledTimes(1);
    expect(mockApprove.mock.calls[0]).toHaveLength(2);
  });
});

describe('DeviceApprovalFlow — deny', () => {
  it('deny calls api.oauth.deny and shows the rejected state', async () => {
    render(<DeviceApprovalFlow initialUserCode={null} signedInEmail={null} />);
    typeCode('ABCD2345');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /^deny$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^deny$/i }));

    await waitFor(() => expect(mockDeny).toHaveBeenCalledWith('tok', 'ABCD-2345'));
    await waitFor(() => expect(screen.getByText(/connection request rejected/i)).toBeInTheDocument());
    expect(mockApprove).not.toHaveBeenCalled();
  });
});

describe('DeviceApprovalFlow — query-param prefill auto-lookup', () => {
  it('auto-looks-up when initialUserCode is provided via ?user_code', async () => {
    render(<DeviceApprovalFlow initialUserCode="WXYZ-6789" signedInEmail={null} />);
    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith('tok', 'WXYZ-6789'));
    await waitFor(() =>
      expect(screen.getByText(/connect this browser extension\?/i)).toBeInTheDocument(),
    );
  });

  it('does NOT auto-lookup an incomplete ?user_code', async () => {
    render(<DeviceApprovalFlow initialUserCode="WX" signedInEmail={null} />);
    // Stays on the entry form, prefilled, with no lookup fired.
    expect(screen.getByText(/enter the code from your browser/i)).toBeInTheDocument();
    expect(mockLookup).not.toHaveBeenCalled();
  });
});

describe('DeviceApprovalFlow — error states', () => {
  it('shows the expired error on a 410 from approve', async () => {
    mockApprove.mockRejectedValue(new Error('API 410: {"message":"Code has expired"}'));
    render(<DeviceApprovalFlow initialUserCode="ABCD-2345" signedInEmail={null} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /approve & connect/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approve & connect/i }));

    await waitFor(() => expect(screen.getByText(/that code has expired/i)).toBeInTheDocument());
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows the not-found error on a 404 from lookup', async () => {
    mockLookup.mockRejectedValue(new Error('API 404: {"message":"Unknown or expired code"}'));
    render(<DeviceApprovalFlow initialUserCode={null} signedInEmail={null} />);
    typeCode('ABCD2345');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText(/couldn.t find that code/i)).toBeInTheDocument());
  });

  it('shows the already-used error on a 409 from approve', async () => {
    mockApprove.mockRejectedValue(new Error('API 409: {"message":"Code has already been approved"}'));
    render(<DeviceApprovalFlow initialUserCode="ABCD-2345" signedInEmail={null} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /approve & connect/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approve & connect/i }));

    await waitFor(() => expect(screen.getByText(/already used/i)).toBeInTheDocument());
  });

  it('shows the no-org error on a 403 from approve', async () => {
    mockApprove.mockRejectedValue(new Error('API 403: {"message":"Your account has no organization"}'));
    render(<DeviceApprovalFlow initialUserCode="ABCD-2345" signedInEmail={null} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /approve & connect/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approve & connect/i }));

    await waitFor(() => expect(screen.getByText(/isn.t linked to an organization/i)).toBeInTheDocument());
  });

  it('lets the user retry from an error back to the entry form', async () => {
    mockLookup.mockRejectedValue(new Error('API 404: {"message":"Unknown"}'));
    render(<DeviceApprovalFlow initialUserCode={null} signedInEmail={null} />);
    typeCode('ABCD2345');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(screen.getByText(/couldn.t find that code/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /try another code/i }));
    expect(screen.getByText(/enter the code from your browser/i)).toBeInTheDocument();
  });
});

describe('DeviceApprovalFlow — not signed in', () => {
  it('surfaces a network error when there is no active session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(<DeviceApprovalFlow initialUserCode={null} signedInEmail={null} />);
    typeCode('ABCD2345');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // No session → getAccessToken throws → classified as a generic error;
    // lookup is never attempted with a missing token.
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(mockLookup).not.toHaveBeenCalled();
  });
});
