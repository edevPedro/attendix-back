FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates ffmpeg espeak-ng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ENV POSTGRESQL_URL=postgresql://attendix:attendix@postgres:5432/attendix
RUN pnpm prisma:generate && pnpm build

EXPOSE 3300
CMD ["sh", "-c", "pnpm prisma:migrate && exec node dist/main"]
