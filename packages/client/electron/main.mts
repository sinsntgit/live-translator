import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, session } from 'electron';
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
// Dev runs use `npm run dev:server`; set this to test the embedded relay
// from an unpackaged build (`electron .`).
const embedRelay = app.isPackaged || process.env.LIVE_TRANSLATOR_EMBED_SERVER === '1';

const ENV_TEMPLATE = `# LiveInterpret configuration. Edit, save, then restart the app.
SONIOX_API_KEY=your_soniox_api_key_here
# Local port for the built-in relay (change only if 8787 is taken).
PORT=8787
`;

// The portable build self-extracts to a temp folder on every launch, so
// process.execPath points there. electron-builder exposes the folder the
// user actually launched the .exe from as PORTABLE_EXECUTABLE_DIR.
function configDir(): string {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  return app.isPackaged ? path.dirname(process.execPath) : process.cwd();
}

let relayProcess: ChildProcess | null = null;

function relayScriptPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'server.cjs')
    : path.join(__dirname, '../../server/dist-bundle/server.cjs');
}

function startRelay(envPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = fork(relayScriptPath(), [], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', LIVE_TRANSLATOR_ENV_PATH: envPath },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    });
    relayProcess = child;

    let output = '';
    const collect = (b: Buffer) => {
      output = (output + b.toString()).slice(-2000);
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);

    let ready = false;
    const timer = setTimeout(() => {
      if (!ready) reject(new Error(`The relay did not start within 10 seconds.

${output.trim()}`));
    }, 10000);

    child.on('message', (msg) => {
      const m = msg as { type?: string; port?: number };
      if (m.type === 'ready' && typeof m.port === 'number') {
        ready = true;
        clearTimeout(timer);
        resolve(m.port);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (!ready) {
        reject(new Error(output.trim() || `The relay exited with code ${code}.`));
      } else if (!app.isReady() || relayProcess === child) {
        relayProcess = null;
        dialog.showErrorBox('LiveInterpret', `The translation relay stopped unexpectedly (code ${code}).

${output.trim()}`);
      }
    });
  });
}

function stopRelay(): void {
  const child = relayProcess;
  relayProcess = null;
  child?.kill();
}

function createWindow(relayUrl?: string): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: relayUrl ? [`--relay-url=${relayUrl}`] : []
    }
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Lists capturable windows/screens with audio, so the renderer can offer
// "capture this meeting app's audio" (Teams/Webex) as a source alongside
// mic and file upload. See requirements.md §3.1/§7.2 and README's
// "System audio capture" architecture note.
//
// Electron's setDisplayMediaRequestHandler validates that the `video` field
// passed to its callback is an actual DesktopCapturerSource returned by
// desktopCapturer.getSources() (a native-backed object) — a plain object
// with a matching `id` is not accepted at runtime even though it satisfies
// the TypeScript type. So we cache the real source objects here and look
// the selection up by id, rather than reconstructing one.
let sourceCache: Electron.DesktopCapturerSource[] = [];
let selectedSourceId: string | null = null;

ipcMain.handle('desktop-capturer:list-sources', async () => {
  sourceCache = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    fetchWindowIcons: true
  });
  console.log(
    `[desktop-capturer] found ${sourceCache.length} source(s):`,
    sourceCache.map((s) => s.name)
  );
  return sourceCache.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnailDataUrl: s.thumbnail.isEmpty() ? '' : s.thumbnail.toDataURL()
  }));
});

ipcMain.handle('desktop-capturer:select-source', (_event, sourceId: string) => {
  selectedSourceId = sourceId;
});

app.whenReady().then(async () => {
  // The renderer triggers this by calling navigator.mediaDevices.getDisplayMedia
  // after picking a source via the IPC handlers above. Returning `audio: 'loopback'`
  // captures that window/screen's audio output (Windows/macOS) — this is what lets
  // the app listen to a Teams/Webex meeting instead of just the room mic.
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    const chosen = selectedSourceId
      ? sourceCache.find((s) => s.id === selectedSourceId)
      : undefined;
    if (!chosen) {
      callback({});
      return;
    }
    callback({ video: chosen, audio: 'loopback' });
  });

  let relayUrl: string | undefined;
  if (embedRelay) {
    const envPath = process.env.LIVE_TRANSLATOR_ENV_PATH ?? path.join(configDir(), '.env');
    if (!fs.existsSync(envPath)) {
      try {
        fs.writeFileSync(envPath, ENV_TEMPLATE, 'utf8');
        dialog.showMessageBoxSync({
          type: 'info',
          title: 'LiveInterpret setup',
          message: 'First-time setup',
          detail: `A settings file was created at:
${envPath}

Open it, paste your Soniox API key after SONIOX_API_KEY=, save, and start LiveInterpret again.`
        });
      } catch (e) {
        dialog.showErrorBox(
          'LiveInterpret',
          `Could not create ${envPath}: ${e instanceof Error ? e.message : String(e)}

Move the app to a folder you can write to.`
        );
      }
      app.quit();
      return;
    }
    try {
      const port = await startRelay(envPath);
      relayUrl = `ws://127.0.0.1:${port}/session`;
    } catch (e) {
      dialog.showErrorBox('LiveInterpret could not start', e instanceof Error ? e.message : String(e));
      app.quit();
      return;
    }
  }

  createWindow(relayUrl);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(relayUrl);
  });
});

app.on('will-quit', stopRelay);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
