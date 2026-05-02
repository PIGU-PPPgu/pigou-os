# Pigou OS Deployment

Pigou OS should be deployed as a server-rendered Next.js app when you want login, quick capture, AI parsing, delete actions, and API routes.

## Recommended first deployment

Use Vercel first. It is the smallest path for this Next.js App Router project.

Required environment variables:

```env
PIGOU_LOGIN_PASSWORD=
PIGOU_SESSION_SECRET=
PIGOU_LLM_WIKI_REBUILD_SECRET=
OPENAI_BASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_EMBEDDING_BASE_URL=
OPENAI_EMBEDDING_API_KEY=
OPENAI_EMBEDDING_MODEL=
```

Do not set `GITHUB_PAGES=true` or `STATIC_EXPORT=true` on Vercel/Netlify. Those modes remove the server API layer.

## Important persistence rule

The local version writes captured notes to:

```text
content/knowledge/*.json
data/knowledge-vectors/*.json
```

That is good for local development, but serverless platforms do not provide durable local writes. If Pigou OS is deployed to Vercel or Netlify, quick capture and delete need a real persistence backend.

Good storage choices:

1. Vercel-first: Vercel Postgres or Supabase for notes, Vercel Blob for assets, and a vector table for embeddings.
2. Repo-first: GitHub Contents API creates commits for `content/*.json`, then Vercel redeploys from GitHub.
3. Netlify-first: Netlify Blobs for notes/vectors, or Supabase for portable storage.

For now, the app intentionally blocks capture/delete on Vercel/Netlify unless `PIGOU_ALLOW_EPHEMERAL_WRITES=true` is set. That flag is only for temporary testing because data can disappear.

## Deployment modes

### Public static cockpit

Use this only for a read-only website:

```env
STATIC_EXPORT=true
```

### Private live OS

Use this for the actual Pigou OS:

```env
PIGOU_LOGIN_PASSWORD=...
PIGOU_SESSION_SECRET=...
```

Then add persistent storage before enabling capture/delete in production.

## Daily LLM Wiki rebuild

Set `PIGOU_LLM_WIKI_REBUILD_SECRET` on the deployment to enable cron-safe graph rebuilds through `GET /api/llm-wiki/rebuild`. Vercel reads the daily schedule from `vercel.json` and sends `CRON_SECRET` automatically when that platform secret is configured; Pigou OS accepts either `PIGOU_LLM_WIKI_REBUILD_SECRET` or `CRON_SECRET`.

For GitHub Actions fallback, add these repository secrets:

```env
PIGOU_OS_BASE_URL=https://your-pigou-os.example
PIGOU_LLM_WIKI_REBUILD_SECRET=...
```

The same script can still log in with `PIGOU_LOGIN_PASSWORD` when a cron secret is not available. Rebuild responses and CLI logs include up to 3 notable connections for the current Asia/Shanghai day when fresh or high-confidence links exist.

## Production server loop

The live Pigou OS server is intended to run as a Docker Compose app on a VPS, with nginx proxying the public domain to `127.0.0.1:3888`.

The production deployment script is:

```bash
PIGOU_APP_DIR=/opt/pigou-os PIGOU_DEPLOY_BRANCH=main ./scripts/deploy-production.sh
```

It is deliberately host-level. Do not run Docker control from the Next.js web process. The script:

1. Writes `content/ops/deploy.json` with the running deployment state.
2. Runs `scripts/backup-content.sh`.
3. Moves live `content` to `/opt/pigou-os/.runtime/content` on first run.
4. Fetches and resets code to `origin/main`.
5. Rebuilds `pigou-os` and `pigou-os-worker`.
6. Waits for the app healthcheck, then writes deployment success or failure for `/ops`.

The Compose file supports external live content:

```env
PIGOU_CONTENT_DIR=/opt/pigou-os/.runtime/content
```

This matters because server content is the live memory store. Do not overwrite it during rsync, git checkout, or manual deploys. The repository may still contain a checked-out `content/` directory after `git reset`; the running containers should use `PIGOU_CONTENT_DIR`.

## GitHub Actions production deploy

`.github/workflows/production-deploy.yml` can deploy `main` to the VPS over SSH. Enable it with:

```text
Repository variable:
PIGOU_PRODUCTION_DEPLOY_ENABLED=true

Repository secrets:
PIGOU_PRODUCTION_HOST=43.156.108.211
PIGOU_PRODUCTION_USER=root
PIGOU_PRODUCTION_SSH_KEY=<private key with access to the server>
PIGOU_PRODUCTION_PORT=22
```

The workflow only executes when the variable is explicitly set to `true`. This prevents accidental server deploys from forks or incomplete secret setups.

## Ops health panel

`/ops` reads `content/ops/*.json`, sync jobs, LLM Wiki graph metadata, and content mtimes to answer the question "is Pigou OS alive?"

Runtime markers currently include:

```text
content/ops/deploy.json
content/ops/worker-heartbeat.json
content/ops/last-sync-job.json
content/ops/last-llm-wiki-rebuild.json
content/ops/last-content-backup.json
content/ops/events.jsonl
```

The JSON API is available at `GET /api/ops/status` for authenticated requests.
