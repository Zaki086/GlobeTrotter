import type { Request } from 'express';
import { buildPaginationMeta, sendCreated, sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import type { RequestContext } from '../types';
import { CommunityService } from '../services/community.service';
import type { ListPostsQuery } from '../validators/community.validator';

function contextOf(req: Request): RequestContext {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

export const listPosts = asyncHandler(async (req, res) => {
  const query = req.query as never as ListPostsQuery;
  const { items, total, groups } = await CommunityService.list(query, req.auth?.userId);

  return sendSuccess(
    res,
    { items, groups, groupBy: query.groupBy },
    'Community posts retrieved',
    200,
    buildPaginationMeta(query.page, query.limit, total),
  );
});

export const getPost = asyncHandler(async (req, res) => {
  const post = await CommunityService.getById(req.params.id, req.auth?.userId);
  return sendSuccess(res, post, 'Post retrieved');
});

export const createPost = asyncHandler(async (req, res) => {
  const post = await CommunityService.create(req.auth!.userId, req.body, contextOf(req));
  return sendCreated(res, post, 'Post published');
});

export const updatePost = asyncHandler(async (req, res) => {
  const post = await CommunityService.update(req.params.id, req.auth!.userId, req.body);
  return sendSuccess(res, post, 'Post updated');
});

export const deletePost = asyncHandler(async (req, res) => {
  await CommunityService.remove(
    req.params.id,
    req.auth!.userId,
    req.auth!.role === 'ADMIN',
    contextOf(req),
  );
  return sendSuccess(res, {}, 'Post deleted');
});

export const toggleLike = asyncHandler(async (req, res) => {
  const result = await CommunityService.toggleLike(req.params.id, req.auth!.userId);
  return sendSuccess(res, result, result.liked ? 'Post liked' : 'Like removed');
});

export const addComment = asyncHandler(async (req, res) => {
  const comment = await CommunityService.addComment(
    req.params.id,
    req.auth!.userId,
    req.body.body,
  );
  return sendCreated(res, comment, 'Comment added');
});

export const deleteComment = asyncHandler(async (req, res) => {
  await CommunityService.removeComment(
    req.params.id,
    req.params.commentId,
    req.auth!.userId,
    req.auth!.role === 'ADMIN',
  );
  return sendSuccess(res, {}, 'Comment deleted');
});

export const listTags = asyncHandler(async (_req, res) => {
  const tags = await CommunityService.tags();
  return sendSuccess(res, tags, 'Tags retrieved');
});
