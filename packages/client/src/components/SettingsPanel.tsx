import { Corners } from './Corners';

export function SettingsPanel({
  model,
  onModelChange,
  endpointDetection,
  onToggleEndpointDetection,
  noiseSuppression,
  onToggleNoiseSuppression,
  contextText,
  onContextTextChange,
  contextTerms,
  onContextTermsChange
}: {
  model: string;
  onModelChange: (v: string) => void;
  endpointDetection: boolean;
  onToggleEndpointDetection: () => void;
  noiseSuppression: boolean;
  onToggleNoiseSuppression: () => void;
  contextText: string;
  onContextTextChange: (v: string) => void;
  contextTerms: string;
  onContextTermsChange: (v: string) => void;
}) {
  return (
    <div className="card blueprint elev-md" style={{ margin: 'var(--space-4) var(--space-4) 0' }}>
      <Corners />
      <div className="card-kicker">Settings</div>
      <div className="card-title">Connection &amp; session</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-4)',
          marginTop: 'var(--space-2)'
        }}
      >
        <div className="field">
          <label>Model</label>
          <select className="input" value={model} onChange={(e) => onModelChange(e.target.value)}>
            <option value="stt-rt-v5">stt-rt-v5 (recommended)</option>
            <option value="stt-rt-v4">stt-rt-v4</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
        <label className="radio">
          <input type="checkbox" checked={endpointDetection} onChange={onToggleEndpointDetection} />
          <span className="dot" />
          Endpoint detection (finalize on pause)
        </label>
        <label className="radio">
          <input type="checkbox" checked={noiseSuppression} onChange={onToggleNoiseSuppression} />
          <span className="dot" />
          Mic noise suppression
        </label>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-4)',
          marginTop: 'var(--space-3)'
        }}
      >
        <div className="field">
          <label>Context (names, topic, expected vocabulary)</label>
          <textarea
            className="input"
            rows={2}
            placeholder="e.g. Weekly ops sync between the Riyadh and Cairo teams; expect names like Abdullah, Fatima, and product names like Al-Rajhi, Nabd."
            value={contextText}
            onChange={(e) => onContextTextChange(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Expected terms (comma-separated)</label>
          <textarea
            className="input"
            rows={2}
            placeholder="e.g. Aramco, Nabd, murabaha, Sheikh Zayed Road"
            value={contextTerms}
            onChange={(e) => onContextTermsChange(e.target.value)}
          />
        </div>
      </div>
      <p style={{ fontSize: 12, opacity: 0.6, margin: 'var(--space-3) 0 0' }}>
        Spoken language is chosen in the Audio source card; the target is always English. The Soniox API key lives only on
        the backend relay; this client never sees it. Context and terms above are sent to Soniox to help
        recognize specific names/jargon — they don't change dialect coverage, which is a property of the
        model itself.
      </p>
    </div>
  );
}
