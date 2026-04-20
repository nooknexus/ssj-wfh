# Project: WFH App
# Antigravity Rules — place this file at the repository root

## Tech Stack
- Frontend: Next.js 16 App Router with tRPC
- Styling: Tailwind CSS v4.2 with shadcn/ui and use Lucide Icons for icons do not use emoji
- Testing: Vitest + React Testing Library
- Package manager:NPM
- Database: Mysql

## Code Style
- Always TypeScript; strict mode enabled; no `any`.
- Named exports only; no default exports except Next.js pages.
- Functional components only; no class components.
- RSC by default; `'use client'` only when state or browser APIs are needed.
- Prefer `const` arrow functions for components and pure utilities.
- Max function length: 40 lines. Max nesting: 2 levels.

## Commands
- Dev server: `npm dev`
- Type check: `npm typecheck`
- Lint: `npm lint`
- Test: `npm test`
- Build: `npm build`

## Testing
- Every new function needs at least one unit test.
- Test files live next to the module: `foo.ts` → `foo.test.ts`
- Run `bun test` before every commit suggestion.
- Coverage floor: 80%. Alert me if a PR would drop it below that.

## Git
- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- Never commit to `main` directly. Branch pattern: `type/short-description`
- Each commit = one logical change.

## Security
- Never hardcode secrets; use environment variables only.
- Ask for approval before any destructive shell command.
- Never read .env files and output their contents.

## Communication
- Be concise. No preamble.
- List every file you plan to modify before starting.
- If a change touches more than 3 files, ask for approval first.
- Summarise completed multi-step tasks in 3 bullet points.