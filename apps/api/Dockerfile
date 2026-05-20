FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --filter @payflow/api --filter @payflow/database --filter @payflow/shared

# Build
FROM deps AS builder
COPY . .
RUN pnpm --filter @payflow/database db:generate
RUN pnpm --filter @payflow/api build

# Production
FROM node:20-alpine AS runner
RUN npm install -g pnpm@9.15.0
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json .

EXPOSE 4000
CMD ["node", "dist/main"]
