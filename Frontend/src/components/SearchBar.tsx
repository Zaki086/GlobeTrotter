import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function SearchBar({ className, ...props }: SearchBarProps) {
  return (
    <div
      className={cn(
        'flex h-14 items-center gap-3 rounded-full border border-border bg-white px-5 shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-sky-500 dark:bg-slate-900',
        className,
      )}
    >
      <Search className="h-5 w-5 text-muted-foreground" />
      <input
        type="text"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        {...props}
      />
    </div>
  );
}
