import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
  startCall: (customerPhone?: string, customerData?: any) => Promise<void>;
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
  const navigateRef = useRef<((path: string) => void) | null>(null);

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

  const endCall = useCallback(async () => {
    setStatus('ended');
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    
    // Save call session and navigate to calls history
    try {
      const resp = await fetch('http://localhost:3001/api/call/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (resp.ok) {
        // Navigate to calls history page after a short delay
        setTimeout(() => {
          if (navigateRef.current) {
            navigateRef.current('/calls-history');
          } else {
            // Fallback: use window.location if navigate not available
            window.location.href = '/calls-history';
          }
        }, 1000);
      }
    } catch (error) {
      console.error('[Call] Failed to end session:', error);
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

  const appendTranscriptToServer = useCallback(async (role: 'user' | 'assistant', content: string) => {
    try {
      await fetch('http://localhost:3001/api/transcript/append', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content })
      });
    } catch (error) {
      console.error('[Call] Failed to append transcript:', error);
    }
  }, []);

  const startCall = useCallback(async (customerPhone?: string, customerData?: any) => {
    if (status === 'connecting' || status === 'active') return;
    setStatus('connecting');
    try {
      // Always start call session (even without customerPhone for testing)
      let callId: string | null = null;
      try {
        const sessionResp = await fetch('http://localhost:3001/api/call/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            customerPhone: customerPhone || 'unknown', 
            customerData: customerData || { firstName: '', lastName: '', zipcode: '', phone: customerPhone || 'unknown' }
          })
        });
        if (sessionResp.ok) {
          const sessionData = await sessionResp.json();
          callId = sessionData.callId;
        }
      } catch (err) {
        console.error('[Call] Failed to start session:', err);
      }
      
      // Navigate to dashboard immediately when call starts
      if (callId && navigateRef.current) {
        setTimeout(() => {
          if (navigateRef.current) {
            navigateRef.current('/dashboard');
          }
        }, 1000);
      }

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

      // Create data channel for OpenAI events
      const dc = pc.createDataChannel('oai-events');
      let assistantBuffer = '';

      dc.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          
          // Accumulate assistant text
          if (evt.type === 'response.audio_transcript.delta' && evt.delta) {
            assistantBuffer += evt.delta;
          } else if (evt.type === 'response.text.delta' && evt.delta) {
            assistantBuffer += evt.delta;
          } else if (evt.type === 'conversation.item.created' && evt.item?.content?.[0]?.transcript) {
            assistantBuffer = evt.item.content[0].transcript;
          }
          
          // Handle completion events
          if (evt.type === 'response.done' || evt.type === 'response.audio_transcript.done' || evt.type === 'conversation.item.completed') {
            const txt = assistantBuffer.trim();
            if (txt) {
              setTranscript((prev) => [...prev, { role: 'assistant', content: txt }]);
              appendTranscriptToServer('assistant', txt);
            }
            assistantBuffer = '';
          }
        } catch (err) {
          console.error('[Call] Data channel error:', err);
        }
      };

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
      
      // Send initial instruction when data channel opens
      dc.onopen = () => {
        const seed = {
          type: 'response.create',
          response: {
            instructions: "You are a residential customer calling a CSR to request dryer vent cleaning and dryer vent inspection today. Always speak only in English. Start with: 'Hi, I am looking for dryer vent cleaning and an inspection today.' Keep replies ≤2 sentences, natural, and as the customer only.",
            modalities: ['audio', 'text']
          }
        };
        dc.send(JSON.stringify(seed));
      };

      // Browser Speech Recognition for user speech
      const SR = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const sr = new SR();
        sr.continuous = true;
        sr.interimResults = false;
        sr.onresult = (ev: any) => {
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            if (ev.results[i].isFinal) {
              const txt = ev.results[i][0].transcript.trim();
              if (txt) {
                setTranscript((prev) => [...prev, { role: 'user', content: txt }]);
                appendTranscriptToServer('user', txt);
              }
            }
          }
        };
        sr.onerror = (err: any) => console.error('[STT] Error:', err);
        sr.onend = () => {
          try { sr.start(); } catch(e) {}
        };
        sr.start();
      }

      setStatus('active');

      // Seed initial assistant line
      const initialMessage = 'Hi, I am looking for dryer vent cleaning and an inspection today.';
      setTranscript((prev) => [...prev, { role: 'assistant', content: initialMessage }]);
      appendTranscriptToServer('assistant', initialMessage);
    } catch (e) {
      console.error(e);
      setStatus('idle');
    }
  }, [status, appendTranscriptToServer]);

  const pushUserUtterance = useCallback((text: string) => {
    if (!text.trim()) return;
    setTranscript((prev) => {
      const next = [...prev, { role: 'user', content: text }];
      // Send to server for nudge generation
      appendTranscriptToServer('user', text);
      return next;
    });
  }, [appendTranscriptToServer]);

  const value = useMemo(
    () => ({ status, transcript, nudges, startCall, endCall, pushUserUtterance }),
    [status, transcript, nudges, startCall, endCall, pushUserUtterance],
  );

  return <CallContextProviderInner value={value} navigateRef={navigateRef}>{children}</CallContextProviderInner>;
}

function CallContextProviderInner({ children, value, navigateRef }: { children: ReactNode; value: CallContextType; navigateRef: React.MutableRefObject<((path: string) => void) | null> }) {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigateRef.current = navigate;
    return () => {
      navigateRef.current = null;
    };
  }, [navigate, navigateRef]);
  
  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}




