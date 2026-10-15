import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AudioSourceMode,
  OutputMode,
  SessionStatus,
  SonioxToken,
  SourceLanguage,
  TranscriptSegment
} from '@live-translator/shared';
import { DEFAULT_SESSION_CONFIG } from '@live-translator/shared';
import { AudioCapture } from '../audio/audioCapture';
import { RelayClient } from '../lib/wsClient';
import { levelStore } from '../lib/levelStore';
import { formatElapsed, wordCountOf } from '../lib/format';

const FLUSH_DEBOUNCE_MS = 1200;

export interface CaptureSourceOption {
  id: string;
  name: string;
  thumbnailDataUrl: string;
}

export interface DeviceOption {
  deviceId: string;
  label: string;
}

export function useTranslationSession(relayUrl: string) {
  const [model, setModel] = useState(DEFAULT_SESSION_CONFIG.model);
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>('ar');
  const [sourceMode, setSourceMode] = useState<AudioSourceMode>('mic');
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [captureSources, setCaptureSources] = useState<CaptureSourceOption[]>([]);
  const [captureSourceId, setCaptureSourceId] = useState('');
  const [fileName, setFileName] = useState('No file selected');
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [running, setRunning] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const [speechMode, setSpeechMode] = useState<OutputMode>('text');
  const [endpointDetection, setEndpointDetection] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [contextText, setContextText] = useState('');
  const [contextTerms, setContextTerms] = useState('');
  const [sourceFinal, setSourceFinal] = useState<SonioxToken[]>([]);
  const [sourcePartial, setSourcePartial] = useState<SonioxToken[]>([]);
  const [englishFinal, setEnglishFinal] = useState<SonioxToken[]>([]);
  const [englishPartial, setEnglishPartial] = useState<SonioxToken[]>([]);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [error, setError] = useState('');

  const captureRef = useRef<AudioCapture | null>(null);
  const relayRef = useRef<RelayClient | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const finalOriginalRef = useRef<SonioxToken[]>([]);
  const finalTranslationRef = useRef<SonioxToken[]>([]);
  const lastFlushArRef = useRef(0);
  const lastFlushEnRef = useRef(0);
  const startTimeRef = useRef(0);
  const elapsedTimerRef = useRef<number | null>(null);
  const flushTimerRef = useRef<number | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const inputs = list
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
      setDevices(inputs);
      setDeviceId((prev) => prev || inputs[0]?.deviceId || '');
    } catch {
      /* permission not granted yet */
    }
  }, []);

  const refreshCaptureSources = useCallback(async () => {
    if (!window.electronBridge) return;
    try {
      const sources = await window.electronBridge.listCaptureSources();
      setCaptureSources(sources);
      setCaptureSourceId((prev) => {
        const stillValid = prev && sources.some((s) => s.id === prev);
        return stillValid ? prev : (sources[0]?.id ?? '');
      });
      if (sources.length === 0) {
        setError('No capturable windows or screens were found. Make sure the meeting window is open and not minimized.');
      } else {
        setError('');
      }
    } catch (e) {
      setError(
        `Could not list windows/screens: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }, []);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const handleFileChange = useCallback((file: File | null) => {
    if (!file) return;
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = URL.createObjectURL(file);
    setFileName(file.name);
  }, []);

  const flushSegment = useCallback(() => {
    const ar = finalOriginalRef.current.map((t) => t.text).join('');
    const en = finalTranslationRef.current.map((t) => t.text).join('');
    const deltaAr = ar.slice(lastFlushArRef.current).trim();
    const deltaEn = en.slice(lastFlushEnRef.current).trim();
    lastFlushArRef.current = ar.length;
    lastFlushEnRef.current = en.length;
    if (!deltaAr && !deltaEn) return;
    const ts = formatElapsed(startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0);
    setSegments((prev) => [...prev, { ts, source: deltaAr, english: deltaEn }]);
    if (speechMode === 'speech' && deltaEn && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(deltaEn);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  }, [speechMode]);

  const handleTokens = useCallback(
    (tokens: SonioxToken[], finished: boolean) => {
      const nonFinalOriginal: SonioxToken[] = [];
      const nonFinalTranslation: SonioxToken[] = [];
      // Translation lags transcription, so a message often carries tokens of
      // only one kind. Replacing the other kind's in-progress text with an
      // empty list made it vanish and reappear (visible flicker), so each
      // stream is only touched when the message actually contains it.
      let sawOriginal = false;
      let sawTranslation = false;
      let addedOriginalFinal = false;
      let addedTranslationFinal = false;
      for (const t of tokens) {
        if (!t.text) continue;
        const isTrans = t.translation_status === 'translation';
        if (isTrans) sawTranslation = true;
        else sawOriginal = true;
        if (t.is_final) {
          (isTrans ? finalTranslationRef.current : finalOriginalRef.current).push(t);
          if (isTrans) addedTranslationFinal = true;
          else addedOriginalFinal = true;
        } else {
          (isTrans ? nonFinalTranslation : nonFinalOriginal).push(t);
        }
      }
      const ar = finalOriginalRef.current.map((t) => t.text).join('');
      const en = finalTranslationRef.current.map((t) => t.text).join('');
      if (addedOriginalFinal) setSourceFinal([...finalOriginalRef.current]);
      if (addedTranslationFinal) {
        setEnglishFinal([...finalTranslationRef.current]);
        setWordCount(wordCountOf(en));
      }
      if (sawOriginal) setSourcePartial(nonFinalOriginal);
      if (sawTranslation) setEnglishPartial(nonFinalTranslation);

      if (ar.length !== lastFlushArRef.current || en.length !== lastFlushEnRef.current) {
        if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = window.setTimeout(flushSegment, FLUSH_DEBOUNCE_MS);
      }
      if (finished) flushSegment();
    },
    [flushSegment]
  );

  const teardown = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
    relayRef.current?.close();
    relayRef.current = null;
    if (elapsedTimerRef.current) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const stopSession = useCallback(() => {
    relayRef.current?.stop();
    flushSegment();
    teardown();
    setRunning(false);
    setStatus('idle');
    levelStore.set(0);
  }, [flushSegment, teardown]);

  const startSession = useCallback(async () => {
    setError('');
    setStatus('connecting');
    setRunning(true);
    setSourceFinal([]);
    setSourcePartial([]);
    setEnglishFinal([]);
    setEnglishPartial([]);
    setSegments([]);
    setWordCount(0);
    setElapsedSec(0);
    finalOriginalRef.current = [];
    finalTranslationRef.current = [];
    lastFlushArRef.current = 0;
    lastFlushEnRef.current = 0;

    const relay = new RelayClient();
    relayRef.current = relay;
    const capture = new AudioCapture();
    captureRef.current = capture;

    try {
      await relay.connect(relayUrl, {
        onMessage: (msg) => {
          if (msg.type === 'status') setStatus(msg.status);
          else if (msg.type === 'tokens') handleTokens(msg.tokens, msg.finished);
          else if (msg.type === 'error') {
            setStatus('error');
            setError(msg.message);
          }
        },
        onClose: () => {
          setRunning((wasRunning) => {
            if (wasRunning) teardown();
            return false;
          });
        }
      });

      await capture.start(
        {
          mode: sourceMode,
          deviceId,
          noiseSuppression,
          fileUrl: fileUrlRef.current ?? undefined,
          captureSourceId
        },
        {
          onPcmFrame: (chunk) => relay.sendAudio(chunk),
          onLevel: (lvl) => levelStore.set(lvl)
        }
      );
      if (sourceMode === 'mic') refreshDevices();

      const terms = contextTerms
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      relay.start({
        model,
        languageHints: [sourceLanguage],
        targetLanguage: 'en',
        enableEndpointDetection: endpointDetection,
        sampleRate: 16000,
        context: contextText || terms.length > 0 ? { text: contextText || undefined, terms: terms.length > 0 ? terms : undefined } : undefined
      });

      startTimeRef.current = Date.now();
      elapsedTimerRef.current = window.setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } catch (e) {
      teardown();
      setStatus('error');
      setRunning(false);
      setError(e instanceof Error ? e.message : 'Could not start the session.');
    }
  }, [
    relayUrl,
    sourceMode,
    deviceId,
    noiseSuppression,
    captureSourceId,
    model,
    sourceLanguage,
    endpointDetection,
    contextText,
    contextTerms,
    handleTokens,
    refreshDevices,
    teardown
  ]);

  useEffect(() => () => teardown(), [teardown]);

  return {
    state: {
      model,
      sourceLanguage,
      sourceMode,
      devices,
      deviceId,
      captureSources,
      captureSourceId,
      fileName,
      status,
      running,
      showSource,
      speechMode,
      endpointDetection,
      noiseSuppression,
      contextText,
      contextTerms,
      sourceFinal,
      sourcePartial,
      englishFinal,
      englishPartial,
      segments,
      elapsedSec,
      wordCount,
      error
    },
    actions: {
      setModel,
      setSourceLanguage,
      setSourceMode,
      setDeviceId,
      setCaptureSourceId,
      refreshCaptureSources,
      handleFileChange,
      setShowSource,
      setSpeechMode,
      setEndpointDetection,
      setNoiseSuppression,
      setContextText,
      setContextTerms,
      startSession,
      stopSession
    }
  };
}
