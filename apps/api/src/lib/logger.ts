import { pino } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

// Exported so tests can assert coverage without relying on pino's runtime.
export const REDACT_PATHS: string[] = [
  // Auth headers — never log
  'req.headers.authorization',
  'req.headers.cookie',
  // Applicant PII — direct and one-level nested
  'applicant_name',       '*.applicant_name',
  'applicant_id',         '*.applicant_id',
  'email',                '*.email',
  'phone',                '*.phone',
  'phone_number',         '*.phone_number',
  'dob',                  '*.dob',
  'ssn',                  '*.ssn',
  'ssn_last4',            '*.ssn_last4',
  // Fernet ciphertext columns — should never appear in logs under any circumstances
  'content_ciphertext',               '*.content_ciphertext',
  'snapshot_ciphertext',              '*.snapshot_ciphertext',
  'extracted_payload_ciphertext',     '*.extracted_payload_ciphertext',
  'user_corrections_ciphertext',      '*.user_corrections_ciphertext',
  'household_snapshot_ciphertext',    '*.household_snapshot_ciphertext',
  'result_ciphertext',                '*.result_ciphertext',
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }
    : {}),
  redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
});
