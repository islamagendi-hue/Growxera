# Privacy and consent

Written to align with the Saudi Personal Data Protection Law (PDPL, in force since September 2024) and the UAE PDPL. **Not legal advice: have counsel review before launch.**

## Principles applied

| Principle | How the product implements it |
| --- | --- |
| Lawful basis: consent | Lead form has a required, unticked processing-consent checkbox with the exact purpose. Stored in `consent_records` with wording + policy version |
| Separate marketing consent | Optional, unticked, separate checkbox. Never bundled with processing consent |
| Purpose limitation | Data is used to produce the report and follow up on it. No sale, no ad audiences |
| Data minimisation | Only name, work email and company are required. Diagnostic answers describe the business, not the person, and every metric can be "I don't know" |
| Transparency | Privacy notice at `/privacy`, linked from the form, banner and footer, with a version number |
| Analytics opt-in | No analytics events are sent before "Accept analytics". Events are pseudonymous (random id), no IP stored, no advertising cookies. Change any time via "Privacy settings" |
| Storage limitation | `purge_expired_data()`: anonymous diagnostics 180 days, leads 2 years after last activity, events 395 days. Configured in `src/config/privacy.ts` |
| Security | Service-role key server-only, RLS deny-all, HTTPS, server-side validation, honeypot and rate limiting |
| Data-subject rights | Access/correction via the privacy email; erasure via `erase_lead_by_email()` |
| Automated decisions | The score is labelled preliminary and indicative; no decision with legal effect is made from it |

## Things only Growx_era can decide (launch gates)

1. **Controller details** on `/privacy`: legal entity, CR number, address, privacy contact.
2. **Hosting region and cross-border transfers.** The PDPL restricts transfers outside the Kingdom. Choose the Supabase region with counsel, document the transfer basis, and sign each provider's DPA (Vercel, Supabase, any CRM/webhook target).
3. **Processor register**: list any CRM, email or WhatsApp provider connected to `LEAD_WEBHOOK_URL`.
4. **Marketing on WhatsApp/SMS**: only to people who ticked marketing consent; honour opt-outs by updating `leads.status = 'unsubscribed'` and adding a `consent_records` row with `granted = false`.
5. **Breach process**: who notifies SDAIA (within 72 hours under the PDPL Implementing Regulations) and affected people.
6. **Registration**: check whether Growx_era must register on SDAIA's National Data Governance Platform.

## Changing the notice

Edit `/privacy`, bump `POLICY_VERSION` in `src/config/privacy.ts`. Visitors see the analytics banner again, and new consents record the new version.
