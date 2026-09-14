ARG BUILD_FROM
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

ARG BUILD_ARCH
ARG T3_VERSION=0.0.40
ARG CLOUDFLARED_VERSION=2026.5.2
ARG HA_MCP_VERSION=3.5.1

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# hadolint ignore=DL3008
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg git jq nano vim-tiny less procps \
        util-linux bsdutils openssh-client \
        python3 python3-pip python3-venv \
        build-essential pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 (required by t3: ^22.16 || ^23.11 || >=24.10)
# hadolint ignore=DL3008
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
        | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
        > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && node --version && npm --version

# T3 Code server (pinned) plus the agent CLIs it drives.
# Provider logins are done remotely through the T3 Code UI after pairing.
# hadolint ignore=DL3016
RUN npm install -g --no-fund --no-audit \
        "t3@${T3_VERSION}" \
        @anthropic-ai/claude-code \
        @openai/codex \
        opencode-ai \
    && npm cache clean --force \
    && t3 --version

# cloudflared: the T3 Connect relay client. Preinstalled so the add-on
# never has to download it at runtime (T3CODE_CLOUDFLARED_PATH points here).
RUN case "${BUILD_ARCH}" in \
        amd64)   CF_ARCH="amd64" ;; \
        aarch64) CF_ARCH="arm64" ;; \
        *) echo "Unsupported BUILD_ARCH: ${BUILD_ARCH}" && exit 1 ;; \
    esac \
    && curl -fsSL -o /usr/local/bin/cloudflared \
        "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-${CF_ARCH}" \
    && chmod +x /usr/local/bin/cloudflared \
    && cloudflared --version

# Home Assistant CLI so agents can run `ha ...` against the Supervisor.
RUN curl -fsSL -o /usr/local/bin/ha \
        "https://github.com/home-assistant/cli/releases/latest/download/ha_${BUILD_ARCH}" \
    && chmod +x /usr/local/bin/ha

# ha-mcp: Home Assistant MCP server (https://github.com/homeassistant-ai/ha-mcp)
RUN python3 -m venv /opt/ha-mcp \
    && /opt/ha-mcp/bin/pip install --no-cache-dir "ha-mcp==${HA_MCP_VERSION}" \
    && ln -s /opt/ha-mcp/bin/ha-mcp /usr/local/bin/ha-mcp

COPY rootfs/ /
RUN chmod +x /run.sh /opt/t3code/*.sh /usr/local/bin/ha-mcp-server

ENV HOME=/data/home \
    T3CODE_HOME=/data/t3code \
    T3CODE_CLOUDFLARED_PATH=/usr/local/bin/cloudflared \
    T3CODE_TELEMETRY_ENABLED=false \
    NODE_OPTIONS=--no-warnings

WORKDIR /config
CMD ["/run.sh"]
