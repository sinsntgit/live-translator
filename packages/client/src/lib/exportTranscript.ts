import { SOURCE_LANGUAGES } from '@live-translator/shared';
import type { SourceLanguage, TranscriptSegment } from '@live-translator/shared';

export type ExportFormat = 'txt' | 'md' | 'json';

export function exportTranscript(
  segments: TranscriptSegment[],
  format: ExportFormat,
  sourceLanguage: SourceLanguage
): void {
  const label = SOURCE_LANGUAGES[sourceLanguage].label;
  let content: string;
  let mime: string;

  if (format === 'json') {
    content = JSON.stringify(
      segments.map((s) => ({
        timestamp: s.ts,
        source_language: sourceLanguage,
        source_text: s.source,
        english_text: s.english
      })),
      null,
      2
    );
    mime = 'application/json';
  } else if (format === 'md') {
    content =
      '# Meeting transcript\n\n' +
      segments.map((s) => `**[${s.ts}]**\n\n- ${label}: ${s.source}\n- EN: ${s.english}\n`).join('\n');
    mime = 'text/markdown';
  } else {
    content = segments.map((s) => `[${s.ts}]\n${label}: ${s.source}\nEN: ${s.english}\n`).join('\n');
    mime = 'text/plain';
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meeting-transcript.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
