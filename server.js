/**
 * 智巡排班 (ShiftMaster) - 轻量云同步服务端
 * 基于 Node.js 原生模块构建，零第三方依赖 (无需 npm install，即开即跑)
 * 支持静态文件托管、双人排班云端同步 API 与 Server-Sent Events (SSE) 实时毫秒级推送
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'rooms.json');

// 确保数据存储目录及文件存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 内存中的房间数据缓存：{ [roomId]: { data: {...}, lastModified: 1720000000000, password: '' } }
let roomsData = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    roomsData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    roomsData = {};
  }
}

// 保存数据至本地磁盘
function saveToDisk() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(roomsData, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save rooms to disk:', err);
  }
}

// 维护 SSE (Server-Sent Events) 长连接客户端：{ [roomId]: Set<res> }
const sseClients = new Map();

function broadcastToRoom(roomId, eventName, data, senderRes = null) {
  const clients = sseClients.get(roomId);
  if (!clients) return;
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    if (client !== senderRes && !client.writableEnded) {
      try {
        client.write(payload);
      } catch (e) {
        clients.delete(client);
      }
    }
  }
}

// MIME 映射表
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ics': 'text/calendar; charset=utf-8'
};

const server = http.createServer((req, res) => {
  // CORS 跨域头（方便独立部署或跨域调用）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Room-Password');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // -------------------------------------------------------------
  // API 1: SSE 实时长连接推送 GET /api/sync/:roomId/events
  // -------------------------------------------------------------
  if (pathname.startsWith('/api/sync/') && pathname.endsWith('/events')) {
    const parts = pathname.split('/');
    const roomId = decodeURIComponent(parts[3] || '').trim();

    if (!roomId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Room ID is required' }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', roomId, timestamp: Date.now() })}\n\n`);

    if (!sseClients.has(roomId)) {
      sseClients.set(roomId, new Set());
    }
    const roomSet = sseClients.get(roomId);
    roomSet.add(res);

    req.on('close', () => {
      roomSet.delete(res);
      if (roomSet.size === 0) {
        sseClients.delete(roomId);
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // API 2: 拉取房间数据 GET /api/sync/:roomId
  // -------------------------------------------------------------
  if (req.method === 'GET' && pathname.startsWith('/api/sync/')) {
    const roomId = decodeURIComponent(pathname.substring('/api/sync/'.length)).trim();
    if (!roomId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Room ID is required' }));
      return;
    }

    const room = roomsData[roomId];
    if (!room) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ exists: false, data: null }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      exists: true,
      lastModified: room.lastModified || 0,
      data: room.data || {}
    }));
    return;
  }

  // -------------------------------------------------------------
  // API 3: 推送/更新房间数据 POST /api/sync/:roomId
  // -------------------------------------------------------------
  if (req.method === 'POST' && pathname.startsWith('/api/sync/')) {
    const roomId = decodeURIComponent(pathname.substring('/api/sync/'.length)).trim();
    if (!roomId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Room ID is required' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // 最大10MB限制
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
        req.destroy();
      }
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const lastModified = Date.now();

        roomsData[roomId] = {
          data: payload.data || payload,
          lastModified,
          updatedAt: new Date().toISOString()
        };

        saveToDisk();

        // 通过 SSE 实时推送给同一房间内的其他所有在线设备（如对方的手机）
        broadcastToRoom(roomId, 'update', {
          lastModified,
          data: roomsData[roomId].data
        }, res);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, lastModified }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // 静态文件服务：托管 index.html, styles.css, app.js 等
  // -------------------------------------------------------------
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // 安全防止目录穿越
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 默认回退到 index.html (SPA)
      filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  智巡排班 (ShiftMaster) 云同步服务已成功启动！`);
  console.log(`  本地访问地址: http://localhost:${PORT}`);
  console.log(`  外网同步接口: http://<服务器公网IP或域名>:${PORT}/api/sync`);
  console.log(`=======================================================`);
});
