import type { SourceLanguage, TranscriptSegment } from '@live-translator/shared';
import { Corners } from './Corners';
import { formatElapsed } from '../lib/format';
import { exportTranscript } from '../lib/exportTranscript';

export function SessionCard({
  elapsedSec,
  wordCount,
  segments,
  sourceLanguage
}: {
  elapsedSec: number;
  wordCount: number;
  segments: TranscriptSegment[];
  sourceLanguage: SourceLanguage;
}) {
  const noSegments = segments.length === 0;
  return (
    <div className="card blueprint elev-sm resizable">
      <Corners />
      <div className="card-kicker">Session</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-2)',
          marginTop: 'var(--space-2)',
          fontSize: 13
        }}
      >
        <div>
          Duration
          <br />
          <strong style={{ fontSize: 20 }}>{formatElapsed(elapsedSec)}</strong>
        </div>
        <div>
          Words translated
          <br />
          <strong style={{ fontSize: 20 }}>{wordCount}</strong>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" disabled={noSegments} onClick={() => exportTranscript(segments, 'txt', sourceLanguage)}>
          .txt
        </button>
        <button type="button" className="btn btn-secondary" disabled={noSegments} onClick={() => exportTranscript(segments, 'md', sourceLanguage)}>
          .md
        </button>
        <button type="button" className="btn btn-secondary" disabled={noSegments} onClick={() => exportTranscript(segments, 'json', sourceLanguage)}>
          .json
        </button>
      </div>
    </div>
  );
}
