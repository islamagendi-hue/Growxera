import "server-only";
/**
 * Direct publishing to the owner's personal LinkedIn profile through LinkedIn's official,
 * self-serve "Share on LinkedIn" product (OAuth scopes: openid profile w_member_social).
 *
 * - Connection: the owner authorizes once at /studio/capabilities. LinkedIn issues a
 *   60-day access token and, for self-serve apps, no refresh token, so the owner
 *   reconnects before it expires (the studio warns 7 days ahead).
 * - The token is stored encrypted (AES-256-GCM, key derived from the client secret).
 * - Nothing here decides what to publish. publish.ts calls postToLinkedIn() only for an
 *   approved item whose approval still matches its content.
 *
 * App keys: env LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET, or entered on the Capabilities
 * page (stored encrypted, see saveAppKeys).
 * Optional env: LINKEDIN_REDIRECT_URI (default <studio origin>/studio/linkedin/callback),
 *           LINKEDIN_API_VERSION (YYYYMM, sent as the LinkedIn-Version header).
 */
import { eq, insert, selectAll, update } from "@/lib/server/store";
import { open, seal, serverSecret } from "./crypto";
import { STUDIO_ORIGIN } from "./host";
import { PUBLISHING_OFF, publishingSwitch } from "./switch";

const clean = (v?: string) => v?.trim().replace(/^["']|["']$/g, "").trim() || undefined;

export const SCOPES = ["openid", "profile", "w_member_social"];
const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const API = "https://api.linkedin.com";
export const EXPIRY_WARNING_DAYS = 7;
export const OAUTH_STATE_COOKIE = "gx_li_oauth_state";

export interface LinkedInConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiVersion: string;
}

export function redirectUri(): string {
  return clean(process.env.LINKEDIN_REDIRECT_URI) ?? `${STUDIO_ORIGIN}/studio/linkedin/callback`;
}

export const encryptToken = (token: string, clientSecret: string) => seal(token, clientSecret, "linkedin-access-token");
/** Null when the value can't be decrypted (for example the client secret was changed). */
export const decryptToken = (value: string, clientSecret: string) => open(value, clientSecret, "linkedin-access-token");

// ── App keys (Client ID / Client Secret) ────────────────────────────────────
// From the env (LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET) or, if those aren't set, entered
// by the owner on the Capabilities page. The stored secret is encrypted with a key derived
// from SUPABASE_SERVICE_ROLE_KEY, which is only in the deployment's env.

interface AppKeysRow {
  id: string;
  created_at: string;
  client_id: string;
  client_secret_enc: string;
}

const appKeysSecret = serverSecret;

export const isValidClientId = (v: string) => /^[A-Za-z0-9]{8,64}$/.test(v);
export const isValidClientSecret = (v: string) => /^[\x21-\x7e]{8,256}$/.test(v);

/** Saves app keys entered in the studio. The newest entry is used. */
export async function saveAppKeys(clientId: string, clientSecret: string): Promise<void> {
  const secret = appKeysSecret();
  if (!secret) throw new Error("Storage isn't configured.");
  await insert("li_linkedin_app", {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    client_id: clientId,
    client_secret_enc: seal(clientSecret, secret, "linkedin-client-secret"),
  });
}

export type KeysSource = "env" | "studio";

/** The config (and where its keys came from), or what is still missing. */
export async function linkedInConfig(): Promise<{ config: LinkedInConfig | null; missing: string[]; source: KeysSource | null }> {
  const apiVersion = clean(process.env.LINKEDIN_API_VERSION) ?? "202606";
  const envId = clean(process.env.LINKEDIN_CLIENT_ID);
  const envSecret = clean(process.env.LINKEDIN_CLIENT_SECRET);
  if (envId && envSecret) return { config: { clientId: envId, clientSecret: envSecret, redirectUri: redirectUri(), apiVersion }, missing: [], source: "env" };
  const secret = appKeysSecret();
  if (secret) {
    try {
      const rows = await selectAll<AppKeysRow>("li_linkedin_app", [], { order: { col: "created_at", ascending: false } });
      const latest = rows[0];
      const clientSecret = latest ? open(latest.client_secret_enc, secret, "linkedin-client-secret") : null;
      if (latest && clientSecret) return { config: { clientId: latest.client_id, clientSecret, redirectUri: redirectUri(), apiVersion }, missing: [], source: "studio" };
    } catch {
      // Table not there yet (migration not applied): treated as not configured.
    }
  }
  return { config: null, missing: ["LinkedIn Client ID and Client Secret"], source: null };
}

// ── Connection state ────────────────────────────────────────────────────────

export interface ConnectionRow {
  id: string;
  created_at: string;
  member_urn: string;
  member_name: string | null;
  scopes: string;
  access_token_enc: string | null;
  expires_at: string;
  revoked_at: string | null;
}

export type ConnectionState =
  | { state: "not_configured"; missing: string[] }
  | { state: "not_connected" }
  | { state: "expired" | "unreadable"; row: ConnectionRow }
  | { state: "connected"; row: ConnectionRow; daysLeft: number; expiringSoon: boolean; canPost: boolean };

async function latestConnection(): Promise<ConnectionRow | null> {
  const rows = await selectAll<ConnectionRow>("li_linkedin_connection", [], { order: { col: "created_at", ascending: false } });
  return rows.find((r) => !r.revoked_at) ?? null;
}

export async function connectionState(now = new Date()): Promise<ConnectionState> {
  const { config, missing } = await linkedInConfig();
  if (!config) return { state: "not_configured", missing };
  let row: ConnectionRow | null;
  try {
    row = await latestConnection();
  } catch {
    // The table doesn't exist yet: the env is set but the migration hasn't been applied.
    return { state: "not_configured", missing: ["database migration 20261012000000_linkedin_publishing.sql"] };
  }
  if (!row?.access_token_enc) return { state: "not_connected" };
  if (new Date(row.expires_at).getTime() <= now.getTime()) return { state: "expired", row };
  if (!decryptToken(row.access_token_enc, config.clientSecret)) return { state: "unreadable", row };
  const daysLeft = Math.floor((new Date(row.expires_at).getTime() - now.getTime()) / 86_400_000);
  return {
    state: "connected",
    row,
    daysLeft,
    expiringSoon: daysLeft < EXPIRY_WARNING_DAYS,
    canPost: row.scopes.split(/[\s,]+/).includes("w_member_social"),
  };
}

/** Token and author for posting, or a reason it can't post right now. */
export async function postingCredentials(now = new Date()): Promise<{ token: string; author: string; apiVersion: string } | { error: string }> {
  const { config } = await linkedInConfig();
  const s = await connectionState(now);
  if (s.state !== "connected" || !config) {
    const why: Record<ConnectionState["state"], string> = {
      not_configured: "LinkedIn isn't set up for this deployment.",
      not_connected: "LinkedIn isn't connected.",
      expired: "The LinkedIn connection expired. Reconnect it on the Capabilities page.",
      unreadable: "The saved LinkedIn connection can't be read (the client secret changed?). Reconnect it.",
      connected: "",
    };
    return { error: why[s.state] };
  }
  if (!s.canPost) return { error: "The LinkedIn connection doesn't include posting permission (w_member_social). Reconnect it." };
  return { token: decryptToken(s.row.access_token_enc!, config.clientSecret)!, author: s.row.member_urn, apiVersion: config.apiVersion };
}

export async function saveConnection(input: { memberUrn: string; memberName: string | null; scopes: string; accessToken: string; expiresIn: number }) {
  const { config } = await linkedInConfig();
  if (!config) throw new Error("LinkedIn isn't configured.");
  // Earlier authorizations stop being used; their encrypted token is erased.
  const previous = await selectAll<ConnectionRow>("li_linkedin_connection", [], { columns: "id,revoked_at" });
  for (const p of previous.filter((r) => !r.revoked_at)) {
    await update("li_linkedin_connection", [eq("id", p.id)], { revoked_at: new Date().toISOString(), access_token_enc: null });
  }
  await insert("li_linkedin_connection", {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    member_urn: input.memberUrn,
    member_name: input.memberName,
    scopes: input.scopes,
    access_token_enc: encryptToken(input.accessToken, config.clientSecret),
    expires_at: new Date(Date.now() + input.expiresIn * 1000).toISOString(),
    revoked_at: null,
  });
}

/** Forgets the token in the studio. (Access can also be removed in LinkedIn's settings.) */
export async function disconnect(): Promise<boolean> {
  const row = await latestConnection();
  if (!row) return false;
  await update("li_linkedin_connection", [eq("id", row.id)], { revoked_at: new Date().toISOString(), access_token_enc: null });
  return true;
}

// ── OAuth ───────────────────────────────────────────────────────────────────

export function authorizeUrl(config: LinkedInConfig, state: string): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    scope: SCOPES.join(" "),
  });
  return `${AUTH_URL}?${q}`;
}

export async function exchangeCode(config: LinkedInConfig, code: string): Promise<{ accessToken: string; expiresIn: number; scopes: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; scope?: string; error?: string };
  if (!res.ok || !body.access_token) throw new LinkedInError(`LinkedIn refused the authorization (${res.status}${body.error ? `, ${body.error}` : ""}).`, res.status, true);
  return { accessToken: body.access_token, expiresIn: Number(body.expires_in) || 60 * 86_400, scopes: body.scope ?? SCOPES.join(" ") };
}

/** The member's id and name from the OpenID userinfo endpoint. */
export async function fetchMember(accessToken: string): Promise<{ urn: string; name: string | null }> {
  const res = await fetch(`${API}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { sub?: string; name?: string };
  if (!res.ok || !body.sub || !/^[A-Za-z0-9_-]+$/.test(body.sub)) throw new LinkedInError(`Couldn't read your LinkedIn profile (${res.status}).`, res.status, true);
  return { urn: `urn:li:person:${body.sub}`, name: body.name ?? null };
}

// ── Posting ─────────────────────────────────────────────────────────────────

/**
 * `definite` = LinkedIn answered and nothing was created, so trying again later is safe.
 * Not definite = the outcome is unknown (timeout, network error after the request was sent):
 * the post may exist, so the studio never retries on its own.
 */
/** The submission deadline passed before the post request was sent. Nothing was sent. */
export class WindowMissedError extends Error {}

export class LinkedInError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly definite: boolean,
  ) {
    super(message);
  }
}

/**
 * Post text in LinkedIn's "little text" format. Reserved characters are escaped, otherwise
 * LinkedIn drops or cuts the text after them. #Word becomes a real hashtag.
 */
export function toLittleText(text: string): string {
  const escape = (s: string) => s.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
  const out: string[] = [];
  const re = /(^|\s)#([\p{L}\p{N}]+)/gu;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index! + m[1].length;
    out.push(escape(text.slice(last, start)), `{hashtag|\\#|${m[2]}}`);
    last = start + 1 + m[2].length;
  }
  out.push(escape(text.slice(last)));
  return out.join("");
}

export interface PostMedia {
  kind: "image" | "document";
  bytes: Uint8Array;
  title: string;
}

type Fetch = typeof fetch;

function apiHeaders(token: string, version: string, json = true): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": version,
    "X-Restli-Protocol-Version": "2.0.0",
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function call(f: Fetch, url: string, init: RequestInit, what: string, timeoutMs = 30_000): Promise<Response> {
  let res: Response;
  try {
    res = await f(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    // Only used before the post request: nothing is published yet, so this is definite.
    throw new LinkedInError(`${what}: no answer from LinkedIn. Nothing was posted.`, null, true);
  }
  if (!res.ok) {
    const detail = ((await res.json().catch(() => null)) as { message?: string } | null)?.message;
    throw new LinkedInError(`${what} failed (${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}).`, res.status, true);
  }
  return res;
}

/** Uploads an image or PDF and waits until LinkedIn has processed it. Returns its URN. */
async function uploadMedia(f: Fetch, token: string, author: string, version: string, media: PostMedia): Promise<string> {
  const resource = media.kind === "image" ? "images" : "documents";
  const init = await call(
    f,
    `${API}/rest/${resource}?action=initializeUpload`,
    { method: "POST", headers: apiHeaders(token, version), body: JSON.stringify({ initializeUploadRequest: { owner: author } }) },
    "Preparing the upload",
  );
  const value = ((await init.json()) as { value?: { uploadUrl?: string; image?: string; document?: string } }).value;
  const urn = media.kind === "image" ? value?.image : value?.document;
  if (!value?.uploadUrl || !urn) throw new LinkedInError("LinkedIn didn't return an upload address.", null, true);
  await call(
    f,
    value.uploadUrl,
    { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" }, body: Buffer.from(media.bytes) },
    "Uploading the file",
    60_000,
  );
  // Documents (PDF carousels) are processed asynchronously; images usually are ready at once.
  for (let i = 0; i < 12; i++) {
    const res = await call(f, `${API}/rest/${resource}/${encodeURIComponent(urn)}`, { headers: apiHeaders(token, version, false) }, "Checking the upload");
    const status = ((await res.json()) as { status?: string }).status;
    if (status === "AVAILABLE") return urn;
    if (status === "PROCESSING_FAILED") throw new LinkedInError("LinkedIn couldn't process the file.", null, true);
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new LinkedInError("LinkedIn is still processing the file. Nothing was posted; try again in a few minutes.", null, true);
}

/**
 * Creates a public post on the member's profile. Returns the post URN from LinkedIn's
 * x-restli-id header. Errors before the post request are always `definite`.
 */
export async function postToLinkedIn(
  input: {
    token: string;
    author: string;
    apiVersion: string;
    text: string;
    media: PostMedia | null;
    /** Automatic publishing: never send after submitBy, and cut the request off at cutoffAt (epoch ms). */
    deadline?: { submitBy: number; cutoffAt: number; now: () => number };
  },
  f: Fetch = fetch,
): Promise<{ urn: string; sentCommentary: string }> {
  // Second check of the all-publishing switch (the first is in publishAction): before any upload,
  // and again right before the post request, so switching OFF stops even a run already under way.
  const stopIfOff = async () => {
    if (!(await publishingSwitch()).enabled) throw new LinkedInError(PUBLISHING_OFF, null, true);
  };
  await stopIfOff();
  const mediaUrn = input.media ? await uploadMedia(f, input.token, input.author, input.apiVersion, input.media) : null;
  const commentary = toLittleText(input.text);
  const body: Record<string, unknown> = {
    author: input.author,
    commentary,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (mediaUrn) body.content = { media: input.media!.kind === "document" ? { id: mediaUrn, title: input.media!.title } : { id: mediaUrn } };

  await stopIfOff();
  const dl = input.deadline;
  if (dl && dl.now() > dl.submitBy) throw new WindowMissedError("The submission deadline passed before the post was sent.");
  const timeoutMs = dl ? Math.max(1, Math.min(30_000, dl.cutoffAt - dl.now())) : 30_000;
  let res: Response;
  try {
    res = await f(`${API}/rest/posts`, {
      method: "POST",
      headers: apiHeaders(input.token, input.apiVersion),
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new LinkedInError("No answer from LinkedIn after sending the post. It may or may not have been published.", null, false);
  }
  if (!res.ok) {
    const detail = ((await res.json().catch(() => null)) as { message?: string } | null)?.message;
    // A 5xx after sending is ambiguous; a 4xx means LinkedIn rejected it.
    throw new LinkedInError(`LinkedIn rejected the post (${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}).`, res.status, res.status < 500);
  }
  const urn = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id");
  if (!urn || !/^urn:li:(share|ugcPost):\d+$/.test(urn)) {
    throw new LinkedInError("LinkedIn accepted the post but didn't return its id. Check your profile.", res.status, false);
  }
  return { urn, sentCommentary: commentary };
}

/**
 * Reads the post back. Self-serve apps may not be allowed to read posts (r_member_social is
 * restricted); then this returns null and the owner verifies by opening the link.
 */
export async function readBackPost(input: { token: string; apiVersion: string; urn: string }, f: Fetch = fetch): Promise<{ commentary: string } | null> {
  try {
    const res = await f(`${API}/rest/posts/${encodeURIComponent(input.urn)}`, {
      headers: apiHeaders(input.token, input.apiVersion, false),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { commentary?: string };
    return typeof body.commentary === "string" ? { commentary: body.commentary } : null;
  } catch {
    return null;
  }
}

export const postUrl = (urn: string) => `https://www.linkedin.com/feed/update/${urn}/`;
