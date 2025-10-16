# Nudge System Architecture & Flow

## Overview
The nudge system provides real-time, context-aware suggestions to customer service representatives during live calls. Nudges are automatically generated based on the conversation transcript and displayed persistently in the UI.

## Architecture

### Backend (server.ts)
- **Express Server** running on port 3001
- **OpenAI GPT-3.5-turbo** for nudge generation
- **In-memory storage** for transcript turns and pending nudges

### Frontend (React + TypeScript)
- **CallContext** - Manages call state and transcript
- **NudgesTray** - Displays and manages nudge lifecycle
- **NudgeCard** - Individual nudge UI component

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     NUDGE GENERATION FLOW                    │
└─────────────────────────────────────────────────────────────┘

1. TRANSCRIPT CAPTURE
   ┌──────────────┐
   │ Admin Page   │ (Browser Speech Recognition)
   │ /admin       │──────────┐
   └──────────────┘          │
                             ▼
   ┌──────────────┐    POST /api/transcript/append
   │ CallContext  │    { role, content }
   └──────────────┘──────────┐
                             │
                             ▼
   ┌─────────────────────────────────────┐
   │ Server: transcriptTurns[]           │
   │ - Stores all conversation turns      │
   │ - Keeps unlimited history            │
   └─────────────────────────────────────┘

2. AUTOMATIC NUDGE GENERATION (Server-Side)
   
   On each transcript append:
   ┌─────────────────────────────────────┐
   │ Take last 12 turns from transcript  │
   └────────────┬────────────────────────┘
                │
                ▼
   ┌─────────────────────────────────────┐
   │ GPT-3.5-turbo                       │
   │ - Temperature: 0.2                  │
   │ - Max tokens: 300                   │
   │ - Prompt: Sales coach for dryer vent│
   │ - Output: JSON with up to 4 nudges  │
   └────────────┬────────────────────────┘
                │
                ▼
   ┌─────────────────────────────────────┐
   │ Generated Nudges                    │
   │ {                                   │
   │   id: string,                       │
   │   type: 'upsell'|'cross_sell'|'tip',│
   │   title: string (≤40 chars),        │
   │   body: string (≤140 chars),        │
   │   priority: 1|2|3                   │
   │ }                                   │
   └────────────┬────────────────────────┘
                │
                ▼
   ┌─────────────────────────────────────┐
   │ pendingNudges[] (Server Memory)     │
   │ - Add unique 'sid' to each nudge    │
   │ - De-duplicate by title             │
   │ - Unlimited queue size              │
   └─────────────────────────────────────┘

3. FRONTEND POLLING & DISPLAY

   Every 600ms:
   ┌──────────────┐
   │ NudgesTray   │
   └──────┬───────┘
          │
          ▼
   GET /api/nudges/latest
          │
          ▼
   ┌─────────────────────────────────────┐
   │ Returns up to 16 pending nudges     │
   └────────────┬────────────────────────┘
                │
                ▼
   ┌─────────────────────────────────────┐
   │ NudgesTray State Management         │
   │ - Add to local cards[] array        │
   │ - De-duplicate by title             │
   │ - Assign expiry times:              │
   │   * expiresAt: now + 15000ms        │
   │   * dismissAt: now + 14000ms        │
   │ - Keep last 30 nudges in backlog    │
   └────────────┬────────────────────────┘
                │
                ▼
   ┌─────────────────────────────────────┐
   │ Display Logic                       │
   │ - Show newest 5 nudges              │
   │ - Fade animation at 14s             │
   │ - Auto-remove at 15s                │
   └─────────────────────────────────────┘

4. ACKNOWLEDGMENT & CLEANUP

   When nudges are displayed:
   ┌──────────────┐
   │ NudgesTray   │
   └──────┬───────┘
          │
          ▼
   POST /api/nudges/ack
   { sids: ["sid1", "sid2", ...] }
          │
          ▼
   ┌─────────────────────────────────────┐
   │ Server: Remove ACKed nudges         │
   │ - Filter out by sid                 │
   │ - Prevents re-display               │
   └─────────────────────────────────────┘
```

## Key Components

### 1. Server Endpoints

#### `POST /api/transcript/append`
- Accepts: `{ role: 'user'|'assistant', content: string }`
- Actions:
  - Stores turn in `transcriptTurns[]`
  - Triggers automatic nudge generation
  - Uses last 12 turns as context
- Logs: `[Transcript] Appended {role}: "{content}" | Total turns: {count}`

#### `POST /api/nudges/generate`
- Accepts: `{ transcript: Array<{role, content}> }`
- Actions:
  - Direct nudge generation endpoint
  - Used by CallContext for immediate generation
  - Returns up to 4 nudges
- Logs: `[Nudges] Generated {count} nudges from transcript`

#### `GET /api/nudges/latest`
- Returns: `{ nudges: ServerNudge[] }` (up to 16)
- Actions:
  - Serves pending nudges without removing them
  - Client polls this every 600ms
- Logs: `[Nudges] Serving {count} pending nudges to client`

#### `POST /api/nudges/ack`
- Accepts: `{ sids: string[] }`
- Actions:
  - Removes acknowledged nudges from queue
  - Prevents duplicate display
- Logs: `[Nudges] ACKed {count} nudges | Remaining: {count}`

### 2. Frontend Components

#### `NudgesTray` Component
**Location:** `src/components/NudgesTray.tsx`

**State Management:**
- `cards[]` - Array of TimedNudge objects with expiry times
- Polls backend every 600ms
- Auto-sweeps expired nudges every 400ms

**Display Configuration:**
- **Display Time:** 15 seconds (increased from 5s)
- **Fade Start:** 14 seconds
- **Visible Count:** 5 nudges (increased from 3)
- **Backlog Size:** 30 nudges (increased from 15)
- **Position:** Fixed bottom-right corner
- **Z-index:** 60

**Deduplication:**
- By title (case-insensitive)
- Across both polling and CallContext sources
- **Time-based cooldown:** Nudges with same title can re-appear after 60 seconds
- Recently shown nudges tracked in `recentlyShownNudges` Map on server

#### `NudgeCard` Component
**Location:** `src/components/Nudge.tsx`

**Visual Design:**
- Width: 288px (w-72)
- Color-coded by type:
  - **Upsell:** Primary color with 10% opacity background
  - **Cross-sell:** Accent color with 10% opacity background
  - **Tip:** Secondary color background
- Close button for manual dismissal
- ARIA live region for accessibility

#### `CallContext`
**Location:** `src/contexts/CallContext.tsx`

**Responsibilities:**
- Manages WebRTC call lifecycle
- Maintains transcript state
- Calls `/api/nudges/generate` on:
  - Call start (with seed message)
  - Each user utterance
- Provides nudges to NudgesTray via context

## Configuration Summary

### Timing
| Parameter | Value | Previous | Location |
|-----------|-------|----------|----------|
| Nudge Lifespan | 15s | 5s | NudgesTray.tsx:35 |
| Fade Start | 14s | 4.5s | NudgesTray.tsx:36 |
| Poll Interval | 600ms | 600ms | NudgesTray.tsx:66 |
| Sweep Interval | 400ms | 400ms | NudgesTray.tsx:77 |

### Capacity
| Parameter | Value | Previous | Location |
|-----------|-------|----------|----------|
| Visible Nudges | 5 | 3 | NudgesTray.tsx:85 |
| Backlog Size | 30 | 15 | NudgesTray.tsx:40 |
| Server Response | 16 | 16 | server.ts:391 |
| Generated Per Turn | 4 | 4 | server.ts:325 |

## Logging & Debugging

All server-side logs use prefixes for easy filtering:

```bash
# View all nudge-related logs
npm run dev | grep "\[Nudges\]"

# View transcript logs
npm run dev | grep "\[Transcript\]"

# View both
npm run dev | grep -E "\[Nudges\]|\[Transcript\]"
```

**Log Examples:**
```
[Transcript] Appended assistant: "Hi, I am looking for dryer vent cleaning and ..." | Total turns: 1
[Nudges] Generated 4 nudges from transcript
[Nudges] Added 4 new nudges to pending queue | Total pending: 4
[Nudges] Serving 4 pending nudges to client
[Nudges] ACKed 4 nudges | Remaining: 0
```

## Testing Instructions

### 1. Start the Backend Server
```bash
cd /Users/krishsharma/Downloads/Call_Scripting_Agent-main
npm run dev
# Server will start on http://localhost:3001
```

### 2. Start the Frontend
```bash
npm run dev
# Frontend will start on http://localhost:5173
```

### 3. Access Admin Interface
Navigate to: `http://localhost:3001/admin`

### 4. Start a Call
1. Click "Start Call" button
2. Allow microphone access
3. Speak naturally with the AI agent
4. Monitor the console for logs

### 5. Verify Nudges
✅ **Check that:**
- Nudges appear in bottom-right corner within 1-2 seconds
- Up to 5 nudges can be visible simultaneously
- Each nudge persists for 15 seconds
- Nudges fade out smoothly 1 second before disappearing
- New nudges push older ones up
- No duplicate nudges appear
- Server console shows generation/ACK logs

### 6. Test Edge Cases
- Start/stop call multiple times
- Navigate between pages (nudges should persist globally)
- Manually close nudges with X button
- Long conversation (verify backlog maintains last 30)

## Troubleshooting

### Issue: No Nudges Appearing
**Check:**
1. Backend server running on port 3001
2. Browser console for errors
3. Network tab for API calls
4. Server console for generation logs

### Issue: Duplicate Nudges
**Fixed:** Removed duplicate NudgesTray from ServicePageTabs.tsx
**Verify:** Only one NudgesTray in App.tsx

### Issue: Nudges Disappear Too Quickly
**Fixed:** Increased from 5s to 15s display time
**Location:** NudgesTray.tsx lines 35-36

### Issue: Can't See All Nudges
**Fixed:** Increased visible count from 3 to 5
**Location:** NudgesTray.tsx line 85

### Issue: Nudges Only Appear at Call Start
**Fixed:** Multiple improvements to capture conversation during call:
1. Enhanced data channel event handlers to capture all OpenAI Realtime event types
2. Improved Speech Recognition with error handling and auto-restart
3. Time-based deduplication (60s cooldown) instead of permanent blocking
**Location:** server.ts lines 91-236, 361-477

**Verification:**
- Admin page at `/admin` now shows real-time status indicators
- Watch for 👤 (user) and 🤖 (assistant) in logs
- "Transcript: X turns" counter increases during conversation
- "Nudges: X pending" shows queue size

## Future Enhancements (Potential)

1. **Persistence Across Sessions**
   - Store nudges in localStorage
   - Restore on page refresh

2. **User Preferences**
   - Adjustable display time
   - Nudge type filtering
   - Position customization

3. **Analytics**
   - Track nudge click-through rates
   - Measure effectiveness by type
   - A/B test different prompts

4. **Advanced Deduplication**
   - Semantic similarity detection
   - Time-window based deduplication

5. **Priority-Based Display**
   - Show high-priority nudges longer
   - Visual indicators for priority levels

## Recent Updates (October 16, 2025)

### Update 1: Display & Performance Improvements
- Increased nudge display time from 5s to 15s
- Increased visible nudges from 3 to 5
- Increased backlog from 15 to 30
- Removed duplicate NudgesTray component

### Update 2: Real-Time Generation Fix ✅
**Problem:** Nudges only appeared at call start, not during ongoing conversation.

### Update 3: High-Quality Nudge Generation ✅
**Problem:** Nudges were generic, repetitive, and lacked specific value propositions.

**Solution:**
1. **Enhanced Event Capture:**
   - Added handlers for `response.audio_transcript.delta`, `response.text.delta`, `response.done`
   - Added handlers for `conversation.item.created`, `conversation.item.completed`
   - Comprehensive logging of all events

2. **Improved Speech Recognition:**
   - Error handling with descriptive messages
   - Auto-restart on STT end
   - Empty string filtering

3. **Time-Based Deduplication:**
   - Nudges can re-appear after 60 seconds
   - `recentlyShownNudges` Map tracks shown nudge titles with timestamps
   - Auto-cleanup of old entries

4. **Real-Time Status Dashboard:**
   - **STT Status:** Shows if speech recognition is active
   - **Transcript Counter:** Shows total conversation turns captured
   - **Nudges Counter:** Shows current pending nudges in queue
   - Updates every 2 seconds

**Solution for Update 3:**
1. **Quality Framework:**
   - Complete prompt rewrite with GOOD vs BAD examples
   - Each nudge type has specific quality requirements
   - Must include specific $ amounts, %, or timeframes
   - Focus on customer value (safety, savings, convenience)

2. **Active Repetition Prevention:**
   - AI receives list of recently shown nudge titles
   - Explicit instruction: "AVOID THESE... generate NEW suggestions"
   - Tracks last 20 shown + pending queue

3. **Quality Over Quantity:**
   - Reduced from 4 to 3 maximum nudges
   - AI can return 0-1 if conversation doesn't warrant quality suggestions
   - Prevents forcing generic nudges

4. **Model Upgrade:**
   - Changed from gpt-3.5-turbo to **gpt-4o-mini**
   - Increased temperature to 0.3 for variety
   - Increased max_tokens to 400 for detailed responses

**Example Quality Comparison:**
| Before (Generic) | After (Specific & Valuable) |
|------------------|----------------------------|
| "Add more services" | "Safety Inspection Bundle ($45) → Identifies fire hazards & improves efficiency by 30%." |
| "Offer upgrade" | "HVAC Duct Cleaning → Share ductwork. Bundle saves $50 & improves air quality." |
| "Ask about needs" | "Ask: 'When last cleaned?' → Reveals urgency. 3+ years = high fire risk angle." |

**Verification Steps:**
```bash
# 1. Start the server
npm run server

# 2. Open admin page
open http://localhost:3001/admin

# 3. Start a call and watch for:
# - Green "STT: Active" indicator
# - Increasing "Transcript: X turns" counter
# - Increasing "Nudges: X pending" counter
# - 👤 and 🤖 emojis in the log

# 4. In server console, watch for QUALITY indicators:
[Nudges] Generated 3 high-quality nudges from transcript
[Nudges] Titles: Safety Inspection Bundle, HVAC Cleaning, Ask About Last Service
[Nudges] Added 2 new nudges to pending queue | Total pending: 2

# 5. Verify nudge quality:
# - Each has specific $ amount or percentage
# - Clear actionable benefit
# - No generic "offer services" suggestions
# - Variety across conversation (no repeats)
```

---

**Last Updated:** October 16, 2025 (Update 2)
**Maintained By:** Development Team

