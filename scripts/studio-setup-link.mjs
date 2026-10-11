#!/usr/bin/env node
/**
 * Creates a one-time studio setup link so the owner can choose the password and pair the
 * authenticator at https://<STUDIO_HOST>/access/setup#token=…. Only the token's SHA-256 is stored.
 * The token is in the #fragment, which browsers never send to the server (src/lib/studio/setup-link.ts).
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/studio-setup-link.mjs --confirm [--hours 2] [--out FILE]
 *
 * --hours  validity, 1 to 24 (default 24).
 * --out    write the link to FILE (created with owner-only permissions) instead of printing it;
 *          only the token's SHA-256 is printed, so the link stays out of terminals and logs.
 * --hash-only  with --out: don't touch any database. Writes the link file and prints only the
 *          SHA-256, which an operator then inserts (token_hash, expires_at = now() + the hours).
 *
 * Writes one row to li_access_setup_tokens in the database those variables point to. Against
 * production this is an owner-approved action (docs/studio/APPROVAL_GATES.md). The printed link
 * is a secret: give it only to the owner, never paste it into logs, issues or commits.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const clean = (v) => v?.trim().replace(/^["']|["']$/g, "").trim() || undefined;
const url = clean(process.env.SUPABASE_URL)?.replace(/\/$/, "");
const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const host = (clean(process.env.STUDIO_HOST) || "agent.growxera.com").toLowerCase();
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const hours = Number(arg("--hours") ?? 24);
const out = arg("--out");
if (out && existsSync(out)) {
  console.error(`${out} already exists. Delete it or choose another file.`);
  process.exit(2);
}
if (!Number.isInteger(hours) || hours < 1 || hours > 24) {
  console.error("--hours must be a whole number from 1 to 24.");
  process.exit(2);
}

const hashOnly = process.argv.includes("--hash-only");
if (hashOnly && !out) {
  console.error("--hash-only needs --out FILE.");
  process.exit(2);
}
if (!hashOnly && !process.argv.includes("--confirm")) {
  console.error("Refusing to run without --confirm. This writes a setup token to the database at SUPABASE_URL.");
  process.exit(2);
}
if (!hashOnly && (!url || !key)) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(2);
}

const token = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(token).digest("hex");
if (!hashOnly) {
  const res = await fetch(`${url}/rest/v1/li_access_setup_tokens`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ token_hash: hash, expires_at: new Date(Date.now() + hours * 3_600_000).toISOString() }),
  });
  if (!res.ok) {
    console.error(`Failed: ${res.status}. Is migration 20261014000000_studio_access.sql applied?`);
    process.exit(1);
  }
}
const link = `https://${host}/access/setup#token=${token}`;
if (out) {
  writeFileSync(out, `${link}\n`, { mode: 0o600, flag: "wx" });
  console.log(
    hashOnly
      ? `Setup link written to ${out}. Nothing stored yet: insert token_hash ${hash} with expires_at = now() + ${hours} h.`
      : `Setup link written to ${out} (valid ${hours} h, works once). Token SHA-256: ${hash}`,
  );
} else {
  console.log(`One-time setup link (valid ${hours} h, works once):\n${link}`);
}
