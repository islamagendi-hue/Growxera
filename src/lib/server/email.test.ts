import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildReport } from "@/lib/diagnostic/engine";
import { sanitizeAnswers } from "@/lib/diagnostic/questions";
import { reportEmail, sendReportEmail } from "./email";

const { answers } = sanitizeAnswers({
  businessModel: "ecommerce",
  industry: "retail_ecommerce",
  primaryMarket: "SA",
  businessAge: "3to5",
  monthlyRevenue: 500000,
  monthlyCustomers: 2500,
});

describe("report email", () => {
  const report = buildReport(answers);

  it("includes the score, stage and bottleneck", () => {
    const { subject, html, text } = reportEmail("Sara Ahmed", report);
    expect(subject).toContain(`${report.overallScore}/100`);
    expect(html).toContain("Hi Sara,");
    expect(html).toContain(report.stage.label);
    expect(text).toContain("Primary bottleneck");
  });

  it("links the button to the shareable report page", () => {
    const { html, text } = reportEmail("Sara", report, "0b5e3c1a-2f4d-4e6b-8a9c-1d2e3f4a5b6c");
    expect(html).toContain("/report/0b5e3c1a-2f4d-4e6b-8a9c-1d2e3f4a5b6c");
    expect(text).toContain("/report/0b5e3c1a-2f4d-4e6b-8a9c-1d2e3f4a5b6c");
  });

  it("escapes the name", () => {
    const { html } = reportEmail("<script>alert(1)</script>", report);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("does nothing without an API key", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await sendReportEmail("a@b.co", "A", report)).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends through Resend when configured", async () => {
    process.env.RESEND_API_KEY = "test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await sendReportEmail("a@b.co", "A", report)).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(init?.body)).to).toEqual(["a@b.co"]);
    delete process.env.RESEND_API_KEY;
  });
});
