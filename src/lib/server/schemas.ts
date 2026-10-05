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
  company_url: z.string().max(0).optional().or(z.literal("")),
});

export const eventSchema = z.object({
  event: z.enum(ANALYTICS_EVENTS),
  props: z.record(z.string(), z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).default({}),
  anonymousId: z.string().uuid(),
  path: z.string().max(300).optional(),
  attribution: attributionSchema.default({}),
  ts: z.string().max(40).optional(),
});
