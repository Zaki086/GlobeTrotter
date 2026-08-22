import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { securityLogger } from '../config/logger';
import type { AuditAction } from '../config/constants';
import type { RequestContext } from '../types';

export interface AuditEntry extends RequestContext {
  actorId?: string | null;
  action: AuditAction | string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Writes the durable audit trail and mirrors it to the security log file.
 *
 * Auditing is observability, not business logic: a failure here is logged but
 * never propagated, so an audit outage cannot roll back a user's successful
 * trip creation.
 */
export class AuditService {
  static async record(entry: AuditEntry): Promise<void> {
    const { actorId, action, resourceType, resourceId, ipAddress, userAgent, metadata } = entry;

    securityLogger.info(action, {
      actorId,
      resourceType,
      resourceId,
      ipAddress,
      userAgent,
      ...(metadata as object | undefined),
    });

    try {
      await prisma.auditLog.create({
        data: {
          actorId: actorId ?? null,
          action,
          resourceType,
          resourceId: resourceId ?? null,
          ipAddress: ipAddress?.slice(0, 64) ?? null,
          userAgent: userAgent?.slice(0, 512) ?? null,
          metadata: metadata ?? undefined,
        },
      });
    } catch (err) {
      securityLogger.error('Failed to persist audit log', {
        action,
        message: (err as Error).message,
      });
    }
  }

  /** Fire-and-forget variant for hot paths that must not await the write. */
  static queue(entry: AuditEntry): void {
    void AuditService.record(entry);
  }

  static async list(params: {
    skip: number;
    take: number;
    action?: string;
    actorId?: string;
    resourceType?: string;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (params.action) where.action = params.action;
    if (params.actorId) where.actorId = params.actorId;
    if (params.resourceType) where.resourceType = params.resourceType;
    if (params.from || params.to) {
      where.createdAt = {
        ...(params.from ? { gte: params.from } : {}),
        ...(params.to ? { lte: params.to } : {}),
      };
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}

export default AuditService;
