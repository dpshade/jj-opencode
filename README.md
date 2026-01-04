# jj-opencode

<div align="center">

**Describe intent. Edit. Commit. Repeat.**

[![npm version](https://img.shields.io/npm/v/jj-opencode.svg?color=cb3837&labelColor=black&style=flat-square)](https://www.npmjs.com/package/jj-opencode)
[![License: MIT](https://img.shields.io/badge/License-MIT-white?labelColor=black&style=flat-square)](https://opensource.org/licenses/MIT)

</div>

An [OpenCode](https://github.com/opencode-ai/opencode) plugin that blocks edits until you declare intent.

## How It Works

```
AI: jj describe -m "Add validation"  ← declare intent, unlocks
AI: [edits files]                    ← all edits in this commit
[session ends]                       ← auto-commits, locks again

AI: jj describe -m "Add tests"       ← declare intent, unlocks
AI: [edits files]
[session ends]                       ← auto-commits, locks again

User: "undo that"
AI: jj undo                          ← reverts last commit
```

`jj new` runs automatically when the session goes idle — can't accidentally mix work.

## Installation

```bash
npm install -g jj-opencode
```

Add to `~/.config/opencode/config.json`:
```json
{
  "plugin": ["jj-opencode"]
}
```

## Commands

| Task | Command |
|------|---------|
| Start work | `jj describe -m "what you're doing"` |
| Finish work | *(automatic)* |
| Undo | `jj undo` |
| Status | `jj st` |
| History | `jj log` |
| Push | `jj_push` tool |

## Tools

### jj_push

Safely pushes current change to a bookmark.

```
jj_push                      ← push to main (default)
jj_push bookmark="feature"   ← push to specific branch
```

- Shows preview before pushing
- Requires user confirmation
- Runs `jj new` + bookmark move + push
- Leaves working copy clean

Only specify `bookmark` if user explicitly requested it.

**Multi-commit push:** The tool shows all commits that will be pushed. JJ pushes bookmarks, not individual commits — moving the bookmark to the tip pushes all ancestors automatically.

## JJ ≠ Git

JJ uses bookmarks, not branches. Key difference for pushing:

| Git Model | JJ Model |
|-----------|----------|
| Push commits one by one | Move bookmark to tip, push once |
| Can rewrite after push (with force) | Commits are **immutable** after push |

**Anti-pattern:** Don't try to push commits sequentially or squash after pushing.

## Subagents

Subagents that hit the edit gate are blocked and told to return to the parent agent. JJ workflow (describe/new/push) should only be managed by the primary agent.

## Why?

- **Guaranteed separation** — `jj new` runs automatically on session idle
- **Never lose work** — every edit is in a described commit
- **Clear history** — every commit has meaning

## License

MIT
