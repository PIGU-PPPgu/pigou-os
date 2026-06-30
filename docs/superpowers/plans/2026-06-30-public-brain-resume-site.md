# Public Brain Resume Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the logged-out Pigou OS homepage into a public personal thinking and resume site while preserving the logged-in private OS and clarifying GitHub Actions.

**Architecture:** Keep `/` as the single home route with the existing cookie gate. Logged-in users keep rendering `TodayPage`; logged-out users render a new presentational `PublicHomepage` component fed by existing JSON project and update data. CI and deployment workflows are split into a normal build quality gate, GitHub Pages static public deploy, and variable-gated production server deploy.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4, existing local JSON content, GitHub Actions, pnpm 10.33.3.

## Global Constraints

- Public visitors see a polished personal thinking site and resume-style portfolio.
- Logged-in Pigou continues to see the private Today cockpit and existing personal OS tools.
- The public site should feel like Pigou's existing Nothing-inspired operating-system interface: monochrome, precise, grid-based, point-display typography, terminal panels, and restrained motion.
- Do not redesign the private Today cockpit or internal workbench pages.
- Do not migrate content storage away from local JSON files.
- Do not add a CMS, database, 3D engine, or new visual-design dependency.
- Do not make GitHub Pages host private write flows; static export remains public/read-only.
- Motion respects `prefers-reduced-motion`.

---

## File Structure

- Create `components/home/PublicHomepage.tsx`: logged-out homepage presentation, data selection helpers, brain-map node markup, selected projects, capability stack, and thinking-system links.
- Modify `app/page.tsx`: keep the auth gate, import `getUpdates`, and render `PublicHomepage` for logged-out users.
- Modify `app/globals.css`: append homepage brain-map and signal-line styles using existing tokens and reduced-motion media query.
- Create `.github/workflows/ci.yml`: quality gate for pull requests and pushes to `main`.
- Modify `.github/workflows/deploy.yml`: keep GitHub Pages deployment but pin pnpm and add the Pages setup action.
- Modify `docs/deployment.md`: briefly document the split between GitHub Pages public static deploy and production server deploy.

## Verification Notes

The local `pnpm` wrapper may try to reinstall `node_modules`. If that prompt appears, cancel it and use direct local binaries instead:

```bash
./node_modules/.bin/tsc --noEmit
node scripts/prepare-next-build.mjs && ./node_modules/.bin/next build
```

Do not run `GITHUB_PAGES=true node scripts/prepare-static-export.mjs` directly in the main working tree unless you are prepared to restore the source patching it performs. Use a disposable worktree after the implementation commit for static-export verification.

---

### Task 1: Public Homepage Component And Route Gate

**Files:**
- Create: `components/home/PublicHomepage.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Project` and `UpdateLog` from `@/lib/data`; `Panel`, `ButtonLink`, `Label`, `SectionHeader`, `StatusBadge`, and `PriorityBadge` from `@/components/UI`.
- Produces: `export function PublicHomepage({ projects, updates }: { projects: Project[]; updates: UpdateLog[] })`.
- Produces: helper `selectPublicProjects(projects: Project[]): Project[]` local to `PublicHomepage.tsx`; it returns shipped/public-image/public projects first, sorted by shipped status and progress.

- [ ] **Step 1: Create the component directory**

Run:

```bash
mkdir -p components/home
```

Expected: `components/home` exists and `git status --short` shows no tracked-file changes from the command alone.

- [ ] **Step 2: Add `PublicHomepage.tsx` with the public composition**

Create `components/home/PublicHomepage.tsx` with this structure and content:

```tsx
import Link from 'next/link';
import { ButtonLink, Label, Panel, PriorityBadge, SectionHeader, StatusBadge } from '@/components/UI';
import type { Project, UpdateLog } from '@/lib/data';

type PublicHomepageProps = {
  projects: Project[];
  updates: UpdateLog[];
};

const brainNodes = [
  { label: '教育 AI', detail: 'teacher tools', className: 'brain-node--top-left' },
  { label: '教师工作流', detail: 'classroom ops', className: 'brain-node--top-right' },
  { label: '个人知识系统', detail: 'thinking OS', className: 'brain-node--left' },
  { label: '数据分析', detail: 'learning signals', className: 'brain-node--right' },
  { label: 'Agent 工程', detail: 'tool chains', className: 'brain-node--bottom-left' },
  { label: '产品交付', detail: 'shipped proof', className: 'brain-node--bottom-right' }
];

const capabilityRows = [
  { index: '01', title: 'AI education products', text: '把真实教师工作流拆成可使用的小程序、数据系统和 AI 工作台。' },
  { index: '02', title: 'Personal OS building', text: '用项目、知识、想法、行动和日志串起自己的长期操作系统。' },
  { index: '03', title: 'Full-stack shipping', text: '从 Next.js 前台、内容结构、自动同步到 VPS 部署都能闭环。' },
  { index: '04', title: 'Evidence-first iteration', text: '用截图、项目状态、更新日志和同步信号证明进展，而不是只写愿景。' }
];

export function PublicHomepage({ projects, updates }: PublicHomepageProps) {
  const selectedWork = selectPublicProjects(projects);
  const latestUpdates = updates.slice(0, 3);
  const shippedCount = projects.filter(project => project.status === 'shipped').length;
  const publicProofCount = projects.filter(project => project.images?.some(image => image.public)).length;

  return <div className="public-home grid gap-5">
    <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Panel dark className="console-screen public-hero relative min-h-[620px] overflow-hidden p-5 md:p-8">
        <div className="motion-grid absolute inset-0 text-white/10 dot-grid" />
        <div className="brain-map-lines" aria-hidden="true">
          {brainNodes.map(node => <span key={node.className} className={`brain-line ${node.className.replace('brain-node', 'brain-line')}`} />)}
        </div>
        <div className="scanline" />
        <div className="relative grid h-full gap-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label>Pigou Wu / Public Brain</Label>
            <span className="live-pill mono rounded-full border border-white/20 px-3 py-1 text-[10px] uppercase text-white/55">Brain map</span>
          </div>
          <div className="brain-map" aria-label="Pigou Wu public thinking map">
            <div className="brain-node brain-node--center">
              <span className="caption text-white/45">CENTER NODE</span>
              <strong>Pigou Wu</strong>
              <span>AI education builder / personal OS maker</span>
            </div>
            {brainNodes.map(node => <div key={node.label} className={`brain-node ${node.className}`}>
              <strong>{node.label}</strong>
              <span>{node.detail}</span>
            </div>)}
          </div>
          <div className="grid gap-5 border-t border-white/15 pt-5 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h2 className="hero-title max-w-4xl text-5xl font-semibold leading-[.92] text-white md:text-7xl">把教育现场、个人知识和 AI 工程接成一套操作系统。</h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/62">这里不是普通主页，而是 Pigou 的公开思维站、作品证据和简历入口。</p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <ButtonLink primary href="/work">View work</ButtonLink>
              <ButtonLink href="/about">Resume</ButtonLink>
            </div>
          </div>
        </div>
      </Panel>

      <aside className="grid gap-5">
        <Panel raised className="p-5 md:p-6">
          <SectionHeader label="Signal" value="public proof" />
          <div className="grid grid-cols-3 gap-3">
            <Metric value={String(projects.length).padStart(2, '0')} label="projects" />
            <Metric value={String(shippedCount).padStart(2, '0')} label="shipped" />
            <Metric value={String(publicProofCount).padStart(2, '0')} label="proof" />
          </div>
        </Panel>
        <Panel className="p-5 md:p-6">
          <SectionHeader label="Resume Stack" value="what I keep building" />
          <div className="grid gap-4">
            {capabilityRows.map(row => <div key={row.index} className="grid grid-cols-[42px_1fr] gap-3 border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
              <span className="doto text-4xl leading-none text-[var(--text-disabled)]">{row.index}</span>
              <div>
                <h3 className="text-base font-semibold leading-tight text-[var(--ink)]">{row.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{row.text}</p>
              </div>
            </div>)}
          </div>
        </Panel>
      </aside>
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <Panel className="p-5 md:p-6">
        <SectionHeader label="Selected Work" value={`${selectedWork.length} public signals`} />
        <div className="grid gap-5">
          {selectedWork.map(project => <Link key={project.slug} href={`/projects/${project.slug}`} className="group grid gap-4 border-b border-[var(--border)] pb-5 transition last:border-b-0 last:pb-0 hover:bg-white/40 md:grid-cols-[1fr_auto] md:p-3">
            <div>
              <div className="flex flex-wrap gap-2"><StatusBadge status={project.status} /><PriorityBadge priority={project.priority} /></div>
              <h3 className="mt-3 text-3xl font-semibold leading-tight text-[var(--ink)]">{project.title}</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)]">{project.explanation || project.summary}</p>
              <div className="caption mt-3">{project.domain || 'project'} / progress {project.progress}% / updated {project.updated}</div>
            </div>
            <span className="mono self-end rounded-full border border-[var(--border-visible)] px-4 py-2 text-[10px] uppercase text-[var(--text-secondary)] group-hover:border-[var(--ink)] group-hover:text-[var(--ink)]">open</span>
          </Link>)}
        </div>
      </Panel>

      <Panel className="p-5 md:p-6">
        <SectionHeader label="Thinking System" value="updates / knowledge / meta" />
        <div className="grid gap-5">
          {latestUpdates.map(update => <Link key={update.slug} href="/updates" className="block border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
            <div className="caption">{update.version} / {update.type} / {update.date}</div>
            <h3 className="mt-2 text-2xl font-semibold leading-tight text-[var(--ink)]">{update.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{update.summary}</p>
          </Link>)}
          <div className="grid gap-3 sm:grid-cols-2">
            <ButtonLink href="/knowledge">Knowledge</ButtonLink>
            <ButtonLink href="/projects/pigou-os">Pigou OS</ButtonLink>
          </div>
        </div>
      </Panel>
    </section>
  </div>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="min-w-0 border-r border-[var(--border)] pr-3 last:border-r-0">
    <div className="doto text-5xl leading-none text-[var(--ink)]">{value}</div>
    <div className="caption mt-2">{label}</div>
  </div>;
}

function selectPublicProjects(projects: Project[]) {
  return projects
    .filter(project => project.status === 'shipped' || project.visibility !== 'private' || project.images?.some(image => image.public))
    .sort((a, b) => Number(b.status === 'shipped') - Number(a.status === 'shipped') || b.progress - a.progress)
    .slice(0, 4);
}
```

Expected: The file imports no client-only APIs and can remain a server component.

- [ ] **Step 3: Replace logged-out homepage JSX with `PublicHomepage`**

Modify `app/page.tsx` so the imports and default function look like this:

```tsx
import { cookies } from 'next/headers';
import { getSessionUserFromCookieHeader } from '@/lib/auth';
import { getProjects, getUpdates } from '@/lib/data';
import TodayPage from './today/page';
import { PublicHomepage } from '@/components/home/PublicHomepage';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cookieHeader = (await cookies()).toString();
  const isLoggedIn = Boolean(getSessionUserFromCookieHeader(cookieHeader));
  if (isLoggedIn) return <TodayPage />;

  return <PublicHomepage projects={getProjects()} updates={getUpdates()} />;
}
```

Expected: `app/page.tsx` no longer contains the old logged-out home markup, and the logged-in path is unchanged.

- [ ] **Step 4: Run the targeted TypeScript check**

Run:

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: exits 0. If it fails, fix the exact TypeScript error before moving on.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add app/page.tsx components/home/PublicHomepage.tsx
git commit -m "feat: add public brain homepage"
```

Expected: commit includes only the route and component files.

---

### Task 2: Brain-Map Motion And Responsive Styling

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: class names emitted by `components/home/PublicHomepage.tsx`: `public-home`, `public-hero`, `brain-map`, `brain-map-lines`, `brain-line`, and `brain-node`.
- Produces: responsive, reduced-motion-safe CSS for the public homepage hero.

- [ ] **Step 1: Append brain-map CSS**

Append this CSS before the existing `@media (prefers-reduced-motion: reduce)` block in `app/globals.css`:

```css
.public-hero .primary-action {
  border-color: rgba(255,255,255,.82);
}

.brain-map {
  position: relative;
  min-height: 330px;
}

.brain-map-lines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.brain-line {
  position: absolute;
  left: 50%;
  top: 50%;
  height: 1px;
  width: 34%;
  background: linear-gradient(90deg, rgba(255,255,255,.02), rgba(255,255,255,.42), rgba(255,255,255,.03));
  transform-origin: left center;
  opacity: .55;
  animation: signal-sweep 3.6s ease-in-out infinite;
}

.brain-line--top-left { transform: rotate(214deg); }
.brain-line--top-right { transform: rotate(326deg); }
.brain-line--left { transform: rotate(178deg); width: 30%; }
.brain-line--right { transform: rotate(2deg); width: 30%; }
.brain-line--bottom-left { transform: rotate(144deg); }
.brain-line--bottom-right { transform: rotate(36deg); }

.brain-node {
  position: absolute;
  display: grid;
  gap: .35rem;
  min-width: 138px;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 8px;
  background: rgba(16,16,15,.72);
  padding: .85rem .95rem;
  color: rgba(255,255,255,.78);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
  animation: node-flicker 4.8s steps(2, end) infinite;
}

.brain-node strong {
  color: #fff;
  font-size: .95rem;
  line-height: 1.2;
}

.brain-node span {
  font-family: 'Space Mono', ui-monospace, monospace;
  font-size: 10px;
  line-height: 1.4;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: rgba(255,255,255,.45);
}

.brain-node--center {
  left: 50%;
  top: 50%;
  width: min(320px, 74vw);
  transform: translate(-50%, -50%);
  border-color: rgba(255,255,255,.42);
  background: rgba(255,255,255,.08);
  padding: 1.15rem;
  text-align: center;
  z-index: 2;
}

.brain-node--center strong {
  font-size: clamp(2.7rem, 8vw, 5.6rem);
  line-height: .88;
}

.brain-node--top-left { left: 6%; top: 8%; }
.brain-node--top-right { right: 5%; top: 12%; }
.brain-node--left { left: 3%; top: 48%; }
.brain-node--right { right: 3%; top: 48%; }
.brain-node--bottom-left { left: 9%; bottom: 8%; }
.brain-node--bottom-right { right: 8%; bottom: 7%; }

@keyframes signal-sweep {
  0%, 100% { opacity: .25; filter: brightness(.75); }
  50% { opacity: .75; filter: brightness(1.25); }
}

@keyframes node-flicker {
  0%, 100% { border-color: rgba(255,255,255,.18); }
  50% { border-color: rgba(255,255,255,.32); }
}

@media (max-width: 720px) {
  .brain-map {
    display: grid;
    grid-template-columns: 1fr;
    gap: .75rem;
    min-height: 0;
  }

  .brain-map-lines {
    display: none;
  }

  .brain-node,
  .brain-node--center {
    position: static;
    width: 100%;
    min-width: 0;
    transform: none;
    text-align: left;
  }

  .brain-node--center strong {
    font-size: clamp(2.8rem, 18vw, 4.8rem);
  }
}
```

Expected: No purple/blue gradient or one-note palette is introduced; the CSS uses existing monochrome tokens and white overlays inside the dark panel.

- [ ] **Step 2: Extend reduced-motion handling**

Inside the existing `@media (prefers-reduced-motion: reduce)` block, no separate selector is needed because the universal rule already disables animations. Confirm that the appended CSS appears before that block.

Expected: reduced-motion users get a static brain map.

- [ ] **Step 3: Run the targeted TypeScript check**

Run:

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 4: Commit Task 2**

Run:

```bash
git add app/globals.css
git commit -m "style: add public brain map motion"
```

Expected: commit includes only `app/globals.css`.

---

### Task 3: GitHub Actions Split And Deployment Notes

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `.github/workflows/deploy.yml`
- Modify: `docs/deployment.md`

**Interfaces:**
- Produces: CI workflow named `CI` with job `quality`.
- Produces: Pages workflow named `Deploy GitHub Pages` that keeps `GITHUB_PAGES=true node scripts/prepare-static-export.mjs` and `GITHUB_PAGES=true pnpm build`.
- Preserves: `.github/workflows/production-deploy.yml` gated by `vars.PIGOU_PRODUCTION_DEPLOY_ENABLED == 'true'`.

- [ ] **Step 1: Add CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.33.3

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm lint

      - name: Build server app
        run: pnpm build
```

Expected: CI uses no production secrets and runs on PRs plus pushes to `main`.

- [ ] **Step 2: Pin pnpm and configure Pages in deploy workflow**

Replace `.github/workflows/deploy.yml` with:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.33.3

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - uses: actions/configure-pages@v5

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Prepare static export
        run: GITHUB_PAGES=true node scripts/prepare-static-export.mjs

      - name: Build static public site
        run: GITHUB_PAGES=true pnpm build

      - uses: actions/upload-pages-artifact@v3
        with:
          path: out

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Expected: Pages deploy still publishes `out` and does not require private OS secrets.

- [ ] **Step 3: Document the deployment split**

In `docs/deployment.md`, under `## Deployment modes`, add:

```markdown
### GitHub Actions split

The repository has three separate automation paths:

- `.github/workflows/ci.yml` runs type checking and the normal server build on pull requests and pushes to `main`.
- `.github/workflows/deploy.yml` publishes the read-only public site to GitHub Pages with `GITHUB_PAGES=true`.
- `.github/workflows/production-deploy.yml` deploys the full private OS to the VPS only when `PIGOU_PRODUCTION_DEPLOY_ENABLED=true`.

GitHub Pages is for the public thinking/resume site. It does not run the write APIs, login-backed capture flows, or private OS server runtime.
```

Expected: Deployment docs clearly describe why Pages and server deployment both exist.

- [ ] **Step 4: Validate workflow YAML shape**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
for path in [Path('.github/workflows/ci.yml'), Path('.github/workflows/deploy.yml'), Path('.github/workflows/production-deploy.yml')]:
    text = path.read_text()
    assert 'uses: actions/checkout@v4' in text or path.name == 'production-deploy.yml'
    assert '\t' not in text
print('workflow text checks passed')
PY
```

Expected: prints `workflow text checks passed`.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add .github/workflows/ci.yml .github/workflows/deploy.yml docs/deployment.md
git commit -m "ci: split quality and pages deployment"
```

Expected: commit includes only workflow and deployment documentation files.

---

### Task 4: Final Verification And Browser Review

**Files:**
- No new source files unless verification reveals a defect.

**Interfaces:**
- Verifies: logged-out public homepage route, normal server build, GitHub Pages static build strategy, and responsive visual behavior.

- [ ] **Step 1: Run TypeScript check**

Run:

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 2: Run normal Next build**

Run:

```bash
node scripts/prepare-next-build.mjs && ./node_modules/.bin/next build
```

Expected: exits 0 and produces `.next`.

- [ ] **Step 3: Verify static export in a disposable worktree after commits**

Run:

```bash
rm -rf /tmp/pigou-os-static-check
git worktree add /tmp/pigou-os-static-check HEAD
cd /tmp/pigou-os-static-check
pnpm install --frozen-lockfile
GITHUB_PAGES=true node scripts/prepare-static-export.mjs
GITHUB_PAGES=true pnpm build
cd -
git worktree remove /tmp/pigou-os-static-check --force
```

Expected: static build exits 0 and writes `out` inside the disposable worktree. If `pnpm install` wants to remove or reinstall modules, allow it only inside `/tmp/pigou-os-static-check`.

- [ ] **Step 4: Browser-check the public homepage**

Run the server without invoking pnpm:

```bash
node scripts/prepare-next-cache.mjs
./node_modules/.bin/next dev --webpack -p 3888
```

Open `http://localhost:3888/` logged out and capture desktop and mobile screenshots at 1440px, 1024px, 768px, and 320px widths.

Expected:

- First viewport shows the public brain-map hero, not the private Today cockpit.
- Text does not overlap at 320px.
- Brain lines are hidden on small screens and nodes stack cleanly.
- Header, nav, hero buttons, selected work links, and thinking-system links are keyboard-focusable where interactive.
- Console has no new errors.

- [ ] **Step 5: Manual logged-in path check**

If a local login cookie is available, open `http://localhost:3888/` while logged in.

Expected: existing `TodayPage` renders. If no login cookie is available, inspect `app/page.tsx` and record this as not run, with the code path unchanged from the previous gate.

- [ ] **Step 6: Review final diff**

Run:

```bash
git diff HEAD~3..HEAD -- app/page.tsx components/home/PublicHomepage.tsx app/globals.css .github/workflows/ci.yml .github/workflows/deploy.yml docs/deployment.md
```

Expected: every changed line traces to public homepage, brain-map styling, CI/Pages split, or deployment docs.

- [ ] **Step 7: Report evidence**

Final report must include:

```text
Outcome:
Evidence:
Changed:
Risk:
Unverified:
```

Expected: no required verifier is claimed as passed unless it actually ran and exited successfully.

---

## Self-Review

- Spec coverage: public homepage, logged-in preservation, GitHub Actions split, responsive behavior, reduced motion, and rollback are covered.
- Placeholder scan: no open-ended implementation instructions remain.
- Type consistency: `PublicHomepage` consumes `Project[]` and `UpdateLog[]`, matching `getProjects()` and `getUpdates()` from `lib/data.ts`.
- Scope check: no private workbench redesign, persistence migration, dependency change, or production deployment is included.
