#!/usr/bin/env node
// publish-to-lab: upsert one project into the "Lab" CMS collection on the NOJARA Wix site.
// UNTESTED AGAINST LIVE WIX. Tested only against the local mock server in publish-to-lab.test.ts.
// Needs Node 22.18+ (runs TypeScript directly). No dependencies.
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

const COLLECTION = "Lab";
const STATUSES = ["In build", "In review", "Approved", "Delivered"];
const API_BASE = (process.env.WIX_API_BASE ?? "https://www.wixapis.com").replace(/\/$/, "");
const PUBLIC_LAB = "https://www.nojara.com/lab";
const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

type Args = {
  slug?: string;
  title?: string;
  client?: string;
  status?: string;
  previewUrl?: string;
  buildLabel?: string;
  changeNote?: string;
  repo?: string;
  cover?: string;
  screens: string[];
  dryRun: boolean;
};

const VALUE_FLAGS: Record<string, "slug" | "title" | "client" | "status" | "previewUrl" | "buildLabel" | "changeNote" | "repo" | "cover"> = {
  "--slug": "slug",
  "--title": "title",
  "--client": "client",
  "--status": "status",
  "--preview-url": "previewUrl",
  "--build-label": "buildLabel",
  "--change-note": "changeNote",
  "--repo": "repo",
  "--cover": "cover",
};

const USAGE = `publish-to-lab --slug <s> --title <t> [--client <c>] [--status "In build"|"In review"|"Approved"|"Delivered"]
               [--preview-url <url>] [--build-label <l>] [--change-note <n>] [--repo <owner/name>]
               [--cover <file|url>] [--screens <file|url> ...] [--dry-run]
Env: WIX_API_KEY, WIX_SITE_ID (WIX_ACCOUNT_ID is accepted but not sent; Wix wants only the site id for site calls)`;

function fail(message: string): never {
  console.error(`publish-to-lab: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  const a: Args = { screens: [], dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--help" || t === "-h") {
      console.log(USAGE);
      process.exit(0);
    }
    if (t === "--dry-run") {
      a.dryRun = true;
      continue;
    }
    if (t === "--screens") {
      while (i + 1 < argv.length && !argv[i + 1].startsWith("--")) a.screens.push(argv[++i]);
      continue;
    }
    const key = VALUE_FLAGS[t];
    if (!key) fail(`unknown option ${t}\n${USAGE}`);
    const v = argv[++i];
    if (v === undefined || v.startsWith("--")) fail(`${t} needs a value`);
    a[key] = v;
  }
  return a;
}

function validate(a: Args): void {
  if (!a.slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug)) fail("--slug is required: lower-case letters, numbers and single dashes, e.g. cerebro-hq");
  if (!a.title) fail("--title is required");
  if (a.status !== undefined && !STATUSES.includes(a.status)) fail(`--status must be one of: ${STATUSES.join(", ")}`);
  if (a.previewUrl !== undefined && !/^https?:\/\//i.test(a.previewUrl)) fail("--preview-url must start with http:// or https://");
}

function credentials(): { key: string; siteId: string } {
  const key = process.env.WIX_API_KEY;
  const siteId = process.env.WIX_SITE_ID;
  if (!key) fail("WIX_API_KEY is not set");
  if (!siteId) fail("WIX_SITE_ID is not set");
  return { key, siteId };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// One call, no retries. On failure the Wix status, message and request id are shown; the key never is.
async function api(
  creds: { key: string; siteId: string },
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { Authorization: creds.key, "wix-site-id": creds.siteId, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  if (!res.ok) {
    const id = res.headers.get("x-wix-request-id") ?? "n/a";
    fail(`${method} ${path} failed: HTTP ${res.status}. ${text.slice(0, 500)} (Wix request id: ${id}). Not retried.`);
  }
  return json;
}

async function waitUntilReady(creds: { key: string; siteId: string }, fileId: string): Promise<void> {
  for (let i = 0; i < 15; i++) {
    const r = await api(creds, "GET", `/site-media/v1/files/get-file-by-id?fileId=${encodeURIComponent(fileId)}`);
    const status = (r.file ?? r.files?.[0])?.operationStatus;
    if (status === "READY" || status === undefined) return;
    if (status === "FAILED") fail(`Wix could not process media file ${fileId}`);
    await sleep(2000);
  }
  console.error(`publish-to-lab: media file ${fileId} is still processing; continuing anyway`);
}

async function toWixUrl(creds: { key: string; siteId: string }, src: string, displayName: string): Promise<string> {
  if (/^https?:\/\//i.test(src)) {
    const ext = extname(new URL(src).pathname).toLowerCase();
    const body: Record<string, string> = { url: src, displayName: displayName + (ext || "") };
    if (MIME[ext]) body.mimeType = MIME[ext];
    const r = await api(creds, "POST", "/site-media/v1/files/import", body);
    if (!r.file?.url) fail(`Wix did not return a file url when importing ${src}`);
    await waitUntilReady(creds, r.file.id);
    return r.file.url;
  }
  const ext = extname(src).toLowerCase();
  const mimeType = MIME[ext];
  if (!mimeType) fail(`unsupported image type for ${src} (use png, jpg, webp or gif)`);
  const bytes = await readFile(src).catch(() => fail(`cannot read file ${src}`));
  const fileName = displayName + ext;
  const gen = await api(creds, "POST", "/site-media/v1/files/generate-upload-url", { mimeType, fileName });
  if (!gen.uploadUrl) fail("Wix did not return an uploadUrl");
  const put = await fetch(gen.uploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: bytes });
  const text = await put.text();
  if (!put.ok) fail(`upload of ${basename(src)} failed: HTTP ${put.status}. ${text.slice(0, 300)}. Not retried.`);
  const file = JSON.parse(text).file;
  if (!file?.url) fail(`Wix did not return a file url after uploading ${basename(src)}`);
  await waitUntilReady(creds, file.id);
  return file.url;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  validate(args);
  const slug = args.slug as string;

  const fields: Record<string, unknown> = {};
  for (const k of ["title", "client", "status", "previewUrl", "buildLabel", "changeNote", "repo"] as const) {
    if (args[k] !== undefined) fields[k] = args[k];
  }
  fields.lastBuild = { $date: new Date().toISOString() };

  if (args.dryRun) {
    console.log(JSON.stringify({ dryRun: true, collection: COLLECTION, slug, fields, cover: args.cover ?? null, screens: args.screens, note: "no network calls were made" }, null, 2));
    return;
  }

  const creds = credentials();

  if (args.cover) fields.cover = await toWixUrl(creds, args.cover, `${slug}-cover`);
  if (args.screens.length) {
    const urls: string[] = [];
    for (let i = 0; i < args.screens.length; i++) urls.push(await toWixUrl(creds, args.screens[i], `${slug}-screen-${i + 1}`));
    fields.gallery = urls;
  }

  const found = await api(creds, "POST", "/wix-data/v2/items/query", {
    dataCollectionId: COLLECTION,
    query: { filter: { slug: { $eq: slug } }, paging: { limit: 2 } },
  });
  const existing: any[] = found.dataItems ?? [];
  if (existing.length > 1) fail(`more than one Lab item has slug "${slug}"; fix it in the CMS first`);

  if (existing.length === 1) {
    const id = existing[0].id ?? existing[0].data?._id;
    await api(creds, "PATCH", `/wix-data/v2/items/${encodeURIComponent(id)}`, {
      dataCollectionId: COLLECTION,
      patch: {
        dataItemId: id,
        fieldModifications: Object.entries(fields).map(([fieldPath, value]) => ({
          fieldPath,
          action: "SET_FIELD",
          setFieldOptions: { value },
        })),
      },
    });
    console.log(`Updated Lab item "${slug}" (${id}). Only the fields you passed were changed.`);
  } else {
    if (!args.status) fail("--status is required when creating a new item");
    const created = await api(creds, "POST", "/wix-data/v2/items", {
      dataCollectionId: COLLECTION,
      dataItem: { data: { slug, ...fields } },
    });
    console.log(`Created Lab item "${slug}" (${created.dataItem?.id ?? "id not returned"}).`);
  }
  console.log(`${PUBLIC_LAB}/${slug}`);
  console.error("Note: while the Lab collection is admin-only (no public page), that link will not show anything. View the item in the Wix CMS.");
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
