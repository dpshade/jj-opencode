---
name: jj-opencode
description: "JJ VCS integration - describe intent before every edit"
alwaysApply: true
---

# jj-opencode

Blocks edits until you describe your intent. Every logical unit of work gets its own commit.

## Workflow

```
jj describe -m "Add input validation"  ← declare intent, unlocks editing
[edit files]                           ← edits go to this commit
[session ends]                         ← auto-commits, locks editing

jj describe -m "Add tests"             ← declare next intent, unlocks
[edit files]
[session ends]                         ← auto-commits, locks editing
```

`jj new` runs automatically when the session goes idle. No manual commit needed.

**If something goes wrong:** `jj undo` reverts the last operation.

## What's Blocked

Until `jj describe -m "description"` is run:
- `write`, `edit`
- `lsp_rename`, `lsp_code_action_resolve`
- `ast_grep_replace`

## Commands

| Task | Command |
|------|---------|
| Start work | `jj describe -m "what you're about to do"` |
| Finish work | *(automatic on session idle)* |
| Check status | `jj st` |
| View history | `jj log` |
| Undo | `jj undo` |
| Abandon current work | `jj abandon @` |
| Push to remote | `jj_push` tool (or specify bookmark: `jj_push bookmark="feature"`) |

## Tools

### jj_push

Safely pushes the current change to a bookmark (defaults to `main`).

```
jj_push                      ← push to main
jj_push bookmark="feature"   ← push to feature branch (user must specify)
```

The tool:
1. Shows a preview with change ID, description, and files
2. Requires user confirmation before pushing
3. Runs `jj new` → `jj bookmark set` → `jj git push`
4. Leaves working copy clean and ready for new work

**Important:** Only specify a bookmark if the user explicitly requested it.

## Subagents

If a subagent tries to edit without a description, it will be blocked and instructed to return to the parent agent. Only the primary agent should manage JJ workflow (describe, new, push).

## Why This Workflow?

1. **Guaranteed separation** — `jj new` runs automatically, re-engaging the gate
2. **Never lose work** — every edit is in a described commit
3. **Clear history** — `jj log` shows what happened step by step
4. **No WIP commits** — every commit has meaning

## Don't Use Git

| Git | JJ |
|-----|-----|
| `git status` | `jj st` |
| `git log` | `jj log` |
| `git diff` | `jj diff` |
| `git add && git commit` | Not needed |
| `git push` | `jj git push -b main` |

## Before Push

Show the user:
```bash
jj log -r @
jj diff --stat
```

Wait for explicit "yes" before pushing.
