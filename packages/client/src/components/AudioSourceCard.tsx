import { memo, useSyncExternalStore } from 'react';
import { SOURCE_LANGUAGES } from '@live-translator/shared';
import { levelStore } from '../lib/levelStore';
import type { AudioSourceMode, SourceLanguage } from '@live-translator/shared';
import { Corners } from './Corners';
import type { CaptureSourceOption, DeviceOption } from '../hooks/useTranslationSession';

const isElectron = typeof window !== 'undefined' && !!window.electronBridge;

const LevelMeter = memo(function LevelMeter() {
  const level = useSyncExternalStore(levelStore.subscribe, levelStore.get);
  return (
    <div
      style={{
        marginTop: 'var(--space-3)',
        height: 6,
        background: 'var(--color-neutral-200)',
        border: '1px solid var(--color-divider)'
      }}
    >
      <div
        style={{
          width: `${Math.round(level * 100)}%`,
          height: '100%',
          background: 'var(--color-accent)',
          transition: 'width 80ms linear'
        }}
      />
    </div>
  );
});

export function AudioSourceCard({
  sourceLanguage,
  onSourceLanguageChange,
  sourceMode,
  onSourceModeChange,
  devices,
  deviceId,
  onDeviceChange,
  captureSources,
  captureSourceId,
  onCaptureSourceChange,
  onRefreshCaptureSources,
  fileName,
  onFileChange,
  running,
  onStart,
  onStop
}: {
  sourceLanguage: SourceLanguage;
  onSourceLanguageChange: (l: SourceLanguage) => void;
  sourceMode: AudioSourceMode;
  onSourceModeChange: (m: AudioSourceMode) => void;
  devices: DeviceOption[];
  deviceId: string;
  onDeviceChange: (id: string) => void;
  captureSources: CaptureSourceOption[];
  captureSourceId: string;
  onCaptureSourceChange: (id: string) => void;
  onRefreshCaptureSources: () => void;
  fileName: string;
  onFileChange: (file: File | null) => void;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <div className="card blueprint elev-sm resizable">
      <Corners />
      <div className="field">
        <label>Spoken language (translated to English)</label>
        <select
          className="input"
          value={sourceLanguage}
          disabled={running}
          onChange={(e) => onSourceLanguageChange(e.target.value as SourceLanguage)}
        >
          {Object.values(SOURCE_LANGUAGES).map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <div className="card-kicker" style={{ marginTop: 'var(--space-3)' }}>Audio source</div>
      <div className="seg" role="radiogroup" style={{ marginTop: 'var(--space-2)' }}>
        <label className="seg-opt">
          <input type="radio" name="src" checked={sourceMode === 'mic'} onChange={() => onSourceModeChange('mic')} />
          Microphone
        </label>
        <label className="seg-opt">
          <input type="radio" name="src" checked={sourceMode === 'file'} onChange={() => onSourceModeChange('file')} />
          Recorded meeting
        </label>
        {isElectron && (
          <label className="seg-opt">
            <input
              type="radio"
              name="src"
              checked={sourceMode === 'system'}
              onChange={() => {
                onSourceModeChange('system');
                onRefreshCaptureSources();
              }}
            />
            Teams / Webex / system audio
          </label>
        )}
      </div>

      {sourceMode === 'mic' && (
        <div className="field" style={{ marginTop: 'var(--space-3)' }}>
          <label>Input device</label>
          <select className="input" value={deviceId} onChange={(e) => onDeviceChange(e.target.value)}>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {sourceMode === 'file' && (
        <div className="field" style={{ marginTop: 'var(--space-3)' }}>
          <label>Meeting recording (audio/video)</label>
          <input
            className="input"
            type="file"
            accept="audio/*,video/*"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          <p style={{ fontSize: 12, opacity: 0.6, margin: 'var(--space-1) 0 0' }}>{fileName}</p>
        </div>
      )}

      {sourceMode === 'system' && (
        <div className="field" style={{ marginTop: 'var(--space-3)' }}>
          <label>Window or screen (audio captured via loopback)</label>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <select
              className="input"
              style={{ flex: 1 }}
              value={captureSourceId}
              onFocus={onRefreshCaptureSources}
              onChange={(e) => onCaptureSourceChange(e.target.value)}
            >
              {captureSources.length === 0 && <option value="">No windows/screens found</option>}
              {captureSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-secondary" onClick={onRefreshCaptureSources}>
              Refresh
            </button>
          </div>
          <p style={{ fontSize: 12, opacity: 0.6, margin: 'var(--space-1) 0 0' }}>
            Pick the Teams/Webex window (or the whole screen) you want to capture audio from. Open the
            meeting window first, then hit Refresh if it's not listed yet.
          </p>
        </div>
      )}

      <LevelMeter />

      {running ? (
        <button
          type="button"
          className="btn btn-secondary btn-block blueprint"
          style={{ marginTop: 'var(--space-3)', position: 'relative' }}
          onClick={onStop}
        >
          <Corners />
          Stop translating
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-block blueprint"
          style={{ marginTop: 'var(--space-3)', position: 'relative' }}
          onClick={onStart}
        >
          <Corners />
          Start translating
        </button>
      )}
    </div>
  );
}
