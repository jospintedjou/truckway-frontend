# syntax=docker/dockerfile:1
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
# npm ci installs exactly the lockfile; retries ride out flaky connections,
# and the cache mount keeps downloaded packages between rebuilds
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci --no-audit --no-fund

COPY . .

# Empty = call the API on the same origin (/api, proxied by nginx below)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine
ENV API_UPSTREAM=http://host.docker.internal:8021
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
