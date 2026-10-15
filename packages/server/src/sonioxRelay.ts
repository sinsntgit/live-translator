import WebSocket from 'ws';
import type {
  ServerToClientMessage,
  SessionConfig,
  SonioxToken
} from '@live-translator/shared';
import { config } from './config.js';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BACKOFF_MS = 1000;
const RECONNECT_BACKOFF_CAP_MS = 5000;

/**
 * Owns a single Soniox real-time WebSocket connection on behalf of one
 * client session. The client never sees the API key or the Soniox URL.
 */
export class SonioxRelay {
  private sonioxWs: WebSocket | null = null;
  private sessionConfig: SessionConfig | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private manualStop = false;
  private running = false;

  constructor(private readonly send: (msg: ServerToClientMessage) => void) {}

  start(sessionConfig: SessionConfig): void {
    this.sessionConfig = sessionConfig;
    this.manualStop = false;
    this.reconnectAttempts = 0;
    this.running = true;
    this.connect();
  }

  private connect(): void {
    this.send({ type: 'status', status: 'connecting' });
    const ws = new WebSocket(config.sonioxUrl);
    this.sonioxWs = ws;

    ws.on('open', () => {
      this.reconnectAttempts = 0;
      const cfg = this.sessionConfig!;
      const hasContext = cfg.context && (cfg.context.text || (cfg.context.terms && cfg.context.terms.length > 0));
      ws.send(
        JSON.stringify({
          api_key: config.sonioxApiKey,
          model: cfg.model,
          audio_format: 'pcm_s16le',
          sample_rate: cfg.sampleRate,
          num_channels: 1,
          language_hints: cfg.languageHints,
          enable_endpoint_detection: cfg.enableEndpointDetection,
          translation: { type: 'one_way', target_language: cfg.targetLanguage },
          ...(hasContext ? { context: cfg.context } : {})
        })
      );
      this.send({ type: 'status', status: 'listening' });
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      let res: {
        tokens?: SonioxToken[];
        finished?: boolean;
        error_code?: string;
        error_message?: string;
      };
      try {
        res = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (res.error_code) {
        this.send({ type: 'error', message: res.error_message ?? res.error_code });
        return;
      }
      if (res.tokens && res.tokens.length > 0) {
        this.send({ type: 'status', status: 'translating' });
      }
      this.send({ type: 'tokens', tokens: res.tokens ?? [], finished: !!res.finished });
    });

    ws.on('error', () => {
      this.send({ type: 'error', message: 'Soniox WebSocket connection error.' });
    });

    ws.on('close', () => {
      this.sonioxWs = null;
      if (this.manualStop || !this.running) {
        this.send({ type: 'status', status: 'idle' });
        return;
      }
      if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        this.send({ type: 'status', status: 'reconnecting' });
        const delay = Math.min(
          RECONNECT_BACKOFF_MS * this.reconnectAttempts,
          RECONNECT_BACKOFF_CAP_MS
        );
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
      } else {
        this.send({
          type: 'error',
          message: 'Lost connection to Soniox after several retries.'
        });
      }
    });
  }

  sendAudio(chunk: Buffer): void {
    if (this.sonioxWs && this.sonioxWs.readyState === WebSocket.OPEN) {
      this.sonioxWs.send(chunk);
    }
  }

  stop(): void {
    this.manualStop = true;
    this.running = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sonioxWs) {
      try {
        this.sonioxWs.send('');
      } catch {
        /* ignore */
      }
      try {
        this.sonioxWs.close();
      } catch {
        /* ignore */
      }
      this.sonioxWs = null;
    }
  }
}
