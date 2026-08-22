import type { Role } from '@prisma/client';

/**
 * Request augmentation. `auth` is populated by authenticate()/optionalAuth();
 * `requestId` by the request logger.
 */
declare global {
  namespace Express {
    interface AuthContext {
      userId: string;
      email: string;
      role: Role;
      sessionId: string;
    }

    interface Request {
      auth?: AuthContext;
      requestId?: string;
    }
  }
}

export {};
