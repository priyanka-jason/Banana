# Banana frontend

Independent React + TypeScript app built with Vite. This is an environment
starter; product design comes next. No backend, database, or external keys are
required to run it.

## Start locally

Use Node.js **24** and npm **11 or newer**. If you use nvm, run `nvm use` here.

```sh
cd frontend # from the repository root
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Saving source files updates the browser automatically.
Stop the server with Ctrl+C. If port 5173 is occupied, stop the existing server
or use `npm run dev -- --port 5174`.

```sh
npm run check    # TypeScript, Oxlint, and formatting
npm run format   # apply formatting
npm run build    # production output in dist/
npm run preview  # production preview on port 4173
```

`npm ci` installs the versions in `package-lock.json`. Use `npm install <package>`
when intentionally changing dependencies. Keep package commands and the
lockfile in this directory.

## Source layout

- `src/App.tsx`: app composition; replace the starter when product design begins.
- `src/main.tsx`: React entry point.
- `src/index.css`: global styles; `src/App.css`: starter styles.
- `src/components/`: reusable UI components, added as needed.
- `src/features/`: product features, added as needed.
- `src/lib/`: API client and shared helpers, added as needed.
- `public/`: static assets served without processing.

## Working alongside the backend team

The frontend owns this directory, its configuration, and its lockfile. Backend
contributors can create `backend/` with their own stack and dependencies. There
is no root npm workspace or shared package installation.

Use a separate Git branch per task. The initial local setup branch is
`frontend/setup`. Folder boundaries reduce conflicts but do not prevent them:
coordinate root documentation and API contract changes with the team.

Agree on endpoint paths, fields, errors, authentication, and the backend's local
port before wiring real data. Until then, keep clearly labelled mock fixtures
in `src/` rather than changing backend code.

To use a local backend, copy `.env.example` to `.env.local`, set
`API_PROXY_TARGET` to the backend's address, and restart Vite. Requests such as
`fetch('/api/...')` are forwarded with the full `/api/...` path unchanged.
This config does not define an endpoint or require backend port 3000.
Without `API_PROXY_TARGET`, the proxy is disabled.

The proxy only runs during Vite development. Production needs a same-origin
reverse proxy or an agreed API origin and CORS strategy. Never place secrets
in browser code or `VITE_*` variables: those values are public. Local `.env`
files are ignored by Git; `.env.example` is safe to commit.

## Working with Codex

Available skills on Alan's machine:

- **Build Web Apps / frontend-app-builder** for future screen design and implementation.
- **React best practices** for component structure, data flow, and performance.
- **Frontend testing/debugging** for responsive and interaction checks.
- **Playwright** for browser checks when a dedicated Browser plugin is unavailable.
- **Image generation** for visual concepts and assets when design work calls for it.

These skills are already installed in Codex; teammates use their own tool setup.
No extra service connection is required to run this frontend.
