# Pigou OS

Personal project console for Pigou Wu. Built with Next.js and a Nothing-inspired monochrome interface.

## Local

```bash
pnpm install
pnpm dev
```

Open http://localhost:3888/knowledge and paste a link or a block of text into Quick Capture.

Private write actions use a single-user login. There is no registration flow.

```bash
cp .env.example .env.local
# fill PIGOU_LOGIN_PASSWORD and PIGOU_SESSION_SECRET
pnpm dev
```

Then open http://localhost:3888/login, log in, and return to `/knowledge`.

Mobile Quick Capture can also write through a webhook secret:

```env
PIGOU_INBOX_WEBHOOK_SECRET=
```

Supported mobile endpoints:

```bash
# iOS Shortcut share sheet
POST /api/inbox/shortcut?secret=$PIGOU_INBOX_WEBHOOK_SECRET

# Feishu automation / bot
POST /api/inbox/feishu
Authorization: Bearer $PIGOU_INBOX_WEBHOOK_SECRET

# WeCom / enterprise WeChat webhook
POST /api/inbox/wecom?secret=$PIGOU_INBOX_WEBHOOK_SECRET
```

All three accept JSON fields like `input`, `text`, `content`, `message`, `url`, or `link`, plus optional `mode`, `title`, and `tags`.

Without `OPENAI_API_KEY`, Pigou OS uses a local fallback parser: it fetches page title, description, and text snippets, then creates a draft knowledge note.

To enable AI parsing:

```bash
cp .env.example .env.local
# fill OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL
# optional: fill OPENAI_EMBEDDING_BASE_URL, OPENAI_EMBEDDING_API_KEY, OPENAI_EMBEDDING_MODEL
pnpm dev
```

Embeddings are stored locally under `data/knowledge-vectors/` and are used for similarity / dedupe signals.

Refresh GitHub contribution heatmap:

```bash
pnpm sync:contrib
```

Refresh project DeepWiki snapshots from GitHub:

```bash
pnpm sync:wiki
pnpm sync:wiki -- --project=headteacher-helper
pnpm sync:wiki -- --project=headteacher-helper --with-llm
pnpm sync:signals -- --project=headteacher-helper
```

The wiki sync is read-only against GitHub. It writes local snapshots to `content/project-wikis/*.json`, including README summaries, file-tree stats, frameworks, important files, and module structure.
Use `--with-llm` to add code insights from selected source files. It stores summaries, data flow, entrypoints, and risks, not raw source text.
After a wiki refresh, `pnpm sync:signals` applies those repo/wiki/task/log signals back to `content/projects/*.json`, updates `progressEvaluation`, and refreshes status/progress/next actions. When run for a single project, it also writes a `content/log/*.json` sync entry.

Refresh the LLM Wiki graph:

```bash
pnpm rebuild:llm-wiki
pnpm rebuild:llm-wiki -- --scope=projects
```

Scheduled rebuilds can authenticate with `PIGOU_LLM_WIKI_REBUILD_SECRET` or `CRON_SECRET`, which is sent as `x-pigou-cron-secret`. The rebuild output includes up to 3 notable connections for the current Asia/Shanghai day when there are fresh or high-confidence graph links.

Self-hosted deepwiki-open can be connected through:

```env
DEEPWIKI_OPEN_BASE_URL=http://localhost:8001
DEEPWIKI_PROVIDER=openai
DEEPWIKI_MODEL=gpt-5.5
DEEPWIKI_REPO_TOKEN=<github-token-for-private-repos>
```

Project pages can then ask the deepwiki-open API about a repository through `/api/deepwiki/ask`.

Automatic project sync:

```bash
# GitHub webhook target
POST /api/github/webhook

# Worker process on your VPS/local machine
pnpm sync:jobs
pnpm sync:jobs -- --limit=10
```

Set `GITHUB_WEBHOOK_SECRET` in both GitHub webhook settings and Pigou OS. The webhook only enqueues a job; the worker performs GitHub sync, project wiki sync, project status/progress/log refresh, global LLM Wiki graph rebuild, and optional deepwiki-open warmup.

There is also a GitHub Actions fallback in `.github/workflows/pigou-sync.yml`. Add `PIGOU_SYNC_GITHUB_TOKEN` as a repository secret if Pigou OS needs to read private or cross-repo data; otherwise the default `github.token` can only see this repository.
For hosted daily LLM Wiki rebuilds, add `PIGOU_OS_BASE_URL` plus either `PIGOU_LLM_WIKI_REBUILD_SECRET`, `CRON_SECRET`, or `PIGOU_LOGIN_PASSWORD`.

## Deploy

Docker / VPS:

```bash
cp .env.example .env
# fill login, AI, GitHub, and DeepWiki variables
docker compose up -d --build
```

Run the optional sync worker:

```bash
docker compose --profile worker up -d pigou-os-worker
```

`content/` is mounted into the container, so knowledge notes, tasks, project wikis, sync jobs, and graph snapshots stay on the server filesystem.

GitHub Pages can deploy the static cockpit, but browser-based capture needs a server runtime because it writes JSON files through `/api/knowledge/ingest`.
Use `GITHUB_PAGES=true` or `STATIC_EXPORT=true` only when you want a static export.

For the real private OS, deploy to Vercel or Netlify as a server-rendered Next.js app and do not enable static export. See [docs/deployment.md](docs/deployment.md).
