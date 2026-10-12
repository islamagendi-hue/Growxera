import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { E2E_DATA } from "../playwright.config";

/**
 * The owner's main journeys in a real browser: first sign-in with the setup link, every studio
 * screen, writing → review → approval, the publishing switches, calendar, activity, backup,
 * settings, and a phone-sized screen. Runs against the local store; nothing leaves the machine.
 */

// RFC 6238 (SHA-1, 30 s, 6 digits), for the authenticator code.
function totp(secret: string, at = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/[\s=]/g, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac("sha1", key).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

const PASSWORD = "a long e2e test password";
const POST = `E2E post ${Date.now()}: what unit economics tell you before revenue does`;
const inThreeDays = () => {
  const d = new Date(Date.now() + 3 * 86_400_000 + 3 * 3_600_000); // shift to Riyadh wall time
  return `${d.toISOString().slice(0, 10)}T10:00`;
};

test.describe.configure({ mode: "serial" });

let context: BrowserContext;
/** The studio's own success notice (not the backup reminder, not Next's route announcer). */
const notice = (text: string) => page.locator("p[role=status]").filter({ hasText: text });
let page: Page;
let postUrl = "";

/** Browser console errors and uncaught exceptions seen on any studio page. */
const consoleErrors: string[] = [];

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(`${page.url()}: ${m.text()}`));
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()}: ${e.message}`));
});
test.afterAll(async () => context.close());

test("signed out, the studio sends you to sign-in", async () => {
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/access$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("first sign-in with the one-time setup link (token stays out of the URL)", async () => {
  const link = fs.readFileSync(path.join(E2E_DATA, "setup-link.txt"), "utf8").trim().replace(/^https:/, "http:");
  const token = link.split("#token=")[1];
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.goto(link);
  await expect(page.getByText("1. Scan this with your authenticator app")).toBeVisible();
  expect(page.url()).not.toContain(token);
  const secret = (await page.locator("code").innerText()).replace(/\s/g, "");
  await page.getByLabel(/^Password \(at least/).fill(PASSWORD);
  await page.getByLabel("Password again").fill(PASSWORD);
  await page.getByLabel("6-digit code now shown in the app").fill(totp(secret));
  await page.getByRole("button", { name: "Save and sign in" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  // Request URLs never include the #fragment, so the token is in none of them.
  expect(urls.filter((u) => u.includes(token))).toEqual([]);
});

test("dashboard shows publishing controls OFF and an empty studio", async () => {
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  const controls = page.getByRole("region", { name: "Publishing controls" });
  await expect(controls.getByText("All publishing")).toBeVisible();
  await expect(controls.getByText("Nothing can be posted, manually or automatically.")).toBeVisible();
  await expect(controls.getByText("Not allowed for this deployment (owner-approved setting needed).")).toBeVisible();
  await expect(page.getByText("Nothing needs you right now.")).toBeVisible();
});

test("every screen opens from the navigation", async () => {
  const screens: [string, string][] = [
    ["Posts", "Posts"],
    ["Calendar", "Calendar"],
    ["New post", "New post"],
    ["Topics", "Topics"],
    ["Activity", "Activity"],
    ["Integrations", "Integrations and capabilities"],
    ["Import", "Import"],
    ["Backup", "Backup"],
    ["Settings", "Settings"],
    ["Dashboard", "Dashboard"],
  ];
  const nav = page.getByRole("navigation", { name: "Studio" });
  for (const [link, heading] of screens) {
    await nav.getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(nav.getByRole("link", { name: link, exact: true })).toHaveAttribute("aria-current", "page");
  }
});

test("settings: local store, this device's session, fixed safety rules", async () => {
  await page.goto("/studio/settings");
  await expect(page.getByText(/Local development store/)).toBeVisible();
  await expect(page.getByText("This device")).toBeVisible();
  await expect(page.getByText(/sent only between 60 and 10 seconds before its planned time/)).toBeVisible();
});

test("a post with a past time is refused and the text is kept", async () => {
  await page.goto("/studio/new");
  await page.getByLabel("Post text").fill("Too late");
  await page.getByLabel("Planned time (Riyadh), optional").fill("2020-01-01T10:00");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.locator("p[role=alert]").filter({ hasText: "already passed" })).toBeVisible();
  await expect(page.getByLabel("Post text")).toHaveValue("Too late");
});

test("write a post, submit it, approve it; nothing can be published", async () => {
  await page.goto("/studio/new");
  await page.getByLabel("Post text").fill(POST);
  await page.getByLabel("Planned time (Riyadh), optional").fill(inThreeDays());
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(notice("Submitted for review.")).toBeVisible();
  postUrl = page.url().replace(/\?.*$/, "");
  const status = page.getByRole("region", { name: "Publishing status" });
  await expect(status).toContainText('It is "ready for review", not approved.');

  await page.getByRole("button", { name: "Approve version 1" }).click();
  await expect(status).toContainText("Version 1 approved");
  await expect(status).toContainText("covers the current version");
  await expect(status).toContainText("All publishing is switched OFF.");
  await expect(status).toContainText("LinkedIn isn't connected.");
  await expect(status).toContainText("Not confirmed for automatic publishing");
  await expect(page.getByRole("button", { name: "Publish now" })).toHaveCount(0);
});

test("editing after approval voids the approval", async () => {
  await page.goto(postUrl);
  const text = page.locator("textarea[name=text]");
  await text.fill(`${POST} (edited)`);
  await page.getByRole("button", { name: /^Save/ }).first().click();
  await expect(notice("Any earlier approval no longer applies.")).toBeVisible();
  const status = page.getByRole("region", { name: "Publishing status" });
  await expect(status).toContainText("doesn't cover the current version");
  await page.getByRole("button", { name: "Approve version 2" }).click();
  await expect(status).toContainText("Version 2 approved");
});

test("confirming a post for automatic publishing says it won't go out while the switches are OFF", async () => {
  await page.goto(postUrl);
  await page.getByLabel(/Publish version 2 automatically/).check();
  await page.getByRole("button", { name: "Schedule for automatic publishing" }).click();
  await expect(notice("only while both all publishing and automatic publishing are ON")).toBeVisible();
  await expect(page.locator("#auto")).toContainText("It won't go out while all publishing and automatic publishing are OFF.");
  await page.getByRole("button", { name: "Cancel automatic publishing" }).click();
  await expect(notice("Automatic publishing cancelled.")).toBeVisible();
});

test("a post gets a house-style design: preview, then attach as a new version", async () => {
  await page.goto(postUrl);
  const preview = page.getByRole("img", { name: "Design preview" });
  await expect(preview).toBeVisible();
  const res = await page.request.get((await preview.getAttribute("src"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
  const design = page.getByRole("region", { name: "Design" });
  await design.getByLabel("Small heading").fill("Behind the Number · Issue 2");
  await design.getByLabel("Format").selectOption("portrait");
  await design.getByRole("button", { name: "Attach to post" }).click();
  await expect(notice("Design attached as a new version.")).toBeVisible();
  await expect(page.getByText("uploaded in the studio")).toBeVisible();
  const status = page.getByRole("region", { name: "Publishing status" });
  await expect(status).toContainText("doesn't cover the current version");
  await page.getByRole("button", { name: "Approve version 3" }).click();
  await expect(status).toContainText("Version 3 approved");
  // Not for anyone else.
  const anon = await page.context().browser()!.newContext();
  expect((await anon.request.get(`http://localhost:3210${await preview.getAttribute("src")}`, { maxRedirects: 0 })).status()).not.toBe(200);
  await anon.close();
});

test("topics: add, refuse a duplicate, remove; Grok off says why and can't be used", async () => {
  await page.goto("/studio/topics");
  await expect(page.getByRole("region", { name: "Grok" })).toContainText("Off: drafts can't be written yet. Missing settings: XAI_API_KEY");
  await expect(page.getByRole("button", { name: "Write it now with Grok" })).toBeDisabled();
  const topic = `Why CAC payback beats ROAS ${Date.now()}`;
  await page.getByLabel("Topic", { exact: true }).fill(topic);
  await page.getByLabel("Format").selectOption("newsletter");
  await page.getByRole("button", { name: "Add to list" }).click();
  await expect(notice("Topic added.")).toBeVisible();
  const item = page.getByRole("listitem").filter({ hasText: topic });
  await expect(item).toContainText("Newsletter");
  await expect(item.getByRole("button", { name: "Write" })).toBeDisabled();
  await page.getByLabel("Topic", { exact: true }).fill(topic.toLowerCase());
  await page.getByRole("button", { name: "Add to list" }).click();
  await expect(page.locator("p[role=alert]").filter({ hasText: "already on the list" })).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: topic }).getByRole("button", { name: "Remove" }).click();
  await expect(notice("Topic removed.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: topic })).toHaveCount(0);
});

test("the dashboard shows what works on the account", async () => {
  await page.goto("/studio");
  await expect(page.getByRole("region", { name: "What works on your account" })).toBeVisible();
});

test("drafts are saved, then submitted for review", async () => {
  await page.goto("/studio/new");
  await page.getByLabel("Post text").fill(`Draft idea ${Date.now()}`);
  await page.getByRole("button", { name: "Save as draft" }).click();
  await expect(page.getByRole("heading", { name: "Draft" })).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(notice("Submitted for review.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
});

test("a post with an uploaded image: stored privately, served only to the owner", async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 1, 2, 3, Date.now() % 255]);
  await page.goto("/studio/new");
  await page.getByLabel("Post text").fill(`Post with an image ${Date.now()}`);
  await page.getByLabel(/One image \(PNG/).setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(notice("Submitted for review.")).toBeVisible();
  await expect(page.getByText("uploaded in the studio")).toBeVisible();
  const href = await page.getByRole("link", { name: "secured copy" }).getAttribute("href");
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  expect(Buffer.from(await res.body())).toEqual(png);
  // Not for anyone else.
  const anon = await page.context().browser()!.newContext();
  expect((await anon.request.get(`http://localhost:3210${href}`, { maxRedirects: 0 })).status()).not.toBe(200);
  await anon.close();
});

test("a disguised file is refused and nothing is saved", async () => {
  await page.goto("/studio/new");
  await page.getByLabel("Post text").fill("Disguised file");
  await page.getByLabel(/One image \(PNG/).setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") });
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.locator("p[role=alert]").filter({ hasText: "Only PNG, JPEG, GIF, WebP images and PDF documents" })).toBeVisible();
  await expect(page.getByLabel("Post text")).toHaveValue("Disguised file");
});

test("the all-publishing switch: ON needs confirmation, OFF works at once, both are logged", async () => {
  await page.goto("/studio/capabilities");
  await page.getByLabel(/Allow publishing to my LinkedIn/).check();
  await page.getByRole("button", { name: "Switch ON" }).first().click();
  await expect(notice("All publishing is ON")).toBeVisible();
  await page.goto("/studio");
  await expect(page.getByText("Posts can go out after their own approval and confirmation.")).toBeVisible();
  await page.goto("/studio/capabilities");
  await page.getByRole("button", { name: "Switch all publishing OFF" }).click();
  await expect(notice("All publishing is OFF")).toBeVisible();
  await page.goto("/studio/activity?category=controls");
  await expect(page.getByText("All publishing switched ON")).toBeVisible();
  await expect(page.getByText("All publishing switched OFF")).toBeVisible();
});

test("the post appears on the dashboard, calendar, posts search and activity", async () => {
  await page.goto("/studio");
  await expect(page.getByRole("region", { name: /Next 14 days/ })).toContainText("E2E post");
  await page.goto("/studio/calendar");
  await expect(page.locator(".md\\:block").getByText(/E2E post/).first()).toBeVisible();
  await page.goto(`/studio/queue?q=${encodeURIComponent("unit economics")}`);
  await expect(page.getByRole("listitem").filter({ hasText: "E2E post" })).toHaveCount(1);
  await page.goto("/studio/queue?filter=awaiting_confirmation");
  await expect(page.getByText(/E2E post/)).toBeVisible();
  await page.goto("/studio/activity");
  await expect(page.getByText("Approved this exact version").first()).toBeVisible();
  await expect(page.getByText("Post created").first()).toBeVisible();
});

test("calendar: month navigation, today link, and a bad month falls back to this month", async () => {
  await page.goto("/studio/calendar");
  const month = page.getByRole("navigation", { name: "Month" });
  const current = await month.locator("span").innerText();
  await month.getByRole("link", { name: /Next/ }).click();
  await expect(month.locator("span")).not.toHaveText(current);
  await month.getByRole("link", { name: "Today" }).click();
  await expect(month.locator("span")).toHaveText(current);
  await page.goto("/studio/calendar?month=2026-13");
  await expect(month.locator("span")).toHaveText(current);
});

test("activity: category and problems-only filters", async () => {
  await page.goto("/studio/activity");
  await page.getByRole("link", { name: "Approvals", exact: true }).click();
  await expect(page).toHaveURL(/category=approvals/);
  await expect(page.getByText("Approved this exact version").first()).toBeVisible();
  await expect(page.getByText("Post created")).toHaveCount(0);
  await page.getByRole("link", { name: "Problems only" }).click();
  await expect(page.getByText(/No matching activity/)).toBeVisible();
});

test("backup downloads a valid export without secrets", async () => {
  await page.goto("/studio/export");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Download export/ }).click()]);
  const file = JSON.parse(fs.readFileSync((await download.path())!, "utf8"));
  expect(file.format).toBeTruthy();
  expect(file.tables.li_actions.count).toBeGreaterThanOrEqual(3);
  // No exported row carries a secret field (their names are only listed under dropped_columns).
  const rowKeys = new Set(Object.values(file.tables as Record<string, { rows: Record<string, unknown>[] }>).flatMap((t) => t.rows.flatMap((r) => Object.keys(r))));
  for (const secret of ["password_hash", "totp_secret_enc", "token_hash", "access_token_enc", "client_secret_enc"]) expect(rowKeys.has(secret), secret).toBe(false);
  expect(file.dropped_columns.li_linkedin_connection).toEqual(["access_token_enc"]);
  expect(file).not.toHaveProperty("tables.li_access_credentials");
});

test("a link from another site can't take a backup or start a LinkedIn connection, even signed in", async () => {
  for (const url of ["/studio/export/download", "/studio/linkedin/connect"]) {
    const res = await page.request.get(url, { headers: { "sec-fetch-site": "cross-site" }, maxRedirects: 0 });
    expect(res.status(), url).toBe(404);
  }
  // The same request started on the studio still works.
  expect((await page.request.get("/studio/export/download", { headers: { "sec-fetch-site": "same-origin" } })).status()).toBe(200);
});

test("on a phone-sized screen the studio fits and the calendar becomes a list", async ({ browser }) => {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await context.storageState() });
  const p = await phone.newPage();
  for (const url of ["/studio", "/studio/queue", "/studio/calendar", "/studio/new", "/studio/activity", "/studio/capabilities", "/studio/import", "/studio/export", "/studio/settings", postUrl]) {
    await p.goto(url);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, url).toBeLessThanOrEqual(1);
  }
  await p.goto("/studio/calendar");
  await expect(p.locator("ol.md\\:hidden").getByText(/E2E post/)).toBeVisible();
  await phone.close();
});

test("screenshots for visual review (only with E2E_SCREENSHOTS=<folder>)", async ({ browser }) => {
  const dir = process.env.E2E_SCREENSHOTS;
  test.skip(!dir, "Set E2E_SCREENSHOTS to a folder to save screenshots.");
  for (const [name, viewport] of [["desktop", { width: 1440, height: 1000 }], ["phone", { width: 390, height: 844 }]] as const) {
    const ctx = await browser.newContext({ viewport, storageState: await context.storageState() });
    const p = await ctx.newPage();
    for (const [slug, url] of [["dashboard", "/studio"], ["posts", "/studio/queue"], ["post", postUrl], ["calendar", "/studio/calendar"], ["new", "/studio/new"], ["activity", "/studio/activity"], ["settings", "/studio/settings"], ["integrations", "/studio/capabilities"], ["import", "/studio/import"], ["backup", "/studio/export"], ["queue-filter", "/studio/queue?filter=attention"], ["empty-search", "/studio/queue?q=nothing-matches-this"]]) {
      await p.goto(url);
      await p.screenshot({ path: path.join(dir!, `${name}-${slug}.png`), fullPage: true });
    }
    await ctx.close();
  }
});

test("signed out: every studio page redirects to sign-in and every studio route is a 404", async ({ browser }) => {
  const anon = await browser.newContext();
  const p = await anon.newPage();
  for (const url of ["/studio", "/studio/queue", "/studio/new", "/studio/calendar", "/studio/activity", "/studio/settings", "/studio/capabilities", "/studio/import", "/studio/export", postUrl]) {
    await p.goto(url);
    await expect(p, url).toHaveURL(/\/access$/);
  }
  for (const url of ["/studio/export/download", "/studio/linkedin/connect", `/studio/assets/${crypto.randomUUID()}`]) {
    expect((await anon.request.get(url, { maxRedirects: 0 })).status(), url).toBe(404);
  }
  await anon.close();
});

test("a page that can't read its data shows a recoverable error without internal details", async () => {
  const file = path.join(E2E_DATA, "li_actions.json");
  const original = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, "{ not json");
  try {
    await page.goto("/studio");
    const box = page.locator("div[role=alert]").filter({ has: page.getByRole("heading", { name: "This page couldn't load" }) });
    await expect(box).toBeVisible();
    // The studio's message has no internal details (Next's own dev overlay shows them only in development).
    await expect(box).not.toContainText(/JSON|SyntaxError|li_actions/);
  } finally {
    fs.writeFileSync(file, original);
  }
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  // The error above is expected; don't count it as a browser error.
  consoleErrors.length = 0;
});

test("no browser errors on any page visited", async () => {
  expect(consoleErrors).toEqual([]);
});

test("sign out ends the session", async () => {
  await page.goto("/studio");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/access$/);
  await page.goto("/studio");
  await expect(page).toHaveURL(/\/access$/);
});
