# Runner image for the capstone: Copilot CLI running headless in a GitLab job.
#
# Every line below that is not the base image or the app toolchain exists because this
# is not the GitHub platform. That is the point of the capstone — count them.
#
# Build on a host with egress to the release sources, then push to the internal registry:
#   docker build -f ci/copilot-runner.Dockerfile -t $CI_REGISTRY_IMAGE/copilot-runner:1 .

FROM node:22-bookworm-slim

# Pin everything. An agent that silently changes version between pipeline runs is not
# something you can put a compliance story around.
ARG COPILOT_CLI_VERSION=1.0.80
ARG GLAB_VERSION=1.48.0
ARG GITLEAKS_VERSION=8.21.2
ARG OSV_SCANNER_VERSION=2.5.1

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl git jq tar \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g "@github/copilot@${COPILOT_CLI_VERSION}"

RUN curl -sSfL -o /usr/local/bin/osv-scanner \
      "https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}/osv-scanner_linux_amd64" \
 && chmod +x /usr/local/bin/osv-scanner

RUN curl -sSfL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz" \
      | tar -xz -C /usr/local/bin gitleaks

RUN curl -sSfL "https://gitlab.com/gitlab-org/cli/-/releases/v${GLAB_VERSION}/downloads/glab_${GLAB_VERSION}_Linux_x86_64.tar.gz" \
      | tar -xz -C /usr/local/bin glab \
 && chmod +x /usr/local/bin/glab

# Machine-wide policy hooks. Root-owned, not world-writable, and cannot be turned off by
# disableAllHooks or by anything in the repository. This is the enforcement point that
# GitHub would otherwise own for you.
COPY --chown=root:root ci/policy.d/ /etc/github-copilot/policy.d/
RUN chmod 0644 /etc/github-copilot/policy.d/*.json

# The agent runs as a non-root user. --allow-all-tools inside a CI container that holds
# deployment credentials is the single largest risk in this design.
RUN useradd --create-home --uid 10001 agent
USER agent

# Pre-seed the config directory so the job never hits an interactive trust prompt.
ENV COPILOT_HOME=/home/agent/.copilot
RUN mkdir -p "$COPILOT_HOME" \
 && printf '%s\n' '{"askUser":false,"autoUpdate":false,"banner":"never","logLevel":"info"}' \
      > "$COPILOT_HOME/settings.json"

WORKDIR /workspace
