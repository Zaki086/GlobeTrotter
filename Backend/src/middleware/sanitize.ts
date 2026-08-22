import type { RequestHandler } from 'express';

/**
 * Defence-in-depth XSS scrubbing.
 *
 * The real protections are (a) Zod schemas that reject unexpected shapes and
 * (b) the client escaping on render — but user-authored trip names and notes
 * are echoed back to other viewers through public share pages, so we also
 * neutralise script-bearing markup on the way in.
 *
 * This strips dangerous constructs rather than HTML-encoding everything, so
 * legitimate text like "Café & Bar 5 > 4 stars" survives intact.
 */

const SCRIPT_BLOCK = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const STYLE_BLOCK = /<style\b[^>]*>[\s\S]*?<\/style\s*>/gi;
const DANGEROUS_TAG = /<\/?(?:iframe|object|embed|link|meta|base|form|svg|math)\b[^>]*>/gi;
const EVENT_HANDLER = /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_PROTOCOL = /(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/gi;

export function sanitizeString(input: string): string {
  return input
    .replace(SCRIPT_BLOCK, '')
    .replace(STYLE_BLOCK, '')
    .replace(DANGEROUS_TAG, '')
    .replace(EVENT_HANDLER, '')
    .replace(DANGEROUS_PROTOCOL, '')
    .trim();
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      // Block prototype-pollution keys outright.
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      out[key] = sanitizeValue(val, depth + 1);
    }
    return out;
  }
  return value;
}

export const sanitizeRequest: RequestHandler = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body) as typeof req.body;
  }
  if (req.query && typeof req.query === 'object') {
    Object.defineProperty(req, 'query', {
      value: sanitizeValue(req.query),
      writable: true,
      configurable: true,
    });
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params) as typeof req.params;
  }
  next();
};

export default sanitizeRequest;
