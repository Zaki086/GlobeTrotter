import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { ApiError } from '../utils/ApiError';

export class NotificationService {
  /** Notifications are advisory — a write failure never fails the caller. */
  static async create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    data?: Prisma.InputJsonValue;
  }): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          data: input.data,
        },
      });
    } catch (err) {
      logger.warn('Failed to create notification', {
        userId: input.userId,
        type: input.type,
        message: (err as Error).message,
      });
    }
  }

  static queue(input: Parameters<typeof NotificationService.create>[0]): void {
    void NotificationService.create(input);
  }

  static async list(userId: string, params: { skip: number; take: number; unreadOnly: boolean }) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(params.unreadOnly ? { readAt: null } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return { items, total, unreadCount };
  }

  static async markRead(userId: string, notificationId: string) {
    // Scoped by userId so one user cannot mark another's notification read.
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await prisma.notification.findFirst({
        where: { id: notificationId, userId },
        select: { id: true },
      });
      if (!exists) throw ApiError.notFound('Notification not found');
    }
    return { updated: result.count };
  }

  static async markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}

export default NotificationService;
