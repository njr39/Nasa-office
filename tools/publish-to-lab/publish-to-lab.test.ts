// Tests run the CLI against a local mock of the Wix API. They prove the tool's logic, not Wix's behaviour.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

type Call = { method: string; url: string; headers: Record<string, string | string[] | undefined>; body: string };

async function mock(opts: { existing?: boolean; failOn?: string } = {}) {
  const calls: Call[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString();
      const url = req.url ?? "";
      calls.push({ method: req.method ?? "", url, headers: req.headers, body });
      const send = (status: number, json: unknown) => {
        res.writeHead(status, { "content-type": "application/json", "x-wix-request-id": "req-123" });
        res.end(JSON.stringify(json));
      };
      if (opts.failOn && url.startsWith(opts.failOn)) return send(403, { message: "no permission" });
      const port = (server.address() as AddressInfo).port;
      if (url === "/wix-data/v2/items/query") return send(200, { dataItems: opts.existing ? [{ id: "item-1", data: { slug: "cerebro-hq" } }] : [] });
      if (url === "/wix-data/v2/items" && req.method === "POST") return send(200, { dataItem: { id: "new-1" } });
      if (url.startsWith("/wix-data/v2/items/") && req.method === "PATCH") return send(200, { dataItem: { id: "item-1" } });
      if (url === "/site-media/v1/files/import") return send(200, { file: { id: "f-url", url: "https://static.wixstatic.com/media/f-url.png", operationStatus: "PENDING" } });
      if (url === "/site-media/v1/files/generate-upload-url") return send(200, { uploadUrl: `http://127.0.0.1:${port}/upload/abc` });
      if (url.startsWith("/upload/abc")) return send(200, { file: { id: "f-local", url: "https://static.wixstatic.com/media/f-local.png", operationStatus: "READY" } });
      if (url.startsWith("/site-media/v1/files/get-file-by-id")) return send(200, { file: { operationStatus: "READY" } });
      return send(404, { message: "unexpected " + url });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { calls, base, close: () => server.close() };
}

function run(args: string[], env: Record<string, string>): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [new URL("./publish-to-lab.ts", import.meta.url).pathname, ...args], {
      env: { PATH: process.env.PATH ?? "", ...env },
    });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, out, err }));
  });
}

const KEY = "SECRET-KEY-VALUE";

test("creates a new item and prints the lab link", async () => {
  const m = await mock();
  const r = await run(["--slug", "cerebro-hq", "--title", "Cerebro HQ", "--status", "In build", "--client", "NOJARA internal"], { WIX_API_KEY: KEY, WIX_SITE_ID: "site-1", WIX_API_BASE: m.base });
  m.close();
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /https:\/\/www\.nojara\.com\/lab\/cerebro-hq/);
  const insert = m.calls.find((c) => c.method === "POST" && c.url === "/wix-data/v2/items");
  assert.ok(insert);
  const data = JSON.parse(insert.body).dataItem.data;
  assert.equal(data.slug, "cerebro-hq");
  assert.equal(data.status, "In build");
  assert.ok(data.lastBuild.$date);
  assert.equal(insert.headers.authorization, KEY);
  assert.equal(insert.headers["wix-site-id"], "site-1");
  assert.equal(insert.headers["wix-account-id"], undefined);
  assert.equal(JSON.parse(insert.body).dataCollectionId, "Lab");
});

test("updates an existing item with only the passed fields, uploads media, never deletes", async () => {
  const m = await mock({ existing: true });
  const dir = await mkdtemp(join(tmpdir(), "lab-"));
  const png = join(dir, "ipad.png");
  await writeFile(png, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const r = await run(
    ["--slug", "cerebro-hq", "--title", "Cerebro HQ", "--build-label", "Checkpoint 2", "--cover", "https://example.com/c.png", "--screens", png, "https://example.com/s.png"],
    { WIX_API_KEY: KEY, WIX_SITE_ID: "site-1", WIX_API_BASE: m.base },
  );
  m.close();
  assert.equal(r.code, 0, r.err);
  const patch = m.calls.find((c) => c.method === "PATCH");
  assert.ok(patch);
  const mods = JSON.parse(patch.body).patch.fieldModifications as { fieldPath: string; setFieldOptions: { value: unknown } }[];
  const paths = mods.map((x) => x.fieldPath).sort();
  assert.deepEqual(paths, ["buildLabel", "cover", "gallery", "lastBuild", "title"]);
  const gallery = mods.find((x) => x.fieldPath === "gallery")!.setFieldOptions.value as string[];
  assert.equal(gallery.length, 2);
  assert.ok(gallery.every((u) => u.startsWith("https://static.wixstatic.com/")));
  assert.ok(!m.calls.some((c) => c.method === "DELETE"));
  assert.ok(m.calls.every((c) => !c.url.includes("/collections")));
});

test("rejects a bad status before any network call", async () => {
  const m = await mock();
  const r = await run(["--slug", "x", "--title", "X", "--status", "Done"], { WIX_API_KEY: KEY, WIX_SITE_ID: "s", WIX_API_BASE: m.base });
  m.close();
  assert.notEqual(r.code, 0);
  assert.match(r.err, /--status must be one of/);
  assert.equal(m.calls.length, 0);
});

test("missing credentials stops the run and never prints a key", async () => {
  const r = await run(["--slug", "x", "--title", "X", "--status", "In build"], { WIX_SITE_ID: "s" });
  assert.notEqual(r.code, 0);
  assert.match(r.err, /WIX_API_KEY is not set/);
});

test("a Wix error shows the request id, is not retried, and does not leak the key", async () => {
  const m = await mock({ failOn: "/wix-data/v2/items/query" });
  const r = await run(["--slug", "x", "--title", "X", "--status", "In build"], { WIX_API_KEY: KEY, WIX_SITE_ID: "s", WIX_API_BASE: m.base });
  m.close();
  assert.notEqual(r.code, 0);
  assert.match(r.err, /HTTP 403/);
  assert.match(r.err, /req-123/);
  assert.ok(!r.err.includes(KEY) && !r.out.includes(KEY));
  assert.equal(m.calls.filter((c) => c.url === "/wix-data/v2/items/query").length, 1);
});

test("--dry-run makes no network calls", async () => {
  const m = await mock();
  const r = await run(["--slug", "x", "--title", "X", "--status", "In build", "--dry-run"], { WIX_API_BASE: m.base });
  m.close();
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /no network calls/);
  assert.equal(m.calls.length, 0);
});
