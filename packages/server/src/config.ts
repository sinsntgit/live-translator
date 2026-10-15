import path from 'node:path';
import dotenv from 'dotenv';

// The packaged app points this at the .env sitting next to the .exe; in
// development it falls back to ./.env in the server's working directory.
export const envPath = process.env.LIVE_TRANSLATOR_ENV_PATH ?? path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v || v === 'your_soniox_api_key_here') {
    console.error(`Missing ${name}. Set it in ${envPath} and restart the app.`);
    process.exit(1);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  sonioxApiKey: requireEnv('SONIOX_API_KEY'),
  sonioxUrl: process.env.SONIOX_URL ?? 'wss://stt-rt.soniox.com/transcribe-websocket'
};
