/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCall } from '@/contexts/CallContext';
import { NudgeCard } from './Nudge';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2 } from 'lucide-react';

type TimedNudge = { key: string; title: string; nudge: any; addedAt: number; expiresAt: number; dismissAt: number };

export function NudgesTray() {
  const { nudges } = useCall();
  const [cards, setCards] = useState<TimedNudge[]>([]);
  const pollRef = useRef<number | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [height, setHeight] = useState(400); // px
  const [width, setWidth] = useState(340); // px
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origLeft: number; origTop: number } | null>(null);

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
          expiresAt: Infinity, // persistent
          dismissAt: Infinity,
        });
      }
      // Keep reasonable backlog (increased to 100 for better persistence)
      return next.slice(-100);
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
            } catch (err) {console.error("error",err)}
          }
        }
      } catch (err) {console.error("error",err)}
      pollRef.current = window.setTimeout(tick, 600) as any;
    };
    tick();
    return () => { if (pollRef.current) window.clearTimeout(pollRef.current); };
  }, []);

  // No expiry sweep needed; nudges are persistent

  // set initial position after mount so we can compute from window size
  useEffect(() => {
    const init = () => {
      const left = Math.max(16, window.innerWidth - width - 16);
      const top = Math.max(16, window.innerHeight - height - 16);
      setPos({ left, top });
    };
    init();
    const onResize = () => init();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [width, height]);

  // Drag handlers (mouse + touch)
  const onHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origLeft: pos.left, origTop: pos.top };
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const newLeft = Math.max(8, Math.min(window.innerWidth - width - 8, dragRef.current.origLeft + dx));
      const maxTop = window.innerHeight - (minimized ? 48 : height) - 8;
      const newTop = Math.max(8, Math.min(maxTop, dragRef.current.origTop + dy));
      setPos({ left: newLeft, top: newTop });
    };
    const onUp = () => {
      document.body.style.userSelect = 'auto';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onHeaderTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    dragRef.current = { startX: t.clientX, startY: t.clientY, origLeft: pos.left, origTop: pos.top };
    const onMove = (ev: TouchEvent) => {
      const tt = ev.touches[0];
      if (!tt || !dragRef.current) return;
      const dx = tt.clientX - dragRef.current.startX;
      const dy = tt.clientY - dragRef.current.startY;
      const newLeft = Math.max(8, Math.min(window.innerWidth - width - 8, dragRef.current.origLeft + dx));
      const maxTop = window.innerHeight - (minimized ? 48 : height) - 8;
      const newTop = Math.max(8, Math.min(maxTop, dragRef.current.origTop + dy));
      setPos({ left: newLeft, top: newTop });
    };
    const onEnd = () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      dragRef.current = null;
    };
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
  };

  const visible = useMemo(() => {
    // Show all nudges, newest at bottom
    return [...cards];
  }, [cards]);

  return (
    <div
      className="fixed z-[60] flex flex-col"
      style={{ 
        width,
        height: minimized ? 48 : height,
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        transition: dragRef.current ? 'none' : 'left 0.2s, top 0.2s'
      }}
    >
      <div
        className="bg-white shadow-lg rounded-lg border border-gray-200 flex flex-col resize overflow-hidden"
        style={{ width, height: minimized ? 48 : height, minWidth: 220, minHeight: 48, maxWidth: 600, maxHeight: 700, position: 'relative' }}
      >
        <div 
          className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg select-none cursor-move"
          onMouseDown={onHeaderMouseDown}
          onTouchStart={onHeaderTouchStart}>
          <span className="font-semibold text-sm">Nudges</span>
          <div className="flex gap-2">
            {minimized ? (
              <Button size="sm" variant="ghost" onClick={() => setMinimized(false)} title="Maximize" aria-label="Maximize">
                <Maximize2 size={18} />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setMinimized(true)} title="Minimize" aria-label="Minimize">
                <Minimize2 size={18} />
              </Button>
            )}
          </div>
        </div>
        {!minimized && (
          <div
            className="p-4 overflow-y-auto flex flex-col gap-2"
            style={{ maxHeight: height - 48, scrollbarWidth: 'thin' }}
          >
            {visible.length === 0 && (
              <div className="text-gray-400 text-center">No nudges yet.</div>
            )}
            {visible.map((c) => (
              <div key={c.key} className="transition-opacity duration-300 opacity-100">
                <NudgeCard nudge={c.nudge} onClose={() => setCards((prev) => prev.filter((x) => x.key !== c.key))} />
              </div>
            ))}
          </div>
        )}
        {/* Resizable handles for all sides */}
        <div
          className="absolute top-0 left-0 w-full h-2 cursor-ns-resize z-50"
          onMouseDown={(e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startHeight = height;
            const onMouseMove = (ev: MouseEvent) => {
              setHeight(Math.max(48, Math.min(700, startHeight + (ev.clientY - startY))));
            };
            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize z-50"
          onMouseDown={(e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startHeight = height;
            const onMouseMove = (ev: MouseEvent) => {
              setHeight(Math.max(48, Math.min(700, startHeight + (ev.clientY - startY))));
            };
            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}
        />
        <div
          className="absolute top-0 left-0 h-full w-2 cursor-ew-resize z-50"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = width;
            const onMouseMove = (ev: MouseEvent) => {
              setWidth(Math.max(220, Math.min(600, startWidth + (ev.clientX - startX))));
            };
            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}
        />
        <div
          className="absolute top-0 right-0 h-full w-2 cursor-ew-resize z-50"
          onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = width;
            const onMouseMove = (ev: MouseEvent) => {
              setWidth(Math.max(220, Math.min(600, startWidth + (ev.clientX - startX))));
            };
            const onMouseUp = () => {
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}
        />
      </div>
    </div>
  );
}


