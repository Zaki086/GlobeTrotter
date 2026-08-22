import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  PenLine,
  Star,
  Users,
} from 'lucide-react';
import { addComment, createPost, listPosts, listTags, toggleLike } from '@/services/community';
import { searchCities } from '@/services/city';
import { GlassCard } from '@/components/GlassCard';
import { BottomSheet } from '@/components/BottomSheet';
import { ListToolbar, Pill, type ToolbarOption } from '@/components/ListToolbar';
import { SectionHeader } from '@/components/SectionHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useToast } from '@/hooks/use-toast';
import { formatRelative, initials } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CommunityGroupBy, CommunityPost, CommunitySortBy } from '@/types';

const GROUP_OPTIONS: ToolbarOption<CommunityGroupBy>[] = [
  { value: 'none', label: 'No grouping' },
  { value: 'city', label: 'Destination' },
  { value: 'tag', label: 'Tag' },
  { value: 'rating', label: 'Rating' },
  { value: 'author', label: 'Traveler' },
];

const SORT_OPTIONS: ToolbarOption<CommunitySortBy>[] = [
  { value: 'recent', label: 'Most recent' },
  { value: 'popular', label: 'Most liked' },
  { value: 'discussed', label: 'Most discussed' },
  { value: 'rating', label: 'Highest rated' },
];

/**
 * Screen 10 — the community feed. Travelers publish experiences about a trip,
 * city or activity, and everyone else browses them with search, grouping,
 * filtering and sorting.
 */
export function CommunityPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<CommunityGroupBy>('none');
  const [sortBy, setSortBy] = useState<CommunitySortBy>('recent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [tag, setTag] = useState<string | undefined>();
  const [minRating, setMinRating] = useState<number | undefined>();
  const [composeOpen, setComposeOpen] = useState(false);
  const [openPost, setOpenPost] = useState<CommunityPost | null>(null);

  const debounced = useDebouncedValue(search, 300);

  const query = useMemo(
    () => ({
      search: debounced || undefined,
      tag,
      minRating,
      groupBy,
      sortBy,
      sortOrder,
      limit: 50,
    }),
    [debounced, tag, minRating, groupBy, sortBy, sortOrder],
  );

  const feed = useQuery({
    queryKey: ['community', query],
    queryFn: () => listPosts(query),
  });

  const tags = useQuery({ queryKey: ['community', 'tags'], queryFn: listTags });

  const like = useMutation({
    mutationFn: (id: string) => toggleLike(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['community'] }),
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const activeFilterCount = (tag ? 1 : 0) + (minRating ? 1 : 0);
  const posts = feed.data?.items ?? [];
  const groups = feed.data?.groups ?? null;

  const reset = () => {
    setTag(undefined);
    setMinRating(undefined);
    setGroupBy('none');
    setSortBy('recent');
    setSortOrder('desc');
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
            <Users className="h-6 w-6 text-primary" />
            Community
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Real experiences from travelers who have been there.
          </p>
        </div>

        {isAuthenticated && (
          <Button onClick={() => setComposeOpen(true)} className="rounded-2xl">
            <PenLine className="mr-1.5 h-4 w-4" />
            Share
          </Button>
        )}
      </header>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search experiences…"
        groupBy={groupBy}
        groupOptions={GROUP_OPTIONS}
        onGroupByChange={setGroupBy}
        sortBy={sortBy}
        sortOptions={SORT_OPTIONS}
        onSortByChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        activeFilterCount={activeFilterCount}
        onResetFilters={reset}
        resultCount={feed.data?.total}
        filters={
          <>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Minimum rating</legend>
              <div className="flex flex-wrap gap-2">
                <Pill active={!minRating} onClick={() => setMinRating(undefined)}>
                  Any
                </Pill>
                {[3, 4, 5].map((value) => (
                  <Pill
                    key={value}
                    active={minRating === value}
                    onClick={() => setMinRating(minRating === value ? undefined : value)}
                  >
                    {value}★ and up
                  </Pill>
                ))}
              </div>
            </fieldset>

            {(tags.data?.length ?? 0) > 0 && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Tag</legend>
                <div className="flex flex-wrap gap-2">
                  <Pill active={!tag} onClick={() => setTag(undefined)}>
                    All
                  </Pill>
                  {tags.data?.slice(0, 12).map((item) => (
                    <Pill
                      key={item.tag}
                      active={tag === item.tag}
                      onClick={() => setTag(tag === item.tag ? undefined : item.tag)}
                    >
                      {item.tag} ({item.count})
                    </Pill>
                  ))}
                </div>
              </fieldset>
            )}
          </>
        }
      />

      {/* Tag rail — quick filtering without opening the sheet. */}
      {(tags.data?.length ?? 0) > 0 && (
        <div className="snap-x-rail -mx-4 px-4 md:mx-0 md:px-0">
          <Pill active={!tag} onClick={() => setTag(undefined)}>
            All topics
          </Pill>
          {tags.data?.slice(0, 12).map((item) => (
            <Pill
              key={item.tag}
              active={tag === item.tag}
              onClick={() => setTag(tag === item.tag ? undefined : item.tag)}
            >
              #{item.tag}
            </Pill>
          ))}
        </div>
      )}

      {feed.isLoading ? (
        <LoadingSkeleton count={4} />
      ) : feed.isError ? (
        <ErrorState
          title="Could not load the community feed"
          message={feed.error instanceof Error ? feed.error.message : undefined}
          onRetry={() => void feed.refetch()}
        />
      ) : posts.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          message={
            debounced || activeFilterCount
              ? 'Try a different search or clear the filters.'
              : 'Be the first to share an experience.'
          }
          action={
            isAuthenticated ? (
              <Button onClick={() => setComposeOpen(true)} className="rounded-2xl">
                <PenLine className="mr-1.5 h-4 w-4" />
                Write a post
              </Button>
            ) : undefined
          }
        />
      ) : groups ? (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              <SectionHeader title={group.key} subtitle={`${group.count} posts`} />
              <div className="grid gap-4 md:grid-cols-2">
                {group.posts.map((post) => (
                  <PostCard
                    key={`${group.key}-${post.id}`}
                    post={post}
                    onOpen={() => setOpenPost(post)}
                    onLike={() => isAuthenticated ? like.mutate(post.id) : navigate('/login')}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {posts.map((post) => (
              <motion.div
                key={post.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <PostCard
                  post={post}
                  onOpen={() => setOpenPost(post)}
                  onLike={() => (isAuthenticated ? like.mutate(post.id) : navigate('/login'))}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <ComposeSheet
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onCreated={() => void queryClient.invalidateQueries({ queryKey: ['community'] })}
      />

      <PostSheet
        post={openPost}
        onClose={() => setOpenPost(null)}
        onChanged={() => void queryClient.invalidateQueries({ queryKey: ['community'] })}
      />
    </div>
  );
}

function PostCard({
  post,
  onOpen,
  onLike,
}: {
  post: CommunityPost;
  onOpen: () => void;
  onLike: () => void;
}) {
  return (
    <GlassCard className="flex h-full flex-col overflow-hidden rounded-3xl p-0">
      <button onClick={onOpen} className="block text-left">
        {post.imageUrl && (
          <div className="relative h-40 overflow-hidden">
            <img
              src={post.imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              loading="lazy"
            />
            {post.city && (
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
                <MapPin className="h-3 w-3" />
                {post.city.name}
              </span>
            )}
          </div>
        )}

        <div className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-base font-semibold leading-snug">{post.title}</h3>
            {post.rating && (
              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                <Star className="h-3 w-3 fill-current" />
                {post.rating}
              </span>
            )}
          </div>

          <p className="line-clamp-3 text-sm text-muted-foreground">{post.body}</p>

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {post.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>

      <div className="mt-auto flex items-center gap-3 border-t border-border px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {post.author.avatarUrl ? (
            <img src={post.author.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            initials(post.author.name)
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{post.author.name}</span>
          <span className="block text-[11px] text-muted-foreground">
            {formatRelative(post.createdAt)}
          </span>
        </span>

        <button
          onClick={onLike}
          className={cn(
            'flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors',
            post.likedByViewer
              ? 'text-destructive'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={post.likedByViewer}
          aria-label={post.likedByViewer ? 'Remove like' : 'Like this post'}
        >
          <Heart className={cn('h-4 w-4', post.likedByViewer && 'fill-current')} />
          {post.likeCount}
        </button>

        <button
          onClick={onOpen}
          className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          aria-label="View comments"
        >
          <MessageCircle className="h-4 w-4" />
          {post.commentCount}
        </button>
      </div>
    </GlassCard>
  );
}

function PostSheet({
  post,
  onClose,
  onChanged,
}: {
  post: CommunityPost | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [comment, setComment] = useState('');

  const send = useMutation({
    mutationFn: () => addComment(post!.id, comment.trim()),
    onSuccess: () => {
      setComment('');
      onChanged();
      toast('Comment added', 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  if (!post) return null;

  return (
    <BottomSheet open={!!post} onClose={onClose} title={post.title}>
      <div className="space-y-4 pb-2">
        {post.imageUrl && (
          <img src={post.imageUrl} alt="" className="h-44 w-full rounded-2xl object-cover" />
        )}

        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(post.author.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{post.author.name}</span>
            <span className="block text-xs text-muted-foreground">
              {formatRelative(post.createdAt)}
              {post.city && ` · ${post.city.name}, ${post.city.country}`}
            </span>
          </span>
          {post.rating && (
            <span className="flex items-center gap-0.5 text-sm font-semibold text-warning">
              <Star className="h-4 w-4 fill-current" />
              {post.rating}
            </span>
          )}
        </div>

        <p className="whitespace-pre-line text-sm leading-relaxed">{post.body}</p>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {isAuthenticated ? (
          <div className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="community-comment">Add a comment</Label>
            <div className="flex gap-2">
              <Input
                id="community-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share a tip or ask a question…"
                maxLength={2000}
                className="rounded-2xl"
              />
              <Button
                className="rounded-2xl"
                disabled={!comment.trim() || send.isPending}
                onClick={() => send.mutate()}
              >
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
            Sign in to join the conversation.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

function ComposeSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [rating, setRating] = useState<number | undefined>();
  const [citySearch, setCitySearch] = useState('');
  const [cityId, setCityId] = useState<string | undefined>();

  const debouncedCity = useDebouncedValue(citySearch, 300);
  const cities = useQuery({
    queryKey: ['cities', { search: debouncedCity }],
    queryFn: () => searchCities({ search: debouncedCity || undefined, limit: 6 }),
    enabled: open && debouncedCity.length > 1,
  });

  const publish = useMutation({
    mutationFn: () =>
      createPost({
        title: title.trim(),
        body: body.trim(),
        cityId,
        rating,
        tags: tagInput
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 8),
      }),
    onSuccess: () => {
      onCreated();
      toast('Your post is live', 'success');
      setTitle('');
      setBody('');
      setTagInput('');
      setRating(undefined);
      setCityId(undefined);
      setCitySearch('');
      onClose();
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const invalid = title.trim().length < 3 || body.trim().length < 10;

  return (
    <BottomSheet open={open} onClose={onClose} title="Share an experience">
      <div className="space-y-4 pb-2">
        <div className="space-y-1.5">
          <Label htmlFor="post-title">Title</Label>
          <Input
            id="post-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Three days in Lisbon on a budget"
            maxLength={180}
            className="rounded-2xl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="post-body">Your experience</Label>
          <textarea
            id="post-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            maxLength={10_000}
            placeholder="What worked, what you'd skip, what you wish you'd known…"
            className="w-full resize-none rounded-2xl border border-input bg-transparent px-4 py-3 text-sm outline-none transition-colors focus-visible:border-primary"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="post-city">Destination (optional)</Label>
          <Input
            id="post-city"
            value={citySearch}
            onChange={(e) => {
              setCitySearch(e.target.value);
              setCityId(undefined);
            }}
            placeholder="Search a city…"
            className="rounded-2xl"
          />
          {(cities.data?.items.length ?? 0) > 0 && !cityId && (
            <div className="flex flex-wrap gap-2 pt-1">
              {cities.data?.items.map((city) => (
                <Pill
                  key={city.id}
                  active={false}
                  onClick={() => {
                    setCityId(city.id);
                    setCitySearch(`${city.name}, ${city.country}`);
                  }}
                >
                  {city.name}
                </Pill>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="post-tags">Tags (comma separated)</Label>
          <Input
            id="post-tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="food, budget, rail"
            className="rounded-2xl"
          />
        </div>

        <div>
          <Label className="mb-2 block">Rating (optional)</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => setRating(rating === value ? undefined : value)}
                className={cn(
                  'touch-target flex flex-1 items-center justify-center rounded-2xl border transition-colors',
                  rating && value <= rating
                    ? 'border-warning bg-warning/10 text-warning'
                    : 'border-border text-muted-foreground',
                )}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
              >
                <Star className={cn('h-5 w-5', rating && value <= rating && 'fill-current')} />
              </button>
            ))}
          </div>
        </div>

        <Button
          className="w-full rounded-2xl"
          size="lg"
          disabled={invalid || publish.isPending}
          onClick={() => publish.mutate()}
        >
          {publish.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Publishing…
            </>
          ) : (
            'Publish'
          )}
        </Button>
      </div>
    </BottomSheet>
  );
}
