# T3 Code for Home Assistant

[![Build add-on](https://github.com/oded996/t3code-home-assistant-addon/actions/workflows/builder.yaml/badge.svg)](https://github.com/oded996/t3code-home-assistant-addon/actions/workflows/builder.yaml)

Run a headless [T3 Code](https://github.com/pingdotgg/t3code) server on your Home Assistant
box and control AI coding agents (Claude Code, Codex, OpenCode) from the T3 Code app on your
phone or desktop through **T3 Connect**.

There is no T3 Code UI on Home Assistant itself. The add-on only exposes a small status page
to sign in to T3 Connect. Everything else, including provider logins, is done remotely from
the T3 Code app.

## Install

1. In Home Assistant go to **Settings → Add-ons → Add-on Store → ⋮ → Repositories**.
2. Add `https://github.com/oded996/t3code-home-assistant-addon`.
3. Install **T3 Code**, start it, and open its panel from the sidebar.
4. Click **Start sign-in**, open the link on any device, sign in to your T3 account, and paste
   the one-time code back into the page.
5. Open the T3 Code app on your phone or desktop, sign in with the same account, and pick the
   Home Assistant environment.

See [t3code/DOCS.md](t3code/DOCS.md) for configuration, LAN mode, and troubleshooting.

## What is inside

- T3 Code server (pinned version, see `t3code/build.yaml`) running `t3 serve`
- Claude Code, Codex, and OpenCode CLIs preinstalled; log in to them from the T3 Code app
- `ha-mcp` Home Assistant MCP server preconfigured for every provider, authenticated with the
  add-on's Supervisor token
- `ha` CLI and git
- `/config` registered as a project, with optional extra project directories

## Development

The add-on is built by GitHub Actions with the official Home Assistant builder and published to
`ghcr.io/oded996/t3code-{arch}`. To build locally:

```bash
docker run --rm --privileged -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PWD":/data ghcr.io/home-assistant/amd64-builder --test --amd64 --target t3code
```
