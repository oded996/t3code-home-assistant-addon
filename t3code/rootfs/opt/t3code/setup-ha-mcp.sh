#!/usr/bin/with-contenv bashio
# Configure the Home Assistant MCP server (ha-mcp) for every installed provider.
# The launcher /usr/local/bin/ha-mcp-server injects the Supervisor token, so no
# secrets are written into provider config files.

if [ -z "${SUPERVISOR_TOKEN:-}" ]; then
    bashio::log.warning "SUPERVISOR_TOKEN not available; skipping ha-mcp setup"
    exit 0
fi

bashio::log.info "Configuring ha-mcp for installed providers"

# Claude Code: user scope so every project gets it.
if command -v claude >/dev/null 2>&1; then
    claude mcp remove --scope user home-assistant >/dev/null 2>&1 || true
    if claude mcp add --scope user home-assistant -- /usr/local/bin/ha-mcp-server >/dev/null 2>&1; then
        bashio::log.info "ha-mcp configured for Claude Code"
    else
        bashio::log.warning "Failed to configure ha-mcp for Claude Code"
    fi
fi

# Codex: ~/.codex/config.toml
if command -v codex >/dev/null 2>&1; then
    mkdir -p "${HOME}/.codex"
    CODEX_CFG="${HOME}/.codex/config.toml"
    touch "${CODEX_CFG}"
    if ! grep -q '^\[mcp_servers\.home-assistant\]' "${CODEX_CFG}"; then
        {
            echo ""
            echo "[mcp_servers.home-assistant]"
            echo 'command = "/usr/local/bin/ha-mcp-server"'
        } >> "${CODEX_CFG}"
        bashio::log.info "ha-mcp configured for Codex"
    fi
fi

# OpenCode: ~/.config/opencode/opencode.json
if command -v opencode >/dev/null 2>&1; then
    OC_DIR="${HOME}/.config/opencode"
    OC_CFG="${OC_DIR}/opencode.json"
    mkdir -p "${OC_DIR}"
    if [ ! -f "${OC_CFG}" ]; then
        echo '{"$schema":"https://opencode.ai/config.json"}' > "${OC_CFG}"
    fi
    if ! jq -e '.mcp["home-assistant"]' "${OC_CFG}" >/dev/null 2>&1; then
        jq '.mcp = (.mcp // {}) + {"home-assistant": {"type": "local", "command": ["/usr/local/bin/ha-mcp-server"], "enabled": true}}' \
            "${OC_CFG}" > "${OC_CFG}.tmp" && mv "${OC_CFG}.tmp" "${OC_CFG}"
        bashio::log.info "ha-mcp configured for OpenCode"
    fi
fi
