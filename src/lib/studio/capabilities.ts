/**
 * What the studio can and cannot do on LinkedIn, and what the owner does by hand instead.
 * Shown at /studio/capabilities. Update a row only with evidence, and record the date.
 *
 * Status meanings:
 *   available    verified working for this app
 *   unverified   documented as possible, not yet tested with this app's credentials
 *   unavailable  not offered to this app (restricted, closed, or no API exists)
 */
export type CapabilityStatus = "available" | "unverified" | "unavailable";

export interface Capability {
  id: string;
  capability: string;
  method: string;
  permission: string;
  status: CapabilityStatus;
  implementation: string;
  manualStep: string | null;
  evidence: string;
}

export const CHECKED_ON = "2026-10-10";

export const CAPABILITIES: Capability[] = [
  {
    id: "publish_text",
    capability: "Publish a text post on your personal profile",
    method: "LinkedIn Posts API (Share on LinkedIn product)",
    permission: "w_member_social: self-serve product; the developer app must be associated with a LinkedIn Page",
    status: "unverified",
    implementation:
      "Built, not yet used live: Publish now for an approved post, or automatic publishing for a post you confirmed one by one (sent 60 to 10 seconds before its planned time, never late). Both need All publishing ON; automatic also needs its own switch. Once per version, after a duplicate check.",
    manualStep: "Until connected: Copy text, Open LinkedIn, post, then paste the post link into the studio.",
    evidence: "Documented as self-serve. Marked available only after the first API post is confirmed live.",
  },
  {
    id: "publish_media",
    capability: "Publish image and PDF-carousel (document) posts",
    method: "Images API / Documents API + Posts API",
    permission: "w_member_social",
    status: "unverified",
    implementation: "Built for one image or one PDF per post, uploaded from the studio's verified copies. Untested until the first such post.",
    manualStep: "Download the asset from the studio, attach it in LinkedIn, post, paste the link back.",
    evidence: "Sources disagree on document posts for personal profiles. Must be tested.",
  },
  {
    id: "newsletter",
    capability: "Publish newsletter articles (Behind the Number)",
    method: "None: LinkedIn has no public API for member articles or newsletters",
    permission: "n/a",
    status: "unavailable",
    implementation: "Drafts only. Grok writes a newsletter draft from a topic on the Topics page (once its settings are set); the house-style cover is made on the post page. Publishing stays manual.",
    manualStep: "Paste into LinkedIn's article editor, choose the Behind the Number newsletter, schedule, paste the link back.",
    evidence: "No member article API in LinkedIn's documentation.",
  },
  {
    id: "read_posts",
    capability: "Read your own historical posts automatically",
    method: "Posts API read",
    permission: "r_member_social: restricted to approved partners",
    status: "unavailable",
    implementation: "History comes from the one-off Buffer export of 10 Oct 2026 (Import page). Importing LinkedIn's own data export isn't built yet.",
    manualStep: "Request 'Get a copy of your data' in LinkedIn settings when a refresh is needed.",
    evidence: "Documented as restricted. A self-serve app can't get it.",
  },
  {
    id: "read_comments",
    capability: "Read comments and replies on your posts",
    method: "Comments API read",
    permission: "r_member_social: restricted",
    status: "unavailable",
    implementation: "Not built yet. Planned: an engagement inbox for pasted comments (Milestone 5).",
    manualStep: "Paste the comment text and its link into the inbox.",
    evidence: "Documented as restricted.",
  },
  {
    id: "write_comments",
    capability: "Post approved replies and comments",
    method: "Comments API write",
    permission: "w_member_social, but needs the target comment or post URN",
    status: "unverified",
    implementation: "Not built yet. Planned: draft and approve replies in the studio (Milestone 5); posting by API needs testing.",
    manualStep: "Copy reply, Open the post, paste and send, then paste the reply link back.",
    evidence: "Writing is self-serve; finding the parent comment's URN without read access is the open question.",
  },
  {
    id: "post_analytics",
    capability: "Post analytics (impressions, reach, reactions, comments)",
    method: "memberCreatorPostAnalytics (Community Management API)",
    permission: "r_member_postAnalytics: gated partner product",
    status: "unavailable",
    implementation: "Not built yet. Planned: weekly upload of LinkedIn's creator analytics export (Milestone 2). Today the studio shows the frozen numbers imported from Buffer on 10 Oct.",
    manualStep: "LinkedIn → Analytics → Content → Export (XLSX), then upload in the studio.",
    evidence: "Available to approved tools such as schedulers, not to a self-serve app.",
  },
  {
    id: "account_metrics",
    capability: "Followers, profile views, newsletter subscribers",
    method: "Member profile analytics (gated) / none for newsletters",
    permission: "Gated or unavailable",
    status: "unavailable",
    implementation: "Not built yet. Planned: weekly manual entry or the analytics export upload (Milestone 2).",
    manualStep: "Check the numbers on LinkedIn for now.",
    evidence: "No self-serve access.",
  },
  {
    id: "messages",
    capability: "Direct messages and connection requests",
    method: "Closed partner programs",
    permission: "Closed",
    status: "unavailable",
    implementation: "Out of scope. Never automated.",
    manualStep: null,
    evidence: "Closed.",
  },
  {
    id: "grok",
    capability: "Grok writing and conversation engine",
    method: "xAI API (api.x.ai)",
    permission: "xAI Console API key with billing; separate from any SuperGrok or X subscription",
    status: "unverified",
    implementation: "Client built, disabled until key, model, prices and monthly budget are set. No fallback model.",
    manualStep: "Create a key and spending limit in console.x.ai, then add the env vars in Vercel.",
    evidence: "No key configured. Check with 'Check Grok API' on this page once a key is set.",
  },
];

export const STATUS_TEXT: Record<CapabilityStatus, string> = {
  available: "Available",
  unverified: "Not verified",
  unavailable: "Not available",
};
