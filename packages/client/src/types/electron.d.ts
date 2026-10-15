export interface CaptureSource {
  id: string;
  name: string;
  thumbnailDataUrl: string;
}

export interface ElectronBridge {
  listCaptureSources(): Promise<CaptureSource[]>;
  selectCaptureSource(sourceId: string): Promise<void>;
  relayUrl: string;
}

declare global {
  interface Window {
    electronBridge: ElectronBridge;
  }
}
