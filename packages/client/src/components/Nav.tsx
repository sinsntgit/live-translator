import { SOURCE_LANGUAGES } from '@live-translator/shared';
import type { SessionStatus, SourceLanguage } from '@live-translator/shared';

const STATUS_MAP: Record<SessionStatus, { label: string; cls: string }> = {
  idle: { label: 'Idle', cls: 'tag-neutral' },
  connecting: { label: 'Connecting', cls: 'tag-outline' },
  listening: { label: 'Listening', cls: 'tag-accent' },
  translating: { label: 'Translating', cls: 'tag-accent' },
  reconnecting: { label: 'Reconnecting…', cls: 'tag-outline' },
  error: { label: 'Error', cls: 'tag-outline' }
};

export function Nav({
  status,
  sourceLanguage,
  settingsOpen,
  onToggleSettings,
  onResetLayout
}: {
  status: SessionStatus;
  sourceLanguage: SourceLanguage;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onResetLayout: () => void;
}) {
  const st = STATUS_MAP[status];
  return (
    <nav className="nav">
      <span className="nav-brand">LiveInterpret</span>
      <span style={{ opacity: 0.6, fontSize: 13 }}>
        {SOURCE_LANGUAGES[sourceLanguage].label} → English · real-time meeting captions
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span className={`tag ${st.cls}`}>{st.label}</span>
        <button type="button" className="btn btn-ghost" onClick={onResetLayout} title="Restore default panel sizes">
          Reset layout
        </button>
        <button type="button" className="btn btn-ghost" onClick={onToggleSettings}>
          {settingsOpen ? 'Close settings' : 'Settings'}
        </button>
      </div>
    </nav>
  );
}
