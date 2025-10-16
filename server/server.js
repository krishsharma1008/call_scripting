import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for a customer service application. Provide concise and helpful responses."
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request.";
    
    res.status(200).json({ reply });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ error: 'Error processing your request' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
