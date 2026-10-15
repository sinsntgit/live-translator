import type { OutputMode } from '@live-translator/shared';
import { Corners } from './Corners';

export function OutputCard({
  speechMode,
  onSpeechModeChange
}: {
  speechMode: OutputMode;
  onSpeechModeChange: (m: OutputMode) => void;
}) {
  return (
    <div className="card blueprint elev-sm resizable">
      <Corners />
      <div className="card-kicker">Output</div>
      <div className="seg" role="radiogroup" style={{ marginTop: 'var(--space-2)' }}>
        <label className="seg-opt">
          <input type="radio" name="out" checked={speechMode === 'text'} onChange={() => onSpeechModeChange('text')} />
          Text only
        </label>
        <label className="seg-opt">
          <input
            type="radio"
            name="out"
            checked={speechMode === 'speech'}
            onChange={() => onSpeechModeChange('speech')}
          />
          Text + spoken English
        </label>
      </div>
      <p style={{ fontSize: 12, opacity: 0.6, margin: 'var(--space-2) 0 0' }}>
        Spoken output uses your browser's built-in text-to-speech voice.
      </p>
    </div>
  );
}
