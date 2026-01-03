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
AI: jj new                           ← commit, locks again

AI: jj describe -m "Add tests"       ← declare intent, unlocks
AI: [edits files]
AI: jj new                           ← commit, locks again

User: "undo that"
AI: jj undo                          ← reverts last commit
```

`jj new` at the end guarantees separation — can't accidentally mix work.

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
| Finish work | `jj new` |
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

## Subagents

Subagents that hit the edit gate are blocked and told to return to the parent agent. JJ workflow (describe/new/push) should only be managed by the primary agent.

## Why?

- **Guaranteed separation** — `jj new` re-engages the gate
- **Never lose work** — every edit is in a described commit
- **Clear history** — every commit has meaning

## License

MIT
