# syntax=docker/dockerfile:1

# Base image pinned to an immutable digest rather than a moving tag.
# `node:22-bookworm-slim` is the multi-arch OCI index for that tag as of pinning;
# to update, re-resolve the digest deliberately rather than letting a rebuild
# silently pick up a different image.
FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS base
WORKDIR /app

# ---------------------------------------------------------------- dependencies
# Resolved in their own stage so that npm, the lockfile, and anything npm leaves
# behind stay out of the image that actually ships.
FROM base AS deps

# Copy only the manifests first. This layer is rebuilt when dependencies change,
# not when application source changes.
COPY package.json package-lock.json ./

# `npm ci` installs strictly from the lockfile and fails if package.json and the
# lockfile disagree. `--omit=dev` keeps development-only packages out of the
# final image.
RUN npm ci --omit=dev

# --------------------------------------------------------------------- runtime
FROM base AS runtime

ENV NODE_ENV=production

# Only the resolved production dependencies come across — no npm cache, no
# lockfile, no build tooling.
COPY --from=deps /app/node_modules ./node_modules

# Application source. package.json is included so the `commonjs` type and
# metadata resolve at runtime.
COPY package.json ./
COPY src/ ./src/

# `node` (uid 1000) ships with the official Node images. Running as a non-root
# user means a process escape does not start as root inside the container.
# Application files are deliberately left root-owned: the runtime user can read
# and execute them but cannot modify its own code at runtime.
USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
