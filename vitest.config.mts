import { defineConfig } from "vitest/config";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    // Local store and email outbox write here during tests, never into the repo.
    env: { GX_DATA_DIR: path.join(os.tmpdir(), `gx-test-${process.pid}`) },
  },
});
