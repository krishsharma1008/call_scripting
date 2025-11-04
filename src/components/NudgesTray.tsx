import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCall } from '@/contexts/CallContext';
import { NudgeCard } from './Nudge';

type TimedNudge = { key: string; title: string; nudge: any; addedAt: number };

export function NudgesTray() {
  const location = useLocation();
  const { nudges } = useCall();
  const [cards, setCards] = useState<TimedNudge[]>([]);
  const pollRef = useRef<number | null>(null);

  // Disable nudges on the intro page
  const isIntroPage = location.pathname === '/intro';

  // Inject nudges from CallContext (if any)
  useEffect(() => {
    if (isIntroPage || !nudges?.length) return;
    appendNudges(nudges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudges, isIntroPage]);

  function appendNudges(incoming: any[]) {
    if (!incoming?.length) return;
    setCards((prev) => {
      const now = Date.now();
      const existingTitles = new Set(prev.map((c) => c.title.toLowerCase()));
      const next = [...prev];
      for (const n of incoming) {
        const title = (n.title || '').toString();
        if (!title) continue;
        if (existingTitles.has(title.toLowerCase())) continue;
        next.push({
          key: `${now}-${Math.random().toString(36).slice(2, 8)}`,
          title,
          nudge: n,
          addedAt: now,
        });
      }
      // Keep all cards (persistent until manually dismissed)
      return next;
    });
  }

  // Poll backend for latest nudges frequently (disabled on intro page)
  useEffect(() => {
    if (isIntroPage) return;
    
    const tick = async () => {
      try {
        const r = await fetch('http://localhost:3001/api/nudges/latest');
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data?.nudges) && data.nudges.length) {
            appendNudges(data.nudges);
            // Send ACK for what we're going to show soon to avoid duplicates across routes
            try {
              const sids = data.nudges.map((n: any) => n.sid).filter(Boolean);
              if (sids.length) {
                await fetch('http://localhost:3001/api/nudges/ack', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sids })
                });
              }
            } catch {}
          }
        }
      } catch {}
      pollRef.current = window.setTimeout(tick, 600) as any;
    };
    tick();
    return () => { if (pollRef.current) window.clearTimeout(pollRef.current); };
  }, [isIntroPage]);

  // Show all cards (persistent, no expiration)
  const visible = useMemo(() => {
    return [...cards];
  }, [cards]);

  // Don't render nudges on the intro page
  if (isIntroPage) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-h-[80vh] overflow-y-auto">
      {visible.map((c) => {
        return (
          <div key={c.key} className="opacity-100">
            <NudgeCard nudge={c.nudge} onClose={() => setCards((prev) => prev.filter((x) => x.key !== c.key))} />
          </div>
        );
      })}
    </div>
  );
}


