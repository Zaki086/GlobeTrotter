import type { Request, RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { securityLogger } from '../config/logger';
import { ApiError } from '../utils/ApiError';
import { extractBearerToken, verifyAccessToken } from '../utils/jwt';

/**
 * Resolves the bearer token into an auth context.
 *
 * A valid signature alone is not enough: the session must still exist and be
 * unrevoked, and the account must still be active. That is what makes
 * "logout all devices" and admin deactivation take effect immediately instead
 * of waiting out the access token's TTL.
 */
async function resolveAuth(req: Request): Promise<Express.AuthContext | null> {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return null;

  const payload = verifyAccessToken(token);

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    select: {
      id: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: { id: true, email: true, role: true, isActive: true } },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session is no longer valid, please sign in again');
  }
  if (session.user.id !== payload.sub) {
    throw ApiError.unauthorized('Token does not match its session');
  }
  if (!session.user.isActive) {
    throw ApiError.forbidden('This account has been deactivated');
  }

  // Best-effort activity tracking; a failure here must not fail the request.
  void prisma.session
    .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return {
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
    sessionId: session.id,
  };
}

/** Hard gate — 401 unless a valid, live session is presented. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) throw ApiError.unauthorized('Authentication required');
    req.auth = auth;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Soft gate — attaches auth when a valid token is present, otherwise continues
 * anonymously. Used by public itinerary routes so a signed-in visitor can be
 * offered "copy to my trips" while anonymous visitors still get the page.
 */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    req.auth = (await resolveAuth(req)) ?? undefined;
  } catch {
    // An invalid token on an optional route is simply treated as anonymous.
    req.auth = undefined;
  }
  next();
};

/** Role gate. Must run after authenticate(). */
export const authorize =
  (...allowed: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(ApiError.unauthorized('Authentication required'));

    if (!allowed.includes(req.auth.role)) {
      securityLogger.warn('Authorization denied', {
        userId: req.auth.userId,
        role: req.auth.role,
        required: allowed,
        path: req.originalUrl,
        ip: req.ip,
      });
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }

    next();
  };

/** Convenience alias for the admin-only analytics surface. */
export const requireAdmin: RequestHandler[] = [authenticate, authorize('ADMIN')];
