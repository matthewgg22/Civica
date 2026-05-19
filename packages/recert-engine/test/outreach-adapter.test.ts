import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TwilioWebhookBody } from '../src/outreach/twilio-adapter.js';

// ---------------------------------------------------------------------------
// Mock: twilio npm package (lazily imported by LiveTwilioAdapter.getClient)
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();
vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

import { LiveTwilioAdapter } from '../src/outreach/twilio-adapter.js';

// ---------------------------------------------------------------------------
// Helpers — minimal SupabaseLike factory
// ---------------------------------------------------------------------------

function makeDb(opts: {
  selectData?: unknown[];
  selectError?: string | null;
  insertError?: string | null;
  updateError?: string | null;
}) {
  return {
    schema: () => ({
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: opts.selectData ?? [],
              error: opts.selectError ? { message: opts.selectError } : null,
            }),
        }),
        insert: () => ({
          onConflict: () => ({
            merge: () =>
              Promise.resolve({
                error: opts.insertError ? { message: opts.insertError } : null,
              }),
          }),
        }),
        update: () => ({
          eq: () =>
            Promise.resolve({
              error: opts.updateError ? { message: opts.updateError } : null,
            }),
        }),
      }),
    }),
  };
}

const TEST_CONFIG = {
  accountSid: 'ACtest',
  authToken: 'auth-token',
  fromNumber: '+15005550006' as const,
};

// ---------------------------------------------------------------------------
// sendSMS
// ---------------------------------------------------------------------------

describe('LiveTwilioAdapter.sendSMS', () => {
  beforeEach(() => mockCreate.mockReset());

  it('calls twilio messages.create with correct params and returns messageSid', async () => {
    mockCreate.mockResolvedValue({ sid: 'SMabc123' });
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));

    const result = await adapter.sendSMS('+14155552671', 'Hello!', 'reminder_30d');

    expect(mockCreate).toHaveBeenCalledWith({
      from: '+15005550006',
      to: '+14155552671',
      body: 'Hello!',
    });
    expect(result).toEqual({ messageSid: 'SMabc123' });
  });

});

// ---------------------------------------------------------------------------
// isOptedOut
// ---------------------------------------------------------------------------

describe('LiveTwilioAdapter.isOptedOut', () => {
  it('returns false when no row found for phone', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({ selectData: [] }));
    expect(await adapter.isOptedOut('+14155552671')).toBe(false);
  });

  it('returns true when opted_out_at set and no subsequent opt-in', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({
      selectData: [{ opted_out_at: '2026-01-01T00:00:00Z', opted_in_at: null }],
    }));
    expect(await adapter.isOptedOut('+14155552671')).toBe(true);
  });

  it('returns false when opted_in_at is more recent than opted_out_at (re-subscribed)', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({
      selectData: [{ opted_out_at: '2026-01-01T00:00:00Z', opted_in_at: '2026-03-01T00:00:00Z' }],
    }));
    expect(await adapter.isOptedOut('+14155552671')).toBe(false);
  });

  it('throws when DB query fails', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({ selectError: 'DB down' }));
    await expect(adapter.isOptedOut('+14155552671')).rejects.toThrow('isOptedOut query failed: DB down');
  });
});

// ---------------------------------------------------------------------------
// recordOptOut / recordOptIn
// ---------------------------------------------------------------------------

describe('LiveTwilioAdapter.recordOptOut', () => {
  it('resolves without error on success', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    await expect(adapter.recordOptOut('+14155552671')).resolves.toBeUndefined();
  });

  it('throws when DB insert fails', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({ insertError: 'unique constraint' }));
    await expect(adapter.recordOptOut('+14155552671')).rejects.toThrow('recordOptOut failed: unique constraint');
  });
});

describe('LiveTwilioAdapter.recordOptIn', () => {
  it('resolves without error on success', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    await expect(adapter.recordOptIn('+14155552671')).resolves.toBeUndefined();
  });

  it('throws when DB update fails', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({ updateError: 'row not found' }));
    await expect(adapter.recordOptIn('+14155552671')).rejects.toThrow('recordOptIn failed: row not found');
  });
});

// ---------------------------------------------------------------------------
// handleWebhook — keyword parsing + opt-out/opt-in side effects
// ---------------------------------------------------------------------------

describe('LiveTwilioAdapter.handleWebhook', () => {
  function webhook(body: string): TwilioWebhookBody {
    return { Body: body, From: '+14155552671', To: '+15005550006' };
  }

  it('STOP → opt_out, returns "opt_out"', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook('STOP'))).toBe('opt_out');
  });

  it('STOPALL → opt_out', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook('STOPALL'))).toBe('opt_out');
  });

  it('UNSUBSCRIBE → opt_out', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook('UNSUBSCRIBE'))).toBe('opt_out');
  });

  it('CANCEL → opt_out', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook('CANCEL'))).toBe('opt_out');
  });

  it('END → opt_out', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook('END'))).toBe('opt_out');
  });

  it('QUIT → opt_out', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook('QUIT'))).toBe('opt_out');
  });

  it('START → opt_in, returns "opt_in"', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook('START'))).toBe('opt_in');
  });

  it('UNSTOP → opt_in', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook('UNSTOP'))).toBe('opt_in');
  });

  it('YES → opt_in', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook('YES'))).toBe('opt_in');
  });

  it('HELP → "help" (no DB side effect)', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook('HELP'))).toBe('help');
  });

  it('INFO → "help"', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook('INFO'))).toBe('help');
  });

  it('arbitrary message → "ignored"', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook('Can you help me with my benefits?'))).toBe('ignored');
  });

  it('empty body → "ignored"', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook(''))).toBe('ignored');
  });

  it('lowercase "stop" → opt_out (case-insensitive)', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook('stop'))).toBe('opt_out');
  });

  it('whitespace-padded " STOP " → opt_out', async () => {
    const adapter = new LiveTwilioAdapter(TEST_CONFIG, makeDb({}));
    expect(await adapter.handleWebhook(webhook(' STOP '))).toBe('opt_out');
  });
});
