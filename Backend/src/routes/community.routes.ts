import { Router } from 'express';
import * as controller from '../controllers/community.controller';
import { authenticate, optionalAuth } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { rateLimiters } from '../middleware/rateLimiter';
import {
  commentParamsSchema,
  createCommentSchema,
  createPostSchema,
  listPostsQuerySchema,
  postIdParamSchema,
  updatePostSchema,
} from '../validators/community.validator';

const router = Router();

// Reading the feed works signed out; optionalAuth lets a signed-in viewer see
// which posts they have already liked.
router.get(
  '/tags',
  optionalAuth,
  controller.listTags,
);

router.get(
  '/',
  optionalAuth,
  rateLimiters.search,
  validate({ query: listPostsQuerySchema }),
  controller.listPosts,
);

router.get(
  '/:id',
  optionalAuth,
  validate({ params: postIdParamSchema }),
  controller.getPost,
);

// Writing requires an account.
router.post(
  '/',
  authenticate,
  rateLimiters.write,
  validate({ body: createPostSchema }),
  controller.createPost,
);

router.patch(
  '/:id',
  authenticate,
  rateLimiters.write,
  validate({ params: postIdParamSchema, body: updatePostSchema }),
  controller.updatePost,
);

router.delete(
  '/:id',
  authenticate,
  validate({ params: postIdParamSchema }),
  controller.deletePost,
);

router.post(
  '/:id/like',
  authenticate,
  rateLimiters.write,
  validate({ params: postIdParamSchema }),
  controller.toggleLike,
);

router.post(
  '/:id/comments',
  authenticate,
  rateLimiters.write,
  validate({ params: postIdParamSchema, body: createCommentSchema }),
  controller.addComment,
);

router.delete(
  '/:id/comments/:commentId',
  authenticate,
  validate({ params: commentParamsSchema }),
  controller.deleteComment,
);

export default router;
