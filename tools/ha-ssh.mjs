// Run a command on the Home Assistant host over SSH (password auth, non-interactive).
// Usage: node tools/ha-ssh.mjs "<command>"
// Config: tools/ha.env (HA_SSH_HOST, HA_SSH_USER, HA_SSH_PASSWORD) — gitignored.
import { Client } from "ssh2";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, "ha.env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const host = process.env.HA_SSH_HOST || "homeassistant.local";
const username = process.env.HA_SSH_USER || "root";
const password = process.env.HA_SSH_PASSWORD;
const command = process.argv.slice(2).join(" ");
if (!command) { console.error("usage: node tools/ha-ssh.mjs <command>"); process.exit(2); }
if (!password) { console.error("HA_SSH_PASSWORD not set (tools/ha.env)"); process.exit(2); }

const conn = new Client();
conn.on("ready", () => {
  conn.exec(command, { pty: false }, (err, stream) => {
    if (err) { console.error(err.message); conn.end(); process.exit(1); }
    stream.on("data", (d) => process.stdout.write(d));
    stream.stderr.on("data", (d) => process.stderr.write(d));
    stream.on("close", (code) => { conn.end(); process.exit(code ?? 0); });
  });
}).on("error", (e) => { console.error("ssh error:", e.message); process.exit(1); })
  .connect({ host, port: 22, username, password, readyTimeout: 15000, tryKeyboard: true })
  .on("keyboard-interactive", (n, i, il, prompts, finish) => finish(prompts.map(() => password)));
