// Vercel Serverless Function: /api/sync
// 支持跨域双人排班云端同步

// 内存暂存 (在 Serverless 暖机实例中)
let memoryStore = global.__shiftMemoryStore || {};
global.__shiftMemoryStore = memoryStore;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Room-Id');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  let roomId = (req.query && req.query.roomId ? req.query.roomId : '').trim();
  if (!roomId && req.url) {
    const match = req.url.match(/\/api\/sync\/([^/?#]+)/);
    if (match) {
      roomId = decodeURIComponent(match[1]).trim();
    }
  }
  if (!roomId && req.headers['x-room-id']) {
    roomId = String(req.headers['x-room-id']).trim();
  }

  if (!roomId) {
    res.status(400).json({ error: 'Missing roomId query parameter or header' });
    return;
  }

  if (req.method === 'GET') {
    const record = memoryStore[roomId];
    if (!record) {
      res.status(200).json({ exists: false, data: null });
      return;
    }
    res.status(200).json({
      exists: true,
      lastModified: record.lastModified,
      data: record.data
    });
    return;
  }

  if (req.method === 'POST') {
    const data = req.body && req.body.data ? req.body.data : req.body;
    const lastModified = Date.now();
    memoryStore[roomId] = {
      data,
      lastModified,
      updatedAt: new Date().toISOString()
    };
    res.status(200).json({ success: true, lastModified });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
