const express = require('express');
const Groq = require('groq-sdk');
const app = express();
app.use(express.json());

app.post('/chat', async (req, res) => {
  if (req.headers['x-proxy-secret'] !== process.env.PROXY_SECRET)
    return res.status(403).json({ error: 'Forbidden' });

  const { messages, tools } = req.body;
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const params = {
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages,
    };
    if (tools?.length) params.tools = tools;

    const response = await groq.chat.completions.create(params);
    const msg = response.choices[0].message;

    if (msg.tool_calls?.length) {
      res.json({ toolCalls: msg.tool_calls, assistantMessage: msg });
    } else {
      res.json({ reply: msg.content });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Proxy running'));
