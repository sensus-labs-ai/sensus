// src/connect.ts
import { execFile as execFile2 } from "node:child_process";
import os2 from "node:os";

// src/api.ts
var DEFAULT_ORIGIN = "https://app.sensuslabs.ai";
function origin() {
  const set = process.env.SENSUS_ORIGIN;
  if (!set) return DEFAULT_ORIGIN;
  try {
    const url = new URL(set);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol === "https:" || url.protocol === "http:" && local) return url.origin;
  } catch {
  }
  return DEFAULT_ORIGIN;
}
var NotConnected = class extends Error {
};
async function json(fetchImpl, url, init, timeoutMs) {
  const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs), headers: { "content-type": "application/json", ...init.headers } });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function listTools(fetchImpl, timeoutMs = 5e3) {
  const { status, body } = await json(fetchImpl, origin() + "/api/companion/tools", { method: "GET" }, timeoutMs);
  const b = body;
  if (status !== 200 || !Array.isArray(b?.tools)) throw new Error("sensus did not answer with its tools");
  return { tools: b.tools, instructions: typeof b.instructions === "string" ? b.instructions : "" };
}
async function callTool(fetchImpl, key, name, args, timeoutMs = 2e4) {
  const { status, body } = await json(
    fetchImpl,
    origin() + "/mcp",
    { method: "POST", headers: { authorization: "Bearer " + key }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) },
    timeoutMs
  );
  if (status === 401) throw new NotConnected();
  const b = body;
  if (status !== 200 || !b) throw new Error("sensus answered " + status);
  if (b.error) return { text: b.error.message ?? "sensus refused the call.", isError: true };
  return { text: b.result?.content?.map((c) => c.text ?? "").join("\n") ?? "", isError: !!b.result?.isError };
}
async function startApproval(fetchImpl, name) {
  const { status, body } = await json(fetchImpl, origin() + "/api/companion/start", { method: "POST", body: JSON.stringify({ name }) }, 1e4);
  const b = body;
  if (status !== 200 || !b?.device_code || !b.code || !b.approve_url || !b.expires_at) throw new Error(b?.error ?? "sensus answered " + status);
  if (new URL(b.approve_url).origin !== origin()) throw new Error("the page to approve on is not at " + origin());
  return { device_code: b.device_code, code: b.code, approve_url: b.approve_url, expires_at: b.expires_at, interval_seconds: b.interval_seconds ?? 2 };
}
async function exchange(fetchImpl, deviceCode) {
  const { status, body } = await json(fetchImpl, origin() + "/api/companion/exchange", { method: "POST", body: JSON.stringify({ device_code: deviceCode }) }, 1e4);
  const b = body;
  if (status !== 200 || !b) throw new Error("sensus answered " + status);
  if (b.status === "approved" && b.key) return { status: "approved", key: b.key, name: b.name ?? "", account: typeof b.account === "string" ? b.account : "" };
  if (b.status === "pending" || b.status === "denied") return { status: b.status };
  return { status: "expired" };
}

// src/store.ts
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
var SERVICE = "sensus";
var STORE_MS = 1500;
function run(file2, args, input) {
  return new Promise((resolve) => {
    if (input === void 0) {
      execFile(file2, args, { timeout: STORE_MS, maxBuffer: 64 * 1024 }, (err, stdout) => resolve({ ok: !err, out: String(stdout ?? "") }));
      return;
    }
    const child = spawn(file2, args, { stdio: ["pipe", "ignore", "ignore"], timeout: STORE_MS });
    child.on("error", () => resolve({ ok: false, out: "" }));
    child.on("close", (code) => resolve({ ok: code === 0, out: "" }));
    child.stdin.on("error", () => void 0);
    child.stdin.end(input);
  });
}
var keychain = {
  async get(origin2) {
    const r = await run("/usr/bin/security", ["find-generic-password", "-s", SERVICE, "-a", origin2, "-w"]);
    return r.ok && r.out.trim() ? r.out.trim() : null;
  },
  async set(origin2, key) {
    return (await run("/usr/bin/security", ["add-generic-password", "-U", "-s", SERVICE, "-a", origin2, "-l", `Sensus (${origin2})`, "-w", key])).ok;
  },
  async remove(origin2) {
    await run("/usr/bin/security", ["delete-generic-password", "-s", SERVICE, "-a", origin2]);
  }
};
var secretService = {
  async get(origin2) {
    const r = await run("secret-tool", ["lookup", "service", SERVICE, "account", origin2]);
    return r.ok && r.out.trim() ? r.out.trim() : null;
  },
  async set(origin2, key) {
    return (await run("secret-tool", ["store", `--label=Sensus (${origin2})`, "service", SERVICE, "account", origin2], key)).ok;
  },
  async remove(origin2) {
    await run("secret-tool", ["clear", "service", SERVICE, "account", origin2]);
  }
};
function home() {
  return process.env.SENSUS_HOME || path.join(os.homedir(), ".sensus");
}
var file = {
  async get(origin2) {
    return readAll()[origin2] ?? null;
  },
  async set(origin2, key) {
    writeAll({ ...readAll(), [origin2]: key });
    return true;
  },
  async remove(origin2) {
    const all = readAll();
    if (!(origin2 in all)) return;
    delete all[origin2];
    writeAll(all);
  }
};
function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(home(), "credentials.json"), "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((e) => typeof e[1] === "string"));
  } catch {
    return {};
  }
}
function writeAll(all) {
  const dir = home();
  fs.mkdirSync(dir, { recursive: true, mode: 448 });
  const target = path.join(dir, "credentials.json");
  const fresh = target + "." + process.pid + ".tmp";
  fs.writeFileSync(fresh, JSON.stringify(all), { mode: 384 });
  fs.renameSync(fresh, target);
}
function stores() {
  if (process.env.SENSUS_STORE === "file") return [file];
  if (process.platform === "darwin") return [keychain, file];
  if (process.platform === "linux") return [secretService, file];
  return [file];
}
async function readKey(origin2) {
  for (const store of stores()) {
    const key = await store.get(origin2);
    if (key) return key;
  }
  return null;
}
async function saveKey(origin2, key) {
  let kept = false;
  for (const store of stores()) {
    if (kept) await store.remove(origin2);
    else kept = await store.set(origin2, key);
  }
  if (!kept) throw new Error("could not keep the key on this computer");
}

// src/connect.ts
var CONNECT_TOOL = {
  name: "sensus_connect",
  description: "Connect this computer to Sensus, once. It opens a page in the person's browser where they approve the computer; tell them the code to check. If the answer says it is still waiting, call it again after the person has approved. Call it only when another Sensus tool says this computer is not connected, or when the person asks to connect or onboard.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false }
};
function run2(file2, args) {
  return new Promise((resolve) => execFile2(file2, args, { timeout: 5e3 }, (err, stdout) => resolve(err ? null : String(stdout ?? "").trim())));
}
async function openInBrowser(url) {
  if (process.platform === "darwin") await run2("open", [url]);
  else if (process.platform === "win32") await run2("rundll32", ["url.dll,FileProtocolHandler", url]);
  else await run2("xdg-open", [url]);
}
async function computerName() {
  const given = process.platform === "darwin" ? await run2("/usr/sbin/scutil", ["--get", "ComputerName"]) : null;
  const name = (given || os2.hostname().split(".")[0] || "this computer").replace(/[\u0000-\u001f]/g, " ").trim().toLowerCase().slice(0, 60);
  return name || "this computer";
}
var waiting = null;
var say = (text) => ({ text, isError: false });
var refuse = (text) => ({ text, isError: true });
async function connect(deps) {
  const at = origin();
  const key = await readKey(at);
  if (key) {
    try {
      await callTool(deps.fetchImpl, key, "sensus_projects", {});
      return say(`this computer is already connected to sensus at ${at}. carry on with what the person asked.`);
    } catch (err) {
      if (!(err instanceof NotConnected)) return refuse("could not reach sensus to check the connection. check the network and try again.");
    }
  }
  try {
    if (!waiting || Date.parse(waiting.expires_at) <= Date.now()) {
      waiting = await startApproval(deps.fetchImpl, await computerName());
      await deps.open(waiting.approve_url);
    }
    const w = waiting;
    const until = Date.now() + deps.waitMs;
    for (; ; ) {
      await deps.sleep(Math.max(1, w.interval_seconds) * 1e3);
      const got = await exchange(deps.fetchImpl, w.device_code);
      if (got.status === "approved") {
        waiting = null;
        await saveKey(at, got.key);
        return say(
          `connected${got.account ? ` to the sensus account ${got.account}` : ""}: "${got.name}" is approved, and its key is kept on this computer. tell the person which account it is. the sensus tools work now. from the next session, preferences arrive at the start by themselves. carry on with what the person asked.`
        );
      }
      if (got.status === "denied") {
        waiting = null;
        return say("the person denied this computer in the browser, so nothing was connected. ask whether they want to try again before calling sensus_connect again.");
      }
      if (got.status === "expired") {
        waiting = null;
        return say("the request ran out before it was answered. call sensus_connect again to open a new page.");
      }
      if (Date.now() >= until) {
        return say(
          `waiting for the person. a page is open in their browser: ${w.approve_url}
tell them, in one line: sign in if asked, check that the page shows the code ${w.code}, and press approve. then call sensus_connect again; it goes on waiting for the same approval.`
        );
      }
    }
  } catch (err) {
    return refuse(`could not connect this computer: ${err instanceof Error ? err.message : "no reason was given"}. check the network and try again.`);
  }
}

// src/git.ts
import { execFile as execFile3 } from "node:child_process";

// ../domain/src/remote.ts
var REMOTE_CHARS = 200;
function canonicalRemote(address) {
  const text = address.trim();
  if (!text || text.length > 2e3 || /\s/.test(text)) return null;
  let host;
  let path2;
  const scp = text.match(/^(?:[^@/\s]+@)?([^:/\s]+):(?!\/\/)(.+)$/);
  if (text.includes("://")) {
    let url;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (!["http:", "https:", "ssh:", "git:"].includes(url.protocol)) return null;
    host = url.hostname;
    path2 = url.pathname;
  } else if (scp) {
    host = scp[1] ?? "";
    path2 = scp[2] ?? "";
  } else {
    const slash = text.indexOf("/");
    if (slash < 1) return null;
    host = text.slice(0, slash);
    path2 = text.slice(slash + 1);
  }
  path2 = path2.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\.git$/i, "");
  const out = (host + "/" + path2).toLowerCase();
  if (!host.includes(".") || !path2 || out.length > REMOTE_CHARS || !/^[a-z0-9._~-]+(\/[a-z0-9._~-]+)+$/.test(out) || out.includes("..")) return null;
  return out;
}

// src/git.ts
function git(args, cwd) {
  return new Promise((resolve) => {
    execFile3(
      "git",
      args,
      { cwd, timeout: 1500, maxBuffer: 64 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
      (err, stdout) => resolve(err ? null : String(stdout ?? "").trim())
    );
  });
}
async function repositoryOf(cwd) {
  if (!cwd || cwd.includes("\0")) return null;
  const origin2 = await git(["remote", "get-url", "origin"], cwd);
  if (origin2) return canonicalRemote(origin2);
  const names = (await git(["remote"], cwd) ?? "").split("\n").filter(Boolean);
  if (names.length !== 1 || !names[0]) return null;
  const only = await git(["remote", "get-url", "--", names[0]], cwd);
  return only ? canonicalRemote(only) : null;
}

// src/hook.ts
var ROOM = 9e3;
var PATIENCE_MS = 4e3;
var NOT_CONNECTED = "Sensus is installed, but this computer is not connected to it, so no preferences were loaded. Say nothing about this unless the person asks about Sensus, asks to connect, or asks to onboard this project; then use the sensus onboard skill, or call sensus_connect.";
var DISCONNECTED = "Sensus: this computer is no longer connected, so no preferences were loaded. It was disconnected in the Sensus web app, or nothing had used it for 90 days. Tell the person in one line, and call sensus_connect if they want to connect it again.";
function intro(at) {
  return `Sensus preferences for this session, from ${at}. They are the person's saved preferences for how you should work: follow the ones listed under "follow" unless the person's request says otherwise. When the person corrects you or states a lasting preference, save it with sensus_save_preference and tell them in one line.

`;
}
async function sessionStartText(cwd, fetchImpl) {
  const at = origin();
  const key = await readKey(at);
  if (!key) return NOT_CONNECTED;
  const repository = await repositoryOf(cwd);
  try {
    const got = await callTool(fetchImpl, key, "sensus_preferences", repository ? { repository } : {}, PATIENCE_MS);
    if (got.isError || !got.text) return "";
    const text = got.text.length > ROOM ? got.text.slice(0, ROOM) + "\n\n(cut here for length. call sensus_preferences for the rest before you start.)" : got.text;
    return intro(at) + text;
  } catch (err) {
    return err instanceof NotConnected ? DISCONNECTED : "";
  }
}
async function sessionStart(stdin, fetchImpl) {
  let cwd = "";
  try {
    const input = JSON.parse(stdin);
    if (typeof input.cwd === "string") cwd = input.cwd;
  } catch {
  }
  const text = await Promise.race([
    sessionStartText(cwd || process.cwd(), fetchImpl).catch(() => ""),
    new Promise((resolve) => setTimeout(() => resolve(""), PATIENCE_MS + 1e3).unref())
  ]);
  return text ? { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } } : {};
}

// src/mcp.ts
var SUPPORTED = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
var PLUGIN_GUIDE = `

This is the Sensus plugin. At the start of each session the preferences for the repository you are in are already in your context, under "Sensus preferences for this session", with each preference's id; you do not need to call sensus_preferences again unless something changed. If a Sensus tool says this computer is not connected, call sensus_connect: it opens a page in the person's browser where they approve the computer once.`;
var OFFLINE_GUIDE = "Sensus holds a person's preferences for how their agents should work. It could not be reached just now, so only sensus_connect is listed. Try again later." + PLUGIN_GUIDE;
function server(deps) {
  let listed = null;
  const sensus = (fetchImpl) => {
    listed ??= listTools(fetchImpl).catch((err) => {
      listed = null;
      throw err;
    });
    return listed;
  };
  async function call(name, args) {
    if (name === CONNECT_TOOL.name) return connect(deps);
    const key = await readKey(origin());
    if (!key) return { text: "this computer is not connected to sensus yet. call sensus_connect first, then call this tool again.", isError: true };
    const sent = typeof args.repository === "string" ? { ...args, repository: canonicalRemote(args.repository) ?? args.repository } : args;
    try {
      return await callTool(deps.fetchImpl, key, name, sent);
    } catch (err) {
      if (err instanceof NotConnected) {
        return { text: "this computer is no longer connected to sensus: it was disconnected in the web app, or nothing had used it for 90 days. call sensus_connect to connect it again, then call this tool again.", isError: true };
      }
      return { text: "could not reach sensus. check the network and try again.", isError: true };
    }
  }
  return async function handle(m) {
    const silent = m.id === void 0 || m.id === null;
    const ok = (result) => ({ jsonrpc: "2.0", id: m.id, result });
    const fail = (code, message) => ({ jsonrpc: "2.0", id: m.id ?? null, error: { code, message } });
    if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return fail(-32600, "invalid request");
    switch (m.method) {
      case "initialize": {
        const asked = m.params?.protocolVersion;
        const instructions = await sensus(deps.fetchImpl).then(
          (s) => s.instructions + PLUGIN_GUIDE,
          () => OFFLINE_GUIDE
        );
        return ok({
          protocolVersion: typeof asked === "string" && SUPPORTED.includes(asked) ? asked : "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "sensus", version: "0.1.0" },
          instructions
        });
      }
      case "ping":
        return silent ? null : ok({});
      case "tools/list": {
        const tools = await sensus(deps.fetchImpl).then(
          (s) => s.tools,
          () => []
        );
        return ok({ tools: [CONNECT_TOOL, ...tools] });
      }
      case "tools/call": {
        const name = typeof m.params?.name === "string" ? m.params.name : "";
        const args = m.params?.arguments && typeof m.params.arguments === "object" ? m.params.arguments : {};
        const got = await call(name, args);
        return ok({ content: [{ type: "text", text: got.text }], isError: got.isError });
      }
      default:
        return silent ? null : fail(-32601, `method not found: ${m.method}`);
    }
  };
}
function serve(deps) {
  const handle = server(deps);
  let buffer = "";
  let queue = Promise.resolve();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (!line) continue;
      queue = queue.then(async () => {
        let answer;
        try {
          answer = await handle(JSON.parse(line));
        } catch {
          answer = { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } };
        }
        if (answer) process.stdout.write(JSON.stringify(answer) + "\n");
      });
    }
  });
  process.stdin.on("end", () => void queue.then(() => process.exit(0)));
}

// src/index.ts
async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  const read = (async () => {
    for await (const chunk of process.stdin) chunks.push(chunk);
  })();
  await Promise.race([read, new Promise((resolve) => setTimeout(resolve, 1e3).unref())]);
  return Buffer.concat(chunks).toString("utf8");
}
var [mode, what] = process.argv.slice(2);
if (mode === "hook" && what === "session-start") {
  const out = await sessionStart(await readStdin(), fetch).catch(() => ({}));
  process.stdout.write(JSON.stringify(out) + "\n");
  process.exit(0);
} else if (mode === "mcp") {
  serve({ fetchImpl: fetch, open: openInBrowser, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)), waitMs: 45e3 });
} else {
  process.stderr.write("the sensus plugin's local program. it is started by the plugin: `hook session-start` or `mcp`.\n");
  process.exit(2);
}
