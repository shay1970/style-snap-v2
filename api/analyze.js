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
      messages: [
        { role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: image } },
          { type: 'text', text: 'Return ONLY a raw JSON array of clothing items. No markdown, no explanation. Each item: {"type":"Hebrew name","cat":"tops|bottoms|footwear|accessories|outerwear","color":"English","hex":"#xxxxxx","brand":"Unknown","style":"Casual","gender":"יוניסקס","conf":0.9}' }
        ]},
        { role: 'assistant', content: '[' }
      ]
    });
    const rawText = response.content[0].text.trim();
    const text = '[' + rawText;
    const match = text.match(/\[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');
    const items = JSON.parse(match[0]);
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
