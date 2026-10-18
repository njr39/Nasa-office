# publish-to-lab

Sends one project build to the **Lab** collection on the NOJARA Wix site, so 39 can see what was built, when, and what changed.

> **Status: UNTESTED AGAINST LIVE WIX.** Six tests pass against a fake Wix server on this machine (`npm test`). Nobody has run it against the real site yet. The first real run is the test. Expect to fix small things.

## What it does

- Finds the Lab item with your `--slug`. Updates it if it exists, creates it if not.
- Uploads your cover and screenshots to the Wix Media Manager and saves the Wix image links on the item.
- Prints `https://www.nojara.com/lab/<slug>` when done.

## What it never does

- Never deletes anything.
- Never touches any collection except `Lab`.
- Never touches pages, menus, design, SEO, forms or apps.
- Never prints or stores the API key.
- Never retries a failed call. It stops and shows the Wix error and request id.

While the Lab collection is admin-only (the option chosen for now), the `/lab/<slug>` link shows nothing to anyone. The item is seen in the Wix CMS. The link starts working only if a private Lab page is built later.

## Setup (once per machine or CI)

Needs Node 22.18 or newer. Nothing to install.

Set two secrets as environment variables. Never put them in a file in the repo.

| Name | What it is |
|---|---|
| `WIX_API_KEY` | A Wix API key limited to the permissions below |
| `WIX_SITE_ID` | `898d106a-0bdd-4037-b8da-20c944f7fa9a` (Nojara Studios) |

**Alternative (Claude cloud sessions): proxy-added key.** If the key is stored as a Claude "Network secret" with `Authorization` and `wix-site-id` custom headers for `www.wixapis.com`, run the tool with `--proxy-auth`. It then sends no credentials of its own and needs no environment variables. The proxy adds the headers.

`WIX_ACCOUNT_ID` can also be set but is not sent. Wix's docs say a site call sends the site id only, not both.

API key permissions (Wix names): **Read Data Items**, **Write Data Items**, **Manage Media Manager**. Restrict the key to the Nojara Studios site only.

## Use

```
node tools/publish-to-lab/publish-to-lab.ts \
  --slug cerebro-hq --title "Cerebro HQ" --client "NOJARA internal" \
  --status "In build" --preview-url https://cerebro-core.vercel.app \
  --build-label "Checkpoint 1" \
  --change-note "One line: what changed in this build" \
  --repo njr39/Cerebro-core \
  --cover shots/ipad-home.png \
  --screens shots/ipad-home.png shots/iphone-home.png
```

- `--slug` and `--title` are always required. `--status` is required when the item is new.
- `--status` is one of: `In build`, `In review`, `Approved`, `Delivered`.
- `--cover` and each `--screens` entry can be a file on disk or a public image link. PNG, JPG, WEBP or GIF.
- On an update, only the options you pass are changed. Everything else on the item stays. If you pass `--screens`, the gallery is replaced with those images.
- `lastBuild` is set to the current time on every run.
- `--dry-run` shows what would be sent and makes no calls at all.
- `--proxy-auth` leaves the Authorization and site headers to the environment's proxy (see Setup).

## If it fails

It stops and prints the HTTP status, Wix's message and the request id. Send that to whoever is fixing it. Do not re-run blindly.

## Things still to confirm on the first real run

- The request id: the tool reads it from the `x-wix-request-id` response header, which is an assumption. If it prints `n/a`, the id is inside the error text instead.
- The data endpoints use the `/wix-data/v2/` paths from the Wix CMS recipes. Wix's API spec lists `/data/v2/` for the same calls. Both are expected to work. Confirm on the first run.
- Waiting for images to finish processing is best effort.
