import { prisma } from '../config/prisma';
import { cache } from '../config/redis';
import { CACHE_KEY, AUDIT_ACTION } from '../config/constants';
import { ApiError } from '../utils/ApiError';
import { verifyPassword } from '../utils/password';
import type { RequestContext } from '../types';
import type { UpdateProfileInput } from '../validators/profile.validator';
import { AuditService } from './audit.service';

export class ProfileService {
  static async get(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw ApiError.notFound('User not found');

    // Saved destinations are stored as bare city ids; hydrate them so the
    // client does not need a second round trip.
    const savedDestinations = user.profile?.savedDestinations.length
      ? await prisma.city.findMany({
          where: { id: { in: user.profile.savedDestinations } },
          select: {
            id: true,
            name: true,
            country: true,
            countryCode: true,
            imageUrl: true,
            costIndex: true,
          },
        })
      : [];

    const [tripCount, sharedCount] = await Promise.all([
      prisma.trip.count({ where: { ownerId: userId } }),
      prisma.sharedItinerary.count({ where: { createdById: userId, isActive: true } }),
    ]);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      avatarUrl: user.profile?.avatarUrl ?? null,
      bio: user.profile?.bio ?? null,
      language: user.profile?.language ?? 'en',
      currency: user.profile?.currency ?? 'USD',
      country: user.profile?.country ?? null,
      phone: user.profile?.phone ?? null,
      savedDestinations,
      stats: { tripCount, sharedItineraries: sharedCount },
    };
  }

  static async update(userId: string, input: UpdateProfileInput, ctx: RequestContext = {}) {
    const { name, savedDestinations, ...profileFields } = input;

    // Reject unknown city ids rather than silently storing dangling references.
    if (savedDestinations && savedDestinations.length > 0) {
      const found = await prisma.city.count({ where: { id: { in: savedDestinations } } });
      if (found !== new Set(savedDestinations).size) {
        throw ApiError.badRequest('One or more saved destinations are not valid cities');
      }
    }

    await prisma.$transaction(async (tx) => {
      if (name) {
        await tx.user.update({ where: { id: userId }, data: { name } });
      }

      const profileData = {
        ...profileFields,
        ...(savedDestinations ? { savedDestinations } : {}),
      };

      if (Object.keys(profileData).length > 0) {
        await tx.profile.upsert({
          where: { userId },
          create: { userId, ...profileData },
          update: profileData,
        });
      }
    });

    await cache.del(CACHE_KEY.dashboard(userId));

    AuditService.queue({
      actorId: userId,
      action: AUDIT_ACTION.PROFILE_UPDATED,
      resourceType: 'profile',
      resourceId: userId,
      metadata: { fields: Object.keys(input) },
      ...ctx,
    });

    return this.get(userId);
  }

  /**
   * Irreversible account deletion. Confirmed by password in the controller;
   * the cascade rules in the schema remove profile, trips, stops, tokens,
   * sessions and notifications. Audit logs survive with a nulled actor.
   */
  static async remove(userId: string, password: string, ctx: RequestContext = {}) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user) throw ApiError.notFound('User not found');

    if (!(await verifyPassword(user.passwordHash, password))) {
      throw ApiError.unauthorized('Password is incorrect');
    }

    // Record the deletion before the row disappears.
    await AuditService.record({
      actorId: userId,
      action: AUDIT_ACTION.PROFILE_DELETED,
      resourceType: 'user',
      resourceId: userId,
      metadata: { email: user.email },
      ...ctx,
    });

    await prisma.user.delete({ where: { id: userId } });
    await cache.del(CACHE_KEY.dashboard(userId));
  }

  // -------------------------------------------------------------------------
  // Saved destinations
  // -------------------------------------------------------------------------

  static async addSavedDestination(userId: string, cityId: string) {
    const city = await prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
    if (!city) throw ApiError.notFound('City not found');

    const profile = await prisma.profile.upsert({
      where: { userId },
      create: { userId, savedDestinations: [cityId] },
      update: {},
      select: { savedDestinations: true },
    });

    if (!profile.savedDestinations.includes(cityId)) {
      await prisma.profile.update({
        where: { userId },
        data: { savedDestinations: { push: cityId } },
      });
    }

    await cache.del(CACHE_KEY.dashboard(userId));
    return this.get(userId);
  }

  static async removeSavedDestination(userId: string, cityId: string) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { savedDestinations: true },
    });
    if (!profile) throw ApiError.notFound('Profile not found');

    await prisma.profile.update({
      where: { userId },
      data: { savedDestinations: profile.savedDestinations.filter((id) => id !== cityId) },
    });

    await cache.del(CACHE_KEY.dashboard(userId));
    return this.get(userId);
  }
}

export default ProfileService;
