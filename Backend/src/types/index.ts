import type { Role, TripMemberRole } from '@prisma/client';

export interface AuthContext {
  userId: string;
  email: string;
  role: Role;
  sessionId: string;
}

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

/** Result of resolving what a user is allowed to do with a given trip. */
export interface TripAccess {
  tripId: string;
  role: TripMemberRole;
  isOwner: boolean;
  canEdit: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}
