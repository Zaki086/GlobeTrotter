import { USE_MOCK, api, request, delay } from '@/lib/api';
import { mockCommunityPosts } from '@/services/mock-data';
import type {
  ApiResponse,
  CommunityComment,
  CommunityFeed,
  CommunityPost,
  CommunityPostDetail,
  CommunityTag,
  CreatePostInput,
  ListPostsQuery,
} from '@/types';

/** Groups a page of posts client-side, mirroring the server's grouping. */
function groupPosts(items: CommunityPost[], groupBy: NonNullable<ListPostsQuery['groupBy']>) {
  if (groupBy === 'none') return null;
  const buckets = new Map<string, CommunityPost[]>();

  const keysFor = (post: CommunityPost): string[] => {
    switch (groupBy) {
      case 'city':
        return [post.city ? `${post.city.name}, ${post.city.country}` : 'No destination'];
      case 'author':
        return [post.author.name];
      case 'rating':
        return [post.rating ? `${post.rating} star${post.rating === 1 ? '' : 's'}` : 'Unrated'];
      case 'tag':
        return post.tags.length ? post.tags : ['Untagged'];
      default:
        return [];
    }
  };

  for (const post of items) {
    for (const key of keysFor(post)) {
      buckets.set(key, [...(buckets.get(key) ?? []), post]);
    }
  }

  return [...buckets.entries()]
    .map(([key, posts]) => ({ key, count: posts.length, posts }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export async function listPosts(
  query: ListPostsQuery = {},
): Promise<CommunityFeed & { total: number }> {
  const groupBy = query.groupBy ?? 'none';

  if (USE_MOCK) {
    await delay();
    let items = [...mockCommunityPosts];

    if (query.search) {
      const term = query.search.toLowerCase();
      items = items.filter(
        (p) => p.title.toLowerCase().includes(term) || p.body.toLowerCase().includes(term),
      );
    }
    if (query.tag) items = items.filter((p) => p.tags.includes(query.tag!));
    if (query.cityId) items = items.filter((p) => p.city?.id === query.cityId);
    if (query.minRating) items = items.filter((p) => (p.rating ?? 0) >= query.minRating!);

    const dir = query.sortOrder === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      switch (query.sortBy) {
        case 'popular':
          return (a.likeCount - b.likeCount) * dir;
        case 'discussed':
          return (a.commentCount - b.commentCount) * dir;
        case 'rating':
          return ((a.rating ?? 0) - (b.rating ?? 0)) * dir;
        default:
          return (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * dir;
      }
    });

    return { items, total: items.length, groups: groupPosts(items, groupBy), groupBy };
  }

  // The feed nests items+groups in `data` and paging in `meta`, so it needs
  // the raw envelope rather than the unwrapping helpers.
  const response = await api.get<ApiResponse<CommunityFeed>>('/community', { params: query });
  return {
    ...response.data.data,
    total: response.data.meta?.total ?? response.data.data.items.length,
  };
}

export async function getPost(id: string): Promise<CommunityPostDetail> {
  if (USE_MOCK) {
    await delay();
    const post = mockCommunityPosts.find((p) => p.id === id);
    if (!post) throw new Error('Post not found');
    return { ...post, comments: [] };
  }
  return request<CommunityPostDetail>({ method: 'GET', url: `/community/${id}` });
}

export async function createPost(input: CreatePostInput): Promise<CommunityPost> {
  if (USE_MOCK) {
    await delay();
    const post: CommunityPost = {
      id: `post-${Date.now()}`,
      title: input.title,
      body: input.body,
      imageUrl: input.imageUrl ?? null,
      tags: input.tags ?? [],
      rating: input.rating ?? null,
      likeCount: 0,
      commentCount: 0,
      likedByViewer: false,
      createdAt: new Date().toISOString(),
      author: { id: 'user-1', name: 'You', avatarUrl: null },
      city: null,
      trip: null,
    };
    mockCommunityPosts.unshift(post);
    return post;
  }
  return request<CommunityPost>({ method: 'POST', url: '/community', data: input });
}

export async function deletePost(id: string): Promise<void> {
  if (USE_MOCK) {
    await delay();
    const i = mockCommunityPosts.findIndex((p) => p.id === id);
    if (i >= 0) mockCommunityPosts.splice(i, 1);
    return;
  }
  await request<void>({ method: 'DELETE', url: `/community/${id}` });
}

export async function toggleLike(id: string): Promise<{ liked: boolean; likeCount: number }> {
  if (USE_MOCK) {
    await delay(150);
    const post = mockCommunityPosts.find((p) => p.id === id);
    if (!post) throw new Error('Post not found');
    post.likedByViewer = !post.likedByViewer;
    post.likeCount += post.likedByViewer ? 1 : -1;
    return { liked: post.likedByViewer, likeCount: post.likeCount };
  }
  return request<{ liked: boolean; likeCount: number }>({
    method: 'POST',
    url: `/community/${id}/like`,
  });
}

export async function addComment(id: string, body: string): Promise<CommunityComment> {
  if (USE_MOCK) {
    await delay();
    const post = mockCommunityPosts.find((p) => p.id === id);
    if (post) post.commentCount += 1;
    return {
      id: `comment-${Date.now()}`,
      body,
      createdAt: new Date().toISOString(),
      author: { id: 'user-1', name: 'You', avatarUrl: null },
    };
  }
  return request<CommunityComment>({
    method: 'POST',
    url: `/community/${id}/comments`,
    data: { body },
  });
}

export async function listTags(): Promise<CommunityTag[]> {
  if (USE_MOCK) {
    await delay(150);
    const counts = new Map<string, number>();
    for (const post of mockCommunityPosts) {
      for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }
  return request<CommunityTag[]>({ method: 'GET', url: '/community/tags' });
}
