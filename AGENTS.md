---
name: jj-opencode
description: "JJ VCS integration - enforces 'declare intent before implementation'"
alwaysApply: true
---

# jj-opencode Plugin

**One job: block file edits until you declare what you're doing.**

## How It Works

```
Session starts → Gate is LOCKED
       ↓
You try to edit → BLOCKED
       ↓
You call: jj("Add input validation")
       ↓
Gate UNLOCKS, JJ change created
       ↓
You edit files freely
       ↓
Work complete → jj_push()
       ↓
User confirms → pushed
       ↓
Gate LOCKS → ready for next task
```

## Tools

| Tool | Purpose |
|------|---------|
| `jj("description")` | Create JJ change, unlock gate |
| `jj_push()` | Show preview, then push (requires user confirmation) |
| `jj_status()` | Show gate state and current changes |

That's it. Everything else is raw JJ commands.

## What's Blocked

Until you call `jj("description")`:
- `write`, `edit` - File creation/modification
- `lsp_rename`, `lsp_code_action_resolve` - LSP modifications
- `ast_grep_replace` - AST-based replacements

## What's Always Allowed

- All read operations (`read`, `glob`, `grep`, `lsp_hover`, etc.)
- All JJ commands via bash (`jj log`, `jj diff`, `jj st`, etc.)
- All other tools

## Workflow Rules

### Use JJ, Not Git

| Don't | Do |
|-------|-----|
| `git status` | `jj st` |
| `git log` | `jj log` |
| `git diff` | `jj diff` |
| `git add && git commit` | Not needed - JJ auto-tracks |
| `git push` | `jj_push()` or `jj git push -b main` |
| `git checkout -b` | `jj new -m "description"` |
| `git stash` | Not needed - just `jj new` |

### Parallel Development

For multiple features, just use `jj new` multiple times:

```bash
# Feature A
jj new main@origin -m "Add authentication"
# work...

# Feature B (in same directory!)
jj new main@origin -m "Fix bug #123"  
# work on different change...
```

JJ handles the isolation. No workspaces needed.

### Push Requires Confirmation

The AI must NEVER call `jj_push(confirm: true)` without explicit user approval:

1. `jj_push()` - Shows preview
2. **Wait for user to say "yes"**
3. `jj_push(confirm: true)` - Only after approval

## Subagent Behavior

Subagents inherit the parent's gate state. If parent called `jj()`, subagents can edit immediately.

## Error Recovery

| Problem | Solution |
|---------|----------|
| Edit blocked | Call `jj("description")` |
| Wrong description | `jj describe -m "new description"` |
| Abandon work | `jj abandon @` |
| Undo mistake | `jj undo` |
| Push failed | Check `jj st`, fix, try again |

## Why This Exists

JJ treats the working copy as an implicit commit. This plugin enforces that philosophy at the tooling level:

1. **Intentionality** - Think about what you're doing before doing it
2. **Audit trail** - Every change has a description from the start
3. **Clean history** - No "WIP" or "fix" commits
