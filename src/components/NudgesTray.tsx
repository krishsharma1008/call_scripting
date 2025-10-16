import { useEffect, useMemo, useRef, useState } from 'react';
import { useCall } from '@/contexts/CallContext';
import { NudgeCard } from './Nudge';

type TimedNudge = { key: string; title: string; nudge: any; addedAt: number; expiresAt: number; dismissAt: number };

export function NudgesTray() {
  const { nudges } = useCall();
  const [cards, setCards] = useState<TimedNudge[]>([]);
  const pollRef = useRef<number | null>(null);
  const sweepRef = useRef<number | null>(null);

  // Inject nudges from CallContext (if any)
  useEffect(() => {
    if (!nudges?.length) return;
    appendNudges(nudges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudges]);

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
          expiresAt: now + 15000, // 15s life for better readability
          dismissAt: now + 14000, // start fading 1s before removal
        });
      }
      // Keep reasonable backlog (increased to 30 for better persistence)
      return next.slice(-30);
    });
  }

  // Poll backend for latest nudges frequently
  useEffect(() => {
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
  }, []);

  // Sweep expired / fade
  useEffect(() => {
    const sweep = () => {
      const now = Date.now();
      setCards((prev) => prev.filter((c) => c.expiresAt > now));
      sweepRef.current = window.setTimeout(sweep, 400) as any;
    };
    sweep();
    return () => { if (sweepRef.current) window.clearTimeout(sweepRef.current); };
  }, []);

  const visible = useMemo(() => {
    // Show newest five for better visibility
    return [...cards].slice(-5);
  }, [cards]);

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {visible.map((c) => {
        const now = Date.now();
        const fading = now >= c.dismissAt;
        return (
          <div key={c.key} className={fading ? 'transition-opacity duration-500 opacity-0' : 'transition-opacity duration-300 opacity-100'}>
            <NudgeCard nudge={c.nudge} onClose={() => setCards((prev) => prev.filter((x) => x.key !== c.key))} />
          </div>
        );
      })}
    </div>
  );
}


