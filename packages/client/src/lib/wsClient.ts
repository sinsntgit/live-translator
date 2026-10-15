import type { ClientToServerMessage, ServerToClientMessage, SessionConfig } from '@live-translator/shared';

export interface RelayClientCallbacks {
  onMessage: (msg: ServerToClientMessage) => void;
  onClose: () => void;
}

/** Connects to our own backend relay (never directly to Soniox from the client). */
export class RelayClient {
  private ws: WebSocket | null = null;

  connect(url: string, callbacks: RelayClientCallbacks): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('Could not reach the backend relay.'));
      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          try {
            callbacks.onMessage(JSON.parse(ev.data) as ServerToClientMessage);
          } catch {
            /* ignore malformed frame */
          }
        }
      };
      ws.onclose = () => callbacks.onClose();
    });
  }

  start(config: SessionConfig): void {
    this.sendJson({ type: 'start', config });
  }

  stop(): void {
    this.sendJson({ type: 'stop' });
  }

  sendAudio(chunk: ArrayBuffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(chunk);
    }
  }

  close(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }

  private sendJson(msg: ClientToServerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
