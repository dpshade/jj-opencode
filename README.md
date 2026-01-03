# jj-opencode

<div align="center">

**Describe what you're doing. Then do it.**

[![npm version](https://img.shields.io/npm/v/jj-opencode.svg?color=cb3837&labelColor=black&style=flat-square)](https://www.npmjs.com/package/jj-opencode)
[![License: MIT](https://img.shields.io/badge/License-MIT-white?labelColor=black&style=flat-square)](https://opensource.org/licenses/MIT)

</div>

A minimal [OpenCode](https://github.com/opencode-ai/opencode) plugin that enforces JJ's workflow philosophy: **declare intent before implementation**.

---

## What It Does

Blocks file edits until you describe what you're doing:

```
You: "Add input validation"
AI: [tries to edit file] → BLOCKED

AI: jj("Add input validation to signup form")
    → Change created, gate unlocked

AI: [edits files freely]

You: "ship it"
AI: jj_push() → shows preview, waits for confirmation
You: "yes"
AI: jj_push(confirm: true) → pushed, gate locked
```

That's it. ~170 lines of code. Three tools.

---

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

**Requirements**: [JJ](https://github.com/jj-vcs/jj) and [OpenCode](https://github.com/opencode-ai/opencode)

---

## Tools

| Tool | Purpose |
|------|---------|
| `jj("description")` | Create JJ change, unlock editing |
| `jj_push()` | Show preview, push after confirmation |
| `jj_status()` | Show gate state and current changes |

Everything else is raw JJ commands via bash.

---

## Why?

JJ treats the working copy as an implicit commit. This plugin enforces that at the tooling level:

1. **Intentionality** — Think before you code
2. **Audit trail** — Every change has a description from the start
3. **Clean history** — No "WIP" or "fix typo" commits

---

## Parallel Development

Just use `jj new` multiple times in the same directory:

```bash
# Feature A
jj new main@origin -m "Add authentication"
# work...

# Feature B (same directory!)
jj new main@origin -m "Fix bug #123"
# work on different change...
```

JJ handles the isolation natively. No workspaces needed.

---

## Subagent Inheritance

When you spawn subagents via the `task` tool, they inherit the parent session's gate state. If the parent called `jj()`, subagents can edit immediately.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Edit blocked | `jj("description")` |
| Wrong description | `jj describe -m "new description"` |
| Abandon work | `jj abandon @` |
| Undo mistake | `jj undo` |
| Push failed | `jj st`, fix issues, retry |

---

## License

MIT
