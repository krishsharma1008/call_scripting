import { cn } from '@/lib/utils';
import type { Nudge } from '@/contexts/CallContext';
import { X } from 'lucide-react';

export function NudgeCard({ nudge, onClose }: { nudge: Nudge; onClose: () => void }) {
  const color = nudge.type === 'upsell' ? 'bg-primary/10 border-primary/30' : nudge.type === 'cross_sell' ? 'bg-accent/10 border-accent/30' : 'bg-secondary border-secondary';
  return (
    <div
      className={cn(
        'w-72 rounded-md border p-3 shadow-sm text-left',
        color,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{nudge.type.replace('_', ' ')}</div>
          <div className="text-sm font-semibold leading-tight">{nudge.title}</div>
        </div>
        <button 
          className="flex-shrink-0 rounded-sm opacity-70 hover:opacity-100 transition-opacity hover:bg-slate-100 dark:hover:bg-slate-800 p-0.5" 
          onClick={onClose} 
          aria-label="Dismiss nudge"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 text-sm text-foreground/90">{nudge.body}</div>
    </div>
  );
}


