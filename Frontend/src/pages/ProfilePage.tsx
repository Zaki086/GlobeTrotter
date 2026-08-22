import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  Globe,
  Heart,
  LogOut,
  Moon,
  Shield,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import {
  deleteProfile,
  getProfile,
  listNotifications,
  markAllNotificationsRead,
  removeSavedDestination,
  updateProfile,
} from '@/services/profile';
import { logoutAll } from '@/services/auth';
import { GlassCard } from '@/components/GlassCard';
import { BottomSheet } from '@/components/BottomSheet';
import { SectionHeader } from '@/components/SectionHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorState } from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useToast } from '@/hooks/use-toast';
import { CURRENCIES, LANGUAGES } from '@/lib/constants';
import { costLevel, fallbackImage, formatDate, initials } from '@/lib/format';
import { cn } from '@/lib/utils';

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [language, setLanguage] = useState('en');
  const [currency, setCurrency] = useState('USD');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: listNotifications,
  });

  const profile = profileQuery.data;

  // Seed the editable fields once the profile arrives.
  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setBio(profile.bio ?? '');
    setLanguage(profile.language);
    setCurrency(profile.currency);
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      updateProfile({
        name: name.trim(),
        bio: bio.trim() || null,
        language,
        currency,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast('Profile updated', 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const unsave = useMutation({
    mutationFn: (cityId: string) => removeSavedDestination(cityId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast('Destination removed', 'success');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const markRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const signOutEverywhere = useMutation({
    mutationFn: logoutAll,
    onSuccess: () => {
      toast('Signed out of all devices', 'success');
      navigate('/login');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  const removeAccount = useMutation({
    mutationFn: () => deleteProfile(password),
    onSuccess: () => {
      toast('Your account has been deleted', 'success');
      void logout();
      navigate('/login');
    },
    onError: (err: Error) => toast(err.message, 'error'),
  });

  if (profileQuery.isLoading) return <LoadingSkeleton count={5} />;

  if (profileQuery.isError || !profile) {
    return (
      <ErrorState title="Could not load your profile" onRetry={() => void profileQuery.refetch()} />
    );
  }

  const dirty =
    name.trim() !== profile.name ||
    (bio.trim() || null) !== (profile.bio ?? null) ||
    language !== profile.language ||
    currency !== profile.currency;

  const unread = notificationsQuery.data?.unreadCount ?? 0;

  return (
    <div className="space-y-8">
      {/* Identity */}
      <GlassCard className="flex items-center gap-4 rounded-3xl p-5">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-2xl object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground">
            {initials(profile.name)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{profile.name}</h1>
          <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {profile.stats.tripCount} trips · joined {formatDate(profile.createdAt)}
          </p>
        </div>

        {profile.role === 'ADMIN' && (
          <button
            onClick={() => navigate('/admin')}
            className="shrink-0 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent"
          >
            <Shield className="mr-1 inline h-3 w-3" />
            Admin
          </button>
        )}
      </GlassCard>

      {/* Personal info */}
      <section className="space-y-3">
        <SectionHeader title="Personal info" icon={User} />
        <GlassCard className="space-y-4 rounded-3xl p-5">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-bio">Bio</Label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Tell other travelers about yourself"
              className="w-full resize-none rounded-2xl border border-input bg-transparent px-4 py-3 text-sm outline-none transition-colors focus-visible:border-primary"
            />
          </div>

          <Button
            className="w-full rounded-2xl"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </GlassCard>
      </section>

      {/* Preferences */}
      <section className="space-y-3">
        <SectionHeader title="Preferences" icon={Globe} />
        <GlassCard className="space-y-5 rounded-3xl p-5">
          <div>
            <Label className="mb-2 block">Language</Label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((item) => (
                <Chip
                  key={item.code}
                  active={language === item.code}
                  onClick={() => setLanguage(item.code)}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Preferred currency</Label>
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((code) => (
                <Chip key={code} active={currency === code} onClick={() => setCurrency(code)}>
                  {code}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <p className="text-sm font-medium">Appearance</p>
              <p className="text-xs text-muted-foreground">
                {theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="touch-target flex items-center justify-center rounded-2xl border border-border transition-colors hover:bg-muted"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </GlassCard>
      </section>

      {/* Saved destinations */}
      <section className="space-y-3">
        <SectionHeader
          title="Saved destinations"
          icon={Heart}
          subtitle={`${profile.savedDestinations.length} saved`}
        />
        {profile.savedDestinations.length === 0 ? (
          <GlassCard className="rounded-3xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing saved yet — tap the heart on a city to keep it here.
            </p>
            <Button
              variant="outline"
              className="mt-3 rounded-2xl"
              onClick={() => navigate('/cities')}
            >
              Explore cities
            </Button>
          </GlassCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {profile.savedDestinations.map((city) => (
              <GlassCard key={city.id} className="flex items-center gap-3 rounded-2xl p-3">
                <img
                  src={city.imageUrl ?? fallbackImage(city.name, 100, 100)}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  loading="lazy"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{city.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {city.country} · {costLevel(city.costIndex).label}
                  </span>
                </span>
                <button
                  onClick={() => unsave.mutate(city.id)}
                  className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Remove ${city.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </GlassCard>
            ))}
          </div>
        )}
      </section>

      {/* Notifications */}
      <section className="space-y-3">
        <SectionHeader
          title="Notifications"
          icon={Bell}
          action={
            unread > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => markRead.mutate()}>
                Mark all read
              </Button>
            ) : undefined
          }
        />
        {(notificationsQuery.data?.items.length ?? 0) === 0 ? (
          <GlassCard className="rounded-3xl p-6 text-center text-sm text-muted-foreground">
            You're all caught up.
          </GlassCard>
        ) : (
          <ul className="space-y-2">
            {notificationsQuery.data?.items.slice(0, 8).map((item) => (
              <li key={item.id}>
                <GlassCard
                  className={cn('rounded-2xl p-4', !item.readAt && 'border-primary/40')}
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.body && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.body}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </p>
                </GlassCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Privacy & account */}
      <section className="space-y-3">
        <SectionHeader title="Privacy & security" icon={Shield} />
        <GlassCard className="divide-y divide-border rounded-3xl">
          <button
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 p-4 text-left text-sm font-medium transition-colors hover:bg-muted"
          >
            <LogOut className="h-4 w-4 text-muted-foreground" />
            Log out
          </button>

          <button
            onClick={() => signOutEverywhere.mutate()}
            disabled={signOutEverywhere.isPending}
            className="flex w-full items-center gap-3 p-4 text-left text-sm font-medium transition-colors hover:bg-muted"
          >
            <Shield className="h-4 w-4 text-muted-foreground" />
            {signOutEverywhere.isPending ? 'Signing out…' : 'Log out of all devices'}
          </button>

          <button
            onClick={() => setDeleteOpen(true)}
            className="flex w-full items-center gap-3 p-4 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete my account
          </button>
        </GlassCard>
      </section>

      {/* Delete account */}
      <BottomSheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account">
        <div className="space-y-4 pb-2">
          <p className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This permanently deletes your account, every trip you own, and all of their stops,
            activities and expenses. It cannot be undone.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="delete-password">Confirm your password</Label>
            <Input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-2xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="rounded-2xl"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-2xl"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-2xl"
              disabled={
                confirmText !== 'DELETE' || password.length === 0 || removeAccount.isPending
              }
              onClick={() => removeAccount.mutate()}
            >
              {removeAccount.isPending ? 'Deleting…' : 'Delete forever'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'border border-border text-muted-foreground hover:text-foreground',
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
