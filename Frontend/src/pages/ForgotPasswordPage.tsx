import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPassword } from '@/services/auth';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      await forgotPassword(data.email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
      <Link
        to="/login"
        className="mb-4 inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </Link>
      <h2 className="mb-2 text-2xl font-semibold text-white">Reset password</h2>
      <p className="mb-6 text-sm text-white/70">
        Enter your email and we will send you a reset link.
      </p>

      {submitted ? (
        <div className="rounded-2xl bg-white/10 p-4 text-center text-white">
          If an account exists, a reset link has been sent.
        </div>
      ) : (
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

          {error && <p className="text-sm text-red-300">{error}</p>}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-sky-500 text-white hover:bg-sky-600"
          >
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>
      )}
    </motion.div>
  );
}
