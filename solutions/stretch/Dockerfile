# Facilitator reference: what a good answer to the Dockerfile stretch goal looks like.
#
# The starting point (lab-app/Dockerfile on main) gets all four things wrong:
#   FROM node:latest   unpinned, and the full ~1.1GB image
#   COPY . .           ships tests, .git, and anything else in the context
#   npm install        resolves fresh, ignores the lockfile, installs devDependencies
#   no USER            runs as root
#
# Attendees will not produce this exactly. Anything that pins a digest, splits the
# build, omits dev dependencies from the final stage, and drops privileges is a pass.
# Build from the lab-app/ directory:  docker build -t lab-app:hardened lab-app/

# ---------------------------------------------------------------------------
# CHANGE 1 - pin the base image to a digest, not a tag.
#
# `node:latest` is a moving target: two people building on the same day can get
# different images, and a rebuild months later is a different OS. A digest is
# content-addressed, so this line always resolves to the exact same bytes.
#
# The tag before the @ is documentation for humans only - the digest is what is
# actually fetched. Also note this is `-slim`, which is a security change in its
# own right: fewer packages in the image is fewer CVEs your scanner has to triage.
#
# Digest below is node:22-bookworm-slim as of 2026-08-27. Refresh it with:
#   docker buildx imagetools inspect node:22-bookworm-slim
# Pinning is only half the job - something has to bump the pin when it goes stale.
# Renovate or Dependabot does this; a comment telling people to remember does not.
# ---------------------------------------------------------------------------

# CHANGE 2 - multi-stage build, part 1: the build stage.
# This stage is allowed to be dirty. It carries devDependencies, the test suite and
# the full source tree, none of which reach the final image. Multi-stage is only
# worth doing if the stages actually differ; here the difference is real.
FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS build

WORKDIR /app

# Copy the manifests before the source. Layer caching keys on file content, so an
# edit to src/ does not invalidate the (slow) dependency install below.
COPY package.json package-lock.json ./

# `npm ci` not `npm install`: it installs exactly what package-lock.json specifies
# and fails if the lockfile and manifest disagree. `npm install` silently resolves
# new versions, which defeats the point of having remediated a pinned advisory in
# Lab 1. --ignore-scripts blocks arbitrary code execution from install hooks.
RUN npm ci --ignore-scripts

COPY src ./src
COPY test ./test

# Test inside the image, against the dependency tree the image will actually ship.
# Passing on a developer laptop proves less than passing here.
RUN npm test

# ---------------------------------------------------------------------------
# CHANGE 3 - production dependencies only in the final stage.
#
# This is a separate `npm ci` rather than `npm prune --omit=dev` on the tree above,
# so the result is derived from the lockfile rather than from whatever pruning
# leaves behind. Same lockfile, so the versions are identical to those just tested.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---------------------------------------------------------------------------
# The final image. Nothing is installed here and no shell command builds anything -
# everything is copied in from a stage that has already been verified.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS runtime

# Signals intent to the runtime and to any library that branches on it. It does not
# by itself prevent devDependencies being present - the stage split above does that.
ENV NODE_ENV=production

WORKDIR /app

# CHANGE 4 - run as a non-root user.
#
# The official Node images ship an unprivileged `node` user (uid 1000). Use it
# rather than creating one: it already exists, and its uid is stable across rebuilds,
# which matters if a volume mount has to line up with it.
#
# --chown on COPY, not a separate RUN chown: a `RUN chown -R` writes a second full
# copy of the files into a new layer and doubles that part of the image.
#
# Files stay owned by node but the app never writes to them, so nothing here is
# writable by the process that runs it. That is deliberate.
COPY --from=deps  --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# USER must come after the COPYs - the copies need to be able to write to /app.
# Anything after this line runs unprivileged, including CMD.
USER node

EXPOSE 3000

# Beyond the four things the prompt asked for, but the container is unreachable
# without it: src/config.js defaults host to 127.0.0.1, which inside a container
# means "loopback of this container only". EXPOSE and -p publish nothing if the
# process is not listening on 0.0.0.0. Good thing to have someone discover by
# running the image rather than by being told.
CMD ["node", "src/server.js", "--host", "0.0.0.0"]

# ---------------------------------------------------------------------------
# What a real hardening review would ask for next, and this file does not do.
# Useful if someone finishes early and wants somewhere to go.
#
#   - A .dockerignore. Without one the build context still uploads .git,
#     node_modules and findings.json to the daemon. The COPY lines here are
#     specific enough that none of it lands in the image, but it is all still
#     sent, and `COPY . .` in a later edit would ship the lot.
#   - `--init`, or tini as PID 1. Node as PID 1 does not reap zombies and
#     handles SIGTERM differently, which shows up as slow shutdowns.
#   - A HEALTHCHECK against /healthz.
#   - A read-only root filesystem at runtime (`docker run --read-only`), plus
#     `--cap-drop ALL` and `--security-opt no-new-privileges`. Note that these
#     are runtime flags: they belong to whoever deploys the image, not to this
#     file. Hardening the Dockerfile is not the same as hardening the container.
#   - Scanning the built image, not just the dependency manifest. `osv-scanner`
#     reads package-lock.json; it says nothing about the Debian packages in the
#     base layer.
# ---------------------------------------------------------------------------
