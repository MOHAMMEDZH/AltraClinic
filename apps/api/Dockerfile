# Clinic-test Nest API image (Azure Container Apps / App Service)
#
# Build from repository root:
#   docker build -f apps/api/Dockerfile --ignorefile apps/api/.dockerignore -t clinic-test-api:local .
#
# Entrypoint uses ts-node transpile-only (workspace @booking/* packages ship as .ts).
# Plain `node dist/main.js` is not the clinic-test entrypoint for that reason.

FROM node:20-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

# Workspace manifests (npm workspaces requires every apps/*/package.json present)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/clinic-dashboard/package.json ./apps/clinic-dashboard/
COPY apps/patient-portal/package.json ./apps/patient-portal/
COPY apps/super-admin/package.json ./apps/super-admin/
COPY packages ./packages

RUN npm ci --ignore-scripts \
  && npm rebuild sharp --workspace=booking-system-api || true

# API sources after install for better layer reuse on code-only changes
COPY apps/api ./apps/api

WORKDIR /repo/apps/api
RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npx", "ts-node", "--transpile-only", "src/main.ts"]
