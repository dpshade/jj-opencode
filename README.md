# jj-opencode

<div align="center">

**Checkpoint before you edit. Undo anything.**

[![npm version](https://img.shields.io/npm/v/jj-opencode.svg?color=cb3837&labelColor=black&style=flat-square)](https://www.npmjs.com/package/jj-opencode)
[![License: MIT](https://img.shields.io/badge/License-MIT-white?labelColor=black&style=flat-square)](https://opensource.org/licenses/MIT)

</div>

An [OpenCode](https://github.com/opencode-ai/opencode) plugin that forces a checkpoint before every edit.

## How It Works

```
AI: jj new -m "Add validation"   ← checkpoint
AI: [edits files]                ← all edits in this commit

AI: jj new -m "Add tests"        ← new checkpoint  
AI: [edits files]                ← all edits in this commit

User: "undo that"
AI: jj undo                      ← reverts entire "Add tests" checkpoint
```

40 lines of code. Zero tools. Just: checkpoint before edit.

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
| Checkpoint | `jj new -m "what you're doing"` |
| Undo | `jj undo` |
| Status | `jj st` |
| History | `jj log` |
| Push | `jj bookmark move main --to @ --allow-backwards && jj git push -b main` |

## Why?

- **Never lose work** — every edit is checkpointed
- **Easy undo** — `jj undo` reverts one logical unit
- **Clear history** — every commit has meaning

## License

MIT
