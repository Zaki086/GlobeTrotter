import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      await login(data);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      <h2 className="mb-6 text-2xl font-semibold text-white">Welcome back</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-sky-500 text-white hover:bg-sky-600"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm text-white/70">
        <Link to="/forgot-password" className="hover:text-white">
          Forgot password?
        </Link>
        <Link to="/signup" className="font-medium text-sky-300 hover:text-white">
          Create account
        </Link>
      </div>
    </motion.div>
  );
}
