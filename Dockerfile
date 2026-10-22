# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN corepack enable && corepack prepare pnpm@9.9.0 --activate
# Workspace scripts and internal packages participate in pnpm install/postinstall.
COPY . .
RUN --mount=type=cache,id=cloudops-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir=/pnpm/store --registry=${NPM_REGISTRY}
RUN pnpm build:antd

FROM joseluisq/static-web-server:2.33-alpine
RUN apk add --no-cache jq
COPY scripts/deploy/update-config.sh /update-config.sh
COPY scripts/deploy/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /update-config.sh /docker-entrypoint.sh
COPY --from=builder /app/apps/web-antd/dist /public
ENV SERVER_ROOT=/public SERVER_PORT=80 SERVER_FALLBACK_PAGE=/public/index.html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
ENTRYPOINT ["/docker-entrypoint.sh"]
