import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ConsentCapture from '../ConsentCapture';

const { mockRefresh, mockGetSession, mockConsentsRecord } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockGetSession: vi.fn(),
  mockConsentsRecord: vi.fn(),
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
    consents: {
      record: mockConsentsRecord,
    },
  },
}));

const APPLICANT_ID = 'a1';

function session() {
  return { data: { session: { access_token: 'tok' } } };
}

beforeEach(() => {
  mockGetSession.mockResolvedValue(session());
  mockConsentsRecord.mockResolvedValue({ consent_id: 'c-new' });
});

afterEach(() => vi.resetAllMocks());

// ── hasConsent=true renders the confirmation view ─────────────────────────

describe('ConsentCapture with existing consent', () => {
  it('shows the consent-on-file message', () => {
    render(<ConsentCapture applicantId={APPLICANT_ID} hasConsent={true} consentedAt={null} />);
    expect(screen.getByText(/privacy notice consent on file/i)).toBeInTheDocument();
  });

  it('does not show the record button when consent exists', () => {
    render(<ConsentCapture applicantId={APPLICANT_ID} hasConsent={true} consentedAt={null} />);
    expect(screen.queryByRole('button', { name: /record/i })).not.toBeInTheDocument();
  });

  it('shows the formatted consent date when provided', () => {
    render(
      <ConsentCapture applicantId={APPLICANT_ID} hasConsent={true} consentedAt="2026-05-17T00:00:00Z" />,
    );
    // The component uses toLocaleDateString — just verify a year is present
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });
});

// ── hasConsent=false renders the capture form ─────────────────────────────

describe('ConsentCapture without consent', () => {
  it('shows the warning banner', () => {
    render(<ConsentCapture applicantId={APPLICANT_ID} hasConsent={false} />);
    expect(screen.getByText(/no privacy notice consent recorded/i)).toBeInTheDocument();
  });

  it('shows the record button', () => {
    render(<ConsentCapture applicantId={APPLICANT_ID} hasConsent={false} />);
    expect(screen.getByRole('button', { name: /record privacy notice consent/i })).toBeInTheDocument();
  });

  it('shows the consent method selector with all four options', () => {
    render(<ConsentCapture applicantId={APPLICANT_ID} hasConsent={false} />);
    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option'));
    expect(options).toHaveLength(4);
  });
});

// ── Record action ─────────────────────────────────────────────────────────

describe('ConsentCapture record action', () => {
  it('calls api.consents.record with the default method (ios_checkbox)', async () => {
    render(<ConsentCapture applicantId={APPLICANT_ID} hasConsent={false} />);
    fireEvent.click(screen.getByRole('button', { name: /record privacy notice consent/i }));

    await waitFor(() => expect(mockConsentsRecord).toHaveBeenCalledTimes(1));
    expect(mockConsentsRecord).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({
        applicant_id: APPLICANT_ID,
        consent_kind: 'privacy_notice',
        consent_method: 'ios_checkbox',
        policy_version: '1.0',
      }),
    );
  });

  it('passes navigator_proxy when that method is selected', async () => {
    render(<ConsentCapture applicantId={APPLICANT_ID} hasConsent={false} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'navigator_proxy' } });
    fireEvent.click(screen.getByRole('button', { name: /record privacy notice consent/i }));

    await waitFor(() => expect(mockConsentsRecord).toHaveBeenCalledTimes(1));
    expect(mockConsentsRecord).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ consent_method: 'navigator_proxy' }),
    );
  });

  it('passes paper_form when that method is selected', async () => {
    render(<ConsentCapture applicantId={APPLICANT_ID} hasConsent={false} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'paper_form' } });
    fireEvent.click(screen.getByRole('button', { name: /record privacy notice consent/i }));

    await waitFor(() => expect(mockConsentsRecord).toHaveBeenCalledTimes(1));
    expect(mockConsentsRecord).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ consent_method: 'paper_form' }),
    );
  });

  it('calls router.refresh after successful record', async () => {
    render(<ConsentCapture applicantId={APPLICANT_ID} hasConsent={false} />);
    fireEvent.click(screen.getByRole('button', { name: /record privacy notice consent/i }));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });
});
