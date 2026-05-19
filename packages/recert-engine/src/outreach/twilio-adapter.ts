import crypto from 'node:crypto';
import { z } from 'zod';
import type { E164, OutreachType, TwilioAdapter } from './types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TwilioAdapterConfig {
  accountSid: string;
  authToken: string;
  fromNumber: E164;
}

/** Minimal Supabase client interface needed for opt-out queries. */
export interface SupabaseLike {
  schema(name: string): {
    from(table: string): {
      select(cols: string): {
        eq(col: string, val: string): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
      insert(row: Record<string, unknown>): {
        onConflict(col: string): {
          merge(): Promise<{ error: { message: string } | null }>;
        };
      };
      update(row: Record<string, unknown>): {
        eq(col: string, val: string): Promise<{ error: { message: string } | null }>;
      };
    };
  };
}

// ---------------------------------------------------------------------------
// Webhook body schema — Twilio sends application/x-www-form-urlencoded
// ---------------------------------------------------------------------------

export const TwilioWebhookBodySchema = z.object({
  Body: z.string().default(''),
  From: z.string(),
  To: z.string(),
  MessageSid: z.string().optional(),
  AccountSid: z.string().optional(),
});

export type TwilioWebhookBody = z.infer<typeof TwilioWebhookBodySchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(phone).digest('hex');
}

/**
 * Parse inbound SMS keyword.
 * Returns 'opt_out', 'opt_in', 'help', or null for everything else.
 */
function parseKeyword(body: string): 'opt_out' | 'opt_in' | 'help' | null {
  const kw = body.trim().toUpperCase();
  if (kw === 'STOP' || kw === 'STOPALL' || kw === 'UNSUBSCRIBE' || kw === 'CANCEL' || kw === 'END' || kw === 'QUIT') {
    return 'opt_out';
  }
  if (kw === 'START' || kw === 'UNSTOP' || kw === 'YES') {
    return 'opt_in';
  }
  if (kw === 'HELP' || kw === 'INFO') {
    return 'help';
  }
  return null;
}

// ---------------------------------------------------------------------------
// LiveTwilioAdapter
// ---------------------------------------------------------------------------

/**
 * LiveTwilioAdapter — production Twilio integration.
 *
 * Lazily imports the `twilio` npm package so the package doesn't crash in
 * pure-test environments where `twilio` may not be installed. The import
 * only happens when sendSMS is first called.
 *
 * Opt-out state is stored in snap_enrollment.recert_outreach_optouts using a
 * SHA-256 hash of the E.164 phone number (never the raw number).
 */
export class LiveTwilioAdapter implements TwilioAdapter {
  private readonly config: TwilioAdapterConfig;
  private readonly db: SupabaseLike;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private twilioClient: any | null = null;

  constructor(config: TwilioAdapterConfig, db: SupabaseLike) {
    this.config = config;
    this.db = db;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (this.twilioClient) return this.twilioClient;
    // Lazy import — avoids crashing test environments without twilio installed.
    const { default: twilio } = await import('twilio');
    this.twilioClient = twilio(this.config.accountSid, this.config.authToken);
    return this.twilioClient;
  }

  async sendSMS(to: E164, body: string, _outreachType: OutreachType): Promise<{ messageSid: string }> {
    const client = await this.getClient();
    const message = await client.messages.create({
      from: this.config.fromNumber,
      to,
      body,
    });
    return { messageSid: message.sid as string };
  }

  async isOptedOut(phone: E164): Promise<boolean> {
    const hash = hashPhone(phone);
    const { data, error } = await this.db
      .schema('snap_enrollment')
      .from('recert_outreach_optouts')
      .select('opted_out_at, opted_in_at')
      .eq('phone_hash', hash);

    if (error) throw new Error(`isOptedOut query failed: ${error.message}`);
    if (!data || data.length === 0) return false;

    const row = data[0] as { opted_out_at: string; opted_in_at: string | null };
    // If opted_in_at is set and is more recent than opted_out_at, they've re-subscribed.
    if (row.opted_in_at && row.opted_in_at > row.opted_out_at) return false;
    return true;
  }

  async recordOptOut(phone: E164): Promise<void> {
    const hash = hashPhone(phone);
    const result = await this.db
      .schema('snap_enrollment')
      .from('recert_outreach_optouts')
      .insert({ phone_hash: hash, opted_out_at: new Date().toISOString() })
      .onConflict('phone_hash')
      .merge();

    if (result.error) throw new Error(`recordOptOut failed: ${result.error.message}`);
  }

  async recordOptIn(phone: E164): Promise<void> {
    const hash = hashPhone(phone);
    const result = await this.db
      .schema('snap_enrollment')
      .from('recert_outreach_optouts')
      .update({ opted_in_at: new Date().toISOString() })
      .eq('phone_hash', hash);

    if (result.error) throw new Error(`recordOptIn failed: ${result.error.message}`);
  }

  /**
   * Handle an inbound Twilio webhook body (STOP / START / HELP / UNSTOP etc.).
   * Returns the action taken: 'opt_out', 'opt_in', 'help', or 'ignored'.
   */
  async handleWebhook(body: TwilioWebhookBody): Promise<'opt_out' | 'opt_in' | 'help' | 'ignored'> {
    const action = parseKeyword(body.Body);
    const from = body.From as E164;

    if (action === 'opt_out') {
      await this.recordOptOut(from);
      return 'opt_out';
    }
    if (action === 'opt_in') {
      await this.recordOptIn(from);
      return 'opt_in';
    }
    if (action === 'help') {
      return 'help';
    }
    return 'ignored';
  }
}
