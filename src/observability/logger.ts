import pino, { Logger } from 'pino';
import { getConfig } from '../config/env';

const config = getConfig();

// Parse redaction paths from config
const redactPaths = config.LOG_REDACT_PATHS
  ? config.LOG_REDACT_PATHS.split(',').map((p) => p.trim())
  : [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers.set-cookie',
      'config.DATABASE_URL',
    ];

export const logger: Logger = pino({
  level: config.LOG_LEVEL || 'info',
  transport:
    config.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false,
          },
        }
      : undefined,
  redact: {
    paths: redactPaths,
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({
      level: label,
    }),
  },
});

export function getLogger(label: string): Logger {
  return logger.child({ module: label });
}
