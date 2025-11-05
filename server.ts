/* eslint-disable @typescript-eslint/no-explicit-any */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

dotenv.config();

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());
// Note: we are not serving a static SPA folder here

// Initialize OpenAI client (prefer server key, fallback to Vite key if present)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
});

// Simple root page
app.get('/', (_req, res) => {
  res.send('<!DOCTYPE html><html><body><h3>Neighborly Backend</h3><p>Visit <a href="/admin">/admin</a> to run the call simulation.</p></body></html>');
});

// Admin call simulator (Start/End, uses Realtime via WebRTC and feeds transcript for nudges)
app.get('/admin', (_req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Neighborly Call Simulator</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background: linear-gradient(180deg,#f8fafc,#eef2ff); color:#0f172a; margin:0; padding:24px; }
    .header { text-align:center; margin-bottom:16px; }
    .header h1 { margin:0; font-size:20px; font-weight:700; background: linear-gradient(90deg,#5b67f1,#a78bfa); -webkit-background-clip:text; background-clip:text; color:transparent; }
    .sub { margin:4px 0 0; color:#64748b; font-size:12px; }
    .card { background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; box-shadow:0 4px 16px rgba(0,0,0,.04); }
    .row { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
    .spacer { flex: 1; }
    .btn { background: #5b67f1; color: #fff; border: 0; padding: 10px 14px; border-radius: 8px; cursor: pointer; box-shadow:0 1px 2px rgba(0,0,0,.08); }
    .btn:hover { filter: brightness(0.96); }
    .btn[disabled] { opacity: .6; cursor: not-allowed; }
    .btn-outline { background:#ffffff; color:#111827; border:1px solid #e5e7eb; }
    .btn-ghost { background:transparent; color:#374151; }
    .muted { color: #64748b; font-size: 12px; }
    .muted.small { font-size: 12px; }
    .muted.xs { font-size: 11px; }
    .log-title { margin-top: 8px; }
    .log { background:#0b1220; color:#e5e7eb; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; border-radius: 8px; padding: 12px; height: 220px; overflow: auto; font-size: 12px; border:1px solid #111827; }
    .status { display: inline-block; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; margin-left: 8px; border:1px solid transparent; }
    .status.active { background: #10b981; color: white; }
    .status.inactive { background: #94a3b8; color: white; }
  </style>
 </head>
 <body>
   <div class="header">
     <h1>Neighborly Call Simulator</h1>
     <div class="sub">WebRTC voice agent + real-time nudge generation</div>
   </div>
   <div class="card">
     <div class="row">
       <div class="muted small">Controls</div><div class="spacer"></div>
       <button class="btn" id="startBtn">Start Call</button>
       <button class="btn btn-outline" id="endBtn" disabled>End Call</button>
       <button class="btn btn-ghost" id="clearBtn">Clear Log</button>
     </div>
     <div class="row">
       <span class="muted small">Status:</span>
       <span class="status inactive" id="sttStatus">STT: Inactive</span>
       <span class="status inactive" id="transcriptStatus">Transcript: 0 turns</span>
       <span class="status inactive" id="nudgesStatus">Nudges: 0 pending</span>
       <div class="spacer"></div>
       <span class="muted xs">Tip: keep this tab focused and allow microphone access.</span>
     </div>
     <div class="row log-title"><span class="muted small">Event Log</span></div>
     <div class="log" id="log"></div>
   </div>

   <script>
    const logEl = document.getElementById('log');
    const sttStatusEl = document.getElementById('sttStatus');
    const transcriptStatusEl = document.getElementById('transcriptStatus');
    const nudgesStatusEl = document.getElementById('nudgesStatus');
    const clearBtn = document.getElementById('clearBtn');
    
    let transcriptCount = 0;
    
    function log(msg) { 
      const div = document.createElement('div'); 
      div.textContent = msg; 
      logEl.appendChild(div); 
      logEl.scrollTop = logEl.scrollHeight; 
    }
    
    function updateStatus() {
      fetch('/api/nudges/latest')
        .then(r => r.json())
        .then(data => {
          const count = data.nudges?.length || 0;
          nudgesStatusEl.textContent = 'Nudges: ' + count + ' pending';
          nudgesStatusEl.className = 'status ' + (count > 0 ? 'active' : 'inactive');
        })
        .catch(() => {});
    }

    clearBtn.addEventListener('click', () => { logEl.innerHTML = ''; });
    
    setInterval(updateStatus, 2000);

    let pc = null;
    let dc = null; // data channel for oai events
    let bufferText = '';

    async function startCall() {
      try {
        document.getElementById('startBtn').disabled = true;
        document.getElementById('endBtn').disabled = false;
        log('Starting call session...');
        
        // Start call session first (required for nudge generation)
        try {
          const sessionResp = await fetch('/api/call/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerPhone: 'admin-test',
              customerData: { firstName: 'Admin', lastName: 'Test', zipcode: '00000', phone: 'admin-test' }
            })
          });
          if (sessionResp.ok) {
            const sessionData = await sessionResp.json();
            log('[Call Session] Started: ' + sessionData.callId);
          } else {
            log('[Warning] Call session start failed, but continuing...');
          }
        } catch (err) {
          log('[Warning] Failed to start call session: ' + (err.message || err));
        }
        
        log('Requesting realtime token...');
        const t = await fetch('/api/realtime/token', { method: 'POST' }).then(r => r.json());
        if (!t.token) throw new Error('No token');

        pc = new RTCPeerConnection();
        pc.ontrack = (e) => {
          const el = document.createElement('audio');
          el.autoplay = true; el.playsInline = true; el.srcObject = e.streams[0];
          document.body.appendChild(el);
        };

        // Mic
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic.getAudioTracks().forEach(tr => pc.addTrack(tr, mic));

        // Data channel for events
        dc = pc.createDataChannel('oai-events');
        dc.onmessage = (e) => {
          try {
            const evt = JSON.parse(e.data);
            
            // Log all events for debugging
            if (evt.type && !evt.type.includes('.delta')) {
              log('[Event] ' + evt.type);
            }
            
            // Accumulate assistant text across possible delta event shapes
            if (evt.type === 'response.audio_transcript.delta' && evt.delta) {
              bufferText += evt.delta;
            } else if (evt.type === 'response.text.delta' && evt.delta) {
              bufferText += evt.delta;
            } else if (evt.type === 'response.function_call_arguments.delta' && evt.delta) {
              bufferText += evt.delta;
            } else if (evt.type === 'conversation.item.created' && evt.item?.content?.[0]?.transcript) {
              // Sometimes transcript comes as complete item
              bufferText = evt.item.content[0].transcript;
            }
            
            // Handle completion events
            if (evt.type === 'response.done' || evt.type === 'response.audio_transcript.done' || evt.type === 'conversation.item.completed') {
              const txt = bufferText.trim();
              if (txt) {
                fetch('/api/transcript/append', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ role: 'assistant', content: txt })
                }).then(() => {
                  log('[Sent] Assistant turn to server');
                  transcriptCount++;
                  transcriptStatusEl.textContent = 'Transcript: ' + transcriptCount + ' turns';
                  transcriptStatusEl.className = 'status active';
                  setTimeout(updateStatus, 500);
                });
                log('🤖 Assistant: ' + txt);
              }
              bufferText = '';
            }
          } catch (err) {
            log('[Error] Data channel: ' + (err.message || err));
          }
        };

        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
        await pc.setLocalDescription(offer);

        const ans = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + t.token, 'Content-Type': 'application/sdp' },
          body: offer.sdp || ''
        });
        if (!ans.ok) throw new Error('Realtime answer failed');
        const answer = { type: 'answer', sdp: await ans.text() };
        await pc.setRemoteDescription(answer);
        log('Call active');

        // Seed initial assistant line (speak via response.create)
        const seed = {
          type: 'response.create',
          response: {
            instructions: "You are a residential customer calling a CSR to request dryer vent cleaning and dryer vent inspection today. Always speak only in English. Start with: 'Hi, I am looking for dryer vent cleaning and an inspection today.' Keep replies ≤2 sentences, natural, and as the customer only.",
            modalities: ['audio', 'text']
          }
        };
        dc.onopen = () => {
          dc.send(JSON.stringify(seed));
        };

        // Also seed transcript for nudges immediately
        fetch('/api/transcript/append', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'assistant', content: 'Hi, I am looking for dryer vent cleaning and an inspection today.' }) });

        // Browser STT for user to feed transcript (nudges); audio already goes to model via mic
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
          const sr = new SR();
          sr.continuous = true;
          sr.interimResults = false;
          sr.onresult = (ev) => {
            for (let i = ev.resultIndex; i < ev.results.length; i++) {
              if (ev.results[i].isFinal) {
                const txt = ev.results[i][0].transcript.trim();
                if (txt) {
                  fetch('/api/transcript/append', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ role: 'user', content: txt }) 
                  }).then(() => {
                    log('[Sent] User turn to server');
                    transcriptCount++;
                    transcriptStatusEl.textContent = 'Transcript: ' + transcriptCount + ' turns';
                    transcriptStatusEl.className = 'status active';
                    setTimeout(updateStatus, 500);
                  });
                  log('👤 You: ' + txt);
                }
              }
            }
          };
          sr.onerror = (err) => log('[STT Error] ' + err.error);
          sr.onend = () => {
            log('[STT] Ended, restarting...');
            try { sr.start(); } catch(e) {}
          };
          sr.start();
          log('[STT] Started - speak now!');
          sttStatusEl.textContent = 'STT: Active';
          sttStatusEl.className = 'status active';
        } else {
          log('SpeechRecognition not available; nudges will consider assistant lines only.');
        }
      } catch (e) {
        log('Error: ' + (e && e.message ? e.message : e));
        document.getElementById('startBtn').disabled = false;
        document.getElementById('endBtn').disabled = true;
      }
    }

    async function endCall() {
      document.getElementById('startBtn').disabled = false;
      document.getElementById('endBtn').disabled = true;
      if (pc) { try { pc.close(); } catch {} pc = null; }
      if (dc) { try { dc.close(); } catch {} dc = null; }
      sttStatusEl.textContent = 'STT: Inactive';
      sttStatusEl.className = 'status inactive';
      
      // End call session
      try {
        await fetch('/api/call/end', { method: 'POST' });
        log('[Call Session] Ended');
      } catch (err) {
        log('[Warning] Failed to end call session: ' + (err.message || err));
      }
      
      log('Call ended');
    }

    document.getElementById('startBtn').addEventListener('click', startCall);
    document.getElementById('endBtn').addEventListener('click', endCall);
   </script>
 </body>
</html>
  `);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Store latest response for frontend polling
let latestResponse: string | null = null;

// Chat endpoint - processes LLM requests and stores response
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemPrompt = `You are a helpful assistant for a customer service application.
      Keep responses concise (1-2 sentences max) and professional.`;

    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 100,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "Sorry, I couldn't process that.";

    latestResponse = reply;
    res.json({ reply });
  } catch (error) {
    console.error('LLM API error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Ephemeral token for OpenAI Realtime (WebRTC) sessions
// Returns a short-lived client token the browser can use to establish a direct WebRTC session
app.post('/api/realtime/token', async (_req, res) => {
  try {
    const serverKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!serverKey) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }

    const sessionResp = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: 'verse',
        modalities: ['audio', 'text'],
        instructions: "You are a residential customer calling a customer service representative to request dryer vent cleaning and dryer vent inspection today. Always role-play strictly as the customer, speaking only in English. Do not adopt the CSR persona. Keep replies natural, concise (≤2 sentences), and proceed only as a customer answering questions or asking about booking/scheduling. Begin the conversation with: 'Hi, is this neighborly? I am looking for dryer vent cleaning and an inspection today.'",
        // Keep default instructions concise – the client will send a response.create with first line
        // You can enrich here if you want the agent to always follow a persona
      }),
    });

    if (!sessionResp.ok) {
      const text = await sessionResp.text();
      return res.status(500).json({ error: 'Failed to create realtime session', details: text });
    }

    const session = await sessionResp.json();
    const token = session?.client_secret?.value;
    if (!token) {
      return res.status(500).json({ error: 'Realtime token missing in response' });
    }
    res.json({ token });
  } catch (err) {
    console.error('Realtime token error:', err);
    res.status(500).json({ error: 'Failed to create realtime token' });
  }
});

type Nudge = {
  id: string;
  type: 'upsell' | 'cross_sell' | 'tip';
  title: string;
  body: string;
  priority: 1 | 2 | 3;
};

// Lead Scoring Types
type CustomerHistory = {
  totalBookings: number;
  cancelledBookings: number;
  avgTicketSize: number;
  lastBookingDate: Date;
  bookingDates: Date[];
};

type LeadScoreAdjustment = {
  delta: number;
  reason: string;
  timestamp: string;
};

type LeadScore = {
  score: number;
  baseScore: number;
  adjustments: LeadScoreAdjustment[];
  lastUpdated: string;
};

type ConversationSignal = {
  urgency: number; // 0-1
  budgetReady: number; // 0-1
  decisionPower: number; // 0-1
  timeline: number; // 0-1
  sentiment: 'positive' | 'neutral' | 'negative';
};

// Appointment Types
type Appointment = {
  id: string;
  date: Date;
  timeSlot: string;
  service: string;
  status: 'pending' | 'past' | 'cancelled';
  customerPhone: string;
  notes?: string;
};

// Call Session Types
type CallSession = {
  callId: string;
  customerPhone: string;
  startTime: Date;
  endTime: Date;
  duration: number; // seconds
  transcript: Array<{ role: string; content: string; timestamp: string; sentiment?: 'positive' | 'neutral' | 'negative'; sentimentScore?: number }>;
  nudgesShown: Array<Nudge & { timestamp: string }>;
  leadScoreHistory: Array<{ score: number; timestamp: string; reason?: string }>;
  finalLeadScore: number;
  initialLeadScore: number;
  customerData: { firstName: string; lastName: string; zipcode: string; phone: string };
  overallSentiment: { positive: number; neutral: number; negative: number; averageScore: number };
};

// Generate small nudges from recent transcript (standalone endpoint, matches quality of auto-generation)
app.post('/api/nudges/generate', async (req, res) => {
  try {
    const { transcript } = req.body as { transcript: Array<{ role: string; content: string }> | string[] };
    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return res.status(400).json({ nudges: [] });
    }

    // Normalize to simple lines of text
    const lines: string[] = (transcript as any[]).map((t) => (typeof t === 'string' ? t : `${t.role}: ${t.content}`));
    const windowText = lines.slice(-12).join('\n');

    const system = `You are an expert sales coach for home services. Generate HIGH-QUALITY, CONTEXT-SPECIFIC nudges for a CSR handling dryer vent cleaning/inspection calls.

OUTPUT FORMAT: JSON with up to 3 nudges (only suggest if highly relevant). Each nudge has: id, type, title, body, priority.

NUDGE TYPES & QUALITY STANDARDS:

1. UPSELL (Enhance current service):
   - GOOD: "Safety Inspection + Cleaning Bundle" → "Add safety inspection for $45. Identifies fire hazards & improves efficiency by 30%."
   - BAD: "Add more services" or "Upgrade your service"
   - Rule: Specific service + clear value (safety, cost savings, performance) + concrete benefit

2. CROSS-SELL (Complementary service):
   - GOOD: "HVAC Duct Cleaning" → "Dryer vent & HVAC share ductwork. Bundle saves $50 & improves air quality."
   - BAD: "We offer other services" or "Check out our other products"
   - Rule: Logical connection to current need + bundling incentive + tangible outcome

3. TIP (Improve conversation/close):
   - GOOD: "Ask: 'When did you last clean the vent?'" → "Reveals urgency. 3+ years = high fire risk angle."
   - BAD: "Be nice to customer" or "Ask questions"
   - Rule: Specific question/action + why it matters + strategic benefit

QUALITY REQUIREMENTS:
- Each nudge must be IMMEDIATELY ACTIONABLE with clear next step
- Include specific dollar amounts, percentages, or timeframes when relevant
- Focus on CUSTOMER VALUE (safety, savings, convenience) not just features
- Be conversational and natural, not salesy or pushy
- Context matters: Only suggest what makes sense given the current conversation

STRICT RULES:
- Body: ≤140 chars. Title: ≤40 chars.
- Priority: 1 (urgent/high-value), 2 (good fit), 3 (nice to have)
- NO generic suggestions like "provide good service" or "ask about needs"
- NO repetition: Each nudge must be distinctly different from previous ones
- If conversation doesn't warrant quality nudges, return fewer (even 0-1)`;

    const prompt = `Conversation (recent):\n${windowText}\n\nAnalyze the conversation context and generate 0-3 HIGH-QUALITY nudges. Respond ONLY as JSON { "nudges": [...] }.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Better quality than gpt-3.5-turbo
      temperature: 0.3, // Slightly higher for more creative, varied suggestions
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      max_tokens: 400, // More room for detailed, quality responses
    });

    const text = completion.choices[0]?.message?.content?.trim() || '';
    let parsed: { nudges?: Nudge[] } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to extract JSON substring
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        parsed = JSON.parse(text.slice(start, end + 1));
      }
    }

    const nudges = Array.isArray(parsed?.nudges) ? parsed.nudges.slice(0, 3) : []; // Changed from 4 to 3 for quality
    console.log(`[Nudges] Generated ${nudges.length} high-quality nudges from transcript`);
    if (nudges.length > 0) {
      console.log(`[Nudges] Titles: ${nudges.map((n: any) => n.title).join(', ')}`);
    }
    res.json({ nudges });
  } catch (err) {
    console.error('[Nudges] Generation error:', err);
    res.status(200).json({ nudges: [] });
  }
});

// In-memory stores for cross-app polling
const transcriptTurns: Array<{ role: string; content: string }> = [];
type ServerNudge = Nudge & { sid: string; createdAt: number };
let pendingNudges: ServerNudge[] = [];
let nudgeCounter = 0;
// Track recently shown nudges to allow re-showing after 60 seconds
const recentlyShownNudges = new Map<string, number>(); // title -> timestamp

// Lead Scoring State
let currentLeadScore: LeadScore | null = null;
let transcriptTurnCount = 0;
let currentCustomerPhone: string | null = null;

// Appointments State
const customerAppointments = new Map<string, Appointment[]>();

// Call Session State
const callSessions = new Map<string, CallSession>();
let currentCallId: string | null = null;
let callStartTime: Date | null = null;
let currentCustomerData: { firstName: string; lastName: string; zipcode: string; phone: string } | null = null;

// Mock Customer History Service
function getCustomerHistory(phone: string): CustomerHistory {
  // Use phone number as seed for consistent mock data
  const seed = phone.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  // Simple deterministic RNG based on phone number
  let rngState = seed;
  const rng = (max: number) => {
    rngState = (rngState * 9301 + 49297) % 233280;
    return Math.floor((rngState / 233280) * max);
  };
  
  const totalBookings = 3 + (rng(6) % 6); // 3-8 bookings
  const cancelledBookings = Math.floor(rng(3)); // 0-2 cancellations
  const avgTicketSize = 150 + (rng(250)); // $150-$400
  
  // Generate booking dates (last 90-365 days)
  const bookingDates: Date[] = [];
  const now = new Date();
  for (let i = 0; i < totalBookings; i++) {
    const daysAgo = 90 + (rng(275)); // 90-365 days ago
    const bookingDate = new Date(now);
    bookingDate.setDate(bookingDate.getDate() - daysAgo);
    bookingDates.push(bookingDate);
  }
  
  // Sort by date (most recent first)
  bookingDates.sort((a, b) => b.getTime() - a.getTime());
  
  return {
    totalBookings,
    cancelledBookings,
    avgTicketSize,
    lastBookingDate: bookingDates[0] || new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
    bookingDates,
  };
}

// Calculate Initial Lead Score from Customer History
function calculateInitialLeadScore(history: CustomerHistory): { score: number; factors: Record<string, number> } {
  let baseScore = 5.0;
  const factors: Record<string, number> = {};
  
  // Bookings component: +0.5 per booking (max +2.0)
  const bookingsComponent = Math.min(history.totalBookings * 0.5, 2.0);
  baseScore += bookingsComponent;
  factors.bookings = bookingsComponent;
  
  // Cancellation penalty: -0.5 per 10% rate (max -2.0)
  const cancellationRate = history.totalBookings > 0 
    ? (history.cancelledBookings / history.totalBookings) * 100 
    : 0;
  const cancellationPenalty = Math.min((cancellationRate / 10) * 0.5, 2.0);
  baseScore -= cancellationPenalty;
  factors.cancellations = -cancellationPenalty;
  
  // Ticket size boost: +0.1 per $50 above $100 (max +1.5)
  const ticketSizeBoost = Math.min(((history.avgTicketSize - 100) / 50) * 0.1, 1.5);
  baseScore += ticketSizeBoost;
  factors.ticketSize = ticketSizeBoost;
  
  // Recency bonus: +0.3 per booking in last 90 days (max +1.5)
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const recentBookings = history.bookingDates.filter(date => date >= ninetyDaysAgo).length;
  const recencyBonus = Math.min(recentBookings * 0.3, 1.5);
  baseScore += recencyBonus;
  factors.recency = recencyBonus;
  
  // Engagement: +0.2 per booking in last year (max +1.0)
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const yearlyBookings = history.bookingDates.filter(date => date >= oneYearAgo).length;
  const engagementBonus = Math.min(yearlyBookings * 0.2, 1.0);
  baseScore += engagementBonus;
  factors.engagement = engagementBonus;
  
  // Clamp between 1.0 and 10.0
  const finalScore = Math.max(1.0, Math.min(10.0, baseScore));
  
  return {
    score: Math.round(finalScore * 10) / 10, // Round to 1 decimal
    factors,
  };
}

// Build comprehensive customer context for nudge generation
function buildCustomerContext(phone: string): string {
  if (!phone) return '';
  
  const history = getCustomerHistory(phone);
  const appointments = getCustomerAppointments(phone);
  const now = new Date();
  
  // Calculate cancellation rate
  const cancellationRate = history.totalBookings > 0 
    ? Math.round((history.cancelledBookings / history.totalBookings) * 100)
    : 0;
  
  // Determine service pattern
  const daysSinceLastBooking = history.lastBookingDate 
    ? Math.floor((now.getTime() - history.lastBookingDate.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;
  let servicePattern = 'New customer';
  if (history.totalBookings > 0) {
    if (daysSinceLastBooking < 90) {
      servicePattern = 'Regular customer';
    } else if (daysSinceLastBooking < 180) {
      servicePattern = 'Occasional customer';
    } else {
      servicePattern = 'Infrequent customer';
    }
  }
  
  // Get pending appointments
  const pendingApps = appointments.filter(a => a.status === 'pending');
  const pastApps = appointments.filter(a => a.status === 'past').slice(0, 5); // Last 5 past services
  const cancelledApps = appointments.filter(a => a.status === 'cancelled');
  
  // Format pending appointments
  const pendingList = pendingApps.length > 0
    ? pendingApps.map(a => {
        const dateStr = a.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `- ${a.service} on ${dateStr} at ${a.timeSlot}`;
      }).join('\n')
    : 'None';
  
  // Format past services
  const pastList = pastApps.length > 0
    ? pastApps.map(a => {
        const dateStr = a.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `- ${a.service} on ${dateStr}`;
      }).join('\n')
    : 'None';
  
  // Format cancelled appointments
  const cancelledList = cancelledApps.length > 0
    ? cancelledApps.map(a => {
        const dateStr = a.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `- ${a.service} was cancelled on ${dateStr}`;
      }).join('\n')
    : 'None';
  
  // Build behavioral insights
  const insights: string[] = [];
  if (cancellationRate > 30) {
    insights.push('High cancellation rate → Focus on value/trust building');
  }
  if (history.avgTicketSize > 250) {
    insights.push('High avg ticket → Suggest premium services');
  } else if (history.avgTicketSize < 150) {
    insights.push('Low avg ticket → Focus on basic services first');
  }
  if (servicePattern === 'Regular customer') {
    insights.push('Regular customer → Focus on upsell/cross-sell');
  } else if (servicePattern === 'New customer') {
    insights.push('New customer → Focus on building relationship');
  }
  
  const insightsList = insights.length > 0 ? insights.join('\n') : 'Standard approach recommended';
  
  // Format last service date
  const lastServiceDate = history.lastBookingDate
    ? history.lastBookingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never';
  
  return `
CUSTOMER HISTORY:
- Total Bookings: ${history.totalBookings}
- Cancelled: ${history.cancelledBookings} (${cancellationRate}% cancellation rate)
- Average Ticket Size: $${history.avgTicketSize}
- Last Service: ${lastServiceDate}
- Service Pattern: ${servicePattern}

UPCOMING APPOINTMENTS:
${pendingList}

PAST SERVICES:
${pastList}

CANCELLED APPOINTMENTS:
${cancelledList}

BEHAVIORAL INSIGHTS:
${insightsList}`;
}

// Sentiment Analysis Function
async function analyzeSentiment(text: string): Promise<{ sentiment: 'positive' | 'neutral' | 'negative'; score: number }> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: 'Analyze the sentiment of the given text. Respond with ONLY a JSON object: {"sentiment": "positive" | "neutral" | "negative", "score": 0.0 to 1.0}. Score: 0.0-0.3 = negative, 0.4-0.6 = neutral, 0.7-1.0 = positive.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      max_tokens: 50,
    });
    
    const response = completion.choices[0]?.message?.content?.trim() || '{"sentiment":"neutral","score":0.5}';
    const parsed = JSON.parse(response);
    
    // Normalize sentiment based on score if not provided correctly
    let sentiment: 'positive' | 'neutral' | 'negative' = parsed.sentiment || 'neutral';
    const score = typeof parsed.score === 'number' ? parsed.score : 0.5;
    
    // Ensure sentiment matches score
    if (score < 0.4) sentiment = 'negative';
    else if (score > 0.6) sentiment = 'positive';
    else sentiment = 'neutral';
    
    return { sentiment, score };
  } catch (error) {
    console.error('[Sentiment] Analysis error:', error);
    return { sentiment: 'neutral', score: 0.5 };
  }
}

// Mock Appointment Generation Service
function getCustomerAppointments(phone: string): Appointment[] {
  // Check if already generated and cached
  if (customerAppointments.has(phone)) {
    return customerAppointments.get(phone)!;
  }

  // Get customer history
  const history = getCustomerHistory(phone);
  const appointments: Appointment[] = [];
  const now = new Date();

  // Use same RNG seed for consistency
  const seed = phone.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  let rngState = seed;
  const rng = (max: number) => {
    rngState = (rngState * 9301 + 49297) % 233280;
    return Math.floor((rngState / 233280) * max);
  };

  // Service types pool
  const serviceTypes = ["Dryer Vent Cleaning", "HVAC Duct Cleaning", "Safety Inspection", "Annual Maintenance"];
  // Time slots pool
  const timeSlots = ["8:00 AM - 10:00 AM", "10:00 AM - 12:00 PM", "1:00 PM - 3:00 PM", "3:00 PM - 5:00 PM"];

  // Generate PAST appointments from booking dates
  history.bookingDates.forEach((bookingDate, index) => {
    appointments.push({
      id: `past-${phone}-${index}`,
      date: new Date(bookingDate),
      timeSlot: timeSlots[rng(timeSlots.length)],
      service: serviceTypes[rng(serviceTypes.length)],
      status: 'past',
      customerPhone: phone,
    });
  });

  // Generate CANCELLED appointments
  for (let i = 0; i < history.cancelledBookings; i++) {
    // Cancelled dates should be in the past (30-180 days ago)
    const daysAgo = 30 + rng(150);
    const cancelledDate = new Date(now);
    cancelledDate.setDate(cancelledDate.getDate() - daysAgo);
    
    appointments.push({
      id: `cancelled-${phone}-${i}`,
      date: cancelledDate,
      timeSlot: timeSlots[rng(timeSlots.length)],
      service: serviceTypes[rng(serviceTypes.length)],
      status: 'cancelled',
      customerPhone: phone,
    });
  }

  // Generate PENDING appointments (1-3 future appointments, 1-30 days from now)
  const pendingCount = 1 + rng(3); // 1-3 pending appointments
  for (let i = 0; i < pendingCount; i++) {
    const daysAhead = 1 + rng(30); // 1-30 days from now
    const pendingDate = new Date(now);
    pendingDate.setDate(pendingDate.getDate() + daysAhead);
    
    appointments.push({
      id: `pending-${phone}-${i}`,
      date: pendingDate,
      timeSlot: timeSlots[rng(timeSlots.length)],
      service: serviceTypes[rng(serviceTypes.length)],
      status: 'pending',
      customerPhone: phone,
    });
  }

  // Sort appointments by date (newest first for pending, oldest first for past)
  appointments.sort((a, b) => {
    if (a.status === 'pending' && b.status === 'pending') {
      return a.date.getTime() - b.date.getTime(); // Future appointments: earliest first
    }
    if (a.status === 'past' && b.status === 'past') {
      return b.date.getTime() - a.date.getTime(); // Past appointments: newest first
    }
    if (a.status === 'cancelled' && b.status === 'cancelled') {
      return b.date.getTime() - a.date.getTime(); // Cancelled: newest first
    }
    return 0;
  });

  // Cache the appointments
  customerAppointments.set(phone, appointments);
  
  return appointments;
}

// Analyze Conversation for Lead Score Updates
async function analyzeConversationForScore(
  recentTurns: Array<{ role: string; content: string }>,
  currentScore: number
): Promise<{ delta: number; reason: string }> {
  try {
    const systemPrompt = `You are a sales intelligence system analyzing conversation signals to adjust lead scores.

Analyze the conversation for buying signals and return a score adjustment (-1.0 to +1.0).

SIGNALS TO DETECT:
- Urgency: "today", "asap", "urgent", "immediately", "right away" → positive
- Budget readiness: "afford", "budget", "price", "cost", "how much", "worth it" → positive
- Decision-making power: "I decide", "my call", "I'll book" → positive; "need to check", "my wife/husband", "let me think" → negative
- Timeline: "this week", "soon", "asap" → positive; "maybe later", "next year", "not sure" → negative
- Negative signals: "too expensive", "not interested", "maybe later", "I'll pass" → negative

SCORING GUIDELINES:
- No customer should receive a perfect 10 or 0 score
- Maximum achievable score is 9.5
- Minimum possible score is 1.5

Return JSON: { "delta": number, "reason": string }
- delta: -1.0 to +1.0 (how much to adjust score)
- reason: brief explanation (max 50 chars)

Be conservative - only adjust if signals are clear.`;

    const conversationText = recentTurns
      .map(t => `${t.role}: ${t.content}`)
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Current lead score: ${currentScore.toFixed(1)}/10\n\nConversation:\n${conversationText}\n\nAnalyze and return JSON with delta and reason.` }
      ],
      max_tokens: 150,
    });

    const text = completion.choices[0]?.message?.content?.trim() || '';
    const parsed = JSON.parse(text);
    
    // Clamp delta to -1.0 to +1.0
    const delta = Math.max(-1.0, Math.min(1.0, parseFloat(parsed.delta) || 0));
    const reason = parsed.reason || 'Conversation analysis';

    return { delta, reason };
  } catch (error) {
    console.error('[Lead Score] Conversation analysis error:', error);
    return { delta: 0, reason: 'Analysis error' };
  }
}

// Lead Score API Endpoints
app.post('/api/lead-score/calculate', async (req, res) => {
  try {
    const { phone } = req.body as { phone: string };
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Phone number required' });
    }

    const history = getCustomerHistory(phone);
    const { score, factors } = calculateInitialLeadScore(history);

    currentLeadScore = {
      score,
      baseScore: score,
      adjustments: [],
      lastUpdated: new Date().toISOString(),
    };
    
    // Track current customer phone for nudge generation context
    currentCustomerPhone = phone;

    console.log(`[Lead Score] Calculated initial score: ${score}/10 for phone ${phone}`);
    res.json({ score, factors, history });
  } catch (error) {
    console.error('[Lead Score] Calculate error:', error);
    res.status(500).json({ error: 'Failed to calculate lead score' });
  }
});

app.get('/api/lead-score/current', (_req, res) => {
  if (!currentLeadScore) {
    return res.json({ score: null, baseScore: null, adjustments: [] });
  }
  res.json(currentLeadScore);
});

// Appointments API Endpoint
app.get('/api/appointments', (req, res) => {
  try {
    const phone = req.query.phone as string;
    const status = req.query.status as 'pending' | 'past' | 'cancelled' | undefined;

    if (!phone || typeof phone !== 'string') {
      return res.json({ appointments: [], counts: { pending: 0, past: 0, cancelled: 0 } });
    }

    // Get all appointments for customer
    const allAppointments = getCustomerAppointments(phone);

    // Calculate counts
    const counts = {
      pending: allAppointments.filter(a => a.status === 'pending').length,
      past: allAppointments.filter(a => a.status === 'past').length,
      cancelled: allAppointments.filter(a => a.status === 'cancelled').length,
    };

    // Filter by status if provided
    let filteredAppointments = allAppointments;
    if (status) {
      filteredAppointments = allAppointments.filter(a => a.status === status);
    }

    // Convert Date objects to ISO strings for JSON serialization
    const serializedAppointments = filteredAppointments.map(apt => ({
      ...apt,
      date: apt.date.toISOString(),
    }));

    res.json({ appointments: serializedAppointments, counts });
  } catch (error) {
    console.error('[Appointments] Error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments', appointments: [], counts: { pending: 0, past: 0, cancelled: 0 } });
  }
});

app.post('/api/transcript/append', async (req, res) => {
  try {
    const { role, content } = req.body as { role: string; content: string };
    if (!role || !content || typeof content !== 'string') {
      return res.status(400).json({ ok: false });
    }
    transcriptTurns.push({ role, content });
    transcriptTurnCount++;

    // Update lead score every 2-3 turns if we have a current score
    if (currentLeadScore && transcriptTurnCount % 2 === 0) {
      const recentTurns = transcriptTurns.slice(-3); // Last 2-3 turns
      if (recentTurns.length >= 2) {
        try {
          const analysis = await analyzeConversationForScore(recentTurns, currentLeadScore.score);
          if (Math.abs(analysis.delta) > 0.05) { // Only update if meaningful change
            const newScore = Math.max(1.0, Math.min(10.0, currentLeadScore.score + analysis.delta));
            currentLeadScore.adjustments.push({
              delta: analysis.delta,
              reason: analysis.reason,
              timestamp: new Date().toISOString(),
            });
            currentLeadScore.score = Math.round(newScore * 10) / 10;
            currentLeadScore.lastUpdated = new Date().toISOString();
            
            // Track in lead score history
            leadScoreHistory.push({
              score: currentLeadScore.score,
              timestamp: new Date().toISOString(),
              reason: analysis.reason
            });
            
            console.log(`[Lead Score] Updated: ${currentLeadScore.score}/10 (delta: ${analysis.delta > 0 ? '+' : ''}${analysis.delta.toFixed(2)}, reason: ${analysis.reason})`);
          }
        } catch (error) {
          console.error('[Lead Score] Update error:', error);
        }
      }
    }

    // Nudge generation is now time-based (every 3 seconds) instead of turn-based
    // Just store the transcript and return - nudges will be generated by the interval
    console.log(`[Transcript] Appended ${role}: "${content.substring(0, 50)}..." | Total turns: ${transcriptTurns.length}`);
    
    // Start nudge generation interval if not already running and we have a call
    if (currentCallId && !nudgeGenerationInterval && transcriptTurns.length >= 2) {
      console.log(`[Nudges] Starting nudge generation interval (currentCallId: ${currentCallId}, turns: ${transcriptTurns.length})`);
      startNudgeGenerationInterval();
    } else if (currentCallId && !nudgeGenerationInterval) {
      console.log(`[Nudges] Waiting for more transcript turns (current: ${transcriptTurns.length}, need: 2)`);
    } else if (!currentCallId) {
      console.log(`[Nudges] No active call session - cannot generate nudges`);
    }
    
    return res.json({ ok: true });
  } catch (e) {
    console.error('[Transcript] Append error:', e);
    res.json({ ok: true });
  }
});

// Function to generate nudges (extracted for reuse)
async function generateNudgesFromTranscript() {
  try {
    // Only generate if we have at least 2 turns and a call is active
    if (!currentCallId) {
      console.log(`[Nudges] Skipping generation - no active call (currentCallId: ${currentCallId})`);
      return;
    }
    if (transcriptTurns.length < 2) {
      console.log(`[Nudges] Skipping generation - not enough turns (${transcriptTurns.length} < 2)`);
      return;
    }
    
    const now = Date.now();
    // Throttle: don't generate if we just generated nudges within the last 2.5 seconds
    if (now - lastNudgeGenerationTime < 2500) {
      return;
    }
    
    lastNudgeGenerationTime = now;
    
    // auto-generate nudges using recent window
    const lines = transcriptTurns.slice(-12);
    console.log(`[Nudges] Generating nudges from ${transcriptTurns.length} total turns (time-based, every 3s)`);
    
    // Get recently shown nudge titles to avoid repetition
    const recentTitles = Array.from(recentlyShownNudges.keys()).slice(-20);
    const pendingTitles = pendingNudges.map(n => n.title);
    const allRecentTitles = [...new Set([...recentTitles, ...pendingTitles])];
    
    // Build comprehensive customer context
    const customerContext = currentCustomerPhone ? buildCustomerContext(currentCustomerPhone) : '';
    
    // Build lead score context for nudge generation
    const leadScoreContext = currentLeadScore 
      ? `\n\nLEAD SCORE: ${currentLeadScore.score}/10 (Base: ${currentLeadScore.baseScore}/10)
NUDGE STRATEGY BASED ON SCORE:
- Score 7-10 (High): Focus on UPSELL opportunities, higher-value services, premium options
- Score 4-6 (Medium): Balanced approach with CROSS-SELL opportunities and value-focused suggestions
- Score 1-3 (Low): Focus on building trust, TIP-based guidance, basic service, no aggressive selling`
      : '';
    
    const system = `You are an expert sales coach for home services. Generate HIGH-QUALITY, CONTEXT-SPECIFIC, PERSONALIZED nudges for a CSR handling dryer vent cleaning/inspection calls.

CRITICAL: Use ALL available customer data (history, appointments, lead score, behavioral insights) to generate PERSONALIZED, context-aware nudges. Each nudge must be highly relevant to this specific customer's profile.

OUTPUT FORMAT: JSON with up to 2 HIGH-QUALITY nudges (only suggest if highly relevant). Each nudge has: id, type, title, body, priority.

NUDGE TYPES & QUALITY STANDARDS:

1. UPSELL (Enhance current service):
   - GOOD: "Safety Inspection + Cleaning Bundle" → "Add safety inspection for $45. Identifies fire hazards & improves efficiency by 30%."
   - BAD: "Add more services" or "Upgrade your service"
   - Rule: Specific service + clear value (safety, cost savings, performance) + concrete benefit

2. CROSS-SELL (Complementary service):
   - GOOD: "HVAC Duct Cleaning" → "Dryer vent & HVAC share ductwork. Bundle saves $50 & improves air quality."
   - BAD: "We offer other services" or "Check out our other products"
   - Rule: Logical connection to current need + bundling incentive + tangible outcome

3. TIP (Improve conversation/close):
   - GOOD: "Ask: 'When did you last clean the vent?'" → "Reveals urgency. 3+ years = high fire risk angle."
   - BAD: "Be nice to customer" or "Ask questions"
   - Rule: Specific question/action + why it matters + strategic benefit

QUALITY REQUIREMENTS:
- Each nudge must be IMMEDIATELY ACTIONABLE with clear next step
- Include specific dollar amounts, percentages, or timeframes when relevant
- Focus on CUSTOMER VALUE (safety, savings, convenience) not just features
- Be conversational and natural, not salesy or pushy
- Context matters: Only suggest what makes sense given the current conversation

STRICT RULES:
- Body: ≤140 chars. Title: ≤40 chars.
- Priority: 1 (urgent/high-value), 2 (good fit) - Focus on priority 1-2 only
- NO generic suggestions like "provide good service" or "ask about needs"
- NO repetition: Each nudge must be distinctly different from previous ones
- PERSONALIZE: Use customer history, appointments, and behavioral insights
- AVOID suggesting services already scheduled in upcoming appointments
- LEVERAGE past service history to suggest complementary services
- CONSIDER cancellation rate and ticket size for appropriate suggestions
- If conversation doesn't warrant quality nudges, return fewer (even 0-1)${leadScoreContext}${customerContext}`;

    const avoidList = allRecentTitles.length > 0 
      ? `\n\nAVOID THESE RECENTLY USED TITLES (generate NEW suggestions):\n${allRecentTitles.map(t => `- "${t}"`).join('\n')}`
      : '';
    
    const prompt = `Conversation (recent):\n${lines.map(l => `${l.role}: ${l.content}`).join('\n')}${avoidList}\n\nAnalyze the conversation context AND all available customer data above. Generate 0-2 HIGH-QUALITY, PERSONALIZED nudges that are:
- Contextually relevant to the current conversation
- Personalized based on customer history and behavior
- Avoiding services already scheduled
- Leveraging past service patterns
- Appropriate for this customer's profile

Use ALL available data (lead score, customer history, appointments, behavioral insights) to make informed, personalized suggestions. Respond ONLY as JSON { "nudges": [...] }.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Better quality than gpt-3.5-turbo, still fast and cost-effective
      temperature: 0.3, // Slightly higher for more creative, varied suggestions
      messages: [ { role: 'system', content: system }, { role: 'user', content: prompt } ],
      max_tokens: 400, // More room for detailed, quality responses
    });
    const text = completion.choices[0]?.message?.content?.trim() || '';

    // Robust JSON parsing: strip markdown fences and extract first JSON object/array
    function parseJsonSafely(s: string) {
      if (!s) return null;
      // Remove markdown fences and common wrappers
      let cleaned = s.replace(/```(?:json)?\r?\n?/gi, '').replace(/```/g, '').trim();

  // Try direct parse first
  try { return JSON.parse(cleaned); } catch (e) { void e; }

      // Try to locate first {...} or [...] block
      const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (match) {
        const candidate = match[0];
        try { return JSON.parse(candidate); } catch (err) {
          console.error('[Nudges] JSON candidate parse failed:', err);
          console.error('[Nudges] Candidate preview:', candidate.substring(0, 800));
          return null;
        }
      }

      // Last-resort: strip surrounding quotes/backticks and try again
      cleaned = cleaned.replace(/^['"`\s]+|['"`\s]+$/g, '');
      try { return JSON.parse(cleaned); } catch (err) {
        console.error('[Nudges] Final parse attempt failed:', err);
        console.error('[Nudges] Raw response preview:', s.substring(0, 1200));
        return null;
      }
    }

    try {
      const parsed = parseJsonSafely(text) as any;
      if (parsed && Array.isArray(parsed?.nudges)) {
        const incoming: Nudge[] = parsed.nudges.slice(0, 2); // Max 2 nudges for higher quality
        const now = Date.now();

        // Clean up old entries from recentlyShown (older than 60 seconds)
        for (const [title, timestamp] of recentlyShownNudges.entries()) {
          if (now - timestamp > 60000) {
            recentlyShownNudges.delete(title);
          }
        }

        // De-dup by title, but allow re-showing after 60 seconds
        const seen = new Set(pendingNudges.map(n => n.title));
        const wrapped: ServerNudge[] = incoming
          .filter(n => {
            if (!n || !n.title) return false;
            // Skip if already in pending queue
            if (seen.has(n.title)) return false;

            // Skip if recently shown (within last 60 seconds)
            const lastShown = recentlyShownNudges.get(n.title);
            if (lastShown && (now - lastShown < 60000)) return false;

            return true;
          })
          .map(n => ({ ...n, sid: `${Date.now()}-${++nudgeCounter}`, createdAt: now }));

        pendingNudges.push(...wrapped);

        if (wrapped.length > 0) {
          console.log(`[Nudges] Added ${wrapped.length} new nudges to pending queue | Total pending: ${pendingNudges.length}`);
          console.log(`[Nudges] New titles: ${wrapped.map(n => n.title).join(', ')}`);
        } else if (incoming.length > 0) {
          console.log(`[Nudges] Generated ${incoming.length} nudges but all were filtered (duplicates or recently shown)`);
        }
      } else {
        console.error('[Nudges] Parse error: unable to extract nudges JSON from model response');
        console.error('[Nudges] Model response preview:', text.substring(0, 1200));
      }
    } catch (parseErr) {
      console.error('[Nudges] Unexpected parse error:', parseErr);
    }
  } catch (error) {
    console.error('[Nudges] Generation error:', error);
  }
}

// Start nudge generation interval (generates every 3 seconds)
function startNudgeGenerationInterval() {
  if (nudgeGenerationInterval) {
    clearInterval(nudgeGenerationInterval);
  }
  
  nudgeGenerationInterval = setInterval(() => {
    if (!currentCallId) {
      // Call ended, stop interval
      if (nudgeGenerationInterval) {
        clearInterval(nudgeGenerationInterval);
        nudgeGenerationInterval = null;
      }
      return;
    }
    
    generateNudgesFromTranscript();
  }, 3000); // Every 3 seconds
  
  console.log('[Nudges] Started time-based generation interval (every 3 seconds)');
}

// Stop nudge generation interval
function stopNudgeGenerationInterval() {
  if (nudgeGenerationInterval) {
    clearInterval(nudgeGenerationInterval);
    nudgeGenerationInterval = null;
    console.log('[Nudges] Stopped time-based generation interval');
  }
}

// Return current transcript turns
app.get('/api/transcript/latest', (_req, res) => {
  res.json({ transcript: transcriptTurns });
});

// Track lead score history for current call
let leadScoreHistory: Array<{ score: number; timestamp: string; reason?: string }> = [];

// Nudge generation interval state
let nudgeGenerationInterval: NodeJS.Timeout | null = null;
let lastNudgeGenerationTime = 0;

// Initialize call session (called when call starts)
app.post('/api/call/start', async (req, res) => {
  try {
    const { customerPhone, customerData } = req.body;
    // Allow calls without customerPhone (use 'unknown' as fallback)
    const phone = customerPhone || 'unknown';

    // Generate unique call ID
    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    currentCallId = callId;
    callStartTime = new Date();
    
    // Reset lead score history for new call
    leadScoreHistory = [];
    
    // Calculate initial lead score (only if phone is not 'unknown')
    let initialScore = 5.0; // Default score
    if (phone !== 'unknown') {
      const history = getCustomerHistory(phone);
      const scoreResult = calculateInitialLeadScore(history);
      initialScore = scoreResult.score;
    }
    
    // Store initial score in history
    leadScoreHistory.push({
      score: initialScore,
      timestamp: callStartTime.toISOString(),
      reason: 'Initial score based on customer history'
    });
    
    // Initialize current lead score
    currentLeadScore = {
      score: initialScore,
      baseScore: initialScore,
      adjustments: [],
      lastUpdated: new Date().toISOString()
    };
    currentCustomerPhone = phone;
    
    // Store customer data if provided
    if (customerData) {
      currentCustomerData = customerData;
    } else {
      // Fallback to minimal data
      currentCustomerData = {
        firstName: '',
        lastName: '',
        zipcode: '',
        phone: phone
      };
    }
    
    // Clear transcript and nudges for new call
    transcriptTurns.length = 0;
    pendingNudges.length = 0;
    transcriptTurnCount = 0;
    
    // Stop any existing interval
    stopNudgeGenerationInterval();
    lastNudgeGenerationTime = 0;
    
    console.log(`[Call] Started: ${callId} for customer ${phone}`);
    console.log(`[Call] Nudge generation will start after 2 transcript turns`);
    
    res.json({ callId, startTime: callStartTime.toISOString() });
  } catch (error) {
    console.error('[Call] Start error:', error);
    res.status(500).json({ error: 'Failed to start call session' });
  }
});

// End call and save session
app.post('/api/call/end', async (req, res) => {
  try {
    if (!currentCallId || !callStartTime) {
      return res.status(400).json({ error: 'No active call session' });
    }

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - callStartTime.getTime()) / 1000);
    
    // Get customer data from context
    const customerPhone = currentCustomerPhone || '';
    
    // Analyze sentiment for all transcript turns
    const transcriptWithSentiment = await Promise.all(
      transcriptTurns.map(async (turn) => {
        const sentiment = await analyzeSentiment(turn.content);
        return {
          role: turn.role,
          content: turn.content,
          timestamp: new Date().toISOString(), // In production, track actual timestamps
          sentiment: sentiment.sentiment,
          sentimentScore: sentiment.score
        };
      })
    );
    
    // Calculate overall sentiment
    const sentiments = transcriptWithSentiment.map(t => t.sentiment);
    const positiveCount = sentiments.filter(s => s === 'positive').length;
    const neutralCount = sentiments.filter(s => s === 'neutral').length;
    const negativeCount = sentiments.filter(s => s === 'negative').length;
    const avgScore = transcriptWithSentiment.reduce((sum, t) => sum + (t.sentimentScore || 0.5), 0) / transcriptWithSentiment.length;
    
    // Get all nudges shown during call (from pendingNudges)
    const nudgesShown = pendingNudges.map(n => ({
      ...n,
      timestamp: new Date(n.createdAt).toISOString()
    }));
    
    // Get final lead score
    const finalScore = currentLeadScore?.score || 0;
    const initialScore = leadScoreHistory[0]?.score || finalScore;
    
    // Get customer data from stored context
    const customerData = currentCustomerData || {
      firstName: '',
      lastName: '',
      zipcode: '',
      phone: customerPhone
    };
    
    // Create call session
    const session: CallSession = {
      callId: currentCallId,
      customerPhone,
      startTime: callStartTime,
      endTime,
      duration,
      transcript: transcriptWithSentiment,
      nudgesShown,
      leadScoreHistory,
      finalLeadScore: finalScore,
      initialLeadScore: initialScore,
      customerData,
      overallSentiment: {
        positive: positiveCount,
        neutral: neutralCount,
        negative: negativeCount,
        averageScore: avgScore
      }
    };
    
    // Save session
    callSessions.set(currentCallId, session);
    
    console.log(`[Call] Ended: ${currentCallId} | Duration: ${duration}s | Score: ${initialScore} → ${finalScore}`);
    
    // Reset call state
    const savedCallId = currentCallId;
    currentCallId = null;
    callStartTime = null;
    leadScoreHistory = [];
    currentCustomerData = null;
    
    // Stop nudge generation interval
    stopNudgeGenerationInterval();
    lastNudgeGenerationTime = 0;
    
    res.json({ callId: savedCallId, session });
  } catch (error) {
    console.error('[Call] End error:', error);
    res.status(500).json({ error: 'Failed to end call session' });
  }
});

// Get call session by ID
app.get('/api/call/session/:callId', (req, res) => {
  try {
    const { callId } = req.params;
    const session = callSessions.get(callId);
    
    if (!session) {
      return res.status(404).json({ error: 'Call session not found' });
    }
    
    // Serialize Date objects to ISO strings
    const serialized = {
      ...session,
      startTime: session.startTime instanceof Date ? session.startTime.toISOString() : session.startTime,
      endTime: session.endTime instanceof Date ? session.endTime.toISOString() : session.endTime,
    };
    
    res.json(serialized);
  } catch (error) {
    console.error('[Call] Get session error:', error);
    res.status(500).json({ error: 'Failed to retrieve call session' });
  }
});

// Get latest call session
app.get('/api/call/latest', (_req, res) => {
  try {
    if (callSessions.size === 0) {
      return res.status(404).json({ error: 'No call sessions found' });
    }
    
    // Get the most recent session (sort by endTime, most recent first)
    const sessions = Array.from(callSessions.values());
    const latest = sessions.sort((a, b) => {
      const timeA = a.endTime instanceof Date ? a.endTime.getTime() : new Date(a.endTime).getTime();
      const timeB = b.endTime instanceof Date ? b.endTime.getTime() : new Date(b.endTime).getTime();
      return timeB - timeA;
    })[0];
    
    // Serialize Date objects to ISO strings
    const serialized = {
      ...latest,
      startTime: latest.startTime instanceof Date ? latest.startTime.toISOString() : latest.startTime,
      endTime: latest.endTime instanceof Date ? latest.endTime.toISOString() : latest.endTime,
    };
    
    res.json(serialized);
  } catch (error) {
    console.error('[Call] Get latest error:', error);
    res.status(500).json({ error: 'Failed to retrieve latest call session' });
  }
});

// Return current pending nudges without draining; client will ACK what it shows
app.get('/api/nudges/latest', (_req, res) => {
  const toSend = pendingNudges.slice(0, 16);
  if (toSend.length > 0) {
    console.log(`[Nudges] Serving ${toSend.length} pending nudges to client`);
  }
  res.json({ nudges: toSend });
});

// Acknowledge and remove shown nudges by sid array
app.post('/api/nudges/ack', async (req, res) => {
  try {
    const { sids } = req.body as { sids: string[] };
    if (!Array.isArray(sids) || !sids.length) return res.json({ ok: true });
    const set = new Set(sids);
    const beforeCount = pendingNudges.length;
    const now = Date.now();
    
    // Mark nudges as recently shown before removing them
    const ackedNudges = pendingNudges.filter(n => set.has(n.sid));
    ackedNudges.forEach(n => {
      recentlyShownNudges.set(n.title, now);
    });
    
    pendingNudges = pendingNudges.filter(n => !set.has(n.sid));
    const removedCount = beforeCount - pendingNudges.length;
    if (removedCount > 0) {
      console.log(`[Nudges] ACKed ${removedCount} nudges (marked as recently shown) | Remaining: ${pendingNudges.length}`);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[Nudges] ACK error:', err);
    res.json({ ok: true });
  }
});

// Frontend polling endpoint
app.get('/api/latest-response', (req, res) => {
  if (latestResponse) {
    const responseToSend = latestResponse;
    latestResponse = null;
    res.json({ reply: responseToSend });
  } else {
    res.json({ reply: null });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Admin interface: http://localhost:${port}/admin`);
});
