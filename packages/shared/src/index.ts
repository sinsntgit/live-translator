/**
 * Protocol shared between the Electron client and the backend relay.
 * The relay owns the Soniox WebSocket connection (and API key); the client
 * never talks to Soniox directly (requirements.md §4.3, §5.1).
 */

export type SessionStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'translating'
  | 'reconnecting'
  | 'error';

export type AudioSourceMode = 'mic' | 'file' | 'system';

export type OutputMode = 'text' | 'speech';

/** Spoken languages the user can pick in the app. Target is always English. */
export type SourceLanguage = 'ar' | 'th';

export interface SourceLanguageInfo {
  code: SourceLanguage;
  label: string;
  /** Text direction for rendering the source transcript. */
  dir: 'rtl' | 'ltr';
}

export const SOURCE_LANGUAGES: Record<SourceLanguage, SourceLanguageInfo> = {
  ar: { code: 'ar', label: 'Arabic', dir: 'rtl' },
  th: { code: 'th', label: 'Thai', dir: 'ltr' }
};

/** Mirrors Soniox's real-time token shape (see README "Response shape"). */
export interface SonioxToken {
  text: string;
  start_ms?: number;
  end_ms?: number;
  confidence?: number;
  is_final: boolean;
  speaker?: string;
  language?: string;
  translation_status: 'original' | 'translation';
}

/**
 * Domain/vocabulary hints sent to Soniox to improve recognition of
 * specific names, jargon, or expected terms (see Soniox docs' `context`
 * field on the real-time config message). This does not fix general
 * accent/dialect coverage, which is a property of the model itself.
 */
export interface SonioxContext {
  text?: string;
  terms?: string[];
}

export interface SessionConfig {
  model: string;
  languageHints: string[];
  targetLanguage: string;
  enableEndpointDetection: boolean;
  sampleRate: number;
  context?: SonioxContext;
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  model: 'stt-rt-v5',
  languageHints: ['ar'],
  targetLanguage: 'en',
  enableEndpointDetection: true,
  sampleRate: 16000
};

/** Messages the client sends to the backend relay over its own WebSocket. */
export type ClientToServerMessage =
  | { type: 'start'; config: SessionConfig }
  | { type: 'stop' };

/**
 * Messages the backend relay sends to the client.
 * Binary frames sent by the client (raw PCM16LE audio) are forwarded
 * straight through to Soniox and are not part of this JSON envelope.
 */
export type ServerToClientMessage =
  | { type: 'status'; status: SessionStatus }
  | { type: 'tokens'; tokens: SonioxToken[]; finished: boolean }
  | { type: 'error'; message: string };

export interface TranscriptSegment {
  ts: string;
  source: string;
  english: string;
}

export interface NormalizedTranscriptEntry {
  timestamp: string;
  source_language: SourceLanguage;
  source_text: string;
  english_text: string;
  is_final: boolean;
}
