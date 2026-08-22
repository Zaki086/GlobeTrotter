import { Prisma, type Role, type User } from '@prisma/client';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { securityLogger } from '../config/logger';
import { AUDIT_ACTION } from '../config/constants';
import { ApiError } from '../utils/ApiError';
import { hashPassword, needsRehash, verifyPassword } from '../utils/password';
import {
  durationToSeconds,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';
import { randomToken } from '../utils/hash';
import type { RequestContext, TokenPair } from '../types';
import { AuditService } from './audit.service';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface AuthResult {
  user: PublicUser;
  tokens: TokenPair;
}

const REFRESH_TTL_SECONDS = durationToSeconds(env.JWT_REFRESH_EXPIRES_IN) || 30 * 86400;
const ACCESS_TTL_SECONDS = durationToSeconds(env.JWT_ACCESS_EXPIRES_IN) || 900;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export class AuthService {
  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  static async signup(
    input: {
      name: string;
      email: string;
      password: string;
      phone?: string;
      city?: string;
      country?: string;
      avatarUrl?: string;
      additionalInfo?: string;
    },
    ctx: RequestContext = {},
  ): Promise<AuthResult> {
    // Email arrives already normalized by the Zod schema.
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.conflict('An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);

    let user: User;
    try {
      user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          // Every user gets a profile row up front so the profile endpoints
          // never have to handle a missing-profile branch. The optional
          // registration fields land here rather than on the user row.
          profile: {
            create: {
              phone: input.phone,
              country: input.country,
              avatarUrl: input.avatarUrl,
              bio: input.additionalInfo,
            },
          },
        },
      });
    } catch (err) {
      // Concurrent signups with the same email race past the check above; the
      // unique index is the real guarantee.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw ApiError.conflict('An account with this email already exists');
      }
      throw err;
    }

    const tokens = await this.issueSession(user, ctx);

    await AuditService.record({
      actorId: user.id,
      action: AUDIT_ACTION.USER_SIGNUP,
      resourceType: 'user',
      resourceId: user.id,
      ...ctx,
    });

    return { user: toPublicUser(user), tokens };
  }

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------

  static async login(
    input: { email: string; password: string; deviceLabel?: string },
    ctx: RequestContext = {},
  ): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    // Verify against a dummy hash when the user is missing so the response
    // time does not reveal whether an email is registered.
    if (!user) {
      await verifyPassword(
        '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0000000000000000000000000000000000000000000',
        input.password,
      );
      await this.recordFailedLogin(input.email, ctx);
      throw ApiError.unauthorized('Invalid email or password');
    }

    const passwordValid = await verifyPassword(user.passwordHash, input.password);
    if (!passwordValid) {
      await this.recordFailedLogin(input.email, ctx, user.id);
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('This account has been deactivated');
    }

    // Transparently upgrade hashes created with older Argon2 parameters.
    if (needsRehash(user.passwordHash)) {
      const upgraded = await hashPassword(input.password);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: upgraded } });
    }

    const tokens = await this.issueSession(user, ctx, input.deviceLabel);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await AuditService.record({
      actorId: user.id,
      action: AUDIT_ACTION.USER_LOGIN,
      resourceType: 'user',
      resourceId: user.id,
      ...ctx,
    });

    return { user: toPublicUser({ ...user, lastLoginAt: new Date() }), tokens };
  }

  private static async recordFailedLogin(email: string, ctx: RequestContext, userId?: string) {
    securityLogger.warn('Failed login attempt', { email, ip: ctx.ipAddress });
    await AuditService.record({
      actorId: userId ?? null,
      action: AUDIT_ACTION.USER_LOGIN_FAILED,
      resourceType: 'user',
      resourceId: userId ?? null,
      metadata: { email },
      ...ctx,
    });
  }

  // -------------------------------------------------------------------------
  // Sessions & token rotation
  // -------------------------------------------------------------------------

  /** Creates a session row plus its first access/refresh token pair. */
  private static async issueSession(
    user: User,
    ctx: RequestContext,
    deviceLabel?: string,
  ): Promise<TokenPair> {
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        userAgent: ctx.userAgent?.slice(0, 512),
        ipAddress: ctx.ipAddress?.slice(0, 64),
        deviceLabel: deviceLabel?.slice(0, 120),
        expiresAt,
      },
    });

    return this.mintTokens(user, session.id);
  }

  private static async mintTokens(
    user: Pick<User, 'id' | 'email' | 'role'>,
    sessionId: string,
    replacesTokenId?: string,
  ): Promise<TokenPair> {
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    });

    const refresh = signRefreshToken({ userId: user.id, sessionId });

    const stored = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId,
        tokenHash: refresh.tokenHash,
        expiresAt: refresh.expiresAt,
      },
    });

    // Link the old token to its successor so reuse is attributable.
    if (replacesTokenId) {
      await prisma.refreshToken.update({
        where: { id: replacesTokenId },
        data: { revokedAt: new Date(), replacedBy: stored.id },
      });
    }

    return {
      accessToken,
      refreshToken: refresh.token,
      expiresIn: ACCESS_TTL_SECONDS,
      tokenType: 'Bearer',
    };
  }

  /**
   * Refresh with rotation and reuse detection.
   *
   * Presenting an already-rotated token means the token leaked (an attacker
   * and the legitimate client both hold it), so the entire session is killed
   * rather than just rejecting the one request.
   */
  static async refresh(rawToken: string, ctx: RequestContext = {}): Promise<AuthResult> {
    const payload = verifyRefreshToken(rawToken);
    const tokenHash = hashToken(rawToken);

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
        session: { select: { id: true, revokedAt: true, expiresAt: true } },
      },
    });

    if (!stored) {
      throw ApiError.unauthorized('Refresh token is not recognised');
    }

    if (stored.revokedAt) {
      securityLogger.error('Refresh token reuse detected', {
        userId: stored.userId,
        sessionId: stored.sessionId,
        ip: ctx.ipAddress,
      });
      await AuditService.record({
        actorId: stored.userId,
        action: AUDIT_ACTION.TOKEN_REUSE_DETECTED,
        resourceType: 'session',
        resourceId: stored.sessionId,
        ...ctx,
      });
      if (stored.sessionId) await this.revokeSession(stored.sessionId);
      throw ApiError.unauthorized('Refresh token has already been used. Please sign in again.');
    }

    if (stored.expiresAt < new Date()) {
      throw ApiError.unauthorized('Refresh token has expired, please sign in again');
    }

    const session = stored.session;
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw ApiError.unauthorized('Session is no longer valid, please sign in again');
    }
    if (session.id !== payload.sessionId || stored.userId !== payload.sub) {
      throw ApiError.unauthorized('Refresh token does not match its session');
    }
    if (!stored.user.isActive) {
      throw ApiError.forbidden('This account has been deactivated');
    }

    const tokens = await this.mintTokens(stored.user, session.id, stored.id);

    await prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });

    AuditService.queue({
      actorId: stored.userId,
      action: AUDIT_ACTION.TOKEN_REFRESH,
      resourceType: 'session',
      resourceId: session.id,
      ...ctx,
    });

    return { user: toPublicUser(stored.user), tokens };
  }

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------

  /** Ends one device's session. */
  static async logout(
    params: { userId: string; sessionId?: string; refreshToken?: string },
    ctx: RequestContext = {},
  ): Promise<{ revokedSessions: number }> {
    let sessionId = params.sessionId;

    // Prefer the session named by the refresh token when one is supplied.
    if (params.refreshToken) {
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(params.refreshToken) },
        select: { sessionId: true, userId: true },
      });
      // Ignore a token belonging to somebody else rather than logging them out.
      if (stored && stored.userId === params.userId && stored.sessionId) {
        sessionId = stored.sessionId;
      }
    }

    if (!sessionId) return { revokedSessions: 0 };

    await this.revokeSession(sessionId, params.userId);

    await AuditService.record({
      actorId: params.userId,
      action: AUDIT_ACTION.USER_LOGOUT,
      resourceType: 'session',
      resourceId: sessionId,
      ...ctx,
    });

    return { revokedSessions: 1 };
  }

  /** Ends every session for the user — the "sign out everywhere" button. */
  static async logoutAll(
    userId: string,
    ctx: RequestContext = {},
  ): Promise<{ revokedSessions: number }> {
    const now = new Date();

    const [sessions] = await prisma.$transaction([
      prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    await AuditService.record({
      actorId: userId,
      action: AUDIT_ACTION.USER_LOGOUT_ALL,
      resourceType: 'user',
      resourceId: userId,
      metadata: { revokedSessions: sessions.count },
      ...ctx,
    });

    return { revokedSessions: sessions.count };
  }

  private static async revokeSession(sessionId: string, userId?: string): Promise<void> {
    const now = new Date();
    await prisma.$transaction([
      prisma.session.updateMany({
        where: { id: sessionId, ...(userId ? { userId } : {}), revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  // -------------------------------------------------------------------------
  // Current user & sessions
  // -------------------------------------------------------------------------

  static async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw ApiError.notFound('User not found');

    const [tripCount, activeSessions] = await Promise.all([
      prisma.trip.count({ where: { ownerId: userId } }),
      prisma.session.count({
        where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      }),
    ]);

    return {
      ...toPublicUser(user),
      profile: user.profile,
      stats: { tripCount, activeSessions },
    };
  }

  static async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        deviceLabel: true,
        userAgent: true,
        ipAddress: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((s) => ({ ...s, isCurrent: s.id === currentSessionId }));
  }

  // -------------------------------------------------------------------------
  // Passwords
  // -------------------------------------------------------------------------

  /**
   * Always resolves successfully, whether or not the email exists — the
   * response must not become an account-enumeration oracle. The returned
   * token is null for unknown emails.
   */
  static async requestPasswordReset(
    emailAddress: string,
    ctx: RequestContext = {},
  ): Promise<{ token: string | null }> {
    const user = await prisma.user.findUnique({
      where: { email: emailAddress },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      securityLogger.info('Password reset requested for unknown account', {
        email: emailAddress,
        ip: ctx.ipAddress,
      });
      return { token: null };
    }

    // Invalidate outstanding tokens so only the newest link works.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const { token, hash } = randomToken(32);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    await AuditService.record({
      actorId: user.id,
      action: AUDIT_ACTION.PASSWORD_RESET_REQUEST,
      resourceType: 'user',
      resourceId: user.id,
      ...ctx,
    });

    // No mail transport in scope: the caller decides what to do with this.
    return { token };
  }

  static async resetPassword(
    input: { token: string; password: string },
    ctx: RequestContext = {},
  ): Promise<void> {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
      include: { user: { select: { id: true, isActive: true } } },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw ApiError.badRequest('This password reset link is invalid or has expired');
    }
    if (!record.user.isActive) {
      throw ApiError.forbidden('This account has been deactivated');
    }

    const passwordHash = await hashPassword(input.password);
    const now = new Date();

    // Changing a password ends every existing session — a reset is the
    // remedy for a compromise, so stale sessions must not survive it.
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: now } }),
      prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    await AuditService.record({
      actorId: record.userId,
      action: AUDIT_ACTION.PASSWORD_RESET_COMPLETE,
      resourceType: 'user',
      resourceId: record.userId,
      ...ctx,
    });
  }

  static async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string },
    keepSessionId?: string,
    ctx: RequestContext = {},
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User not found');

    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw ApiError.unauthorized('Current password is incorrect');
    }

    const passwordHash = await hashPassword(input.newPassword);
    const now = new Date();

    // Every session except the one making the change is revoked.
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      prisma.session.updateMany({
        where: { userId, revokedAt: null, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
        data: { revokedAt: now },
      }),
      prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(keepSessionId ? { sessionId: { not: keepSessionId } } : {}),
        },
        data: { revokedAt: now },
      }),
    ]);

    await AuditService.record({
      actorId: userId,
      action: AUDIT_ACTION.PASSWORD_RESET_COMPLETE,
      resourceType: 'user',
      resourceId: userId,
      metadata: { via: 'change-password' },
      ...ctx,
    });
  }

  /** Housekeeping for expired rows; safe to call from a cron. */
  static async pruneExpiredTokens(): Promise<{ removed: number }> {
    const now = new Date();
    const [tokens, resets] = await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);
    return { removed: tokens.count + resets.count };
  }
}

export default AuthService;
