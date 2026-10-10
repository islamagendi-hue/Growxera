import "server-only";

/** The studio owner's email (server-only env STUDIO_OWNER_EMAIL). Without it, nobody gets in. */
export function ownerEmail(): string | null {
  const v = process.env.STUDIO_OWNER_EMAIL?.trim().replace(/^["']|["']$/g, "").trim().toLowerCase();
  return v || null;
}
