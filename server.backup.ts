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
app.use(express.static('public'));

// Initialize TWO OpenAI clients
const nudgeGenerator = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY, // For generating nudges
});

const textGenerator = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY, // For generating text (separate service)
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Store latest response for frontend polling
let latestResponse: string | null = null;

// Store connected SSE clients for real-time updates
let connectedClients: Set<any> = new Set();

// Helper function to send SSE to all connected clients
function sendSSEToAll(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  connectedClients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      // Remove disconnected clients
      connectedClients.delete(client);
    }
  });
}

// Text Generation Endpoint - Generates realistic customer-agent conversations using AI
app.post('/api/generate-text', async (req, res) => {
  try {
    // Generate a dynamic conversation scenario based on dryer vent service workflow
    const conversationPrompt = `Generate a realistic customer service conversation for a dryer vent cleaning service. Follow this structure:

1. Customer contacts with a problem (dryer not working, strange noises, etc.)
2. Agent gathers information (previous usage, lead source, contact verification)
3. Agent identifies service needs and provides options
4. Customer asks about pricing and service details
5. Agent provides quote and explains value proposition
6. Customer schedules appointment or asks follow-up questions

Format the conversation with <Caller> tags for customer and <Agent> tags for service agent.

Make it natural, conversational, and specific to dryer vent services. Include realistic details about pricing, services, and scheduling.

Generate a complete conversation with 6-8 dialogue turns.`;

    const completion = await textGenerator.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: 'system',
          content: 'You generate realistic customer service conversations for dryer vent cleaning services. Create natural dialogue between customers and agents, following typical service industry patterns. Include specific details about services, pricing with quotes, and scheduling appointments.'
        },
        { role: 'user', content: conversationPrompt }
      ],
      max_tokens: CONFIG.MAX_TOKENS_TEXT,
      temperature: CONFIG.TEMPERATURE_TEXT,
    });

    const generatedConversation = completion.choices[0]?.message?.content?.trim();

    if (generatedConversation) {
      console.log('📝 Generated conversation:', generatedConversation.substring(0, 100) + '...');
      res.json({ conversation: generatedConversation });
    } else {
      res.status(500).json({ error: 'No conversation generated' });
    }
  } catch (error) {
    console.error('❌ Text generation error:', error);
    res.status(500).json({ error: 'Failed to generate conversation' });
  }
});

// Nudge Generation Endpoint - Converts conversation text into actionable nudges
app.post('/api/generate-nudge', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Enhanced prompt that understands conversation format and extracts actionable insights
    const nudgePrompt = `Analyze this customer service conversation and extract key actionable insights for customer service agents. Focus on service details, upselling and cross-selling opportunities demonstrated:

"${text}"

Please provide a concise, actionable nudge that captures the most important lesson or technique from this conversation. Format it as a brief reminder or tip that an agent could use in similar situations.`;

    const completion = await nudgeGenerator.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: 'system',
          content: `Your role is to help customer service agents improve their sales efficiency by providing nudges to improve the chance of upselling and cross-selling opportunities. 
                    The nudge must be crisp and to the point, maybe about 2 lines, with only any upselling and cross selling opportunities and also any service details if the agent missed it.
                    DO NOT GIVE ADVICE TO THE AGENT, just provide the nudge with any numerical figures about the service or any service details if the agent missed it.
                    For upselling ipportunities make up the details about other services.
                    For cross selling opportunities, do it after the customer books the appointment, make up the details about other brands and their relevant services, and the benefits of using them, also any promotions or discounts. The other brands are also house maintenance services.`
        },
        { role: 'user', content: nudgePrompt }
      ],
      max_tokens: CONFIG.MAX_TOKENS_NUDGE,
      temperature: CONFIG.TEMPERATURE_NUDGE,
    });

    const nudge = completion.choices[0]?.message?.content?.trim();

    if (nudge) {
      console.log('💬 Generated nudge from conversation:', nudge);
      res.json({ nudge });
    } else {
      res.status(500).json({ error: 'No nudge generated' });
    }
  } catch (error) {
    console.error('❌ Nudge generation error:', error);
    res.status(500).json({ error: 'Failed to generate nudge' });
  }
});

// Real-time SSE endpoint for live nudge updates
app.get('/api/realtime-nudges', (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Add client to connected clients
  connectedClients.add(res);

  // Send initial connection confirmation
  sendSSEToAll({ type: 'connected', message: 'Connected to real-time nudge stream' });

  // Handle client disconnect
  req.on('close', () => {
    connectedClients.delete(res);
  });

  req.on('end', () => {
    connectedClients.delete(res);
  });
});

// Background text generation service
let isGenerating = false;
let generationInterval: NodeJS.Timeout | null = null;

// Configuration for the background service
const CONFIG = {
  GENERATION_INTERVAL: 60000, // 60 seconds (increased for longer pauses between turns)
  CONVERSATION_TURN_DELAY: 3000, // Base delay between turns (2-4 seconds with randomization)
  MAX_TOKENS_TEXT: 60,
  MAX_TOKENS_NUDGE: 80,
  TEMPERATURE_TEXT: 0.7,
  TEMPERATURE_NUDGE: 0.7,
};

async function startTextGeneration() {
  if (isGenerating) return;

  isGenerating = true;
  console.log('🚀 Starting real-time conversation simulation...');

  const simulateLiveConversation = async () => {
    try {
      console.log('📞 Starting new live conversation simulation...');

      // Initial customer problem
      const initialCustomerPrompt = `Generate a realistic opening line from a customer calling about a dryer vent issue. Make it natural and conversational. Examples: "Hi, my dryer isn't working properly and I think it might be the vent", "I've been having problems with my dryer taking forever to dry clothes", "I noticed a burning smell when using my dryer and I'm concerned about the vent". Keep it to 1-2 sentences.`;

      const customerCompletion = await textGenerator.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: 'system',
            content: 'You generate realistic customer dialogue for dryer vent service calls. Create natural, conversational opening statements from customers experiencing dryer problems.'
          },
          { role: 'user', content: initialCustomerPrompt }
        ],
        max_tokens: 40,
        temperature: 0.8,
      });

      const customerOpening = customerCompletion.choices[0]?.message?.content?.trim();
      if (!customerOpening) {
        console.error('❌ No customer opening generated');
        return;
      }

      console.log('👤 Customer:', customerOpening);
      let conversationHistory = `<Caller> ${customerOpening}`;

      // Generate conversation turn by turn
      for (let turn = 1; turn <= 6; turn++) {
        console.log(`🎭 Turn ${turn}/6: Generating agent response...`);

        // Generate agent response based on conversation so far
        const agentPrompt = `This is a dryer vent service call. The conversation so far is:

        ${conversationHistory}

        <Agent>`;

        const agentCompletion = await textGenerator.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: 'system',
              content: 'You are a helpful customer service agent for dryer vent cleaning services. Respond naturally to the customer based on the conversation history. Be professional, empathetic, and focus on gathering information or providing solutions. Keep responses conversational and realistic for a phone call.'
            },
            { role: 'user', content: agentPrompt }
          ],
          max_tokens: 60,
          temperature: 0.7,
        });

        const agentResponse = agentCompletion.choices[0]?.message?.content?.trim();
        if (!agentResponse) {
          console.error(`❌ No agent response generated for turn ${turn}`);
          break;
        }

        conversationHistory += ` ${agentResponse}`;
        console.log('🤖 Agent:', agentResponse);

        // Generate nudge from current conversation
        if (turn > 1) { // Skip nudge for first turn (just customer opening)
          console.log(`💭 Generating nudge after turn ${turn}...`);
          try {
            const nudgeResponse = await fetch('http://localhost:3001/api/generate-nudge', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text: conversationHistory }),
            });

            if (nudgeResponse.ok) {
              const nudgeData = await nudgeResponse.json();
              const nudge = nudgeData.nudge;

              if (nudge) {
                console.log(`💬 Nudge ${turn}:`, nudge);
                latestResponse = nudge; // Store for frontend polling
                // Send real-time update to all connected clients
                sendSSEToAll({
                  type: 'nudge',
                  nudge: nudge,
                  timestamp: new Date().toISOString()
                });
              }
            }
          } catch (error) {
            console.error('❌ Error generating nudge:', error);
          }
        }

        // Shorter pause before customer speaks (2-4 seconds)
        const pauseDuration = 2000 + Math.random() * 2000; // 2-4 seconds
        console.log(`⏱️  Pausing for ${Math.round(pauseDuration/1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, pauseDuration));

        // Generate next customer response (if not last turn)
        if (turn < 6) {
          console.log(`🎭 Turn ${turn + 1}/6: Generating customer response...`);

          const customerPrompt = `Continue this dryer vent service conversation. The conversation so far is:

          ${conversationHistory}

          Respond as the customer. Be natural and conversational. You might ask questions, express concerns, or move toward scheduling. Keep it realistic for a phone call.

          <Caller>`;

          const customerCompletion = await textGenerator.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: 'system',
                content: 'You are a customer calling about dryer vent issues. Respond naturally based on the agent\'s previous response. Ask relevant questions, express realistic concerns, or move toward resolution. Keep responses conversational and authentic.'
              },
              { role: 'user', content: customerPrompt }
            ],
            max_tokens: 50,
            temperature: 0.8,
          });

          const customerResponse = customerCompletion.choices[0]?.message?.content?.trim();
          if (!customerResponse) {
            console.error(`❌ No customer response generated for turn ${turn + 1}`);
            break;
          }

          conversationHistory += ` ${customerResponse}`;
          console.log('👤 Customer:', customerResponse);

          // Generate nudge after customer response
          console.log(`💭 Generating nudge after customer response ${turn + 1}...`);
          try {
            const nudgeResponse = await fetch('http://localhost:3001/api/generate-nudge', {
              method: 'POST',
               headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text: conversationHistory }),
            });

            if (nudgeResponse.ok) {
              const nudgeData = await nudgeResponse.json();
              const nudge = nudgeData.nudge;

              if (nudge) {
                console.log(`💬 Nudge ${turn + 1}:`, nudge);
                latestResponse = nudge; // Store for frontend polling
                // Send real-time update to all connected clients
                sendSSEToAll({
                  type: 'nudge',
                  nudge: nudge,
                  timestamp: new Date().toISOString()
                });
              }
            }
          } catch (error) {
            console.error('❌ Error generating nudge:', error);
          }

          // Another pause before next agent turn (4-8 seconds)
          const nextPauseDuration = 4000 + Math.random() * 4000;
          console.log(`⏱️  Pausing for ${Math.round(nextPauseDuration/1000)} seconds before next turn...`);
          await new Promise(resolve => setTimeout(resolve, nextPauseDuration));
        }
      }

      console.log('✅ Live conversation simulation complete!');
      console.log('📞 Final conversation:', conversationHistory);

    } catch (error) {
      console.error('❌ Error in live conversation simulation:', error);
    }
  };

  // Run simulation immediately, then every 60 seconds
  await simulateLiveConversation();
  generationInterval = setInterval(simulateLiveConversation, CONFIG.GENERATION_INTERVAL);

  console.log('✅ Live conversation simulation started - generating turn-by-turn conversations every 60 seconds');
}

// Control endpoints for the background service
app.post('/api/start-generation', (req, res) => {
  startTextGeneration();
  res.json({ status: 'started' });
});

app.post('/api/stop-generation', (req, res) => {
  if (generationInterval) {
    clearInterval(generationInterval);
    generationInterval = null;
  }
  isGenerating = false;
  latestResponse = null; // Clear any remaining responses
  res.json({ status: 'stopped' });
});

app.get('/api/generation-status', (req, res) => {
  res.json({
    isGenerating,
    interval: generationInterval ? CONFIG.GENERATION_INTERVAL : null,
    config: CONFIG
  });
});

// Update configuration endpoint
app.post('/api/update-config', (req, res) => {
  const { generationInterval: newInterval, maxTokensText, maxTokensNudge, temperatureText, temperatureNudge } = req.body;

  if (newInterval && newInterval > 5000) { // Minimum 5 seconds
    CONFIG.GENERATION_INTERVAL = newInterval;
  }
  if (maxTokensText && maxTokensText > 0) {
    CONFIG.MAX_TOKENS_TEXT = maxTokensText;
  }
  if (maxTokensNudge && maxTokensNudge > 0) {
    CONFIG.MAX_TOKENS_NUDGE = maxTokensNudge;
  }
  if (temperatureText && temperatureText >= 0 && temperatureText <= 2) {
    CONFIG.TEMPERATURE_TEXT = temperatureText;
  }
  if (temperatureNudge && temperatureNudge >= 0 && temperatureNudge <= 2) {
    CONFIG.TEMPERATURE_NUDGE = temperatureNudge;
  }

  // Restart generation with new config if running
  if (isGenerating && newInterval) {
    if (generationInterval) {
      clearInterval(generationInterval);
    }
    // Restart with new interval
    setTimeout(() => {
      if (isGenerating) {
        generationInterval = setInterval(() => {
          // This will need to be implemented with the generate function
        }, CONFIG.GENERATION_INTERVAL);
      }
    }, 1000);
  }

  res.json({ status: 'updated', config: CONFIG });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Starting background nudge generation service...`);

  // Start the background service after a short delay
  setTimeout(() => {
    startTextGeneration();
  }, 2000);
});
