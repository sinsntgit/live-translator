import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { SOURCE_LANGUAGES } from '@live-translator/shared';
import type { SonioxToken, SourceLanguage } from '@live-translator/shared';
import { Corners } from './Corners';

const LOW_CONFIDENCE = 0.5;
const MEDIUM_CONFIDENCE = 0.8;

const BASE_ENGLISH_SIZE = 17;
const BASE_SOURCE_SIZE = 15;
const ZOOM_STORAGE_KEY = 'liveinterpret.zoom';
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 2.2;
const ZOOM_STEP = 0.1;

function confidenceStyle(confidence: number | undefined, highlight: boolean): CSSProperties {
  if (!highlight || confidence === undefined) return {};
  if (confidence < LOW_CONFIDENCE) {
    return { textDecoration: 'underline solid var(--color-accent-900)', textDecorationThickness: 2, textUnderlineOffset: 3 };
  }
  if (confidence < MEDIUM_CONFIDENCE) {
    return { textDecoration: 'underline dotted var(--color-accent-700)', textUnderlineOffset: 3 };
  }
  return {};
}

const TokenStream = memo(function TokenStream({ tokens, highlight, dim }: { tokens: SonioxToken[]; highlight: boolean; dim?: boolean }) {
  return (
    <>
      {tokens.map((t, i) => (
        <span
          key={i}
          style={{ ...(dim ? { opacity: 0.55 } : {}), ...confidenceStyle(t.confidence, highlight) }}
          title={t.confidence !== undefined ? `confidence: ${(t.confidence * 100).toFixed(0)}%` : undefined}
        >
          {t.text}
        </span>
      ))}
    </>
  );
});

function followIfNearBottom(el: HTMLDivElement | null) {
  if (!el) return;
  // Only follow new text if the user is already near the bottom, so
  // scrolling up to re-read something doesn't get yanked back down by
  // the next caption update.
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  if (nearBottom) el.scrollTop = el.scrollHeight;
}

export const CaptionsPanel = memo(function CaptionsPanel({
  sourceLanguage,
  showSource,
  onToggleShowSource,
  maximized,
  onToggleMaximize,
  layoutKey,
  sourceFinal,
  sourcePartial,
  englishFinal,
  englishPartial
}: {
  sourceLanguage: SourceLanguage;
  showSource: boolean;
  onToggleShowSource: () => void;
  maximized: boolean;
  onToggleMaximize: () => void;
  /** Changing this remounts the text boxes, discarding any manual resize. */
  layoutKey: number;
  sourceFinal: SonioxToken[];
  sourcePartial: SonioxToken[];
  englishFinal: SonioxToken[];
  englishPartial: SonioxToken[];
}) {
  const lang = SOURCE_LANGUAGES[sourceLanguage];
  const captionsRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const [highlightConfidence, setHighlightConfidence] = useState(true);
  const [zoom, setZoom] = useState(() => {
    try {
      const z = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
      if (z >= ZOOM_MIN && z <= ZOOM_MAX) return z;
    } catch {
      /* storage unavailable */
    }
    return 1;
  });
  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
    } catch {
      /* storage unavailable */
    }
  }, [zoom]);
  const hasCaptions = englishFinal.length > 0 || englishPartial.length > 0;

  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  const zoomReset = () => setZoom(1);

  useLayoutEffect(() => followIfNearBottom(captionsRef.current), [englishFinal, englishPartial]);
  useLayoutEffect(() => followIfNearBottom(sourceRef.current), [sourceFinal, sourcePartial]);

  // Esc leaves the maximized view.
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggleMaximize();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximized, onToggleMaximize]);

  const boxBase: CSSProperties = {
    overflow: 'auto',
    resize: 'both',
    maxWidth: '100%',
    padding: 'var(--space-2)',
    border: '1px solid var(--color-divider)'
  };

  return (
    <div className="card blueprint elev-md" style={{ minHeight: 540, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Corners />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <div className="card-kicker">Live captions</div>
          <div className="card-title">English translation</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }} title="Zoom the caption text size">
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '2px 10px' }}
              onClick={zoomOut}
              disabled={zoom <= ZOOM_MIN}
              aria-label="Zoom out caption text"
            >
              A−
            </button>
            <span
              style={{ fontSize: 12, opacity: 0.6, minWidth: 36, textAlign: 'center', cursor: 'pointer' }}
              onClick={zoomReset}
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '2px 10px' }}
              onClick={zoomIn}
              disabled={zoom >= ZOOM_MAX}
              aria-label="Zoom in caption text"
            >
              A+
            </button>
          </div>
          <label className="radio" title="Underlines words Soniox is less confident about, based on each token's confidence score.">
            <input type="checkbox" checked={highlightConfidence} onChange={() => setHighlightConfidence((v) => !v)} />
            <span className="dot" />
            Highlight uncertain words
          </label>
          <label className="radio">
            <input type="checkbox" checked={showSource} onChange={onToggleShowSource} />
            <span className="dot" />
            Show {lang.label}
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '2px 10px' }}
            onClick={onToggleMaximize}
            title={maximized ? 'Restore layout (Esc)' : 'Maximize captions'}
          >
            {maximized ? 'Restore' : 'Maximize'}
          </button>
        </div>
      </div>
      <div
        key={`en-${layoutKey}`}
        ref={captionsRef}
        className="captions-scroll"
        style={{
          ...boxBase,
          height: maximized ? '52vh' : 420,
          minHeight: 160,
          maxHeight: maximized ? 'none' : '70vh',
          marginTop: 'var(--space-3)',
          fontSize: BASE_ENGLISH_SIZE * zoom,
          lineHeight: 1.5
        }}
      >
        {hasCaptions ? (
          <>
            <TokenStream tokens={englishFinal} highlight={highlightConfidence} />
            <TokenStream tokens={englishPartial} highlight={highlightConfidence} dim />
          </>
        ) : (
          <p style={{ opacity: 0.45, fontSize: 15 }}>
            Waiting for {lang.label} speech… start a session to see English captions here.
          </p>
        )}
      </div>
      {showSource && (
        <div style={{ borderTop: '1px solid var(--color-divider)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)' }}>
          <div className="card-kicker">Source text ({lang.label})</div>
          <div
            key={`src-${layoutKey}-${sourceLanguage}`}
            ref={sourceRef}
            className="captions-scroll"
            lang={sourceLanguage}
            style={{
              ...boxBase,
              height: maximized ? '24vh' : 200,
              minHeight: 100,
              maxHeight: maximized ? 'none' : '50vh',
              marginTop: 'var(--space-2)',
              direction: lang.dir,
              textAlign: lang.dir === 'rtl' ? 'right' : 'left',
              fontSize: BASE_SOURCE_SIZE * zoom,
              opacity: 0.75
            }}
          >
            <TokenStream tokens={sourceFinal} highlight={highlightConfidence} />
            <TokenStream tokens={sourcePartial} highlight={highlightConfidence} dim />
          </div>
        </div>
      )}
    </div>
  );
});
