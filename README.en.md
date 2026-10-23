# AI-CloudOps Web

**English** | [简体中文](README.md)

The web console for **AI-CloudOps**, an open-source, AI-assisted cloud-native operations platform. It provides the user interface for Kubernetes management, the service tree / CMDB, Prometheus monitoring and alerting, ticketing, scheduled jobs, RBAC, and the AIOps features (root cause analysis, load prediction, operations assistant and auto-remediation).

[![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Project Components

AI-CloudOps is made up of three repositories that are deployed together:

| Repository | Role | Stack |
| --- | --- | --- |
| **[AI-CloudOps](https://github.com/GoSimplicity/AI-CloudOps)** | Backend API, authentication/RBAC, and gateway to the AI service | Go, Gin, GORM, MySQL, Redis |
| **[AI-CloudOps-web](https://github.com/GoSimplicity/AI-CloudOps-web)** (this repo) | Web console | Vue 3, TypeScript, Vben Admin, Ant Design Vue |
| **[AI-CloudOps-aiops](https://github.com/GoSimplicity/AI-CloudOps-aiops)** | AIOps service: RCA, prediction, assistant (RAG + MCP), auto-remediation | Python, FastAPI, LangGraph, scikit-learn |

The console talks **only to the Go backend**. Both `/api` and `/api/v1` (AI features) are authenticated by the backend with JWT and role permissions. The backend then forwards AI requests to the AIOps service with an internal key. The browser never sees that key.

## Features

Pages included in the console (`apps/web-antd/src/views`):

- **Dashboard and system:** welcome page with real host CPU/memory/disk/load samples (values that have not been collected are shown as pending, never faked), users, roles, API permissions, audit log.
- **Service tree / CMDB:** tree node management, local hosts, browser SSH terminal (xterm.js over WebSocket), cloud accounts and cloud resources. The account form currently enables **Alibaba Cloud** only; existing assets from other providers can still be viewed.
- **Kubernetes:** clusters, namespaces, nodes, pods, deployments, statefulsets, daemonsets, services, ingresses, configmaps, secrets, PVs/PVCs, roles and bindings, YAML templates and tasks.
- **Monitoring and alerting:** Prometheus configuration, scrape pools and jobs, alert rules, recording rules, alert events, on-duty groups and send groups.
- **Ticketing:** categories, form designer, process designer, templates, ticket instances and notification settings.
- **Scheduled jobs:** cron job management.
- **AIOps:** operations assistant (sessions, queries, knowledge base), root cause analysis, load prediction, and the auto-remediation workflow with human confirmation.

Accounts are created by an administrator. Self sign-up, SMS, QR-code and third-party login are not provided. List exports produce UTF-8 CSV with formula-injection protection. Audit and ticket exports cover the current page only.

## Tech Stack

- [Vue 3.5](https://vuejs.org/) + TypeScript, built with [Vite](https://vitejs.dev/)
- [Vben Admin 5](https://github.com/vbenjs/vue-vben-admin) monorepo (pnpm workspaces + Turborepo)
- [Ant Design Vue 4](https://antdv.com/), Pinia, Vue Router, ECharts, xterm.js, Tailwind CSS
- Vitest for unit tests, Playwright for end-to-end tests

## Repository Layout

```text
AI-CloudOps-web/
├── apps/web-antd/          # The AI-CloudOps console application
│   └── src/
│       ├── api/            # API clients for the Go backend
│       ├── views/          # Pages (k8s, servicetree, prometheus, workorder, cron, rca, predict, assistant, autofix, ...)
│       ├── router/         # Route modules
│       ├── components/     # Shared components (incl. the OpsPage layout)
│       └── store/          # Pinia stores
├── packages/               # Shared Vben packages (@core, stores, styles, locales, ...)
├── internal/               # Build tooling (vite-config, lint configs, tsconfig)
├── scripts/deploy/         # Container entrypoint and runtime config injection
├── tests/                  # Playwright end-to-end tests
├── docs/release/           # Frontend refactor acceptance notes
├── DESIGN.md               # UI conventions
└── SECURITY.md             # Frontend security notes
```

## Quick Start

### Requirements

- Node.js 22 (Node.js >= 20 is the minimum in `package.json`)
- pnpm 9.9.0 (`corepack enable && corepack prepare pnpm@9.9.0 --activate`)
- A running [AI-CloudOps backend](https://github.com/GoSimplicity/AI-CloudOps), by default on `http://localhost:8889`

### Install and run

```bash
git clone https://github.com/GoSimplicity/AI-CloudOps-web.git
cd AI-CloudOps-web
pnpm install --frozen-lockfile
pnpm dev
```

The dev server runs at `http://localhost:5666` and binds to `127.0.0.1`. Requests to `/api` and `/api/v1` (including WebSockets) are proxied to the backend. To point at a different backend:

```bash
VITE_PROXY_TARGET=http://127.0.0.1:8889 pnpm dev
```

Run `pnpm install --frozen-lockfile` again after the first install or after moving the directory, so the internal workspace stubs are regenerated.

### Configuration

Build-time settings live in `apps/web-antd/.env*`:

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_PORT` | `5666` | Dev server port |
| `VITE_GLOB_API_URL` | `/api` | Backend API base path |
| `VITE_GLOB_AIOPS_URL` | `/api/v1` | AI API base path (served through the Go gateway) |
| `VITE_ROUTER_HISTORY` | `hash` (production) | Vue Router history mode |

> **Security:** every `VITE_*` / `VITE_GLOB_*` value is shipped to the browser. Never put the AIOps API key, cloud secret keys or any other server-side credential there. See [SECURITY.md](SECURITY.md).

## Build and Test

```bash
pnpm -F @vben/web-antd typecheck   # type check
pnpm test:unit --run               # unit tests (Vitest)
pnpm build:antd                    # production build -> apps/web-antd/dist
```

Verify the real production bundle, not only the Vite dev mode:

```bash
pnpm build:antd
CLOUDOPS_PREVIEW=true CLOUDOPS_ROUTER_HISTORY=hash pnpm test:e2e --grep "login is usable"
```

Full-route end-to-end tests run against an isolated environment. Credentials are read from environment variables or an env file and are never recorded:

```bash
VITE_PROXY_TARGET=http://127.0.0.1:17889 pnpm -F @vben/web-antd exec vite --mode development --port 5667
CLOUDOPS_WEB_URL=http://127.0.0.1:5667 CLOUDOPS_TEST_ENV_FILE=/absolute/path/to/isolated/.env pnpm test:e2e
```

The tests use local Chrome by default. Set `PLAYWRIGHT_CHANNEL=chromium` to use Playwright's Chromium. CI (`.github/workflows/verify.yml`) runs typecheck, unit tests, the production build and the production login check.

## Deployment

The `Dockerfile` builds the app with Node 22 / pnpm 9.9.0 and serves the static `dist` with [static-web-server](https://static-web-server.net/) on port 80, with an HTTP health check. At start-up, the entrypoint writes only `VITE_GLOB_*` public settings into `_app.config.js`.

```bash
docker build -t cloudops-web .
# In restricted networks:
docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com -t cloudops-web .
```

The recommended way to run the whole platform is the release Compose bundle in the backend repository ([`deploy/release`](https://github.com/GoSimplicity/AI-CloudOps/tree/main/deploy/release)). It serves this console and the API from the same origin behind nginx.

## Online Demo

The public online demo is **temporarily unavailable**. Please use the Docker Compose deployment in the [backend repository](https://github.com/GoSimplicity/AI-CloudOps#deployment-all-three-services) to try the platform locally.

## Contributing

1. Fork the repository and create a feature branch.
2. Follow [DESIGN.md](DESIGN.md) for UI conventions, and run typecheck, unit tests and the build before submitting.
3. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
4. Open a pull request describing the change and how it was tested.

## License

This repository is licensed under the [MIT License](LICENSE). It is based on [Vben Admin](https://github.com/vbenjs/vue-vben-admin), which is also MIT-licensed.

## Contact

- **Email:** <wzijian62@gmail.com>
- **WeChat:** GoSimplicity
- **Issues:** <https://github.com/GoSimplicity/AI-CloudOps-web/issues>

## Acknowledgements

Thanks to everyone who has contributed to AI-CloudOps, and to [Vben Admin](https://github.com/vbenjs/vue-vben-admin), [Vue.js](https://vuejs.org/), [Ant Design Vue](https://antdv.com/) and the other open-source projects this console builds on.
