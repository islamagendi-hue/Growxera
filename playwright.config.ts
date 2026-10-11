import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests of the studio in a real browser against `next dev` on localhost, with the
 * local file store in a throwaway folder: no Supabase, no LinkedIn, no network services.
 * e2e/global-setup.ts refuses to run if any real credentials could be picked up.
 */
export const E2E_PORT = 3210;
export const E2E_DATA = path.join(os.tmpdir(), "gx-studio-e2e");
export const E2E_OWNER = "owner@example.com";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npx next dev -p ${E2E_PORT}`,
    url: `http://localhost:${E2E_PORT}/access`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    env: {
      GX_DATA_DIR: E2E_DATA,
      STUDIO_OWNER_EMAIL: E2E_OWNER,
      NEXT_TELEMETRY_DISABLED: "1",
      // Explicitly empty: the store must stay in local mode.
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      STUDIO_AUTO_PUBLISH_ALLOWED: "",
      LINKEDIN_CLIENT_ID: "",
      LINKEDIN_CLIENT_SECRET: "",
    },
  },
});
