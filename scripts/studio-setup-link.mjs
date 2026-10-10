#!/usr/bin/env node
/**
 * Creates a one-time studio setup link (24 h) so the owner can choose the password and pair the
 * authenticator at https://<STUDIO_HOST>/access/setup. Only the link's SHA-256 is stored.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/studio-setup-link.mjs --confirm
 *
 * Writes one row to li_access_setup_tokens in the database those variables point to. Against
 * production this is an owner-approved action (docs/studio/APPROVAL_GATES.md). The printed link
 * is a secret: give it only to the owner, never paste it into logs, issues or commits.
 */
import { createHash, randomBytes } from "node:crypto";

const clean = (v) => v?.trim().replace(/^["']|["']$/g, "").trim() || undefined;
const url = clean(process.env.SUPABASE_URL)?.replace(/\/$/, "");
const key = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const host = (clean(process.env.STUDIO_HOST) || "agent.growxera.com").toLowerCase();

if (!process.argv.includes("--confirm")) {
  console.error("Refusing to run without --confirm. This writes a setup token to the database at SUPABASE_URL.");
  process.exit(2);
}
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(2);
}

const token = randomBytes(32).toString("base64url");
const res = await fetch(`${url}/rest/v1/li_access_setup_tokens`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
  body: JSON.stringify({
    token_hash: createHash("sha256").update(token).digest("hex"),
    expires_at: new Date(Date.now() + 24 * 3_600_000).toISOString(),
  }),
});
if (!res.ok) {
  console.error(`Failed: ${res.status}. Is migration 20261014000000_studio_access.sql applied?`);
  process.exit(1);
}
console.log(`One-time setup link (valid 24 hours, works once):\nhttps://${host}/access/setup?token=${token}`);
