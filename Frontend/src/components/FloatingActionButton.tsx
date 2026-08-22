import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps {
  onClick?: () => void;
  className?: string;
  label?: string;
}

export function FloatingActionButton({ onClick, className, label }: FloatingActionButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-label={label ?? 'Create new'}
      className={cn(
        'flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/30',
        className,
      )}
    >
      <Plus className="h-7 w-7" />
    </motion.button>
  );
}
