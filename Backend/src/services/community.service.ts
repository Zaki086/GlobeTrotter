import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { toDateString } from '../utils/dates';
import type { RequestContext } from '../types';
import type {
  CreatePostInput,
  ListPostsQuery,
  UpdatePostInput,
} from '../validators/community.validator';
import { AuditService } from './audit.service';
import { NotificationService } from './notification.service';

const postInclude = {
  author: { select: { id: true, name: true, profile: { select: { avatarUrl: true } } } },
  city: { select: { id: true, name: true, country: true, countryCode: true, imageUrl: true } },
  trip: { select: { id: true, name: true, startDate: true, endDate: true, isPublic: true } },
} satisfies Prisma.CommunityPostInclude;

type PostWithRelations = Prisma.CommunityPostGetPayload<{ include: typeof postInclude }>;

/**
 * The community feed (Screen 10): travelers publish write-ups about a trip,
 * city or activity, and others browse them with search, grouping, filtering
 * and sorting.
 */
export class CommunityService {
  static async list(query: ListPostsQuery, viewerId?: string) {
    const where: Prisma.CommunityPostWhereInput = {};

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { body: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.cityId) where.cityId = query.cityId;
    if (query.tripId) where.tripId = query.tripId;
    if (query.authorId) where.authorId = query.authorId;
    if (query.tag) where.tags = { has: query.tag };
    if (query.minRating) where.rating = { gte: query.minRating };

    const orderBy: Prisma.CommunityPostOrderByWithRelationInput =
      query.sortBy === 'popular'
        ? { likeCount: query.sortOrder }
        : query.sortBy === 'discussed'
          ? { commentCount: query.sortOrder }
          : query.sortBy === 'rating'
            ? { rating: query.sortOrder }
            : { createdAt: query.sortOrder };

    const skip = (query.page - 1) * query.limit;

    const [posts, total] = await Promise.all([
      prisma.communityPost.findMany({
        where,
        include: postInclude,
        orderBy,
        skip,
        take: query.limit,
      }),
      prisma.communityPost.count({ where }),
    ]);

    // Which of these has the viewer already liked? One query rather than N.
    const likedIds = viewerId
      ? new Set(
          (
            await prisma.communityLike.findMany({
              where: { userId: viewerId, postId: { in: posts.map((p) => p.id) } },
              select: { postId: true },
            })
          ).map((l) => l.postId),
        )
      : new Set<string>();

    const items = posts.map((post) => this.toDto(post, likedIds.has(post.id)));

    return {
      items,
      total,
      // The client renders one section per group when groupBy != none.
      groups: query.groupBy === 'none' ? null : this.group(items, query.groupBy),
    };
  }

  /** Buckets the page's posts by the requested dimension, largest first. */
  private static group(items: ReturnType<typeof CommunityService.toDto>[], by: ListPostsQuery['groupBy']) {
    const buckets = new Map<string, typeof items>();

    const keysFor = (post: (typeof items)[number]): string[] => {
      switch (by) {
        case 'city':
          return [post.city ? `${post.city.name}, ${post.city.country}` : 'No destination'];
        case 'author':
          return [post.author.name];
        case 'rating':
          return [post.rating ? `${post.rating} star${post.rating === 1 ? '' : 's'}` : 'Unrated'];
        case 'tag':
          // A post can appear under several tags — that is the point of tags.
          return post.tags.length ? post.tags : ['Untagged'];
        default:
          return [];
      }
    };

    for (const post of items) {
      for (const key of keysFor(post)) {
        const bucket = buckets.get(key) ?? [];
        bucket.push(post);
        buckets.set(key, bucket);
      }
    }

    return [...buckets.entries()]
      .map(([key, posts]) => ({ key, count: posts.length, posts }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }

  static async getById(id: string, viewerId?: string) {
    const post = await prisma.communityPost.findUnique({ where: { id }, include: postInclude });
    if (!post) throw ApiError.notFound('Post not found');

    const [liked, comments] = await Promise.all([
      viewerId
        ? prisma.communityLike.findUnique({
            where: { postId_userId: { postId: id, userId: viewerId } },
            select: { id: true },
          })
        : null,
      prisma.communityComment.findMany({
        where: { postId: id },
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true, profile: { select: { avatarUrl: true } } } },
        },
      }),
    ]);

    return {
      ...this.toDto(post, !!liked),
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: {
          id: c.author.id,
          name: c.author.name,
          avatarUrl: c.author.profile?.avatarUrl ?? null,
        },
      })),
    };
  }

  static async create(authorId: string, input: CreatePostInput, ctx: RequestContext = {}) {
    // A post may only reference a trip the author can actually see, otherwise
    // the feed would leak the names of other people's private trips.
    if (input.tripId) {
      const trip = await prisma.trip.findFirst({
        where: {
          id: input.tripId,
          OR: [{ ownerId: authorId }, { members: { some: { userId: authorId } } }],
        },
        select: { id: true },
      });
      if (!trip) throw ApiError.badRequest('That trip does not exist or is not yours');
    }

    if (input.cityId) {
      const city = await prisma.city.findUnique({ where: { id: input.cityId }, select: { id: true } });
      if (!city) throw ApiError.badRequest('That city does not exist');
    }

    const post = await prisma.communityPost.create({
      data: {
        authorId,
        tripId: input.tripId ?? null,
        cityId: input.cityId ?? null,
        title: input.title,
        body: input.body,
        imageUrl: input.imageUrl ?? null,
        // Normalised so "Food", "food" and " food " group together.
        tags: [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))],
        rating: input.rating ?? null,
      },
      include: postInclude,
    });

    AuditService.queue({
      actorId: authorId,
      action: 'community.post_created',
      resourceType: 'community_post',
      resourceId: post.id,
      ...ctx,
    });

    return this.toDto(post, false);
  }

  static async update(id: string, userId: string, input: UpdatePostInput) {
    const existing = await prisma.communityPost.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!existing) throw ApiError.notFound('Post not found');
    if (existing.authorId !== userId) throw ApiError.forbidden('You can only edit your own posts');

    const post = await prisma.communityPost.update({
      where: { id },
      data: {
        ...input,
        ...(input.tags
          ? { tags: [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))] }
          : {}),
      },
      include: postInclude,
    });

    return this.toDto(post, false);
  }

  static async remove(id: string, userId: string, isAdmin: boolean, ctx: RequestContext = {}) {
    const post = await prisma.communityPost.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!post) throw ApiError.notFound('Post not found');
    // Admins can moderate; everyone else may only remove their own.
    if (post.authorId !== userId && !isAdmin) {
      throw ApiError.forbidden('You can only delete your own posts');
    }

    await prisma.communityPost.delete({ where: { id } });

    AuditService.queue({
      actorId: userId,
      action: isAdmin && post.authorId !== userId ? 'community.post_moderated' : 'community.post_deleted',
      resourceType: 'community_post',
      resourceId: id,
      ...ctx,
    });
  }

  /**
   * Toggles a like. The counter is updated in the same transaction as the
   * like row, so the denormalised count cannot drift from reality.
   */
  static async toggleLike(id: string, userId: string) {
    const post = await prisma.communityPost.findUnique({
      where: { id },
      select: { id: true, authorId: true, title: true },
    });
    if (!post) throw ApiError.notFound('Post not found');

    const existing = await prisma.communityLike.findUnique({
      where: { postId_userId: { postId: id, userId } },
      select: { id: true },
    });

    if (existing) {
      const [, updated] = await prisma.$transaction([
        prisma.communityLike.delete({ where: { id: existing.id } }),
        prisma.communityPost.update({
          where: { id },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        }),
      ]);
      return { liked: false, likeCount: updated.likeCount };
    }

    const [, updated] = await prisma.$transaction([
      prisma.communityLike.create({ data: { postId: id, userId } }),
      prisma.communityPost.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      }),
    ]);

    if (post.authorId !== userId) {
      NotificationService.queue({
        userId: post.authorId,
        type: 'SYSTEM',
        title: 'Someone liked your post',
        body: post.title,
        data: { postId: id },
      });
    }

    return { liked: true, likeCount: updated.likeCount };
  }

  static async addComment(id: string, userId: string, body: string) {
    const post = await prisma.communityPost.findUnique({
      where: { id },
      select: { id: true, authorId: true, title: true },
    });
    if (!post) throw ApiError.notFound('Post not found');

    const [comment] = await prisma.$transaction([
      prisma.communityComment.create({
        data: { postId: id, authorId: userId, body },
        include: {
          author: { select: { id: true, name: true, profile: { select: { avatarUrl: true } } } },
        },
      }),
      prisma.communityPost.update({
        where: { id },
        data: { commentCount: { increment: 1 } },
      }),
    ]);

    if (post.authorId !== userId) {
      NotificationService.queue({
        userId: post.authorId,
        type: 'SYSTEM',
        title: 'New comment on your post',
        body: post.title,
        data: { postId: id },
      });
    }

    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      author: {
        id: comment.author.id,
        name: comment.author.name,
        avatarUrl: comment.author.profile?.avatarUrl ?? null,
      },
    };
  }

  static async removeComment(postId: string, commentId: string, userId: string, isAdmin: boolean) {
    const comment = await prisma.communityComment.findFirst({
      where: { id: commentId, postId },
      select: { id: true, authorId: true },
    });
    if (!comment) throw ApiError.notFound('Comment not found');
    if (comment.authorId !== userId && !isAdmin) {
      throw ApiError.forbidden('You can only delete your own comments');
    }

    await prisma.$transaction([
      prisma.communityComment.delete({ where: { id: comment.id } }),
      prisma.communityPost.update({
        where: { id: postId },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);
  }

  /** Distinct tags with usage counts, for the filter rail. */
  static async tags(limit = 30) {
    const rows = await prisma.$queryRaw<Array<{ tag: string; count: bigint }>>`
      SELECT unnest(tags) AS tag, COUNT(*)::bigint AS count
      FROM community_posts
      GROUP BY tag
      ORDER BY count DESC, tag ASC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
  }

  private static toDto(post: PostWithRelations, likedByViewer: boolean) {
    return {
      id: post.id,
      title: post.title,
      body: post.body,
      imageUrl: post.imageUrl,
      tags: post.tags,
      rating: post.rating,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      likedByViewer,
      createdAt: post.createdAt,
      author: {
        id: post.author.id,
        name: post.author.name,
        avatarUrl: post.author.profile?.avatarUrl ?? null,
      },
      city: post.city,
      trip: post.trip
        ? {
            id: post.trip.id,
            name: post.trip.name,
            startDate: toDateString(post.trip.startDate),
            endDate: toDateString(post.trip.endDate),
            isPublic: post.trip.isPublic,
          }
        : null,
    };
  }
}

export default CommunityService;
