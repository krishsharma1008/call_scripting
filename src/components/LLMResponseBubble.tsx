import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface LLMResponseBubbleProps {
  message: string;
  onDismiss: () => void;
}

export function LLMResponseBubble({ message, onDismiss }: LLMResponseBubbleProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);

    const dismissTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, 10000);

    return () => {
      clearTimeout(timer);
      clearTimeout(dismissTimer);
    };
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={cn(
        'bg-blue-600 text-white shadow-lg rounded-full px-6 py-3',
        'flex items-center space-x-4 max-w-md',
        'transition-all duration-300 ease-in-out',
        'border-2 border-white',
        'shadow-xl',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
        'animate-pulse'
      )}
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: isVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(16px)',
        zIndex: 9999,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      }}
    >
      <div className="flex-1 text-center text-sm font-medium">
        {message}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsVisible(false);
          setTimeout(onDismiss, 300);
        }}
        className="ml-2 text-white hover:text-blue-200 focus:outline-none flex-shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
