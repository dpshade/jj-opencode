# jj-opencode

[![npm version](https://img.shields.io/npm/v/jj-opencode.svg)](https://www.npmjs.com/package/jj-opencode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

OpenCode plugin that enforces JJ's "define change before implementation" workflow.

## What It Does

This plugin prevents file modifications until you define what change you're making. It enforces the pattern:

```bash
jj git fetch && jj new main@origin -m "description of work"
```

**Before** you can edit any files.

## Quick Start

```bash
# 1. Install
npm install -g jj-opencode

# 2. Add to OpenCode config (~/.config/opencode/config.json)
{ "plugin": ["jj-opencode"] }

# 3. Start working - the AI handles the rest
# When you ask it to edit files, it will:
# - Suggest a JJ change description
# - Create the change automatically (or ask for approval)
# - Proceed with your requested edits
```

## Installation

### From npm (recommended)

```bash
npm install -g jj-opencode
```

Then add to your OpenCode config (`~/.config/opencode/config.json`):

```json
{
  "plugin": ["jj-opencode"]
}
```

**Optional**: Install slash commands for explicit user control:
```bash
node -e "require('jj-opencode/bin/setup.js')"
```

### Local Development

Clone the repo and symlink:

```bash
git clone https://github.com/dpshade/jj-opencode
cd jj-opencode
bun install
bun run build

# Symlink the plugin
ln -s $(pwd) ~/.config/opencode/plugin/jj-opencode

# Install slash commands
node bin/setup.js
```

## How It Works

1. **Session starts in default workspace** → Gate is LOCKED
2. **You ask AI to edit** → AI suggests a JJ change description
3. **AI creates the change** → Creates workspace, moves session there, gate UNLOCKS
4. **AI edits freely** → All changes tracked in the workspace's JJ change
5. **Work complete** → Push via `jj_push()` (requires your confirmation)
6. **Gate locks** → Next task creates a new change in the same workspace

### Automatic Workspace Isolation

When `jj()` is called from the **default** workspace, it automatically:
1. Creates `.workspaces/feature-slug/` subdirectory
2. Moves the current session to that directory
3. Creates a JJ change with a bookmark
4. Unlocks the gate

Subsequent `jj()` calls within that workspace just create new changes (no additional workspaces). This keeps your default workspace pristine.

**Directory structure:**
```
myproject/
├── .jj/                    # JJ internal storage
├── .workspaces/            # AI agent workspaces (add to .gitignore)
│   ├── add-auth/           # workspace for auth feature
│   └── fix-bug-123/        # workspace for bug fix
├── src/
└── ...
```

### Agent Mode Behavior

The plugin detects mode based on what tool is being blocked:

| Blocked Tool | Behavior |
|--------------|----------|
| `write`, `edit`, etc. | Announces description, proceeds automatically |
| Other tools | Suggests description, waits for approval |

## Available Tools

| Tool | Purpose |
|------|---------|
| `jj(description, bookmark?, from?)` | Create new JJ change, unlock editing |
| `jj_status()` | Show current change, gate state, workspace, and diff summary |
| `jj_push(bookmark?, confirm?)` | Preview then push (requires `confirm: true`) |
| `jj_workspace(description)` | Create workspace in .workspaces/ for parallel development |
| `jj_workspaces()` | List all workspaces with their status |
| `jj_cleanup(confirm?)` | Abandon empty commits and forget stale workspaces |
| `jj_undo()` | Undo last JJ operation - instant recovery |
| `jj_describe(message)` | Update description of current change |
| `jj_abandon()` | Abandon current change, reset gate |
| `jj_git_init()` | Initialize JJ in non-JJ repo |

### Optional Slash Commands

If you prefer explicit control, install the slash commands:

```bash
node -e "require('jj-opencode/bin/setup.js')"
```

| Command | Purpose |
|---------|---------|
| `/jj "description"` | Explicitly create a JJ change |
| `/jj-push` | Explicitly trigger push flow |

## Push Requires Confirmation

**Important**: The `/jj-push` command uses a two-step process:

1. First call shows a preview of changes and asks for permission
2. Only after you explicitly confirm does it actually push

The AI cannot auto-push without your approval.

## What's Blocked

Until a change is defined via `/jj` or `jj()`:
- File write/edit operations
- Bash commands that modify files (sed -i, rm, mv, etc.)
- LSP rename/code action operations
- AST grep replace operations

**All git commands are blocked** with JJ alternatives suggested:

| Git Command | JJ Alternative |
|-------------|----------------|
| `git status` | `jj st` |
| `git log` | `jj log` |
| `git diff` | `jj diff` |
| `git add` | (not needed) |
| `git commit` | `jj describe -m "..."` |
| `git push` | `/jj-push` or `jj_push()` |
| `git checkout` | `jj edit <change>` |
| `git branch` | `jj bookmark list` |
| `git stash` | (use `jj new`) |
| `git pull` | `jj git fetch && jj rebase` |

What's always allowed:
- Reading files
- Searching (grep, glob)
- LSP queries (hover, definitions)
- Web lookups
- JJ commands (`jj log`, `jj st`, etc.)
- Spawning subagents (they inherit gate state)

## Description Quality

Descriptions must be at least 10 characters and more than one word. This ensures meaningful change context.

## Typical Workflow

Here's what a typical OpenCode session looks like with jj-opencode:

```
You: "Add input validation to the signup form"

AI: Creating JJ change: "Add input validation to signup form"
    ✓ Workspace created: .workspaces/add-input-validation-to-signup-form/
    ✓ Session moved to workspace
    ✓ Change created (ID: kpxvmstq)
    ✓ Gate unlocked - editing enabled

AI: [reads current code, makes edits to signup.ts]
    I've added email format validation and password strength checks.

You: "looks good, push it"

AI: Ready to push to add-input-validation-to-signup-form:
    
    Files changed (2):
      M src/signup.ts
      M src/validation.ts
    
    Description: "Add input validation to signup form"
    
    Confirm push?

You: "yes"

AI: ✓ Pushed to add-input-validation-to-signup-form
    ✓ Workspace cleaned up
    ✓ Gate locked - ready for next task

You: "now add unit tests for that validation"

AI: Creating JJ change: "Add unit tests for signup validation"
    [creates change in current workspace, continues working...]
```

### What Makes This Different

- **No manual branching** — The AI creates a fresh JJ change from `main@origin` automatically
- **Intentional commits** — Every change has a description before any code is written
- **Safe checkpoints** — Gate locks after push, ensuring clean separation between tasks
- **Instant recovery** — Made a mistake? `jj_undo()` reverts the last operation

## Parallel Development with Workspaces

The first `jj()` call from the default workspace automatically creates a feature workspace. For **additional** parallel workspaces, use `jj_workspace()`:

```
You: "I want to work on auth improvements in parallel with the current work"

AI: [calls jj_workspace("Add authentication improvements")]
    Workspace created: .workspaces/add-authentication-improvements/
    
    To work in this workspace, start a new OpenCode session:
    cd .workspaces/add-authentication-improvements && opencode
```

In the new workspace session:
- Call `jj("specific task")` to unlock editing
- Work normally - edits are isolated to this workspace
- `jj_push()` pushes to a named bookmark (not main)
- After push, workspace is auto-cleaned up

**Note**: Add `.workspaces/` to your `.gitignore`.

### Named Bookmarks (Feature Branches)

For team workflows, create named bookmarks instead of pushing to main:

```
jj("Add user settings page", bookmark: "user-settings")
```

This creates a change with bookmark `user-settings`. When you push, it goes to that branch.

### Branch from Specific Revision

Start from a different base:

```
jj("Fix auth bug", from: "release-v2")
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Edit blocked unexpectedly | Run `jj_status()` to check gate state |
| Wrong change description | Run `jj_describe("new description")` |
| Want to start over | Run `jj_abandon()` then create new change |
| Made a mistake | Run `jj_undo()` to revert last operation |
| Push fails | Check `jj_status()`, fix issues, try `jj_push()` again |
| Empty commits cluttering log | Run `jj_cleanup()` to abandon empty commits |
| Stale workspaces | Run `jj_cleanup()` to forget workspaces whose changes merged |
| Plugin not loading | Verify `~/.config/opencode/config.json` includes `"plugin": ["jj-opencode"]` |

## JJ Concepts

New to JJ? Here are the key concepts:

- **Change ID**: Stable identifier that survives rebases (e.g., `skvrkxkk`)
- **Commit ID**: Git-style hash that changes on every edit (e.g., `52ba303b`)
- **Working copy = commit**: Your edits are always in a commit context
- **`@`**: Refers to the current working-copy change

## Why?

JJ (Jujutsu) treats the working copy as an implicit commit. The `jj new -m "description"` command declares your intent BEFORE you start implementing. This plugin enforces that pattern at the tooling level.

Benefits:
- **Intentionality**: Forces you to think before coding
- **Audit trail**: Every change has a description from the start
- **Parallel work**: Multiple changes as siblings from main
- **JJ philosophy**: The tool enforces what JJ was designed for

## Requirements

- [JJ (Jujutsu)](https://github.com/jj-vcs/jj) installed and in PATH
- [OpenCode](https://github.com/opencode-ai/opencode) with plugin support

## License

MIT
