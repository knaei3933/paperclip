import { useState, useEffect, useRef, useCallback } from 'react';

export interface WsEvent {
  type: 'agent_status_changed' | 'task_updated' | 'escalation_created';
  data: unknown;
}

export function useWebSocket(url: string = 'ws://localhost:3100/ws') {
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval>>(undefined);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const token = localStorage.getItem('apiAuthToken') ?? new URLSearchParams(window.location.search).get('token');
    const wsUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      // Send periodic heartbeat to keep connection alive
      heartbeatTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20_000);
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as WsEvent;
        setLastEvent(parsed);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      clearInterval(heartbeatTimer.current);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      clearInterval(heartbeatTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { lastEvent, connected };
}
