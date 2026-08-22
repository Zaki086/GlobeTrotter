import fs from 'node:fs';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env } from './env';

if (!fs.existsSync(env.logDir)) {
  fs.mkdirSync(env.logDir, { recursive: true });
}

/**
 * Keys whose values must never reach a log file. Redaction runs recursively
 * over every logged metadata object, so a stray `logger.info('x', req.body)`
 * still cannot leak a password or token.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'confirmpassword',
  'passwordhash',
  'password_hash',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'tokenhash',
  'token_hash',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'api_key',
]);

const REDACTED = '[REDACTED]';

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redact(val, depth + 1);
  }
  return out;
}

const redactFormat = winston.format((info) => {
  const { level, message, timestamp, stack, ...meta } = info;
  return { level, message, timestamp, stack, ...(redact(meta) as object) };
});

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  redactFormat(),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  redactFormat(),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${stack ?? message}${extra}`;
  }),
);

const rotateDefaults = {
  dirname: env.logDir,
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  format: jsonFormat,
};

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: 'globetrotter-api' },
  transports: [
    new DailyRotateFile({ ...rotateDefaults, filename: 'application-%DATE%.log' }),
    new DailyRotateFile({ ...rotateDefaults, filename: 'error-%DATE%.log', level: 'error' }),
  ],
  exitOnError: false,
});

/** Dedicated channel for auth + admin events, kept separate for audit review. */
export const securityLogger = winston.createLogger({
  level: 'info',
  defaultMeta: { service: 'globetrotter-security' },
  transports: [new DailyRotateFile({ ...rotateDefaults, filename: 'security-%DATE%.log' })],
  exitOnError: false,
});

/** Per-request access log. */
export const httpLogger = winston.createLogger({
  level: 'http',
  defaultMeta: { service: 'globetrotter-http' },
  transports: [new DailyRotateFile({ ...rotateDefaults, filename: 'http-%DATE%.log' })],
  exitOnError: false,
});

// Tests stay quiet; every other environment mirrors to the console.
if (!env.isTest) {
  const consoleTransport = new winston.transports.Console({ format: consoleFormat });
  logger.add(consoleTransport);
  securityLogger.add(consoleTransport);
}

export default logger;
