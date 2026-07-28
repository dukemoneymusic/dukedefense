# DUKE$DEFENSE has zero npm dependencies, so this image is tiny and builds
# in seconds. Works on any container host — Render, Railway, Fly.io, Koyeb,
# Google Cloud Run, etc. The host injects PORT; server.js binds exactly it.
FROM node:20-alpine

WORKDIR /app
COPY . .

# no `npm install` — there are no dependencies
ENV HOST=0.0.0.0
EXPOSE 8177

CMD ["node", "server.js"]
