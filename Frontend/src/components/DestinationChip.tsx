import { cn } from '@/lib/utils';

interface DestinationChipProps {
  name: string;
  imageUrl?: string | null;
  onClick?: () => void;
  selected?: boolean;
}

export function DestinationChip({ name, imageUrl, onClick, selected }: DestinationChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        selected
          ? 'border-sky-500 bg-sky-500 text-white'
          : 'border-border bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800',
      )}
    >
      {imageUrl && (
        <img src={imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
      )}
      {name}
    </button>
  );
}
