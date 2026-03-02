ARG CONTAINER_VERSION=alpine
FROM oven/bun:${CONTAINER_VERSION} as builder

WORKDIR /usr/src/app

COPY . .

RUN bun install \
  --prefer-offline \
  --frozen-lockfile \
  --non-interactive

RUN bun run build

FROM oven/bun:${CONTAINER_VERSION} as production

ENV TIMEZONE=Europe/Paris \
  LANG=fr_FR.UTF-8

WORKDIR /usr/src/app

ADD package.json .
ADD *.lock .

RUN apk add --no-cache tzdata && \
  ln -s /usr/share/zoneinfo/${TIMEZONE} /etc/localtime && \
  echo "${TIMEZONE}" > /etc/timezone

RUN bun install \
  --prefer-offline \
  --frozen-lockfile \
  --non-interactive \
  --production

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 4000

CMD ["bun", "run", "start:prod"]
