# SPDX-License-Identifier: EUPL-1.2
FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM base AS seed
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "db:seed"]

FROM node:22-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build /app/package.json ./package.json
USER node
EXPOSE 3000
CMD ["npm", "start"]
