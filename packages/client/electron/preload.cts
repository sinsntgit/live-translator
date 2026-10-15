import { contextBridge, ipcRenderer } from 'electron';

export interface CaptureSource {
  id: string;
  name: string;
  thumbnailDataUrl: string;
}

// The main process starts the relay on a port it picked up from the user's
// .env and passes the resulting URL in as a window argument.
const relayArg = process.argv.find((a) => a.startsWith('--relay-url='));

const api = {
  listCaptureSources: (): Promise<CaptureSource[]> =>
    ipcRenderer.invoke('desktop-capturer:list-sources'),
  selectCaptureSource: (sourceId: string): Promise<void> =>
    ipcRenderer.invoke('desktop-capturer:select-source', sourceId),
  relayUrl: relayArg
    ? relayArg.slice('--relay-url='.length)
    : (process.env.LIVE_TRANSLATOR_RELAY_URL ?? 'ws://127.0.0.1:8787/session')
};

export type ElectronBridge = typeof api;

contextBridge.exposeInMainWorld('electronBridge', api);
