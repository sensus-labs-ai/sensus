---
name: onboard
description: Put this repository on Sensus - connect this computer, find or make the repository's project, and save the preferences found in the repository. Use when the person asks to onboard, set up, add or use Sensus here ("onboard this project onto sensus", "can we use sensus here?").
---

Set this repository up on Sensus for the person. Do every step yourself; only the approval in the browser needs them. Keep your messages to them short.

1. Connect. Call `sensus_connect`.
   - Already connected, or connected: go on.
   - Waiting: tell the person in one line that a page is open in their browser, to sign in if asked, to check that it shows the code from the answer, and to press approve. Then call `sensus_connect` again.
   - Denied, or an error: say so in one line and stop.

2. Find the project. Run `git remote get-url origin` and call `sensus_preferences` with `repository` set to what it prints.
   - It answers with a project: this repository is already on Sensus. Go on to step 3 and skip what the project already has.
   - It says no project is linked: call `sensus_projects`. If one of the projects is clearly this repository, link it with `sensus_save_project` (`project_id` and `repository`). Otherwise make one with `sensus_save_project`: `name` is the repository's name in lowercase, and `repository` is the address. The person asked to onboard, so do not ask again.
   - The folder is not a git repository, or has no remote: Sensus knows a project by its repository's address. Tell the person, and offer to make a project with no repository (`sensus_save_project` with only `name`); they would then name the project at the start of a session.

3. Learn how work is done here. Read what the repository says:
   - CLAUDE.md, AGENTS.md and other agent instruction files at any level, the README files, and `docs/` (contributing, architecture, conventions, decisions).
   - The package manager and scripts, and the lint, format, type-check and test setup.
   - The last 30 commit subjects (`git log --oneline -30`), for how commit messages are written.
   - What you already know about how this person works, from their global instructions and memory.

   Turn what you find into preferences. Each is one thing an agent can follow: a short lowercase name, `what` in one or two plain sentences, and `when` if it applies only some of the time. Keep only what would change what an agent does. Leave out generic advice and anything a linter already enforces. Never save a secret, a key, an internal address with a password in it, or personal details about other people.
   - How this codebase is run, for everyone on it: layer `project`.
   - How this person works everywhere: layer `mine`.
   - This person's own habit that only makes sense here: layer `mine_in_project`.

   Skip anything the answer in step 2 already lists, and do not save two that say nearly the same. Save each with `sensus_save_preference`. If the person narrowed the request ("just the commit conventions"), save only those.

4. Wrap up. Tell the person, briefly:
   - the project, and whether you made it or it was already there;
   - what you saved, grouped by layer, one line per name;
   - anything skipped or refused, in one line;
   - the project's link from the tool answers, and that they can change, turn off or remove any preference there, or tell you what to change.

Onboarding never edits the repository. From the next session, the preferences arrive at the start by themselves.
