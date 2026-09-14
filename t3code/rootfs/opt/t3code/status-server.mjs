// Minimal ingress status page for the T3 Code add-on.
// Shows T3 Connect login state and drives the headless (out-of-band OAuth)
// login flow: start -> show URL -> user pastes one-time code -> done.
// No T3 Code UI is served here; remote clients connect through T3 Connect.

import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import { spawn, execFile } from "node:child_process";

const PORT = 8099;
const MODE = process.env.T3CODE_REMOTE_MODE || "t3_connect";
const LAN_PORT = process.env.T3CODE_LAN_PORT || "3773";

// ---- t3 helpers -----------------------------------------------------------

function t3(args) {
  return new Promise((resolve) => {
    execFile("t3", args, { env: process.env, timeout: 30000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout || "", stderr: stderr || "" });
    });
  });
}

async function connectStatus() {
  const r = await t3(["connect", "status", "--json"]);
  try {
    return JSON.parse(r.stdout.trim());
  } catch {
    return { error: (r.stderr || r.stdout).trim() || "t3 connect status failed" };
  }
}

// ---- headless link session ------------------------------------------------
// `t3 connect link --headless` prints an authorize URL then prompts for the
// code on a TTY. We wrap it in `script` to give it a pty and feed stdin.

let session = null; // { proc, output, url, state, error, startedAt }

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
}

function startLink() {
  if (session && (session.state === "starting" || session.state === "waiting_for_code" || session.state === "submitted")) {
    return session;
  }
  const proc = spawn(
    "script",
    ["-qfec", "t3 connect link --headless", "/dev/null"],
    { env: { ...process.env, TERM: "dumb", NO_COLOR: "1" } },
  );
  const s = { proc, output: "", url: null, state: "starting", error: null, startedAt: Date.now() };
  session = s;
  const onData = (chunk) => {
    s.output += chunk.toString();
    const clean = stripAnsi(s.output);
    if (!s.url) {
      const m = clean.match(/https?:\/\/[^\s'"<>]+/);
      if (m) s.url = m[0].replace(/[),.]+$/, "");
    }
    if (s.url && s.state === "starting" && /Authorization code/i.test(clean)) s.state = "waiting_for_code";
    if (/Authorized|Signed in/.test(clean)) s.state = "done";
    if (s.state === "submitted" && /invalid|rejected|expired|error|failed|denied/i.test(clean.slice(-400))) {
      s.state = "waiting_for_code";
      s.error = "The code was rejected. Open the link again and paste a fresh code.";
    }
  };
  proc.stdout.on("data", onData);
  proc.stderr.on("data", onData);
  proc.on("exit", (code) => {
    if (s.state !== "done") {
      s.state = "failed";
      s.error = s.error || `Login process exited with code ${code}. See the add-on log.`;
      console.log("[status] link process output:\n" + stripAnsi(s.output));
    }
  });
  return s;
}

function submitCode(code) {
  if (!session || session.state === "done" || session.state === "failed") {
    return { ok: false, error: "No login in progress. Click 'Start sign-in' first." };
  }
  session.error = null;
  session.state = "submitted";
  session.proc.stdin.write(code.trim() + "\n");
  return { ok: true };
}

function publicSession() {
  if (!session) return null;
  return { state: session.state, url: session.url, error: session.error, startedAt: session.startedAt };
}

// ---- server restart -------------------------------------------------------

function restartServer() {
  // run.sh loops on t3 serve; the marker file tells it this exit was requested.
  fs.writeFileSync("/tmp/t3-restart-requested", "1");
  execFile("pkill", ["-f", "t3 serve"], () => {});
  return { ok: true };
}

function lanInfo() {
  const ifaces = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === "IPv4" && !a.internal) ifaces.push(`${name}: ${a.address}`);
    }
  }
  return { port: LAN_PORT, ifaces };
}

// ---- HTTP -----------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      try {
        resolve(b ? JSON.parse(b) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  const ingressPath = req.headers["x-ingress-path"] || "";
  const url = new URL(req.url, "http://localhost");
  let path = url.pathname;
  if (ingressPath && path.startsWith(ingressPath)) path = path.slice(ingressPath.length) || "/";

  if (req.method === "GET" && path === "/api/status") {
    return json(res, 200, {
      mode: MODE,
      connect: await connectStatus(),
      session: publicSession(),
      lan: MODE === "lan" ? lanInfo() : null,
    });
  }
  if (req.method === "POST" && path === "/api/link/start") {
    const s = startLink();
    for (let i = 0; i < 60 && !s.url && s.state === "starting"; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return json(res, 200, publicSession());
  }
  if (req.method === "POST" && path === "/api/link/code") {
    const body = await readBody(req);
    if (!body.code) return json(res, 400, { ok: false, error: "Missing code" });
    return json(res, 200, submitCode(String(body.code)));
  }
  if (req.method === "POST" && path === "/api/unlink") {
    const r = await t3(["connect", "unlink"]);
    return json(res, 200, { ok: r.ok, output: (r.stdout + r.stderr).trim() });
  }
  if (req.method === "POST" && path === "/api/logout") {
    const r = await t3(["connect", "logout"]);
    session = null;
    return json(res, 200, { ok: r.ok, output: (r.stdout + r.stderr).trim() });
  }
  if (req.method === "POST" && path === "/api/restart") {
    return json(res, 200, restartServer());
  }
  if (req.method === "GET" && (path === "/" || path === "")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return res.end(PAGE.replace("__BASE__", ingressPath));
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "0.0.0.0", () => console.log(`[status] listening on ${PORT} (mode=${MODE})`));

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>T3 Code</title>
<style>
 body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#111;color:#eee;max-width:720px}
 h1{font-size:20px;margin:0 0 16px} h2{font-size:13px;margin:0 0 12px;color:#aaa;text-transform:uppercase;letter-spacing:.05em}
 .card{background:#1c1c1c;border:1px solid #2a2a2a;border-radius:10px;padding:16px;margin-bottom:12px}
 .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #262626} .row:last-child{border:0}
 .ok{color:#4ade80}.bad{color:#f87171}.warn{color:#fbbf24}
 button{background:#2563eb;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-size:14px;cursor:pointer;margin:4px 6px 4px 0}
 button.secondary{background:#333} button:disabled{opacity:.5;cursor:default}
 input{width:100%;box-sizing:border-box;padding:10px;border-radius:6px;border:1px solid #444;background:#111;color:#eee;font-size:15px;margin:8px 0}
 a{color:#60a5fa;word-break:break-all} code{background:#000;padding:2px 5px;border-radius:4px}
 .muted{color:#888;font-size:13px}
</style></head><body>
<h1>T3 Code add-on</h1>
<div id="app" class="card">Loading…</div>
<div class="muted">This page only manages remote access. Use the T3 Code app on your phone or desktop to work with agents.</div>
<script>
const BASE = "__BASE__";
const api = (p, opt) => fetch(BASE + p, opt).then(r => r.json());
const post = (p, body) => api(p, {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(body||{})});
let st = null;
let pendingCode = "";
async function refresh(){ try { st = await api("/api/status"); render(); } catch (e) { document.getElementById("app").textContent = "Status server unreachable: " + e; } }
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function row(l,v){ return '<div class="row"><span>'+l+'</span><span class="'+(v?"ok":"bad")+'">'+(v?"yes":"no")+'</span></div>'; }
function render(){
  const c = st.connect || {}; const s = st.session; const el = document.getElementById("app");
  const codeEl = document.getElementById("code"); if (codeEl) pendingCode = codeEl.value;
  if (st.mode === "lan") {
    el.innerHTML = '<h2>LAN pairing mode</h2>' +
      '<p>The server listens on port <code>'+esc(st.lan.port)+'</code>. The pairing URL and token are printed in the add-on <b>Log</b> tab at each start.</p>' +
      '<p class="muted">Replace the host in the pairing URL with your Home Assistant IP. Container interfaces: '+esc(st.lan.ifaces.join(", ")||"n/a")+'</p>';
    return;
  }
  if (c.error) { el.innerHTML = '<p class="bad">Could not read T3 Connect status: '+esc(c.error)+'</p>'; return; }
  const ready = c.authenticated && c.desired;
  let h = '<h2>T3 Connect</h2>' +
    row("Signed in", c.authenticated) + row("Remote access enabled", c.desired) + row("Environment linked", c.linked) +
    '<div class="row"><span>Relay</span><span>'+esc(c.relayUrl||"—")+'</span></div>' +
    '<div class="row"><span>Relay client</span><span>'+(c.relayClient? esc(c.relayClient.status)+" "+esc(c.relayClient.version||""):"—")+'</span></div>';
  if (ready && c.linked) {
    h += '<p class="ok">Ready. Open the T3 Code app on another device, sign in with the same account, and pick this environment.</p>';
  } else if (ready && !c.linked) {
    h += '<p class="warn">Authorized. The server links to T3 Connect on its next start.</p><button onclick="restart()">Restart server now</button>';
  } else if (!s || s.state === "failed" || s.state === "done") {
    h += '<p>Not signed in. Sign in to your T3 account to allow remote control of this server.</p>' +
      (s && s.state === "failed" ? '<p class="bad">'+esc(s.error)+'</p>' : '') +
      '<button onclick="start()">Start sign-in</button>' +
      '<p class="muted">The same instructions are printed in the add-on Log tab.</p>';
  } else {
    h += '<p><b>Step 1.</b> Open this link on any device with a browser and sign in:</p>' +
      (s.url ? '<p><a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.url)+'</a></p>' : '<p class="muted">Waiting for the login link…</p>') +
      '<p><b>Step 2.</b> Paste the one-time code shown after signing in:</p>' +
      '<input id="code" placeholder="Authorization code" autocomplete="off" value="'+esc(pendingCode)+'">' +
      (s.error ? '<p class="bad">'+esc(s.error)+'</p>' : '') +
      '<button onclick="submit()" '+(s.state==="submitted"?"disabled":"")+'>'+(s.state==="submitted"?"Verifying…":"Submit code")+'</button>';
  }
  if (c.authenticated) h += '<p style="margin-top:20px"><button class="secondary" onclick="unlink()">Disable remote access</button><button class="secondary" onclick="logout()">Sign out</button></p>';
  el.innerHTML = h;
}
async function start(){ await post("/api/link/start"); await refresh(); }
async function submit(){ const code=document.getElementById("code").value; if(!code) return; pendingCode=""; await post("/api/link/code",{code}); await refresh(); }
async function unlink(){ if(confirm("Disable remote access?")) { await post("/api/unlink"); await refresh(); } }
async function logout(){ if(confirm("Sign out of T3 Connect?")) { await post("/api/logout"); await refresh(); } }
async function restart(){ await post("/api/restart"); setTimeout(refresh, 4000); }
refresh(); setInterval(refresh, 4000);
</script></body></html>`;
