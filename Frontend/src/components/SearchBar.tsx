import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Renders a clear button once there is a value. */
  onClear?: () => void;
  /** Extra controls pinned to the right, e.g. a filter button. */
  trailing?: React.ReactNode;
  containerClassName?: string;
}

/**
 * The search field used across every list screen.
 *
 * It owns its leading icon and clear affordance — callers previously stacked
 * their own absolutely-positioned icon on top, which rendered two magnifying
 * glasses side by side.
 */
export function SearchBar({
  className,
  containerClassName,
  onClear,
  trailing,
  value,
  ...props
}: SearchBarProps) {
  const hasValue = typeof value === 'string' ? value.length > 0 : value != null;

  return (
    <div
      className={cn(
        'flex h-13 items-center gap-3 rounded-full border border-border bg-card px-5 shadow-sm backdrop-blur-xl transition-shadow focus-within:ring-2 focus-within:ring-ring',
        containerClassName,
      )}
    >
      <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />

      <input
        type="text"
        value={value}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground',
          className,
        )}
        {...props}
      />

      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {trailing}
    </div>
  );
}
