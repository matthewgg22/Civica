import type { E164, OutreachType, TwilioAdapter } from './types.js';

/**
 * NoopTwilioAdapter — used in dev and test environments.
 * No Twilio credentials are required. sendSMS logs to console and returns a
 * fake messageSid. Opt-out methods are no-ops; isOptedOut always returns false.
 */
export class NoopTwilioAdapter implements TwilioAdapter {
  async sendSMS(to: E164, body: string, outreachType: OutreachType): Promise<{ messageSid: string }> {
    const messageSid = `noop-${Date.now()}`;
    console.log(`[NoopTwilioAdapter] sendSMS type=${outreachType} to=${to} sid=${messageSid}`);
    console.log(`[NoopTwilioAdapter] body=${body.slice(0, 80)}`);
    return { messageSid };
  }

  async isOptedOut(_phone: E164): Promise<boolean> {
    return false;
  }

  async recordOptOut(_phone: E164): Promise<void> {
    // no-op in dev/test
  }

  async recordOptIn(_phone: E164): Promise<void> {
    // no-op in dev/test
  }
}
