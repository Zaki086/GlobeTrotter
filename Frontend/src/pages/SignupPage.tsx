import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof schema>;

function passwordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

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
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const pwd = watch('password', '');
  const strength = useMemo(() => passwordStrength(pwd), [pwd]);
  const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500'];

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      await signup(data);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
      <h2 className="mb-6 text-2xl font-semibold text-white">Create account</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-1.5">
          <Label className="text-white/80">Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" />
            <Input
              {...register('name')}
              placeholder="Alex Wanderer"
              className="border-white/10 bg-white/10 pl-10 text-white placeholder:text-white/40 focus-visible:ring-sky-400"
            />
          </div>
          {errors.name && <p className="text-xs text-red-300">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-white/80">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" />
            <Input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              className="border-white/10 bg-white/10 pl-10 text-white placeholder:text-white/40 focus-visible:ring-sky-400"
            />
          </div>
          {errors.email && <p className="text-xs text-red-300">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-white/80">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/50" />
            <Input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="border-white/10 bg-white/10 pl-10 pr-10 text-white placeholder:text-white/40 focus-visible:ring-sky-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-300">{errors.password.message}</p>}

          {pwd.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i < strength ? strengthColors[strength - 1] : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-white/60">
                Strength: <span className="text-white">{strengthLabels[strength - 1]}</span>
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-sky-500 text-white hover:bg-sky-600"
        >
          {isSubmitting ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-white/70">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-sky-300 hover:text-white">
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}
