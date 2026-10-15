import { useCallback, useEffect, useRef, useState } from 'react';
import { Nav } from './components/Nav';
import { SettingsPanel } from './components/SettingsPanel';
import { CaptionsPanel } from './components/CaptionsPanel';
import { AudioSourceCard } from './components/AudioSourceCard';
import { OutputCard } from './components/OutputCard';
import { SessionCard } from './components/SessionCard';
import { useTranslationSession } from './hooks/useTranslationSession';

const RELAY_URL = window.electronBridge?.relayUrl ?? 'ws://127.0.0.1:8787/session';

const DEFAULT_SPLIT = 66; // % of width given to the captions panel
const SPLIT_MIN = 30;
const SPLIT_MAX = 85;
const SPLIT_STORAGE_KEY = 'liveinterpret.split';

function loadSplit(): number {
  try {
    const v = Number(localStorage.getItem(SPLIT_STORAGE_KEY));
    if (v >= SPLIT_MIN && v <= SPLIT_MAX) return v;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_SPLIT;
}

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [split, setSplit] = useState(loadSplit);
  const [maximized, setMaximized] = useState(false);
  const [layoutKey, setLayoutKey] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const { state, actions } = useTranslationSession(RELAY_URL);

  useEffect(() => {
    try {
      localStorage.setItem(SPLIT_STORAGE_KEY, String(split));
    } catch {
      /* storage unavailable */
    }
  }, [split]);

  const startDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const grid = gridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const onMove = (ev: PointerEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  const resetLayout = () => {
    setSplit(DEFAULT_SPLIT);
    setMaximized(false);
    setLayoutKey((k) => k + 1);
  };

  const toggleMaximize = useCallback(() => setMaximized((m) => !m), []);
  const { setShowSource } = actions;
  const toggleShowSource = useCallback(() => setShowSource((v) => !v), [setShowSource]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <Nav
        status={state.status}
        sourceLanguage={state.sourceLanguage}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        onResetLayout={resetLayout}
      />

      {state.error && (
        <div
          style={{
            margin: '0 var(--space-4)',
            padding: 'var(--space-2) var(--space-3)',
            border: '1px solid var(--color-accent-700)',
            color: 'var(--color-accent-900)',
            fontSize: 13
          }}
        >
          {state.error}
        </div>
      )}

      {settingsOpen && (
        <SettingsPanel
          model={state.model}
          onModelChange={actions.setModel}
          endpointDetection={state.endpointDetection}
          onToggleEndpointDetection={() => actions.setEndpointDetection((v) => !v)}
          noiseSuppression={state.noiseSuppression}
          onToggleNoiseSuppression={() => actions.setNoiseSuppression((v) => !v)}
          contextText={state.contextText}
          onContextTextChange={actions.setContextText}
          contextTerms={state.contextTerms}
          onContextTermsChange={actions.setContextTerms}
        />
      )}

      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: maximized ? 'minmax(0, 1fr)' : `minmax(0, ${split}fr) 10px minmax(0, ${100 - split}fr)`,
          padding: 'var(--space-4)',
          alignItems: 'start'
        }}
      >
        <CaptionsPanel
          sourceLanguage={state.sourceLanguage}
          showSource={state.showSource}
          onToggleShowSource={toggleShowSource}
          maximized={maximized}
          onToggleMaximize={toggleMaximize}
          layoutKey={layoutKey}
          sourceFinal={state.sourceFinal}
          sourcePartial={state.sourcePartial}
          englishFinal={state.englishFinal}
          englishPartial={state.englishPartial}
        />

        {!maximized && (
          <>
            <div
              className="split-handle"
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize panels"
              onPointerDown={startDrag}
              onDoubleClick={() => setSplit(DEFAULT_SPLIT)}
            />
            <div key={`side-${layoutKey}`} style={{ display: 'grid', gap: 'var(--space-4)', minWidth: 0 }}>
              <AudioSourceCard
                sourceLanguage={state.sourceLanguage}
                onSourceLanguageChange={actions.setSourceLanguage}
                sourceMode={state.sourceMode}
                onSourceModeChange={actions.setSourceMode}
                devices={state.devices}
                deviceId={state.deviceId}
                onDeviceChange={actions.setDeviceId}
                captureSources={state.captureSources}
                captureSourceId={state.captureSourceId}
                onCaptureSourceChange={actions.setCaptureSourceId}
                onRefreshCaptureSources={actions.refreshCaptureSources}
                fileName={state.fileName}
                onFileChange={actions.handleFileChange}
                running={state.running}
                onStart={actions.startSession}
                onStop={actions.stopSession}
              />

              <OutputCard speechMode={state.speechMode} onSpeechModeChange={actions.setSpeechMode} />

              <SessionCard
                elapsedSec={state.elapsedSec}
                wordCount={state.wordCount}
                segments={state.segments}
                sourceLanguage={state.sourceLanguage}
              />
            </div>
          </>
        )}
      </div>

      {maximized && (
        <div style={{ textAlign: 'center', fontSize: 12, opacity: 0.5, paddingBottom: 'var(--space-3)' }}>
          Press Esc or “Restore” to bring the controls back. Translation keeps running while maximized.
        </div>
      )}
    </div>
  );
}
