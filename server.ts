/* eslint-disable @typescript-eslint/no-explicit-any */
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import { Client as PGClient } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let leadPolicy = "";
let offerStrategy = {
  tier: "B",
  score: 50,
  sizing: "standard",
  incentive: "none",
  notes: "",
};

// === Nudge cadence & queue ===
let lastNudgeAt = 0;
const NUDGE_COOLDOWN_MS = 7000; // 7s between generations
const MAX_PENDING = 12; // cap the queue

// === Robust JSON parser: strips code fences & extracts first {...} ===
function safeJsonParse(possiblyFenced: string): any | null {
  if (!possiblyFenced) return null;
  const noFences = possiblyFenced
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```$/m, "")
    .trim();
  const start = noFences.indexOf("{");
  const end = noFences.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(noFences.slice(start, end + 1));
  } catch {
    return null;
  }
}

// === Small service catalog (used to bias upsell/cross-sell) ===
const serviceCatalogDefault = [
  {
    key: "safety_inspection",
    name: "Dryer Safety Inspection",
    price: 45,
    value: "fire risk check, airflow, lint buildup",
  },
  {
    key: "cleaning_bundle",
    name: "Cleaning + Inspection Bundle",
    price: 129,
    value: "saves $25 vs separate",
  },
  {
    key: "hvac_duct_cleaning",
    name: "HVAC Duct Cleaning",
    price: 199,
    value: "air quality, pet dander",
  },
  {
    key: "annual_plan",
    name: "Annual Maintenance Plan",
    price: 99,
    value: "2 cleanings/year + priority slots",
  },
];

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type Nudge = {
  id: string;
  type: "upsell" | "cross_sell" | "tip";
  title: string;
  body: string;
  priority: 1 | 2 | 3;
};
type ServerNudge = Nudge & { sid: string; createdAt: number };

dotenv.config();

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ------------------------
// OpenAI
// ------------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
});

// ------------------------
// Postgres (pgvector) setup
// ------------------------
if (!process.env.DATABASE_URL) {
  console.warn(
    "[DB] DATABASE_URL not set. Vector features will fail without it."
  );
}
const pg = new PGClient({ connectionString: process.env.DATABASE_URL });
await pg.connect().catch((e) => {
  console.error("[DB] Connection error:", e);
  process.exit(1);
});

type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  plan: "none" | "basic" | "premium";
  last_service_date: string; // ISO date string
  avg_order_value: number;
  dryer_age_years: number;
  has_pets: boolean;
  notes: string;
};

async function listLeads(): Promise<LeadRow[]> {
  const { rows } = await pg.query(
    `SELECT id,name,email,phone,city,plan,last_service_date,avg_order_value,dryer_age_years,has_pets,notes
     FROM leads ORDER BY id`
  );
  return rows;
}
async function getLead(id: string): Promise<LeadRow | null> {
  const { rows } = await pg.query(
    `SELECT id,name,email,phone,city,plan,last_service_date,avg_order_value,dryer_age_years,has_pets,notes
     FROM leads WHERE id=$1`,
    [id]
  );
  return rows[0] || null;
}

// ------------------------
// Simple root page
// ------------------------
app.get("/", (_req, res) => {
  res.send(
    '<!DOCTYPE html><html><body><h3>Neighborly Backend</h3><p>Visit <a href="/admin">/admin</a> to run the call simulation.</p></body></html>'
  );
});

// ------------------------
// Admin call simulator (updated with lead picker + lead panel)
// ------------------------
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

     <!-- Lead picker row -->
     <div class="row">
       <div class="muted small">Lead</div><div class="spacer"></div>
       <select id="leadSelect" class="btn btn-outline"></select>
       <button class="btn" id="pickBtn">Use Lead</button>
     </div>

     <!-- Lead status row -->
     <div class="row">
       <div class="muted small">Selected:</div>
       <div id="leadName" class="muted small">—</div>
       <span class="status inactive" id="leadTier">Tier: —</span>
       <span class="status inactive" id="leadScore">Score: —</span>
       <div class="spacer"></div>
       <span class="muted xs" id="leadDetails">city: — | plan: — | last: — | AOV: —</span>
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

    // Lead UI refs
    const leadSelect = document.getElementById('leadSelect');
    const pickBtn = document.getElementById('pickBtn');
    const leadNameEl = document.getElementById('leadName');
    const leadTierEl = document.getElementById('leadTier');
    const leadScoreEl = document.getElementById('leadScore');
    const leadDetailsEl = document.getElementById('leadDetails');

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

    // Lead UI helpers
    async function loadLeads() {
      try {
        const r = await fetch('/api/users').then(r=>r.json());
        leadSelect.innerHTML = '';
        (r.users || []).forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = \`\${u.id} · \${u.name} · \${u.city} · \${u.plan}\`;
          leadSelect.appendChild(opt);
        });
      } catch {}
    }

    async function refreshLead() {
      try {
        const r = await fetch('/api/lead/current').then(r => r.json());
        if (!r || !r.user) {
          leadNameEl.textContent = '—';
          leadTierEl.textContent = 'Tier: —';
          leadScoreEl.textContent = 'Score: —';
          leadTierEl.className = 'status inactive';
          leadScoreEl.className = 'status inactive';
          leadDetailsEl.textContent = 'city: — | plan: — | last: — | AOV: —';
          return;
        }
        const u = r.user;
        const ls = r.leadScore;
        leadNameEl.textContent = \`\${u.name}\`;
        if (ls) {
          leadScoreEl.textContent = \`Score: \${ls.score}\`;
          leadTierEl.textContent = \`Tier: \${ls.tier}\`;
          leadScoreEl.className = 'status active';
          leadTierEl.className = 'status active';
        } else {
          leadScoreEl.textContent = 'Score: —';
          leadTierEl.textContent = 'Tier: —';
          leadScoreEl.className = 'status inactive';
          leadTierEl.className = 'status inactive';
        }
        leadDetailsEl.textContent = \`city: \${u.city} | plan: \${u.plan} | last: \${u.last_service_date} | AOV: $\${u.avg_order_value}\`;
      } catch {}
    }

    pickBtn.addEventListener('click', async () => {
      const id = leadSelect.value;
      if (!id) return;
      await fetch('/api/users/select', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) });
      await refreshLead();
      log('[Lead] Selected ' + id);
    });

    loadLeads();
    setInterval(refreshLead, 3000);

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

// ------------------------
// Health
// ------------------------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ------------------------
// SSE infra
// ------------------------
const connectedClients = new Set<any>();
function sendSSEToAll(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  connectedClients.forEach((client) => {
    try {
      client.write(message);
    } catch {
      connectedClients.delete(client);
    }
  });
}
app.get("/api/realtime-nudges", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });
  connectedClients.add(res);
  // greet only this client
  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      message: "Connected to real-time nudge stream",
    })}\n\n`
  );
  req.on("close", () => connectedClients.delete(res));
  req.on("end", () => connectedClients.delete(res));
});

// ------------------------
// Simple chat (kept as-is; unused by admin UI)
// ------------------------
let latestResponse: string | null = null;
// app.post("/api/chat", async (req, res) => {
//   try {
//     const { message } = req.body;
//     if (!message) return res.status(400).json({ error: "Message is required" });

//     const systemPrompt = `You are a helpful assistant for a customer service application.
//       Keep responses concise (1-2 sentences max) and professional.`;

//     const messages: Message[] = [
//       { role: "system", content: systemPrompt },
//       { role: "user", content: message },
//     ];

//     const completion = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages,
//       max_tokens: 100,
//       temperature: 0.7,
//     });

//     const reply =
//       completion.choices[0]?.message?.content?.trim() ||
//       "Sorry, I couldn't process that.";
//     latestResponse = reply;
//     res.json({ reply });
//   } catch (error) {
//     console.error("LLM API error:", error);
//     res.status(500).json({ error: "Failed to process request" });
//   }
// });

app.get("/api/latest-response", (_req, res) => {
  if (latestResponse) {
    const responseToSend = latestResponse;
    latestResponse = null;
    res.json({ reply: responseToSend });
  } else {
    res.json({ reply: null });
  }
});

// ------------------------
// Realtime token (WebRTC)
// ------------------------
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

// ------------------------
// Leads APIs (manual selection; no auto-pick)
// ------------------------
let selectedUserId: string | null = null;
type LeadScore = {
  score: number;
  tier: "A" | "B" | "C";
  reasons: string[];
  recommendedAngles: string[];
  updatedAt: number;
};
let currentLeadScore: LeadScore | null = null;

function getCurrentUserId() {
  return selectedUserId;
}

app.get("/api/users", async (_req, res) => {
  const users = await listLeads();
  res.json({ users });
});

app.post("/api/users/select", async (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required" });
  const u = await getLead(id);
  if (!u) return res.status(404).json({ error: "user not found" });
  selectedUserId = u.id;
  currentLeadScore = null;
  res.json({ ok: true, user: u });
});

app.get("/api/lead/current", async (_req, res) => {
  if (!selectedUserId) return res.json({ user: null, leadScore: null });
  const u = await getLead(selectedUserId);
  res.json({ user: u, leadScore: currentLeadScore });
});

// Lead scoring helper
async function computeLeadScore(
  user: LeadRow,
  recentTurns: { role: string; content: string }[]
) {
  const convo = recentTurns
    .slice(-12)
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n");
  const sys = `You are a B2C lead scoring assistant for home services.
Return STRICT JSON with: score (0-100), tier (A/B/C), reasons (3-5 bullets), recommendedAngles (2-4 bullets).
Signals: recency of service, plan, avg order value, dryer age, safety urgency, time pressure, pets/air quality, budget.`;
  const usr = `USER PROFILE:
${JSON.stringify(user, null, 2)}

RECENT CONVERSATION (last 12 turns):
${convo}

Return ONLY JSON: {"score": <0-100>, "tier": "A|B|C", "reasons": [...], "recommendedAngles": [...] }`;

  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 250,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr },
    ],
  });

  try {
    const txt = r.choices[0]?.message?.content?.trim() || "{}";
    const parsed = JSON.parse(txt);
    currentLeadScore = { ...parsed, updatedAt: Date.now() };
    sendSSEToAll({
      type: "leadscore",
      userId: user.id,
      score: parsed.score,
      tier: parsed.tier,
      reasons: parsed.reasons,
      recommendedAngles: parsed.recommendedAngles,
      timestamp: new Date().toISOString(),
    });
  } catch {
    currentLeadScore = {
      score: 40,
      tier: "C",
      reasons: [],
      recommendedAngles: [],
      updatedAt: Date.now(),
    };
  }
  return currentLeadScore!;
}

// ------------------------
// Nudge generation (standalone utility; unchanged behavior)
// ------------------------
// app.post("/api/nudges/generate", async (req, res) => {
//   try {
//     const { transcript } = req.body as {
//       transcript: Array<{ role: string; content: string }> | string[];
//     };
//     if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
//       return res.status(400).json({ nudges: [] });
//     }

//     const lines: string[] = (transcript as any[]).map((t) =>
//       typeof t === "string" ? t : `${t.role}: ${t.content}`
//     );
//     const windowText = lines.slice(-12).join("\n");

//     const system = `You are an expert sales coach for home services. Generate HIGH-QUALITY, CONTEXT-SPECIFIC nudges for a CSR handling dryer vent cleaning/inspection calls.

// OUTPUT FORMAT: JSON with up to 3 nudges (only suggest if highly relevant). Each nudge has: id, type, title, body, priority.

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
//       model: "gpt-4o-mini",
//       temperature: 0.3,
//       messages: [
//         { role: "system", content: system },
//         { role: "user", content: prompt },
//       ],
//       max_tokens: 400,
//     });

//     const text = completion.choices[0]?.message?.content?.trim() || "";
//     let parsed: { nudges?: Nudge[] } = {};
//     try {
//       parsed = JSON.parse(text);
//     } catch {
//       const start = text.indexOf("{");
//       const end = text.lastIndexOf("}");
//       if (start !== -1 && end !== -1 && end > start) {
//         parsed = JSON.parse(text.slice(start, end + 1));
//       }
//     }

//     const nudges = Array.isArray(parsed?.nudges)
//       ? parsed.nudges.slice(0, 3)
//       : [];
//     console.log(
//       `[Nudges] Generated ${nudges.length} high-quality nudges from transcript`
//     );
//     if (nudges.length > 0) {
//       console.log(
//         `[Nudges] Titles: ${nudges.map((n: any) => n.title).join(", ")}`
//       );
//     }
//     res.json({ nudges });
//   } catch (err) {
//     console.error("[Nudges] Generation error:", err);
//     res.status(200).json({ nudges: [] });
//   }
// });

// ------------------------
// In-memory stores for live nudge pipeline
// ------------------------
const transcriptTurns: Array<{ role: string; content: string }> = [];
let pendingNudges: ServerNudge[] = [];
let nudgeCounter = 0;
const recentlyShownNudges = new Map<string, number>(); // title -> timestamp

app.post("/api/transcript/append", async (req, res) => {
  try {
    const { role, content } = req.body as { role: string; content: string };
    if (!role || !content || typeof content !== "string") {
      return res.status(400).json({ ok: false });
    }
    transcriptTurns.push({ role, content });
    console.log(
      `[Transcript] Appended ${role}: "${content.substring(
        0,
        50
      )}..." | Total turns: ${transcriptTurns.length}`
    );

    // Generate nudges ONLY on finalized USER turns + cooldown
    if (role !== "user") return res.json({ ok: true });
    if (Date.now() - lastNudgeAt < NUDGE_COOLDOWN_MS)
      return res.json({ ok: true });
    lastNudgeAt = Date.now();

    // ===== Lead context & (re)score throttle =====
    const userId = selectedUserId;
    let leadCtx = "";
    if (userId) {
      const u = await getLead(userId);
      if (u) {
        const tooOld =
          !currentLeadScore || Date.now() - currentLeadScore.updatedAt > 15000;
        if (tooOld) {
          await computeLeadScore(u, transcriptTurns);
        }

        // Similar customers hint (pgvector neighbors)
        let similarHint = "none";
        try {
          const sim = await getSimilarLeads(u.id, 2);
          if (Array.isArray(sim) && sim.length) {
            similarHint = sim
              .map((s: any) => `${s.name} (${s.plan})`)
              .join(", ");
          }
        } catch {}

        if (currentLeadScore) {
          const ls = currentLeadScore;
          // NOTE: do NOT dump raw notes; feed compact profile signals and label as tie-breaks
          const profileSig = {
            city: u.city,
            plan: u.plan,
            avgOrderValue: u.avg_order_value,
            dryerAgeYears: u.dryer_age_years,
            hasPets: !!u.has_pets,
            lastServiceDate: u.last_service_date,
          };

          leadCtx = `

PROFILE (for tie-breaks only; conversation takes precedence):
- lead_score: ${ls.score} (${ls.tier})
- angles_to_prioritize: ${ls.recommendedAngles?.join("; ") || ""}
- profile_signals: ${JSON.stringify(profileSig)}
- similar_customers_hint: ${similarHint}
`;
        }

        // === Lead scoring strategy (drives offer size & incentive) ===

        if (currentLeadScore) {
          const ls = currentLeadScore; // { score, tier, recommendedAngles }
          const score = Number(ls.score) || 50;
          const tier = (ls.tier as "A" | "B" | "C") || "B";

          // Decide offer sizing & incentive policy from score
          // A: easy convert → lighter offer, minimal discount
          // B: medium → standard offer, small incentive
          // C: hard → aggressive bundle/discount
          let sizing: "light" | "standard" | "aggressive" = "standard";
          let incentive = "none";
          let notes = "";

          if (score >= 75) {
            sizing = "light";
            incentive = "none"; // maybe value-add instead of discount
            notes = "Emphasize convenience/priority; avoid heavy discounting.";
          } else if (score >= 50) {
            sizing = "standard";
            incentive = "small"; // $10–$20 off or small value-add
            notes = "Balanced offer; small incentive if needed to close.";
          } else {
            sizing = "aggressive";
            incentive = "strong"; // bundle + stronger savings
            notes = "Lead needs a stronger reason: bundle & clearer savings.";
          }

          offerStrategy = { tier, score, sizing, incentive, notes };

          leadPolicy = `
LEAD SCORING STRATEGY:
- lead_tag: "Lead ${tier} • ${score}"
- sizing: ${sizing}   (light|standard|aggressive)
- incentive: ${incentive}   (none|small|strong)
- guidance: ${notes}
- angles_to_prioritize: ${ls.recommendedAngles?.join("; ") || ""}
`;
        }
      }
    }

    // ===== Conversation & profile signals =====
    const last6Turns = transcriptTurns.slice(-6);
    const recentWindow = last6Turns
      .map((l) => `${l.role}: ${l.content}`)
      .join("\n");
    const latestUserTurn =
      [...last6Turns].reverse().find((t) => t.role === "user")?.content || "";
    const textBlob = last6Turns
      .map((t) => `${t.role}: ${t.content}`.toLowerCase())
      .join(" ");

    const convSig = {
      mentionsSmell: /smell|odor|odour|burnt/.test(textBlob),
      mentionsPets: /pet|dog|cat|dander/.test(textBlob),
      mentionsAllergy: /allergy|allergies|asthma|sneeze/.test(textBlob),
      urgency: /today|sooner|urgent|asap|now|immediately/.test(textBlob),
    };
    const profileSig = {
      hasPets: /"hasPets":\s*true/i.test(leadCtx),
      oldDryer: (() => {
        const m = /"dryerAgeYears":\s*(\d+)/.exec(leadCtx);
        return m ? parseInt(m[1], 10) >= 7 : false;
      })(),
      longSinceClean: (() => {
        const m = /"lastServiceDate":\s*"([0-9-]+)"/.exec(leadCtx);
        if (!m) return false;
        const d = new Date(m[1]);
        return (
          isFinite(d.valueOf()) &&
          Date.now() - d.getTime() > 1000 * 60 * 60 * 24 * 365 * 2
        );
      })(),
      highAOV: (() => {
        const m = /"avgOrderValue":\s*(\d+)/.exec(leadCtx);
        return m ? parseInt(m[1], 10) >= 120 : false;
      })(),
      leadTierA: /lead_score:\s*(\d+)\s*\(A\)/.test(leadCtx),
    };

    // ===== Avoid lists =====
    const recentTitles = Array.from(recentlyShownNudges.keys()).slice(-20);
    const pendingTitles = pendingNudges.map((n) => n.title);
    const allRecentTitles = [...new Set([...recentTitles, ...pendingTitles])];
    const recentBodies = pendingNudges.map((n) => n.body);

    // ===== Catalog text =====
    const catalogArray: any[] =
      typeof (globalThis as any).serviceCatalog !== "undefined"
        ? (globalThis as any).serviceCatalog
        : typeof (serviceCatalog as any) !== "undefined"
        ? (serviceCatalog as any)
        : serviceCatalogDefault;

    const catalogText = Array.isArray(catalogArray)
      ? catalogArray
          .map((s: any) => `- ${s.name} ($${s.price}): ${s.value}`)
          .join("\n")
      : serviceCatalogDefault
          .map((s: any) => `- ${s.name} ($${s.price}): ${s.value}`)
          .join("\n");

    // ===== System prompt: prefer upsell/cross-sell; conversation > profile =====
    const system = `You are an expert sales coach for home services.
Output a SINGLE JSON object: {"nudges":[ ...0–2 items... ]}. No code fences.

DECISION HIERARCHY (must follow):
1) Latest USER turn (most important)
2) Recent conversation (next)
3) Profile/lead context (tie-breaks only)

CATALOG (eligible offers you may recommend):
${catalogText}

${leadPolicy || ""}

NUDGE TYPES:
- next_step = a specific question/check/confirmation grounded in the LATEST USER turn to advance the call
- upsell = enhance current service (inspection, bundle, plan)
- cross_sell = complementary (HVAC duct cleaning)
- tip = only if conversation lacks enough detail for next_step or offers (avoid tips when a concrete next_step or offer is possible)

PRIORITY:
- Prefer outputting (1) one "next_step" and (2) one of ("upsell" or "cross_sell") when justified by conversation.
- If conversation doesn't justify offers, you may return only a "next_step".
- Max 2 nudges total.

LEAD-SCORE BEHAVIOR (MANDATORY for upsell/cross_sell):
- Use the strategy in LEAD SCORING STRATEGY:
  - sizing = light|standard|aggressive controls how big the offer is.
  - incentive = none|small|strong controls discount/value-add intensity.
- Mention the lead tag in title or body, e.g., "Lead A • 82".
- Align the offer & incentive with sizing (light → no/low discount; aggressive → stronger savings/bundle).
- If Tier A/high score: avoid heavy discounting; emphasize convenience/priority.
- If Tier C/low score: make a clearer, stronger value case (bundle or bigger saving).

STRICT RULES:
- At most 2 nudges; it's OK to return {"nudges": []}.
- A nudge MUST be grounded in the LATEST USER turn or recent conversation — do NOT emit nudges solely from profile.
- Title ≤40 chars; body ≤140 chars.
- Each nudge must include: id, type ("next_step" | "upsell" | "cross_sell" | "tip"), title, body, priority (1..3), key (snake_case), source ("conversation" | "profile+conversation"), sizing ("light"|"standard"|"aggressive"), incentive ("none"|"small"|"strong"), lead_tag (e.g., "Lead A • 82").
- Avoid repeating concepts in the DO_NOT_REPEAT lists.
- Output must be a single JSON object.`;

    // ===== User prompt =====
    const avoidList =
      allRecentTitles.length || recentBodies.length
        ? `

DO_NOT_REPEAT_TITLES:
${allRecentTitles.map((t) => `- "${t}"`).join("\n")}

DO_NOT_REPEAT_BODIES:
${recentBodies.map((b) => `- "${b}"`).join("\n")}
`
        : "";

    const prompt = `LATEST_USER_TURN:
"${latestUserTurn}"

RECENT_CONVERSATION (last 6 turns):
${recentWindow}

${avoidList}
${leadCtx}

CONVERSATION_SIGNALS:
${JSON.stringify(convSig)}

PROFILE_SIGNALS (tie-breaks only):
${JSON.stringify(profileSig)}

${leadPolicy}

INSTRUCTIONS:
- Choose 0–2 nudges.
- Prefer one "next_step" and one of ("upsell" or "cross_sell") when conversation allows.
- If insufficient conversation grounds, return {"nudges":[]}.
- Prefer upsell > cross_sell > tip when signals allow.

Return ONLY JSON: {"nudges":[...]}.
`;

    // ===== OpenAI call =====
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      max_tokens: 260,
    });

    // ===== Parse & filter =====
    const text = completion.choices[0]?.message?.content?.trim() || "";
    const parsed = safeJsonParse(text);

    if (!parsed || !Array.isArray(parsed.nudges)) {
      console.error("[Nudges] Parse fail. Raw:", text.slice(0, 200));
      return res.json({ ok: true });
    }

    // Enforce grounding: must reference conversation (not profile-only)
    const convoLower = (recentWindow + " " + latestUserTurn).toLowerCase();
    const filtered: any[] = parsed.nudges
      .slice(0, 2) // keep at most 2
      .filter((n) => {
        const src = (n?.source || "").toLowerCase();
        if (src === "profile") return false; // reject purely profile-grounded
        const body = (n?.body || "").toLowerCase();
        const title = (n?.title || "").toLowerCase();
        const overlaps =
          body
            .split(/\W+/)
            .some((w) => w.length > 3 && convoLower.includes(w)) ||
          title
            .split(/\W+/)
            .some((w) => w.length > 3 && convoLower.includes(w));
        return overlaps;
      });

    if (!filtered.length) return res.json({ ok: true });

    const now = Date.now();
    // expire recentlyShown (60s)
    for (const [k, ts] of recentlyShownNudges.entries()) {
      if (now - ts > 60000) recentlyShownNudges.delete(k);
    }

    const seenTitles = new Set(pendingNudges.map((n) => n.title));
    const seenBodies = new Set(pendingNudges.map((n) => n.body));

    const wrapped: ServerNudge[] = filtered
      .filter((n) => {
        if (!n?.title || !n?.body) return false;
        const key = (n as any).key?.toString();
        if (key && recentlyShownNudges.has(key)) return false; // concept de-dup
        if (seenTitles.has(n.title)) return false;
        if (seenBodies.has(n.body)) return false;
        return true;
      })
      .map((n) => ({
        ...n,
        sid: `${Date.now()}-${++nudgeCounter}`,
        createdAt: now,
      }));

    if (!wrapped.length) return res.json({ ok: true });

    pendingNudges.push(...wrapped);
    // cap queue
    if (pendingNudges.length > MAX_PENDING) {
      pendingNudges = pendingNudges.slice(-MAX_PENDING);
    }

    console.log(
      `[Nudges] Added ${wrapped.length} new nudges to pending queue | Total pending: ${pendingNudges.length}`
    );

    // SSE push
    wrapped.forEach((nudge) => {
      sendSSEToAll({
        type: "nudge",
        nudge: nudge.body,
        title: nudge.title,
        priority: nudge.priority,
        timestamp: new Date().toISOString(),
      });
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("[Transcript] Append error:", e);
    res.json({ ok: true });
  }
});

// ------------------------
// Nudges latest + ack
// ------------------------
app.get("/api/nudges/latest", (_req, res) => {
  const toSend = pendingNudges.slice(0, 16);
  if (toSend.length > 0) {
    console.log(`[Nudges] Serving ${toSend.length} pending nudges to client`);
  }
  res.json({ nudges: toSend });
});
app.post("/api/nudges/ack", (req, res) => {
  try {
    const { sids } = req.body as { sids: string[] };
    if (!Array.isArray(sids) || !sids.length) return res.json({ ok: true });
    const set = new Set(sids);
    const beforeCount = pendingNudges.length;
    const now = Date.now();

    const ackedNudges = pendingNudges.filter((n) => set.has(n.sid));
    ackedNudges.forEach((n) => {
      recentlyShownNudges.set(n.title, now);
      // store key if present
      // @ts-ignore
      if ((n as any).key) recentlyShownNudges.set((n as any).key, now);
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

// ------------------------
// Start server
// ------------------------
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Admin interface: http://localhost:${port}/admin`);
});
