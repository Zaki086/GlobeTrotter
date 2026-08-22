import { z } from 'zod';
import { httpUrl, pagination, uuid } from './common.validator';

export const listPostsQuerySchema = pagination.extend({
  search: z.string().trim().max(180).optional(),
  cityId: uuid.optional(),
  tripId: uuid.optional(),
  authorId: uuid.optional(),
  tag: z.string().trim().max(40).optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  /** Drives the "Group by" control on the community screen. */
  groupBy: z.enum(['none', 'city', 'tag', 'rating', 'author']).default('none'),
  sortBy: z.enum(['recent', 'popular', 'rating', 'discussed']).default('recent'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const createPostSchema = z.object({
  title: z.string().trim().min(3, 'Give your post a title').max(180),
  body: z.string().trim().min(10, 'Tell us a bit more').max(10_000),
  imageUrl: httpUrl.optional(),
  tripId: uuid.optional(),
  cityId: uuid.optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(8, 'At most 8 tags').default([]),
  rating: z.number().int().min(1).max(5).optional(),
});

export const updatePostSchema = createPostSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
});

export const postIdParamSchema = z.object({ id: uuid });
export const commentParamsSchema = z.object({ id: uuid, commentId: uuid });

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
