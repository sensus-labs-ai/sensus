# Sensus

Sensus keeps your preferences for how agents should work. When you correct an agent or state a lasting preference, it is saved, and from then on every agent you use gets it. You see, change, turn off and undo every preference in the web app at https://app.sensuslabs.ai.

This repository is the Sensus plugin for Claude Code and Codex. It needs Node 20 or later.

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

## What it keeps on your computer

One key, which lets agents on this computer act as you in Sensus. It is kept in the system's key store where there is one (the Keychain on macOS, the secret service on a Linux desktop) and otherwise in `~/.sensus/credentials.json`, readable only by you. The agent never sees it. To cut a computer off, open "connect" in the web app and press "disconnect".

Sensus does not read your chats or your code. The plugin sends the address of the repository you are in (as host/owner/name) and what the agent saves as a preference.

## Licence

The plugin is under the MIT licence (`LICENSE`). The name Sensus and the "s." mark are Sensus Labs' and are not part of that licence.

## What is in here

`sensus/dist/sensus.mjs` is the whole program, built from source and not minified so you can read what the hook runs. `sensus/hooks/hooks.json` starts it at the start of a session, and `sensus/.mcp.json` starts it as the tools.
