# Derive resume.html from index.html at build time. index.html is the single
# source of truth; nothing about the resume is hand-maintained, so it cannot
# drift out of sync the way a second hand-edited page would.
FROM node:22-alpine AS build
WORKDIR /app
COPY index.html build-resume.js ./
RUN node build-resume.js

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html /srv/
COPY --from=build /app/resume.html /srv/
