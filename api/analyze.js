const Anthropic = require('@anthropic-ai/sdk');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { return res.status(200).end(); }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }
  const { image, mimeType } = req.body;
  if (!image) { return res.status(400).json({ error: 'Missing image data' }); }
  if (!process.env.ANTHROPIC_API_KEY) { return res.status(500).json({ error: 'API key not configured' }); }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: image } },
          { type: 'text', text: 'Analyze clothing in this image. Respond with ONLY a JSON array (no markdown, no explanation). Start with [ and end with ]. Each item: {"type":"שם עברי","cat":"tops|bottoms|footwear|accessories|outerwear","color":"English","hex":"#hex","brand":"brand or Unknown","style":"Casual|Sporty|Classic","gender":"גברים|נשים|יוניסקס","conf":0.9}' }
        ]
      }]
    });
    const text = response.content[0].text.trim();
    console.log('Claude response:', text.substring(0, 200));
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd <= jsonStart) {
      throw new Error('No JSON array in response: ' + text.substring(0, 100));
    }
    const items = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    const validCats = new Set(['tops','bottoms','footwear','accessories','outerwear']);
    const sanitized = items.map((item, i) => ({
      id: i+1, type: item.type||'פריט לבוש',
      cat: validCats.has(item.cat)?item.cat:'tops',
      color: item.color||'Unknown', hex: item.hex||'#888888',
      brand: item.brand||'Unknown', style: item.style||'Casual',
      gender: item.gender||'יוניסקס',
      conf: typeof item.conf==='number'?Math.min(1,Math.max(0,item.conf)):0.85
    }));
    return res.status(200).json({ items: sanitized });
  } catch (error) {
    console.error('Claude API error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
