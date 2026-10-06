import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildReport } from "@/lib/diagnostic/engine";
import { sanitizeAnswers } from "@/lib/diagnostic/questions";
import { bookingConfirmationEmail, noAccountEmail, reportReadyEmail, sendEmail, signInEmail, specialistTeamEmail } from "./email";

const { answers } = sanitizeAnswers({
  industry: "ecommerce",
  segment: "b2c",
  businessType: "d2c_brand",
  category: "perfume",
  geography: "SA",
  city: "riyadh",
  businessAge: "3to5",
  monthlyRevenue: 500000,
  monthlyNewCustomers: 900,
  monthlyOrders: 2500,
});
const report = buildReport(answers);
const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.RESEND_API_KEY;
});

describe("report ready email", () => {
  it("leads with View report and links to the one-time sign-in link", () => {
    const { subject, html, text } = reportReadyEmail("Sara Ahmed", report, TOKEN, 2880);
    expect(subject).toContain("report is ready");
    expect(html).toContain("Hi Sara,");
    expect(html).toContain("View report");
    expect(html).not.toMatch(/download/i);
    expect(html).toContain(`/auth/verify?token=${TOKEN}`);
    expect(text).toContain(`/auth/verify?token=${TOKEN}`);
    expect(text).toContain("48 hours");
  });

  it("escapes the name", () => {
    const { html } = reportReadyEmail("<script>alert(1)</script>", report, TOKEN, 60);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("sign-in emails", () => {
  it("login link says it is single use and when it expires", () => {
    const { subject, text } = signInEmail("Sara", TOKEN, 20, false);
    expect(subject).toBe("Your secure Growx Era login link");
    expect(text).toContain("works once and expires in 20 minutes");
  });
  it("the no-account email carries no token", () => {
    const { html, text } = noAccountEmail();
    expect(html).not.toContain("token=");
    expect(text).toContain("/signup");
  });
});

describe("specialist emails", () => {
  it("booking confirmation names the Riyadh time", () => {
    const { subject } = bookingConfirmationEmail({ name: "Sara", company: "Oud Co", slotStart: "2026-10-10T16:00:00.000Z" });
    expect(subject).toContain("19:00 (Riyadh time)");
  });
  it("team email carries the diagnostic context for the specialist", () => {
    const { text } = specialistTeamEmail({ kind: "question", name: "Sara", email: "s@x.co", company: "Oud Co", message: "Hi", report });
    expect(text).toContain(`Growth Score: ${report.overallScore}/100`);
    expect(text).toContain("Perfumes & fragrance");
  });
});

describe("sending", () => {
  it("sends through Resend when configured, with scheduling for reminders", async () => {
    process.env.RESEND_API_KEY = "test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await sendEmail("a@b.co", noAccountEmail(), { scheduledAt: "2026-10-10T13:00:00.000Z" })).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init?.body));
    expect(body.to).toEqual(["a@b.co"]);
    expect(body.scheduled_at).toBe("2026-10-10T13:00:00.000Z");
  });

  it("never calls the provider without an API key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await sendEmail("a@b.co", noAccountEmail());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
