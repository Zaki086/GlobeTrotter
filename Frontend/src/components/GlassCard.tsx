import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function GlassCard({ children, className, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-white/20 bg-white/80 p-5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
