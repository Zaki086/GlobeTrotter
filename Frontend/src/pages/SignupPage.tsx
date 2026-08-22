import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Camera,
  Eye,
  EyeOff,
  Globe2,
  Lock,
  Mail,
  MapPin,
  Phone,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

/**
 * Registration — wireframe screen 2.
 *
 * Collects first/last name, email, phone, city, country, an optional photo
 * and a free-text note, in the two-column layout the wireframe shows. Only
 * name, email and password are required; the rest enrich the profile.
 */
const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  email: z.string().trim().email('Enter a valid email'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{6,30}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  avatarUrl: z.string().trim().url('Must be a valid URL').optional().or(z.literal('')),
  additionalInfo: z.string().trim().max(500).optional(),
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[a-z]/, 'Needs a lowercase letter')
    .regex(/[A-Z]/, 'Needs an uppercase letter')
    .regex(/\d/, 'Needs a number')
    .regex(/[^A-Za-z0-9]/, 'Needs a special character'),
});

type FormData = z.infer<typeof schema>;

function passwordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const STRENGTH_LABELS = ['Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['bg-destructive', 'bg-warning', 'bg-warning', 'bg-success'];

export function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), mode: 'onBlur' });

  const pwd = watch('password', '');
  const avatarUrl = watch('avatarUrl', '');
  const firstName = watch('firstName', '');
  const strength = useMemo(() => passwordStrength(pwd), [pwd]);

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      await signup({
        firstName: data.firstName,
        lastName: data.lastName,
        name: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        password: data.password,
        phone: data.phone || undefined,
        city: data.city || undefined,
        country: data.country || undefined,
        avatarUrl: data.avatarUrl || undefined,
        additionalInfo: data.additionalInfo || undefined,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
      {/* Avatar, as in the wireframe's circular photo slot */}
      <div className="mb-5 flex flex-col items-center gap-2">
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-20 w-20 rounded-full border-2 border-white/25 object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-white/30 bg-white/10 text-white/60">
              {firstName ? (
                <span className="text-xl font-semibold text-white">
                  {firstName.charAt(0).toUpperCase()}
                </span>
              ) : (
                <Camera className="h-7 w-7" />
              )}
            </span>
          )}
        </div>
        <h2 className="text-2xl font-semibold text-white">Create account</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name — two columns, as the wireframe shows */}
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="firstName"
            label="First name"
            icon={User}
            error={errors.firstName?.message}
            {...register('firstName')}
            placeholder="Ada"
            autoComplete="given-name"
          />
          <Field
            id="lastName"
            label="Last name"
            error={errors.lastName?.message}
            {...register('lastName')}
            placeholder="Lovelace"
            autoComplete="family-name"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            id="email"
            label="Email"
            icon={Mail}
            type="email"
            error={errors.email?.message}
            {...register('email')}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <Field
            id="phone"
            label="Phone"
            icon={Phone}
            error={errors.phone?.message}
            {...register('phone')}
            placeholder="+1 555 0100"
            autoComplete="tel"
            optional
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            id="city"
            label="City"
            icon={MapPin}
            error={errors.city?.message}
            {...register('city')}
            placeholder="Lisbon"
            autoComplete="address-level2"
            optional
          />
          <Field
            id="country"
            label="Country"
            icon={Globe2}
            error={errors.country?.message}
            {...register('country')}
            placeholder="Portugal"
            autoComplete="country-name"
            optional
          />
        </div>

        {/* Password with strength meter */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-white/90">
            Password
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('password')}
              className="border-white/10 bg-white/10 pl-10 pr-10 text-white placeholder:text-white/40 focus-visible:ring-sky-400"
              placeholder="••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 transition-colors hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {pwd.length > 0 && (
            <>
              <div className="flex gap-1.5 pt-1">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors',
                      i < strength ? STRENGTH_COLORS[strength - 1] : 'bg-white/15',
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-white/60">
                Strength:{' '}
                <span className="font-medium text-white">
                  {STRENGTH_LABELS[Math.max(0, strength - 1)]}
                </span>
              </p>
            </>
          )}
          {errors.password && (
            <p className="text-xs text-red-300">{errors.password.message}</p>
          )}
        </div>

        {/* Additional information — the wireframe's free-text box */}
        <div className="space-y-1.5">
          <Label htmlFor="additionalInfo" className="text-sm font-medium text-white/90">
            Additional information <span className="text-white/40">(optional)</span>
          </Label>
          <textarea
            id="additionalInfo"
            rows={2}
            maxLength={500}
            {...register('additionalInfo')}
            placeholder="Tell other travelers a little about yourself…"
            className="w-full resize-none rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-sky-400"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="avatarUrl" className="text-sm font-medium text-white/90">
            Photo URL <span className="text-white/40">(optional)</span>
          </Label>
          <Input
            id="avatarUrl"
            type="url"
            {...register('avatarUrl')}
            placeholder="https://…"
            className="border-white/10 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-sky-400"
          />
          {errors.avatarUrl && (
            <p className="text-xs text-red-300">{errors.avatarUrl.message}</p>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-red-500/15 px-4 py-2.5 text-sm text-red-200" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-sky-500 text-white hover:bg-sky-600"
        >
          {isSubmitting ? 'Creating account…' : 'Register'}
        </Button>

        <p className="text-center text-sm text-white/70">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-sky-300 hover:text-sky-200">
            Sign in
          </Link>
        </p>
      </form>
    </motion.div>
  );
}

/** Labelled input matching the auth screens' glass styling. */
const Field = ({
  id,
  label,
  icon: Icon,
  error,
  optional,
  ...props
}: {
  id: string;
  label: string;
  icon?: typeof User;
  error?: string;
  optional?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-sm font-medium text-white/90">
      {label} {optional && <span className="text-white/40">(optional)</span>}
    </Label>
    <div className="relative">
      {Icon && (
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
      )}
      <Input
        id={id}
        {...props}
        className={cn(
          'border-white/10 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-sky-400',
          Icon && 'pl-10',
        )}
      />
    </div>
    {error && <p className="text-xs text-red-300">{error}</p>}
  </div>
);
