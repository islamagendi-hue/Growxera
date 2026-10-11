import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { insert, select } from "./store";

const original = process.env.GX_DATA_DIR;
afterEach(() => {
  vi.unstubAllEnvs();
  if (original) process.env.GX_DATA_DIR = original;
});

describe("local development store", () => {
  it("reads a missing table as empty, but refuses a damaged one instead of overwriting it", async () => {
    const dir = path.join(os.tmpdir(), `gx-store-${crypto.randomUUID()}`);
    vi.stubEnv("GX_DATA_DIR", dir);
    expect(await select("li_actions", [])).toEqual([]);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "li_actions.json"), "{ damaged");
    await expect(select("li_actions", [])).rejects.toThrow();
    await expect(insert("li_actions", { id: "x" })).rejects.toThrow();
    expect(fs.readFileSync(path.join(dir, "li_actions.json"), "utf8")).toBe("{ damaged");
    fs.writeFileSync(path.join(dir, "li_actions.json"), '{"not":"a list"}');
    await expect(select("li_actions", [])).rejects.toThrow(/damaged/);
  });
});
