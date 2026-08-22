import { Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

interface BudgetCardProps {
  title: string;
  amount: number;
  currency: string;
  subtitle?: string;
  trend?: 'positive' | 'negative' | 'neutral';
}

export function BudgetCard({ title, amount, currency, subtitle, trend = 'neutral' }: BudgetCardProps) {
  const trendColor =
    trend === 'positive' ? 'text-green-600' : trend === 'negative' ? 'text-red-500' : 'text-foreground';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-white p-5 shadow-sm dark:bg-slate-900"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10 text-sky-600">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={cn('text-2xl font-semibold', trendColor)}>
            {currency} {Math.round(amount).toLocaleString()}
          </p>
        </div>
      </div>
      {subtitle && <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>}
    </motion.div>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
