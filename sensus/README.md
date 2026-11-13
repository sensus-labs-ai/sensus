# Sensus

Sensus keeps your preferences for how agents should work. When you correct an agent or state a lasting preference, it is saved, and from then on every agent you use gets it. You see, change, turn off and undo every preference in the web app at https://app.sensuslabs.ai.

This is the Sensus plugin for Claude Code and Codex. It needs Node 20 or later and a Sensus account, which is free.

## Install

Claude Code:

```
claude plugin marketplace add sensus-labs-ai/sensus
claude plugin install sensus@sensus-labs
```

Codex:

```
codex plugin marketplace add sensus-labs-ai/sensus
codex plugin add sensus@sensus-labs
```

In Codex, run `/hooks` once in a session and trust the Sensus hook. Codex does not run a plugin's hook until you have.

Then start a new session in your project and say:

```
onboard this project onto sensus
```

A page opens in your browser. Sign in, check that it shows the code your agent tells you, and press approve. That connects this computer once, for Claude Code and Codex and every project.

## What it does

- At the start of every session it loads your preferences for the repository you are in, so the agent has them before your first message. It waits a few seconds at most and never holds a session up.
- It gives the agent the Sensus tools: read preferences, save a correction, turn one off, remove one, and make or archive a project. The agent acts as you and can do what you can do in the web app, and nothing more. It asks you in the chat before turning off, removing or archiving.
- The `onboard` skill puts a repository on Sensus: it finds or makes the project, reads the repository's docs, and saves what it finds as preferences.

## Everything it runs, reads and sends

The plugin is one program, `dist/sensus.mjs`, built from source and not minified so it can be read. It has no dependencies and installs nothing. It is started two ways: by the session-start hook (`hooks/hooks.json`), and as a local MCP server for the length of a session (`.mcp.json`).

It runs these programs, each with a fixed list of arguments and never through a shell:

- `git remote get-url origin` (and `git remote`), in the folder the session is in, to learn which repository it is.
- The system's key store, to keep and read its own key: `/usr/bin/security` on macOS, `secret-tool` on Linux.
- `/usr/sbin/scutil --get ComputerName` on macOS, to name the computer on the approve page.
- `open`, `xdg-open` or `rundll32 url.dll,FileProtocolHandler`, once, to open the approve page in your browser when you connect.

It reads and writes one thing on your computer: its own key, which Sensus issues to this computer when you approve it in the browser. The key is kept in the system's key store where there is one (the Keychain on macOS, the secret service on a Linux desktop) and otherwise in `~/.sensus/credentials.json`, readable only by you. It reads no other credential, no environment secret and no file of yours. The agent never sees the key.

It talks to one server, https://app.sensuslabs.ai, over HTTPS, and sends:

- the address of the repository you are in, cut down to host/owner/name, so a password inside a clone address never leaves your computer;
- your computer's name, once, when you connect it;
- the tool calls your agent makes, such as a preference it saves, with the key.

It does not read your chats, your code or your files, and it does not change Claude's or Codex's settings. To cut a computer off, open "connect" in the web app and press "disconnect".

Three environment variables change where it looks, for development: `SENSUS_ORIGIN` (another Sensus address; a key is only ever sent over HTTPS or to localhost), `SENSUS_HOME` (the folder for the key file) and `SENSUS_STORE=file` (use the file only).

## Licence

The plugin is under the MIT licence (`LICENSE`). The name Sensus and the "s." mark are Sensus Labs' and are not part of that licence.
