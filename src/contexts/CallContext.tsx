import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode, useEffect } from 'react';

type CallStatus = 'idle' | 'connecting' | 'active' | 'ended';

export type Nudge = {
  id: string;
  type: 'upsell' | 'cross_sell' | 'tip';
  title: string;
  body: string;
  priority: 1 | 2 | 3;
};

type TranscriptTurn = { role: 'assistant' | 'user'; content: string };

type CallContextType = {
  status: CallStatus;
  transcript: TranscriptTurn[];
  nudges: Nudge[];
  startCall: () => Promise<void>;
  endCall: () => void;
  pushUserUtterance: (text: string) => void;
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Lazy remote audio element
  useEffect(() => {
    if (!remoteAudioRef.current) {
      const el = document.createElement('audio');
      el.autoplay = true;
      el.playsInline = true;
      remoteAudioRef.current = el;
      document.body.appendChild(el);
    }
    return () => {
      // Do not remove audio element so it can be reused; browser GC is fine
    };
  }, []);

  const endCall = useCallback(() => {
    setStatus('ended');
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    setTimeout(() => setStatus('idle'), 500);
  }, []);

  const fetchNudges = useCallback(async (recent: TranscriptTurn[]) => {
    try {
      const resp = await fetch('http://localhost:3001/api/nudges/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: recent }),
      });
      if (!resp.ok) return;
      const data = (await resp.json()) as { nudges: Nudge[] };
      if (!Array.isArray(data?.nudges)) return;
      // de-dup by title
      setNudges((prev) => {
        const titles = new Set(prev.map((n) => n.title));
        const merged = [...prev, ...data.nudges.filter((n) => !titles.has(n.title))];
        return merged.slice(-5);
      });
    } catch {}
  }, []);

  const startCall = useCallback(async () => {
    if (status === 'connecting' || status === 'active') return;
    setStatus('connecting');
    try {
      const tokenResp = await fetch('http://localhost:3001/api/realtime/token', { method: 'POST' });
      const { token } = await tokenResp.json();
      if (!token) throw new Error('No realtime token');

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Handle remote audio
      pc.ontrack = (e) => {
        const stream = e.streams?.[0];
        if (stream && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
        }
      };

      // Add mic
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of mic.getAudioTracks()) {
        pc.addTrack(track, mic);
      }

      // Create local SDP offer
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);

      // Send SDP to OpenAI Realtime
      const sdpResp = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp || '',
      });

      if (!sdpResp.ok) throw new Error('Failed to establish realtime');
      const answer = {
        type: 'answer' as const,
        sdp: await sdpResp.text(),
      };
      await pc.setRemoteDescription(answer);
      setStatus('active');

      // Seed initial assistant line into transcript for downstream nudges
      setTranscript((prev) => [...prev, { role: 'assistant', content: 'Hi, I am looking for a deep cleaning service today.' }]);
      fetchNudges([{ role: 'assistant', content: 'Hi, I am looking for a deep cleaning service today.' }]);
    } catch (e) {
      console.error(e);
      setStatus('idle');
    }
  }, [status, fetchNudges]);

  const pushUserUtterance = useCallback((text: string) => {
    if (!text.trim()) return;
    setTranscript((prev) => {
      const next = [...prev, { role: 'user', content: text }];
      // Generate nudges on turn end
      fetchNudges(next.slice(-10));
      return next;
    });
  }, [fetchNudges]);

  const value = useMemo(
    () => ({ status, transcript, nudges, startCall, endCall, pushUserUtterance }),
    [status, transcript, nudges, startCall, endCall, pushUserUtterance],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}


