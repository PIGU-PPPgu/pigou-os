# Public Brain Resume Site Design

## Outcome

Pigou OS should serve two clear audiences from the same codebase:

- Public visitors see a polished personal thinking site and resume-style portfolio.
- Logged-in Pigou continues to see the private Today cockpit and existing personal OS tools.

The public site should feel like Pigou's existing Nothing-inspired operating-system interface: monochrome, precise, grid-based, point-display typography, terminal panels, and restrained motion.

## Acceptance Criteria

- The public homepage presents Pigou Wu as an AI education builder, personal knowledge-system maker, and product engineer.
- The public homepage includes a dynamic first-viewport brain-map hero, representative projects, resume/capability highlights, and recent thinking or system-output links.
- Existing private routes, login behavior, JSON content sources, and write APIs keep their current contracts.
- GitHub Actions provide a clear CI quality gate and a GitHub Pages static deployment for the public site.
- Production server deployment remains available as an explicit, variable-gated workflow for the full private OS.
- The implementation is responsive at mobile, tablet, laptop, and desktop widths.
- Motion respects `prefers-reduced-motion`.

## Non-Goals

- Do not redesign the private Today cockpit or internal workbench pages.
- Do not migrate content storage away from local JSON files.
- Do not add a CMS, database, 3D engine, or new visual-design dependency.
- Do not make GitHub Pages host private write flows; static export remains public/read-only.
- Do not rewrite every public route in this pass.

## Current Context

The repository is a Next.js app with Tailwind CSS and local JSON content. The existing design system already has:

- `components/UI.tsx` panel, label, badge, button, progress, and meter primitives.
- `app/globals.css` monochrome tokens, dot grids, scanline motion, panel corners, and reduced-motion support.
- Public screenshots in `public/wechat/assets/` showing the established UI direction.
- Existing GitHub Actions for Pages deployment, production server deployment, and Pigou OS sync.

The strongest current visual direction is the private OS console language. The public homepage needs clearer storytelling, not a new aesthetic.

## Recommended Approach

Use a dual-layer public/private homepage:

- If logged in, `/` renders the existing private Today cockpit.
- If not logged in, `/` renders a new public landing surface.

The public surface should use a dynamic brain-map hero. The center node is Pigou Wu; surrounding nodes represent education AI, teacher workflow products, personal knowledge systems, data analysis, agent engineering, and product shipping. Lines and nodes animate with CSS only, using the current dot-grid and scanline language.

Below the hero:

- Selected Work: three to four projects drawn from existing `content/projects/*.json`, prioritizing shipped or public projects.
- Capability Stack: concise resume-style evidence grouped by product, engineering, education, and systems thinking.
- Thinking System: links into public knowledge, updates, and Pigou OS as a meta-project.

## Architecture

Keep the implementation narrow:

- Add one focused public homepage component under `components/home/`.
- Keep data derivation inside `app/page.tsx` or a small colocated helper if the component grows.
- Reuse existing `Panel`, `ButtonLink`, `StatusBadge`, and CSS token classes.
- Add only the CSS needed for the brain-map hero and responsive layout to `app/globals.css`.
- Update existing public navigation copy only where it improves clarity.

No new runtime dependency is needed.

## GitHub Actions Design

Create a clear workflow split:

- `ci.yml`: runs on pull requests and pushes to `main`; installs with pnpm, runs `pnpm lint`, and runs `pnpm build`.
- `deploy.yml`: deploys the static public build to GitHub Pages on `main` and manual dispatch. It continues using `GITHUB_PAGES=true` and `scripts/prepare-static-export.mjs`.
- `production-deploy.yml`: remains variable-gated with `vars.PIGOU_PRODUCTION_DEPLOY_ENABLED == 'true'` for full server deployment.
- `pigou-sync.yml`: remains the scheduled/manual content sync workflow.

The CI workflow should not require production secrets. Static Pages deploy should not claim to support private write APIs.

## Error Handling And Fallbacks

- If static export patches private pages, locked private pages remain readable as login-required screens.
- If project data is missing, public homepage sections render empty-safe copy and avoid broken links.
- If motion is disabled by the user, brain-map animation collapses to a stable static composition.
- If GitHub Pages base path is active, asset and route behavior continues through existing `next.config.mjs`.

## Testing And Evidence

Implementation should be verified with:

- `pnpm lint` for TypeScript correctness.
- `GITHUB_PAGES=true pnpm build` for static export.
- A normal `pnpm build` for server-rendered private OS compatibility.
- Browser screenshots at 320px, 768px, 1024px, and 1440px if local browser verification can run without destructive dependency reinstall.
- Manual inspection that logged-out `/` shows the public site and logged-in behavior remains unchanged by code path.

## Rollback

Rollback is straightforward:

- Revert the homepage component and CSS changes to restore the previous public homepage.
- Revert CI workflow additions if they block unexpectedly.
- Existing production deploy remains disabled unless the repository variable explicitly enables it.

## Self-Review

- No unresolved decisions remain in this spec.
- Scope is a single coherent pass: public homepage/storytelling plus CI workflow cleanup.
- The implementation avoids speculative dependencies and preserves the private OS boundary.
- Acceptance criteria map to concrete build, lint, static export, and browser checks.
