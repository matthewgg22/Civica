import { pino } from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

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
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.applicant_name',
      '*.dob',
      '*.ssn',
      '*.ssn_last4',
    ],
    censor: '[REDACTED]',
  },
});
