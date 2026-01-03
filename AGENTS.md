---
name: jj-opencode
description: "JJ VCS integration - checkpoint before every edit"
alwaysApply: true
---

# jj-opencode

Blocks edits until you create a checkpoint. Every logical unit of work gets its own commit.

## Workflow

```
jj new -m "Add input validation"    ← checkpoint created
[edit files]                         ← edits go to this commit
jj new -m "Add tests for validation" ← new checkpoint
[edit files]                         ← edits go to this commit
jj new -m "Fix edge case"            ← new checkpoint
[edit files]
```

**If something goes wrong:** `jj undo` reverts the last checkpoint entirely.

## What's Blocked

Until `jj new -m "description"` is run:
- `write`, `edit`
- `lsp_rename`, `lsp_code_action_resolve`
- `ast_grep_replace`

## Commands

| Task | Command |
|------|---------|
| Create checkpoint | `jj new -m "what you're about to do"` |
| Check status | `jj st` |
| View history | `jj log` |
| Undo last checkpoint | `jj undo` |
| Update description | `jj describe -m "better description"` |
| Abandon current work | `jj abandon @` |
| Push to remote | `jj bookmark move main --to @ --allow-backwards && jj git push -b main` |

## Why Checkpoints?

1. **Never lose work** — every edit is in a described commit
2. **Easy undo** — `jj undo` reverts exactly one logical unit
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
