# Skills

Portable [agent skills](https://agentskills.io/specification) kept in this repo so they survive
ephemeral environments. They are **not** under `.claude/skills/`, because they are meant to be
installed at personal scope and used across every project — not just this one.

## Install (all projects)

```sh
sh skills/install.sh
```

Copies each skill into `~/.claude/skills/`, which is scanned in every project. Codex, Copilot CLI,
and Gemini CLI also read `~/.agents/skills/` — install there with `TARGET=~/.agents/skills sh skills/install.sh`.

Re-run after pulling changes to update. Restart the agent session afterwards so it re-scans.

## Skills

| Skill | Scope |
|---|---|
| `ui-ux-pro-max` | Building, restyling, or reviewing user-facing UI in any project: theme, direction (RTL), responsive, and accessibility correctness, plus a pre-ship review checklist. Stack-agnostic — it reads the project's own design system first. |

## Editing

Edit the copy in this repo, commit, then re-run the installer. Editing `~/.claude/skills/` directly
means the change is lost with the machine or container.
