# PAC CRM — production image
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 \
    DATABASE_URL=file:/data/pac-crm.db
COPY --from=build /app ./
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000
# First boot creates the schema in the empty volume. Later schema changes are a deliberate,
# reviewed step:  docker compose run --rm crm npx drizzle-kit push   (see README → Upgrading)
CMD ["sh", "-c", "[ -f /data/pac-crm.db ] || npx drizzle-kit push --force; npm run start"]
