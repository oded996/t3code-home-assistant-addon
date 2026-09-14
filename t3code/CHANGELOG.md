## 0.1.4

- Fix sign-in links polluted by terminal hyperlink escape codes.
- Read-only diagnostics endpoints on the status server (/api/diag, /api/diag/claude).

## 0.1.3

- Status page: sign in to Claude Code and Codex on this server (headless login flows).
- New options claude_code_oauth_token, anthropic_api_key, openai_api_key as an alternative.

## 0.1.2

- Add bubblewrap for the Codex sandbox.
- Log the output of `t3 project add` so registration problems are visible.

## 0.1.1

- Fix startup crash: t3 rejects lowercase T3CODE_LOG_LEVEL; pass --log-level only.
- Fix status page and startup check failing to parse `t3 connect status --json` output.
- Disable bashio errexit so a failed `t3 serve` is retried instead of stopping the add-on.
- Log which CLIs are present at startup.

## 0.1.0

- Initial release: headless `t3 serve`, T3 Connect sign-in through the ingress status page,
  LAN pairing mode, `/config` project registration, `ha-mcp` for Claude Code / Codex / OpenCode.
