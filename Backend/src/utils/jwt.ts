import crypto from 'node:crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { ApiError } from './ApiError';

export type TokenRole = 'USER' | 'ADMIN';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  role: TokenRole;
  sessionId: string;
  type: 'access';
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  sessionId: string;
  /** Random per-token id; its SHA-256 is what the database stores. */
  jti: string;
  type: 'refresh';
}

const baseOptions = {
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
};

export function signAccessToken(payload: {
  userId: string;
  email: string;
  role: TokenRole;
  sessionId: string;
}): string {
  return jwt.sign(
    { email: payload.email, role: payload.role, sessionId: payload.sessionId, type: 'access' },
    env.JWT_ACCESS_SECRET,
    {
      ...baseOptions,
      subject: payload.userId,
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    } as SignOptions,
  );
}

export function signRefreshToken(payload: { userId: string; sessionId: string }): {
  token: string;
  jti: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sessionId: payload.sessionId, jti, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    {
      ...baseOptions,
      subject: payload.userId,
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    } as SignOptions,
  );

  const decoded = jwt.decode(token) as JwtPayload;
  return {
    token,
    jti,
    tokenHash: hashToken(token),
    expiresAt: new Date((decoded.exp ?? 0) * 1000),
  };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, baseOptions) as AccessTokenPayload;
    if (payload.type !== 'access') throw ApiError.unauthorized('Invalid token type');
    return payload;
  } catch (err) {
    throw translateJwtError(err);
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, baseOptions) as RefreshTokenPayload;
    if (payload.type !== 'refresh') throw ApiError.unauthorized('Invalid token type');
    return payload;
  } catch (err) {
    throw translateJwtError(err);
  }
}

function translateJwtError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof jwt.TokenExpiredError) return ApiError.unauthorized('Token has expired');
  if (err instanceof jwt.JsonWebTokenError) return ApiError.unauthorized('Invalid token');
  return ApiError.unauthorized('Could not verify token');
}

/** Refresh tokens are stored only as a SHA-256 digest, like a password. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Extracts a bearer token from an Authorization header, if present. */
export function extractBearerToken(header?: string): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

/** Converts "15m" / "30d" / "3600" style durations into seconds. */
export function durationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])?$/.exec(duration.trim());
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2] ?? 's';
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[unit as 's' | 'm' | 'h' | 'd'];
  return value * multiplier;
}
