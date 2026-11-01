import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export function useWebSocket() {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [latestData, setLatestData] = useState(null);
  const [nodeStatus, setNodeStatus] = useState({
    node_top: { status: 'offline', rssi: null },
    node_bottom: { status: 'offline', rssi: null }
  });
  const [lastMessageTime, setLastMessageTime] = useState(null);

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const staleTimeoutRef = useRef(null);

  const resetStaleTimer = useCallback(() => {
    setIsStale(false);
    if (staleTimeoutRef.current) clearTimeout(staleTimeoutRef.current);
    // Nếu quá 8 giây không có tin mới từ WebSocket -> coi dữ liệu là cũ (stale)
    staleTimeoutRef.current = setTimeout(() => {
      setIsStale(true);
    }, 8000);
  }, []);

  const connect = useCallback(() => {
    if (!isAuthenticated || !token) return;

    // Xác định protocol tương đối: wss nếu https, ws nếu http
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

    console.log(`[WebSocket] Connecting to relative endpoint: ${protocol}//${host}/ws`);
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('✔ [WebSocket] Connected successfully.');
      setIsConnected(true);
      resetStaleTimer();
    };

    ws.onmessage = (event) => {
      resetStaleTimer();
      setLastMessageTime(Date.now());

      try {
        const payload = JSON.parse(event.data);
        setLatestData(payload);

        if (payload.type === 'NODE_STATUS') {
          setNodeStatus(payload.data);
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      console.warn('⚠ [WebSocket] Connection closed. Reconnecting in 3s...');
      setIsConnected(false);
      setIsStale(true);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('[WebSocket] Error occurred:', err);
      ws.close();
    };
  }, [isAuthenticated, token, resetStaleTimer]);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (staleTimeoutRef.current) {
        clearTimeout(staleTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    isConnected,
    isStale,
    latestData,
    nodeStatus,
    lastMessageTime
  };
}
