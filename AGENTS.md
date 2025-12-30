---
name: jj-opencode
description: "JJ VCS integration - enforces 'define change before implementation'"
alwaysApply: true
---

# jj-opencode Plugin

This plugin enforces JJ's workflow philosophy: **define what you're doing before you do it**.

## Why This Exists

JJ (Jujutsu) treats the working copy as an implicit commit. The `jj new -m "description"` command declares your intent BEFORE you start implementing. This plugin enforces that pattern at the tooling level - no file modifications are allowed until you define your change.

## Gate Behavior

**Before any file modification**, you must define your change:

1. Call `jj("description of your work")`
2. This runs: `jj git fetch && jj new main@origin -m "description"`
3. Gate unlocks - you can now edit files
4. When done, call `jj_push()` to push
5. Gate locks again - next task requires new `/jj "description"`

## Available Tools

| Tool | Purpose | When Available |
|------|---------|----------------|
| `jj(description)` | Create new change from main@origin, unlock gate | Always |
| `jj_status()` | Show change ID, description, diff summary, gate state | Always |
| `jj_push(bookmark?, confirm?)` | Validate and push (first call shows preview, second with confirm:true pushes) | After jj |
| `jj_git_init()` | Initialize JJ in non-JJ repo | Only if not JJ repo |

## Description Quality

Descriptions must be:
- At least 10 characters
- More than one word

This ensures meaningful change descriptions that provide context.

## What's Blocked (Until Gate Unlocked)

- `write`, `edit` - File creation/modification
- `lsp_rename`, `lsp_code_action_resolve` - LSP modifications
- `ast_grep_replace` - AST-based replacements
- `bash` commands that modify files (sed -i, rm, mv, cp, redirects, etc.)
- `todowrite` - State modifications

## Git Commands Are Blocked (Always)

**All git commands are intercepted and blocked** with JJ equivalents suggested:

| Git Command | JJ Equivalent |
|-------------|---------------|
| `git status` | `jj st` |
| `git log` | `jj log` |
| `git diff` | `jj diff` |
| `git add` | (not needed - JJ auto-tracks) |
| `git commit` | `jj describe -m "message"` |
| `git push` | `jj_push()` or `jj git push` |
| `git checkout` | `jj edit <change>` or `jj new` |
| `git branch` | `jj bookmark list` |
| `git stash` | (not needed - use `jj new`) |
| `git pull` | `jj git fetch && jj rebase` |

This enforces JJ-native workflow and prevents mixing git/jj commands.

## What's Always Allowed

- `read`, `glob`, `grep` - File reading and searching
- `lsp_hover`, `lsp_goto_definition`, `lsp_find_references` - LSP queries
- `ast_grep_search` - AST searches (not replace)
- `webfetch`, `context7_*`, `websearch_*` - External lookups
- `task`, `background_task`, `call_omo_agent` - Agent orchestration
- `bash` read-only commands (ls, cat, jj log, etc.)
- All `jj_*` tools from this plugin

## Workflow Example

```
Session starts
    ↓
Gate is LOCKED
    ↓
User: "Add a validation function to utils.ts"
    ↓
You attempt to edit → BLOCKED
    ↓
You call: jj("Add input validation function to utils.ts")
    ↓
Gate UNLOCKS, change ID assigned
    ↓
You edit utils.ts freely
    ↓
Work complete → jj_push()
    ↓
Gate LOCKS again (checkpoint complete)
    ↓
Next task? Run jj("description") to start new checkpoint
```

## Subagent Behavior

Subagents spawned via `task` tool **inherit the parent session's gate state**.

- If parent called `jj()`, subagents can edit files
- All edits go to the same JJ change
- No need for subagents to call `jj()` again

## Non-JJ Repository Handling

If the working directory is not a JJ repository:

1. Plugin detects this on session start
2. On first edit attempt, offers to run `jj_git_init()`
3. After init, immediately prompts for change description
4. Workflow continues normally

## Error Recovery

| Situation | Solution |
|-----------|----------|
| Edit blocked unexpectedly | Call `jj_status()` to check gate state |
| Wrong description | Run `jj describe -m "new description"` |
| Want to start over | Run `jj abandon` then `jj("new description")` |
| Push fails | Check `jj_status()`, fix issues, try `jj_push()` again |

## JJ Concepts

- **Change ID**: Stable identifier that survives rebases (e.g., `skvrkxkk`)
- **Commit ID**: Hash that changes on every edit (e.g., `52ba303b`)
- **Working copy = commit**: Your edits are always in a commit context
- **`@`**: Refers to the current working-copy commit

## Why "Define Before Implement"?

1. **Forces intentionality**: You must think about what you're doing before doing it
2. **Creates audit trail**: Every change has a description from the start
3. **Enables parallel work**: Multiple changes can be siblings from main
4. **Aligns with JJ philosophy**: The tool enforces what JJ was designed for
