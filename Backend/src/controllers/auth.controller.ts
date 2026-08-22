import type { Request, Response } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { sendCreated, sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { durationToSeconds } from '../utils/jwt';
import type { RequestContext } from '../types';
import { AuthService } from '../services/auth.service';

/** Controllers only translate HTTP <-> service calls; no business logic here. */
function contextOf(req: Request): RequestContext {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

const REFRESH_COOKIE = 'gt_refresh_token';

/**
 * The refresh token is also set as an httpOnly cookie so browser clients can
 * avoid keeping it in JS-reachable storage. Native clients ignore the cookie
 * and use the body field instead.
 */
function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'strict' : 'lax',
    maxAge: (durationToSeconds(env.JWT_REFRESH_EXPIRES_IN) || 30 * 86400) * 1000,
    path: '/',
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
}

export const signup = asyncHandler(async (req, res) => {
  const result = await AuthService.signup(req.body, contextOf(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  return sendCreated(res, result, 'Account created successfully');
});

export const login = asyncHandler(async (req, res) => {
  const result = await AuthService.login(req.body, contextOf(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  return sendSuccess(res, result, 'Signed in successfully');
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('A refresh token is required');

  const result = await AuthService.refresh(token, contextOf(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  return sendSuccess(res, result, 'Token refreshed successfully');
});

export const logout = asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const token = req.body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];

  const result = req.body?.allDevices
    ? await AuthService.logoutAll(auth.userId, contextOf(req))
    : await AuthService.logout(
        { userId: auth.userId, sessionId: auth.sessionId, refreshToken: token },
        contextOf(req),
      );

  clearRefreshCookie(res);
  return sendSuccess(
    res,
    result,
    req.body?.allDevices ? 'Signed out of all devices' : 'Signed out successfully',
  );
});

export const logoutAll = asyncHandler(async (req, res) => {
  const result = await AuthService.logoutAll(req.auth!.userId, contextOf(req));
  clearRefreshCookie(res);
  return sendSuccess(res, result, 'Signed out of all devices');
});

export const me = asyncHandler(async (req, res) => {
  const user = await AuthService.me(req.auth!.userId);
  return sendSuccess(res, user, 'Current user retrieved');
});

export const listSessions = asyncHandler(async (req, res) => {
  const sessions = await AuthService.listSessions(req.auth!.userId, req.auth!.sessionId);
  return sendSuccess(res, sessions, 'Active sessions retrieved');
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await AuthService.requestPasswordReset(req.body.email, contextOf(req));

  // The response is identical whether or not the email exists, so it cannot
  // be used to enumerate accounts. Outside production the token is returned
  // to make the flow testable without a mail transport.
  return sendSuccess(
    res,
    env.isProduction ? {} : { resetToken: result.token },
    'If an account exists for that email, a password reset link has been sent',
  );
});

export const resetPassword = asyncHandler(async (req, res) => {
  await AuthService.resetPassword(req.body, contextOf(req));
  clearRefreshCookie(res);
  return sendSuccess(res, {}, 'Password reset successfully. Please sign in again.');
});

export const changePassword = asyncHandler(async (req, res) => {
  await AuthService.changePassword(
    req.auth!.userId,
    req.body,
    req.auth!.sessionId,
    contextOf(req),
  );
  return sendSuccess(res, {}, 'Password changed. Other devices have been signed out.');
});
