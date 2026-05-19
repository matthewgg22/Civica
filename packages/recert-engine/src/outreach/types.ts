export type E164 = `+${string}`;

export type OutreachType =
  | 'sms_reminder_30d'
  | 'sms_reminder_7d'
  | 'sms_reminder_0d'
  | 'sms_custom'
  | 'call_prep';

export type TwilioAdapter = {
  sendSMS(to: E164, body: string, outreachType: OutreachType): Promise<{ messageSid: string }>;
  isOptedOut(phone: E164): Promise<boolean>;
  recordOptOut(phone: E164): Promise<void>;
  recordOptIn(phone: E164): Promise<void>;
};
