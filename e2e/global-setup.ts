import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { E2E_DATA, E2E_PORT } from "../playwright.config";

/**
 * Safety first: `next dev` would load .env.local / .env.development* and could point the store at
 * a real database. Refuse to run if any such file or any real credential is present.
 * Then start from an empty store and prepare one setup link for the owner's first sign-in.
 */
export default async function globalSetup() {
  const root = path.join(__dirname, "..");
  const envFiles = fs.readdirSync(root).filter((f) => f.startsWith(".env") && f !== ".env.example");
  if (envFiles.length) throw new Error(`Refusing to run E2E tests with ${envFiles.join(", ")} present: they could point the app at real services.`);
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "LINKEDIN_CLIENT_SECRET", "XAI_API_KEY"]) {
    if (process.env[k]) throw new Error(`Refusing to run E2E tests with ${k} set.`);
  }

  fs.rmSync(E2E_DATA, { recursive: true, force: true });
  fs.mkdirSync(E2E_DATA, { recursive: true });
  const linkFile = path.join(E2E_DATA, "setup-link.txt");
  const out = execFileSync(process.execPath, [path.join(root, "scripts/studio-setup-link.mjs"), "--hash-only", "--hours", "2", "--out", linkFile], {
    env: { PATH: process.env.PATH ?? "", STUDIO_HOST: `localhost:${E2E_PORT}` } as unknown as NodeJS.ProcessEnv,
  }).toString();
  const hash = /token_hash ([0-9a-f]{64})/.exec(out)?.[1];
  if (!hash) throw new Error("The setup-link script didn't print a hash.");
  fs.writeFileSync(
    path.join(E2E_DATA, "li_access_setup_tokens.json"),
    JSON.stringify([{ id: crypto.randomUUID(), created_at: new Date().toISOString(), token_hash: hash, expires_at: new Date(Date.now() + 2 * 3_600_000).toISOString(), used_at: null }]),
  );
}
