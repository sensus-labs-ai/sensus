# Sensus

Sensus keeps your preferences for how agents should work. When you correct an agent or state a lasting preference, it is saved, and from then on every agent you use gets it. You see, change, turn off and undo every preference in the web app at https://app.sensuslabs.ai.

This repository holds the Sensus plugin for Claude Code and Codex, in the `sensus` folder. What it does, and everything it runs, reads and sends, is in [sensus/README.md](sensus/README.md).

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

In Codex, run `/hooks` once in a session and trust the Sensus hook.

Then start a new session in your project and say "onboard this project onto sensus".

## Licence

MIT (`LICENSE`). The name Sensus and the "s." mark are Sensus Labs' and are not part of that licence.
