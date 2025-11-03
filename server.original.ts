/* eslint-disable @typescript-eslint/no-explicit-any */
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Message = {
  role: "system" | "user" | "assistant";
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
app.get("/", (_req, res) => {
  res.send(
    '<!DOCTYPE html><html><body><h3>Neighborly Backend</h3><p>Visit <a href="/admin">/admin</a> to run the call simulation.</p></body></html>'
  );
});

// Admin call simulator (Start/End, uses Realtime via WebRTC and feeds transcript for nudges)
app.get("/admin", (_req, res) => {
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

    function endCall() {
      document.getElementById('startBtn').disabled = false;
      document.getElementById('endBtn').disabled = true;
      if (pc) { try { pc.close(); } catch {} pc = null; }
      if (dc) { try { dc.close(); } catch {} dc = null; }
      sttStatusEl.textContent = 'STT: Inactive';
      sttStatusEl.className = 'status inactive';
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
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const connectedClients = new Set<any>();

// Store latest response for frontend polling
let latestResponse: string | null = null;

// Helper function to send SSE to all connected clients
function sendSSEToAll(data: any) {
  const message = `data: ${JSON.stringify(data)}

`;
  connectedClients.forEach((client) => {
    try {
      client.write(message);
    } catch (error) {
      // Remove disconnected clients
      connectedClients.delete(client);
    }
  });
}

// Real-time SSE endpoint for live nudge updates
app.get("/api/realtime-nudges", (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  // Add client to connected clients
  connectedClients.add(res);

  // Send initial connection confirmation
  sendSSEToAll({
    type: "connected",
    message: "Connected to real-time nudge stream",
  });

  // Handle client disconnect
  req.on("close", () => {
    connectedClients.delete(res);
  });

  req.on("end", () => {
    connectedClients.delete(res);
  });
});

// Chat endpoint - processes LLM requests and stores response
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const systemPrompt = `You are a helpful assistant for a customer service application.
      Keep responses concise (1-2 sentences max) and professional.`;

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
      max_tokens: 100,
      temperature: 0.7,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      "Sorry, I couldn't process that.";

    latestResponse = reply;
    res.json({ reply });
  } catch (error) {
    console.error("LLM API error:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
});

// Ephemeral token for OpenAI Realtime (WebRTC) sessions
// Returns a short-lived client token the browser can use to establish a direct WebRTC session
app.post("/api/realtime/token", async (_req, res) => {
  try {
    const serverKey =
      process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!serverKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const sessionResp = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serverKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview",
          voice: "verse",
          modalities: ["audio", "text"],
          instructions:
            "You are a residential customer calling a customer service representative to request dryer vent cleaning and dryer vent inspection today. Always role-play strictly as the customer, speaking only in English. Do not adopt the CSR persona. Keep replies natural, concise (≤2 sentences), and proceed only as a customer answering questions or asking about booking/scheduling. Begin the conversation with: 'Hi, is this neighborly? I am looking for dryer vent cleaning and an inspection today.'",
          // Keep default instructions concise – the client will send a response.create with first line
          // You can enrich here if you want the agent to always follow a persona
        }),
      }
    );

    if (!sessionResp.ok) {
      const text = await sessionResp.text();
      return res
        .status(500)
        .json({ error: "Failed to create realtime session", details: text });
    }

    const session = await sessionResp.json();
    const token = session?.client_secret?.value;
    if (!token) {
      return res
        .status(500)
        .json({ error: "Realtime token missing in response" });
    }
    res.json({ token });
  } catch (err) {
    console.error("Realtime token error:", err);
    res.status(500).json({ error: "Failed to create realtime token" });
  }
});

type Nudge = {
  id: string;
  type: "upsell" | "cross_sell" | "tip";
  title: string;
  body: string;
  priority: 1 | 2 | 3;
};

// Generate small nudges from recent transcript (standalone endpoint, matches quality of auto-generation)
// app.post('/api/nudges/generate', async (req, res) => {
//   try {
//     const { transcript } = req.body as { transcript: Array<{ role: string; content: string }> | string[] };
//     if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
//       return res.status(400).json({ nudges: [] });
//     }

//     // Normalize to simple lines of text
//     const lines: string[] = (transcript as any[]).map((t) => (typeof t === 'string' ? t : `${t.role}: ${t.content}`));
//     const windowText = lines.slice(-12).join('\n');

//     const system = `You are an expert sales coach for home services. Generate HIGH-QUALITY, CONTEXT-SPECIFIC nudges for a CSR handling dryer vent cleaning/inspection calls.

// OUTPUT FORMAT: JSON with up to 2 nudges (only suggest if highly relevant). Each nudge has: id, type, title, body, priority.

// NUDGE TYPES & QUALITY STANDARDS:

// 1. UPSELL (Enhance current service):
//    - GOOD: "Safety Inspection + Cleaning Bundle" → "Add safety inspection for $45. Identifies fire hazards & improves efficiency by 30%."
//    - BAD: "Add more services" or "Upgrade your service"
//    - Rule: Specific service + clear value (safety, cost savings, performance) + concrete benefit

// 2. CROSS-SELL (Complementary service):
//    - GOOD: "HVAC Duct Cleaning" → "Dryer vent & HVAC share ductwork. Bundle saves $50 & improves air quality."
//    - BAD: "We offer other services" or "Check out our other products"
//    - Rule: Logical connection to current need + bundling incentive + tangible outcome

// 3. TIP (Improve conversation/close):
//    - GOOD: "Ask: 'When did you last clean the vent?'" → "Reveals urgency. 3+ years = high fire risk angle."
//    - BAD: "Be nice to customer" or "Ask questions"
//    - Rule: Specific question/action + why it matters + strategic benefit

// QUALITY REQUIREMENTS:
// - Each nudge must be IMMEDIATELY ACTIONABLE with clear next step
// - Include specific dollar amounts, percentages, or timeframes when relevant
// - Focus on CUSTOMER VALUE (safety, savings, convenience) not just features
// - Be conversational and natural, not salesy or pushy
// - Context matters: Only suggest what makes sense given the current conversation

// STRICT RULES:
// - Body: ≤140 chars. Title: ≤40 chars.
// - Priority: 1 (urgent/high-value), 2 (good fit), 3 (nice to have)
// - NO generic suggestions like "provide good service" or "ask about needs"
// - NO repetition: Each nudge must be distinctly different from previous ones
// - If conversation doesn't warrant quality nudges, return fewer (even 0-1)`;

//     const prompt = `Conversation (recent):\n${windowText}\n\nAnalyze the conversation context and generate 0-3 HIGH-QUALITY nudges. Respond ONLY as JSON { "nudges": [...] }.`;

//     const completion = await openai.chat.completions.create({
//       model: 'gpt-4o-mini', // Better quality than gpt-3.5-turbo
//       temperature: 0.3, // Slightly higher for more creative, varied suggestions
//       messages: [
//         { role: 'system', content: system },
//         { role: 'user', content: prompt },
//       ],
//       max_tokens: 400, // More room for detailed, quality responses
//     });

//     const text = completion.choices[0]?.message?.content?.trim() || '';
//     let parsed: { nudges?: Nudge[] } = {};
//     try {
//       parsed = JSON.parse(text);
//     } catch {
//       // Try to extract JSON substring
//       const start = text.indexOf('{');
//       const end = text.lastIndexOf('}');
//       if (start !== -1 && end !== -1 && end > start) {
//         parsed = JSON.parse(text.slice(start, end + 1));
//       }
//     }

//     const nudges = Array.isArray(parsed?.nudges) ? parsed.nudges.slice(0, 3) : []; // Changed from 4 to 3 for quality
//     console.log(`[Nudges] Generated ${nudges.length} high-quality nudges from transcript`);
//     if (nudges.length > 0) {
//       console.log(`[Nudges] Titles: ${nudges.map((n: any) => n.title).join(', ')}`);
//     }
//     res.json({ nudges });
//   } catch (err) {
//     console.error('[Nudges] Generation error:', err);
//     res.status(200).json({ nudges: [] });
//   }
// });

// In-memory stores for cross-app polling
const transcriptTurns: Array<{ role: string; content: string }> = [];
type ServerNudge = Nudge & { sid: string; createdAt: number };
let pendingNudges: ServerNudge[] = [];
let nudgeCounter = 0;
// Track recently shown nudges to allow re-showing after 60 seconds
const recentlyShownNudges = new Map<string, number>(); // title -> timestamp

app.post("/api/transcript/append", async (req, res) => {
  try {
    const { role, content } = req.body as { role: string; content: string };
    if (!role || !content || typeof content !== "string") {
      return res.status(400).json({ ok: false });
    }
    transcriptTurns.push({ role, content });

    // auto-generate nudges using recent window
    const lines = transcriptTurns.slice(-12);
    console.log(
      `[Transcript] Appended ${role}: "${content.substring(
        0,
        50
      )}..." | Total turns: ${transcriptTurns.length}`
    );

    // Get recently shown nudge titles to avoid repetition
    const recentTitles = Array.from(recentlyShownNudges.keys()).slice(-20);
    const pendingTitles = pendingNudges.map((n) => n.title);
    const allRecentTitles = [...new Set([...recentTitles, ...pendingTitles])];

    const system = `You are an expert sales coach for home services. Generate HIGH-QUALITY, CONTEXT-SPECIFIC nudges for a CSR handling dryer vent cleaning/inspection calls.

OUTPUT FORMAT: JSON with up to 2 nudges (only suggest if highly relevant). Each nudge has: id, type, title, body, priority.

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

    const avoidList =
      allRecentTitles.length > 0
        ? `\n\nAVOID THESE RECENTLY USED TITLES (generate NEW suggestions):\n${allRecentTitles
            .map((t) => `- "${t}"`)
            .join("\n")}`
        : "";

    const prompt = `Conversation (recent):\n${lines
      .map((l) => `${l.role}: ${l.content}`)
      .join(
        "\n"
      )}${avoidList}\n\nAnalyze the conversation context and generate 0-2 HIGH-QUALITY nudges. Respond ONLY as JSON { "nudges": [...] }.`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Better quality than gpt-3.5-turbo, still fast and cost-effective
      temperature: 0.3, // Slightly higher for more creative, varied suggestions
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      max_tokens: 400, // More room for detailed, quality responses
    });
    const text = completion.choices[0]?.message?.content?.trim() || "";
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed?.nudges)) {
        const incoming: Nudge[] = parsed.nudges.slice(0, 3); // Changed from 4 to 3 for higher quality
        const now = Date.now();

        // Clean up old entries from recentlyShown (older than 60 seconds)
        for (const [title, timestamp] of recentlyShownNudges.entries()) {
          if (now - timestamp > 60000) {
            recentlyShownNudges.delete(title);
          }
        }

        // De-dup by title, but allow re-showing after 60 seconds
        const seen = new Set(pendingNudges.map((n) => n.title));
        const wrapped: ServerNudge[] = incoming
          .filter((n) => {
            // Skip if already in pending queue
            if (seen.has(n.title)) return false;

            // Skip if recently shown (within last 60 seconds)
            const lastShown = recentlyShownNudges.get(n.title);
            if (lastShown && now - lastShown < 60000) return false;

            return true;
          })
          .map((n) => ({
            ...n,
            sid: `${Date.now()}-${++nudgeCounter}`,
            createdAt: now,
          }));

        pendingNudges.push(...wrapped);

        if (wrapped.length > 0) {
          console.log(
            `[Nudges] Added ${wrapped.length} new nudges to pending queue | Total pending: ${pendingNudges.length}`
          );
          console.log(
            `[Nudges] New titles: ${wrapped.map((n) => n.title).join(", ")}`
          );

          // Send real-time update to all connected SSE clients
          wrapped.forEach((nudge) => {
            sendSSEToAll({
              type: "nudge",
              nudge: nudge.body, // Send the nudge text
              title: nudge.title,
              priority: nudge.priority,
              timestamp: new Date().toISOString(),
            });
          });
        } else if (incoming.length > 0) {
          console.log(
            `[Nudges] Generated ${incoming.length} nudges but all were filtered (duplicates or recently shown)`
          );
        }
      }
    } catch (parseErr) {
      console.error("[Nudges] Parse error:", parseErr);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("[Transcript] Append error:", e);
    res.json({ ok: true });
  }
});

// Return current pending nudges without draining; client will ACK what it shows
app.get("/api/nudges/latest", (_req, res) => {
  const toSend = pendingNudges.slice(0, 16);
  if (toSend.length > 0) {
    console.log(`[Nudges] Serving ${toSend.length} pending nudges to client`);
  }
  res.json({ nudges: toSend });
});

// Acknowledge and remove shown nudges by sid array
app.post("/api/nudges/ack", async (req, res) => {
  try {
    const { sids } = req.body as { sids: string[] };
    if (!Array.isArray(sids) || !sids.length) return res.json({ ok: true });
    const set = new Set(sids);
    const beforeCount = pendingNudges.length;
    const now = Date.now();

    // Mark nudges as recently shown before removing them
    const ackedNudges = pendingNudges.filter((n) => set.has(n.sid));
    ackedNudges.forEach((n) => {
      recentlyShownNudges.set(n.title, now);
    });

    pendingNudges = pendingNudges.filter((n) => !set.has(n.sid));
    const removedCount = beforeCount - pendingNudges.length;
    if (removedCount > 0) {
      console.log(
        `[Nudges] ACKed ${removedCount} nudges (marked as recently shown) | Remaining: ${pendingNudges.length}`
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[Nudges] ACK error:", err);
    res.json({ ok: true });
  }
});

// Frontend polling endpoint
app.get("/api/latest-response", (req, res) => {
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
