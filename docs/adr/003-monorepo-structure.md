# 003. 📦 Monorepo with Separate Server and Client Packages

**Status**: ✅ Accepted
**Date**: 2026-03-13
**Deciders**: Engineering team

## 🤔 Context

The BLE$$ P platform consists of two distinct applications:

1. 🖥️ **Server:** An Express 5 REST API (TypeScript) that handles authentication, product catalog, orders, payments, and serves the production SPA
2. 🎨 **Client:** A React 19 SPA (TypeScript) that provides the storefront UI, shopping cart, checkout flow, and admin dashboard

We needed to decide whether to maintain these as separate repositories or colocate them in a single repository.

### 🔍 Alternatives Evaluated

| Approach | Verdict | Reasoning |
|----------|---------|-----------|
| **Separate repositories** (server-repo + client-repo) | ❌ Rejected | Changes that span both frontend and backend (new API endpoints, schema changes, shared types) require coordinated PRs across two repos. Local development requires cloning two repos and managing two sets of environment variables. CI/CD must be synchronized between repos |
| **Monorepo with npm workspaces** (or Turborepo, Nx) | ❌ Rejected | Overkill for a two-package project. Workspace managers add configuration complexity (hoisting rules, dependency resolution quirks) and a learning curve that is not justified for two packages |
| **Monorepo with simple orchestration** | ✅ Selected | A root `package.json` with `concurrently` provides all the orchestration we need. Each package remains self-contained with its own `package.json` and `node_modules`. Simple, explicit, no magic |

## ✅ Decision

We adopt a monorepo structure with two top-level packages: `server/` and `client/`. A root `package.json` provides convenience scripts that orchestrate both packages using `concurrently`.

### 📁 Repository Structure

```
blessp/
├── 📄 package.json          # Root scripts (dev, build, test, lint)
├── 📄 docker-compose.yml    # Production Docker setup
├── 📄 docker-compose.dev.yml # Development Docker setup
├── 📄 Dockerfile            # Multi-stage build for both packages
├── 📄 .env.example          # Environment variable template
├── 📁 docs/                 # Shared documentation
├── 📁 server/               # Express API server
│   ├── 📄 package.json      # Server dependencies and scripts
│   ├── 📁 src/              # TypeScript source code
│   ├── 📁 prisma/           # Schema, migrations, seed
│   └── 📁 tests/            # Unit and integration tests
└── 📁 client/               # React SPA
    ├── 📄 package.json      # Client dependencies and scripts
    ├── 📁 src/              # TypeScript + React source code
    └── 📄 vite.config.ts    # Vite build configuration
```

### 🔧 Key Design Choices

#### 1. No workspace manager required

Each package has its own `package.json` and `node_modules`. The root `package.json` uses `concurrently` and `cd` commands to run scripts in both packages. This avoids:

- npm workspace hoisting conflicts
- Phantom dependency issues
- Turborepo/Nx configuration overhead
- Unexpected dependency resolution behavior

#### 2. Shared development command

```bash
# Starts both server (tsx watch, port 3000) and client (Vite, port 5173)
npm run dev
```

The root `dev` script uses `concurrently` to run both dev servers in parallel with color-coded output.

#### 3. Independent builds

Each package builds independently:

- **Server:** `cd server && npm run build` (TypeScript → JavaScript in `dist/`)
- **Client:** `cd client && npm run build` (Vite production build in `dist/`)

No shared build step, no cross-package dependencies at build time.

#### 4. Single Docker image for production

The multi-stage Dockerfile builds both packages and copies the client's `dist/` output into the server's `public/` directory. The Express server serves the SPA's static files, resulting in a **single deployable container**.

```
Production container:
├── dist/          # Compiled server code
├── public/        # Compiled client code (served by Express)
├── node_modules/  # Server production dependencies
└── prisma/        # Schema and migrations
```

#### 5. Shared documentation

All documentation (API reference, database schema, deployment guide, ADRs) lives in the root `docs/` directory, accessible to both packages.

### 📋 Root package.json Scripts

| Script | What it does |
|--------|-------------|
| `npm run dev` | Starts server (tsx watch) and client (Vite) concurrently |
| `npm run build` | Builds both server and client sequentially |
| `npm run lint` | Lints both packages |
| `npm run test` | Runs tests in both packages |

## 📊 Consequences

### What becomes easier ✅

- **Atomic pull requests** that span both frontend and backend. A new API endpoint and the UI that consumes it can be reviewed and merged together
- **One-command development:** `git clone` + `npm run dev` starts the full stack. No need to coordinate multiple repos
- **Shared configuration:** Docker, CI pipeline, documentation, and environment variables are managed in one place without cross-repo duplication
- **Consistent versioning:** Both packages share the same version number (currently 3.0.0), making it clear which client version is compatible with which server version
- **Simplified code review:** Reviewers see the complete picture of a change (API + UI + tests) in a single PR
- **Docker simplicity:** One Dockerfile, one `docker compose up`, one deployed container

### What becomes harder ⚠️

- **CI runs for both packages** even when only one has changed. This is mitigable with path-based CI triggers (e.g., `paths: ['server/**']`) but we have not implemented this yet because build times are fast enough (under 3 minutes)
- **Repository size grows faster** as both codebases evolve. For a project of this scale, this is not a concern
- **Independent deployment** of client or server requires additional pipeline configuration. Currently, every deployment ships both. This is acceptable because the client and server are tightly coupled (the server serves the client's static files)
- **Contributors working on only one package** still clone the entire repository. The overhead is minimal (the entire repo is under 50 MB including `node_modules`)

### 🔮 Future Considerations

If the project grows to include additional packages (e.g., a shared types library, an admin panel as a separate app, a mobile BFF), we would revisit this decision and evaluate npm workspaces or Turborepo. For two packages, the current approach is the right level of complexity.
