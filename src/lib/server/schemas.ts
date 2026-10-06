import "server-only";
import { z } from "zod";
import { ANALYTICS_EVENTS, ATTRIBUTION_KEYS } from "@/lib/analytics/events";

const attributionShape = Object.fromEntries(ATTRIBUTION_KEYS.map((k) => [k, z.string().max(500).optional()])) as Record<
  (typeof ATTRIBUTION_KEYS)[number],
  z.ZodOptional<z.ZodString>
>;
export const attributionSchema = z.object(attributionShape).partial().strip();

export const attributionContextSchema = z
  .object({ first: attributionSchema.optional(), last: attributionSchema.optional() })
  .default({});

export const diagnosticRequestSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  upload: z.unknown().optional(),
  anonymousId: z.string().uuid().optional(),
  attribution: attributionContextSchema,
});

const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^\+?[0-9\s()-]{7,}$/, "Enter a valid phone number, including country code.");

export const leadSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid work email.").max(200),
  company: z.string().trim().min(1, "Enter your company.").max(160),
  phone: phone.optional().or(z.literal("")),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  consentProcessing: z.literal(true, { message: "Please agree so we can prepare your report." }),
  consentMarketing: z.boolean().default(false),
});

export const leadRequestSchema = z.object({
  lead: leadSchema,
  source: z.enum(["diagnostic", "contact"]),
  diagnosticSessionId: z.string().uuid().optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
  anonymousId: z.string().uuid().optional(),
  attribution: attributionContextSchema,
  /** Honeypot: humans never fill this. */
  company_url: z.string().max(500).optional(),
});

export const eventSchema = z.object({
  event: z.enum(ANALYTICS_EVENTS),
  props: z.record(z.string(), z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).default({}),
  anonymousId: z.string().uuid(),
  path: z.string().max(300).optional(),
  attribution: attributionSchema.default({}),
  ts: z.string().max(40).optional(),
});

const email = z.string().trim().toLowerCase().email("Enter a valid email.").max(200);
const name = z.string().trim().min(2, "Enter your name.").max(120);
const company = z.string().trim().min(1, "Enter your company.").max(160);

/** Where to go after signing in: same-site paths only (checked again by safeRedirect). */
const nextPath = z.string().max(300).regex(/^\/(?!\/)[^\s\\]*$/).optional();

export const authRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("login"), email, next: nextPath }),
  z.object({
    mode: z.literal("signup"),
    email,
    name,
    company,
    next: nextPath,
    consentProcessing: z.literal(true, { message: "Please agree so we can create your account." }),
    /** Honeypot. */
    company_url: z.string().max(500).optional(),
  }),
]);

export const verifySchema = z.object({ token: z.string().min(30).max(100) });

export const profileSchema = z.object({
  name,
  company,
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  phone: phone.optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
});

const contactFields = z.object({ name, email, company });

export const specialistQuestionSchema = z.object({
  diagnosticSessionId: z.string().uuid().optional(),
  topic: z.enum(["report", "results", "recommendations", "work_together", "other"]),
  message: z.string().trim().min(5, "Tell us a little more.").max(2000),
  contact: contactFields.optional(),
  consentProcessing: z.literal(true, { message: "Please agree so we can reply." }).optional(),
  company_url: z.string().max(500).optional(),
});

export const bookingSchema = z.object({
  slotStart: z.string().datetime(),
  diagnosticSessionId: z.string().uuid().optional(),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  contact: contactFields.optional(),
  consentProcessing: z.literal(true, { message: "Please agree so we can arrange the call." }).optional(),
  company_url: z.string().max(500).optional(),
});

/** Summary of an uploaded file. The raw file is never sent. */
export const uploadSummarySchema = z
  .object({
    fileName: z.string().max(120),
    rows: z.number().int().min(0).max(1_000_000),
    validRows: z.number().int().min(0).max(1_000_000),
    from: z.string().max(10),
    to: z.string().max(10),
    monthsUsed: z.number().int().min(0).max(240),
    columns: z.object({ date: z.string().max(80), amount: z.string().max(80), customer: z.string().max(80).optional() }),
    applied: z.array(z.string().max(40)).max(10),
  })
  .strip();
