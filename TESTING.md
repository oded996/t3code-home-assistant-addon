# Testing the add-on against the real Home Assistant

This guide is written for an agent (or a human) verifying the add-on on Oded's home
Home Assistant instance. Everything here is reachable from the development machine on the
home LAN.

## Environment

| Item | Value |
| --- | --- |
| Home Assistant URL | `http://homeassistant.local:8123/` (HA OS 18.x, Core 2026.9, amd64) |
| SSH | `root@homeassistant.local`, password in `tools/ha.env` (gitignored) |
| Add-on slug | `f32addfd_t3code` (container name `addon_f32addfd_t3code`, hostname `f32addfd-t3code`, IP on the add-on network) |
| Add-on repo | `https://github.com/oded996/t3code-home-assistant-addon` |
| Images | `ghcr.io/oded996/t3code-{amd64,aarch64}` built by GitHub Actions on push to `main` |
| T3 Code app | `https://app.t3.codes/` (the HA environment appears under T3 Connect once linked) |

## SSH helper

`ssh` on Windows cannot take a password non-interactively, so use the Node helper:

```bash
node tools/ha-ssh.mjs "ha info"
node tools/ha-ssh.mjs "ha apps logs f32addfd_t3code"          # add-on log (may need 'ha addons' on older CLIs)
node tools/ha-ssh.mjs "ha apps info f32addfd_t3code"
node tools/ha-ssh.mjs "ha apps restart f32addfd_t3code"
node tools/ha-ssh.mjs "ha store reload && ha apps update f32addfd_t3code"   # after a new version is published
node tools/ha-ssh.mjs "ha core logs | tail -100"
```

The SSH add-on runs in protection mode, so `docker exec` is NOT available. To look inside the
add-on container use the status server's read-only diagnostics, reachable over the add-on
network from the SSH session:

```bash
node tools/ha-ssh.mjs "curl -s http://f32addfd-t3code:8099/api/status"        # T3 Connect + provider login state
node tools/ha-ssh.mjs "curl -s http://f32addfd-t3code:8099/api/diag"          # versions, env, files
node tools/ha-ssh.mjs "curl -s -X POST http://f32addfd-t3code:8099/api/diag/claude"   # runs 'claude -p' inside the container (up to 2 min)
```

Strip ANSI colour codes from log output with `sed 's/\x1b\[[0-9;]*m//g'`.

## Browser

Use the T3 Code preview tools (`mcp__t3-code__preview_*`). Two tabs are normally open and
already logged in:

- `tab_1`: Home Assistant. The add-on panel is in the sidebar as "T3 Code" (ingress).
- `tab_2`: `https://app.t3.codes/` (the remote T3 Code UI).

Tips:

- `preview_snapshot` returns a very large accessibility tree. Prefer `includeImage=false`
  and, for specific values, `preview_evaluate` with an expression such as
  `document.body.innerText.slice(0, 3000)`.
- If a tab shows a login form, stop and ask Oded to log in; never try credentials.
- The HA add-on panel URL is `http://homeassistant.local:8123/hassio/ingress/f32addfd_t3code`.

## Publishing a new version

1. Bump `version` in `t3code/config.yaml` and add a `CHANGELOG.md` entry.
2. Commit and push to `main`. The "Build add-on" workflow builds both arches (about 10 minutes).
   Check with `gh run list --repo oded996/t3code-home-assistant-addon --limit 3`.
3. On the HA box: `ha store reload && ha apps update f32addfd_t3code`, then read the log.

## Verification checklist

Run these in order and report each as pass/fail with the evidence (log lines, API output,
or what the page shows).

1. **Add-on starts.** Log contains "T3 Code server is ready" and no ERROR lines before it.
   All six "found <cli>" lines are present.
2. **Project registration.** Log shows "Registered project: /config" or "Project already
   registered: /config".
3. **MCP setup.** Log shows "ha-mcp configured for Claude Code" (and Codex / OpenCode).
4. **T3 Connect.** `/api/status` shows `authenticated`, `desired`, and `linked` all true, and
   the log shows "Relay client tunnel connection registered".
5. **Status page renders.** Open the T3 Code panel in `tab_1`; it shows the T3 Connect card
   with three "yes" rows and the Providers card.
6. **Claude works inside the container.** `POST /api/diag/claude` returns `ok: true` and a
   short answer in `stdout`. If it fails, `stderr` has the real error.
7. **Remote thread.** In `tab_2`, pick the Home Assistant environment, start a new thread in
   the "Home Assistant Config" project, send "List the files in the current directory", and
   confirm a reply arrives without red error banners.
8. **MCP from the agent.** In the same thread ask "Use the home-assistant MCP tools to list
   three entities". Confirm the tool call appears and returns entities.

## Reporting

Report findings as a short list: what passed, what failed with the exact error text, and the
most likely cause with the file in this repo that would need to change. Do not modify the
add-on or push anything unless explicitly asked.
