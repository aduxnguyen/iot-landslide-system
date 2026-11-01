import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

let wss = null;
const clients = new Map(); // ws -> { user, isAlive }

export function initWebSocketServer(server) {
  wss = new WebSocketServer({ noServer: true });

  // Heartbeat ping-pong mỗi 25s để giữ kết nối ổn định qua Reverse Proxy/Tunnel
  const heartbeatInterval = setInterval(() => {
    for (const [ws, clientData] of clients.entries()) {
      if (!clientData.isAlive) {
        console.log(`[WS] Terminating inactive connection: ${clientData.user?.username || 'anonymous'}`);
        clients.delete(ws);
        ws.terminate();
        continue;
      }
      clientData.isAlive = false;
      ws.ping();
    }
  }, 25000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  // Xử lý nâng cấp HTTP Upgrade request trên path `/ws`
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname !== '/ws') {
      return; // Để các handler khác hoặc bỏ qua
    }

    // Xác thực token qua query parameter hoặc header
    const token = url.searchParams.get('token') || request.headers['sec-websocket-protocol'];
    const secret = process.env.JWT_SECRET;

    if (!token) {
      console.warn('[WS Upgrade] Rejected connection: missing JWT token');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const decoded = jwt.verify(token, secret);
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, decoded);
      });
    } catch (err) {
      console.warn('[WS Upgrade] Rejected connection: invalid or expired JWT token', err.message);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request, user) => {
    clients.set(ws, { user, isAlive: true });
    console.log(`✔ [WS] Client connected: ${user.username} (${user.role})`);

    // Gửi gói tin chào mừng
    ws.send(JSON.stringify({
      type: 'INIT_CONNECTED',
      data: {
        username: user.username,
        role: user.role,
        serverTime: Date.now()
      }
    }));

    ws.on('pong', () => {
      const client = clients.get(ws);
      if (client) client.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message.toString());
        // Người dùng viewer tuyệt đối không được gửi lệnh điều khiển qua WS
        if (parsed.type === 'COMMAND' && user.role !== 'admin') {
          ws.send(JSON.stringify({
            type: 'ERROR',
            error: 'Quyền xem (Viewer) không được phép thực hiện lệnh điều khiển.'
          }));
          return;
        }
      } catch (err) {
        // Bỏ qua tin nhắn không đúng định dạng
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected: ${user.username}`);
    });
  });

  return broadcast;
}

// Hàm broadcast dữ liệu tới mọi client đang kết nối
export function broadcast(payload) {
  if (!wss) return;
  const msg = JSON.stringify(payload);
  for (const [ws] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}
