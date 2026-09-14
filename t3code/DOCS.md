# T3 Code add-on

Runs a headless [T3 Code](https://github.com/pingdotgg/t3code) server inside Home Assistant.
You control it remotely from the T3 Code app (iOS, Android, web, or desktop). The add-on
itself only serves a small status page for signing in to T3 Connect.

## First run (T3 Connect)

1. Start the add-on and open the **T3 Code** panel in the sidebar.
2. Click **Start sign-in**. A login link appears.
3. Open the link on any device, sign in to your T3 account, and copy the one-time code.
4. Paste the code into the status page and submit.
5. Click **Restart server now**. The server links to T3 Connect and becomes reachable.
6. In the T3 Code app, sign in with the same account. The Home Assistant environment
   appears under T3 Connect.

The same instructions are printed in the add-on **Log** tab if you prefer to follow them
from there.

Once connected, log in to your providers from the T3 Code app (Settings → Providers).
Credentials are stored in the add-on's `/data` directory and survive restarts and updates.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `remote_mode` | `t3_connect` | `t3_connect` uses the managed relay (no ports to open). `lan` binds the server to a port for direct pairing on your network. |
| `lan_port` | `3773` | Port used in `lan` mode. Also expose it under the add-on's Network section. |
| `extra_project_dirs` | `[]` | Additional directories to register as T3 Code projects, for example `/addons/my-addon` or `/share/projects`. |
| `git_init_config` | `false` | Run `git init` in `/config` on start if it is not a repository. T3 Code works best with git projects. |
| `enable_ha_mcp` | `true` | Configure the `ha-mcp` Home Assistant MCP server for Claude Code, Codex, and OpenCode. |
| `log_level` | `info` | T3 Code server log level. |

## LAN mode

Set `remote_mode: lan`, expose the port in the add-on's Network section, and restart. On each
start the log prints a connection string, token, and pairing URL. The host in that URL is the
container's address, so replace it with your Home Assistant IP before pasting it into the
T3 Code app. Treat the pairing URL as a password.

## Home Assistant MCP

The add-on ships `ha-mcp` and points each installed provider at it through the launcher
`/usr/local/bin/ha-mcp-server`, which injects the add-on's Supervisor token at run time. No
secrets are written into provider config files. The agents can read states, call services,
inspect history and logs, and manage automations. The `ha` CLI is also available for direct
Supervisor commands.

## Mounted directories

`/config` (read-write), `/addons` (read-write), `/share` (read-write), `/ssl` (read-only).
`/config` is registered as the default project.

## Security notes

- Anyone who can reach your T3 Connect account or a pairing link can run agents with full
  read-write access to your Home Assistant configuration. Protect that account.
- Provider CLIs run inside the container as root, as is standard for add-ons.
- The status page is only reachable through Home Assistant ingress (admin users).

## Troubleshooting

- **"Relay client" shows unsupported or missing**: the bundled `cloudflared` did not start.
  Check the log for details and open an issue with your architecture.
- **Signed in but not linked**: the server links on its next start. Restart the add-on.
- **Code rejected**: open the login link again to get a fresh code. Codes are single use.
- **Agent cannot see Home Assistant tools**: confirm `enable_ha_mcp` is on and check the log
  for "ha-mcp configured".
