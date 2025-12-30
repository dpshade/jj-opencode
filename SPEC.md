# jj-opencode Plugin Specification

> OpenCode plugin that enforces JJ's "define change before implementation" philosophy

**Version**: 0.2.0  
**Status**: Release Candidate  
**Last Updated**: 2025-12-29

---

## Executive Summary

`jj-opencode` transforms OpenCode into a JJ-native agentic coding environment by enforcing a critical workflow gate: **no file modifications are allowed until the agent defines what change it's about to make**.

This aligns with JJ's core philosophy where the working copy is always a commit, and `jj new -m "description"` declares intent before implementation.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Plugin name | `jj-opencode` | JJ-first naming, consistent with jj-vcs ecosystem |
| Distribution | Local + npm | Develop at `~/.config/opencode/plugin/jj-opencode/`, publish to npm |
| Parallel detection | Always `jj new main@origin` | JJ handles parallelism naturally via sibling changes |
| Subagent behavior | Inherit parent state | Subagents work within parent's change context |
| Error UX | Auto-prompt agent | Blocked edits prompt agent to describe intended work |
| Non-JJ repos | Streamlined init | Offer `jj git init` + immediately prompt for change description |
| Description validation | Manual `jj_push` | Agent explicitly calls when ready to push |
| Blocked scope | Strict | All non-read-only tools blocked until gate unlocked |
| Documentation | Separate AGENTS.md | Plugin has own docs, user's AGENTS.md unchanged |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         jj-opencode Plugin                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Session State                               │   │
│  │                                                                  │   │
│  │  Map<sessionId, {                                               │   │
│  │    gateUnlocked: boolean,      // Has jj_init been called?      │   │
│  │    changeId: string | null,    // Stable JJ change ID           │   │
│  │    changeDescription: string,  // From jj new -m "..."          │   │
│  │    parentSessionId?: string,   // For subagent inheritance      │   │
│  │    isJJRepo: boolean,          // Is this directory a JJ repo?  │   │
│  │    modifiedFiles: string[],    // Files changed this session    │   │
│  │  }>                                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Lifecycle Hooks                             │   │
│  │                                                                  │   │
│  │  session.created:                                               │   │
│  │    1. Check if JJ repo: `jj root`                               │   │
│  │    2. Check for parent session (subagent detection)             │   │
│  │    3. If subagent → inherit parent's unlocked state             │   │
│  │    4. If not JJ repo → set isJJRepo=false, offer init           │   │
│  │    5. If JJ repo → check current change state                   │   │
│  │                                                                  │   │
│  │  tool.execute.before:                                           │   │
│  │    1. If tool in READ_ONLY_TOOLS → allow                        │   │
│  │    2. If tool is 'bash' → analyze command                       │   │
│  │       - Matches BASH_READONLY_PATTERNS → allow                  │   │
│  │       - Matches BASH_MODIFY_PATTERNS → check gate               │   │
│  │    3. If tool in MODIFYING_TOOLS → check gate                   │   │
│  │    4. If gate locked → throw auto-prompt error                  │   │
│  │                                                                  │   │
│  │  tool.execute.after:                                            │   │
│  │    1. Track modified files for jj_push validation               │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Custom Tools                                │   │
│  │                                                                  │   │
│  │  jj_init(description: string)                                   │   │
│  │    Purpose: Create new JJ change and unlock the gate            │   │
│  │    Command: jj git fetch && jj new main@origin -m "{desc}"      │   │
│  │    Returns: Change ID confirmation, gate unlocked message       │   │
│  │                                                                  │   │
│  │  jj_status()                                                    │   │
│  │    Purpose: Show current change state and gate status           │   │
│  │    Returns: Change ID, description, diff summary, gate state    │   │
│  │                                                                  │   │
│  │  jj_describe(message: string)                                   │   │
│  │    Purpose: Update current change description                   │   │
│  │    Command: jj describe -m "{message}"                          │   │
│  │    Returns: Confirmation of new description                     │   │
│  │                                                                  │   │
│  │  jj_push(bookmark?)                                              │   │
│  │    Purpose: Validate, bookmark, and push to remote              │   │
│  │    Args: bookmark (optional, defaults to 'main')                │   │
│  │    Steps:                                                       │   │
│  │      1. Validate description matches diff (warn if mismatch)    │   │
│  │      2. jj bookmark move {bookmark} --to @                      │   │
│  │      3. jj git push -b {bookmark} (fallback to raw git)         │   │
│  │    Returns: Push confirmation with bookmark name                │   │
│  │                                                                  │   │
│  │  jj_git_init() [only shown if not JJ repo]                      │   │
│  │    Purpose: Initialize JJ and immediately prompt for change     │   │
│  │    Steps:                                                       │   │
│  │      1. jj git init                                             │   │
│  │      2. Prompt: "JJ initialized. What change will you make?"    │   │
│  │    Returns: Prompts agent for jj_init description               │   │
│  │                                                                  │   │
│  │  jj_abandon()                                                   │   │
│  │    Purpose: Abandon current change and reset gate               │   │
│  │    Command: jj abandon @                                        │   │
│  │    Returns: Gate reset, prompts for new jj_init                 │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tool Classification

### Read-Only Tools (Always Allowed)

```typescript
const READ_ONLY_TOOLS = [
  // File reading
  'read',
  'glob', 
  'grep',
  
  // LSP queries (read-only)
  'lsp_hover',
  'lsp_goto_definition', 
  'lsp_find_references',
  'lsp_document_symbols',
  'lsp_workspace_symbols',
  'lsp_diagnostics',
  'lsp_servers',
  'lsp_prepare_rename',     // Prepare is read-only
  'lsp_code_actions',       // Getting actions is read-only
  
  // AST search (not replace)
  'ast_grep_search',
  
  // Web/external
  'webfetch',
  'context7_resolve-library-id',
  'context7_query-docs',
  'grep_app_searchGitHub',
  'websearch_exa_web_search_exa',
  
  // Memory/state reading
  'supermemory',
  'todoread',
  'look_at',
  
  // Agent orchestration (subagents inherit state)
  'task',
  'background_task',
  'background_output',
  'background_cancel',
  'call_omo_agent',
  
  // Interactive sessions (read-focused)
  'interactive_bash',       // Tmux - handled separately if needed
  
  // Plugin's own tools (always available)
  'jj_init',
  'jj_status', 
  'jj_git_init',
]
```

### Modifying Tools (Blocked Until Gate Unlocked)

```typescript
const MODIFYING_TOOLS = [
  // File modification
  'write',
  'edit', 
  
  // LSP modifications
  'lsp_rename',
  'lsp_code_action_resolve',
  
  // AST modifications
  'ast_grep_replace',
  
  // Todo state (considered state modification)
  'todowrite',
  
  // Slash commands (may modify files)
  'slashcommand',
  
  // Plugin's gated tools
  'jj_describe',
  'jj_push',
  'jj_abandon',
]
```

### Bash Command Analysis

```typescript
// Patterns that indicate file modification
const BASH_MODIFY_PATTERNS = [
  // Direct file operations
  /\bsed\s+-i/,                    // sed in-place edit
  /\bperl\s+-[ip]/,                // perl in-place
  /[^<]>[^>]/,                     // Single redirect (not heredoc, not >>)
  />>/,                            // Append redirect
  /\btee\b/,                       // tee writes to files
  /\brm\s/,                        // remove
  /\bmv\s/,                        // move
  /\bcp\s/,                        // copy
  /\bmkdir\b/,                     // create directory
  /\brmdir\b/,                     // remove directory
  /\btouch\b/,                     // create/update file
  /\bchmod\b/,                     // modify permissions
  /\bchown\b/,                     // modify ownership
  /\bln\s/,                        // create link
  /\bunlink\b/,                    // remove link
  /\btruncate\b/,                  // truncate file
  /\bdd\b/,                        // disk dump
  /\binstall\b/,                   // install command
  
  // VCS modifications
  /\bgit\s+(add|commit|push|checkout|reset|clean|stash|cherry-pick|revert|merge|rebase)\b/,
  /\bjj\s+(new|describe|squash|abandon|split|edit|restore|diffedit)\b/,
  
  // Package managers
  /\bnpm\s+(install|uninstall|update|init|link|publish)\b/,
  /\byarn\s+(add|remove|install|link)\b/,
  /\bpnpm\s+(add|remove|install|link)\b/,
  /\bbun\s+(add|remove|install|link|create)\b/,
  /\bpip\s+(install|uninstall)\b/,
  /\bcargo\s+(add|remove|install|build)\b/,
  
  // Build/compile (creates files)
  /\bmake\b/,
  /\bninja\b/,
  /\bcmake\b/,
  /\bgcc\b/,
  /\bclang\b/,
  /\brustc\b/,
  /\btsc\b/,                       // TypeScript compiler
  
  // Archive/extract
  /\btar\s+[^t]/,                  // tar (except list)
  /\bunzip\b/,
  /\bgunzip\b/,
]

// Patterns that are explicitly read-only (override modify detection)
const BASH_READONLY_PATTERNS = [
  // JJ read operations (allow these always)
  /\bjj\s+(log|st|status|diff|show|op\s+log|file\s+show|git\s+fetch|evolog|bookmark\s+list)\b/,
  
  // Git read operations
  /\bgit\s+(status|log|diff|show|branch|remote|tag|describe|rev-parse|ls-files|ls-tree)\b/,
  
  // File reading
  /\bcat\b(?!.*[>])/,              // cat without redirect
  /\bhead\b/,
  /\btail\b/,
  /\bless\b/,
  /\bmore\b/,
  /\bbat\b/,                       // bat (cat alternative)
  
  // Search/find
  /\bgrep\b/,
  /\brg\b/,                        // ripgrep
  /\bag\b/,                        // silver searcher
  /\bfind\b(?!.*-exec)/,           // find without -exec
  /\bfd\b/,                        // fd (find alternative)
  /\blocate\b/,
  /\bwhich\b/,
  /\bwhereis\b/,
  /\btype\b/,
  
  // System info
  /\bls\b/,
  /\bexa\b/,                       // exa (ls alternative)
  /\blsd\b/,                       // lsd (ls alternative)  
  /\btree\b/,
  /\bpwd\b/,
  /\bwc\b/,
  /\bdu\b/,
  /\bdf\b/,
  /\bstat\b/,
  /\bfile\b/,
  /\benv\b/,
  /\bprintenv\b/,
  /\becho\s+\$/,                   // echo $VAR (no redirect)
  /\buname\b/,
  /\bhostname\b/,
  /\bdate\b/,
  /\buptime\b/,
  /\bwho\b/,
  /\bps\b/,
  /\btop\b/,
  /\bhtop\b/,
  
  // Package info (not install)
  /\bnpm\s+(list|ls|info|view|outdated|search)\b/,
  /\byarn\s+(list|info|why)\b/,
  /\bpip\s+(list|show|freeze)\b/,
  /\bcargo\s+(tree|search|info)\b/,
]
```

---

## User-Facing Messages

### Gate Block Message (Auto-Prompt)

```typescript
const GATE_BLOCK_MESSAGE = `
**Edit blocked**: No JJ change defined for this session.

Before I can modify files, I need to know what change you want to make.

**What work are you about to do?** 

Once you describe it, I'll run:
\`\`\`bash
jj git fetch && jj new main@origin -m "your description"
\`\`\`

This creates a new JJ change that tracks all your work with clear intent.

Just tell me what you're implementing and I'll set it up.
`
```

### Non-JJ Repo Message

```typescript
const NOT_JJ_REPO_MESSAGE = `
This directory is not a JJ repository.

I can initialize JJ for you - it's fully Git-compatible and won't affect your existing Git history.

**To get started**, call \`jj_git_init()\` and I'll:
1. Initialize JJ in this directory
2. Ask what change you want to make
3. Set up tracking so all your work is captured

Would you like me to proceed?
`
```

### jj_init Success

```typescript
const JJ_INIT_SUCCESS = (changeId: string, description: string) => `
**Change created successfully**

| Field | Value |
|-------|-------|
| Change ID | \`${changeId}\` |
| Description | ${description} |
| Base | \`main@origin\` (latest remote) |

You may now edit files. All changes will be tracked in this change.

When ready to push, call \`jj_push()\`.
`
```

### jj_push Validation Warning

```typescript
const PUSH_DESCRIPTION_WARNING = (description: string, files: string[]) => `
**Description may not match changes**

Current description: "${description}"
Files modified: ${files.join(', ')}

Consider updating the description with \`jj_describe()\` before pushing.

Proceed anyway? (The push will continue unless you call jj_describe first)
`
```

---

## File Structure

```
~/.config/opencode/plugin/jj-opencode/
├── index.ts                 # Main plugin entry point
├── package.json             # Package manifest
├── tsconfig.json            # TypeScript config
├── AGENTS.md                # Plugin documentation for agents
├── README.md                # Human-readable documentation
│
├── lib/
│   ├── state.ts             # Session state management
│   │   ├── SessionState interface
│   │   ├── createState()
│   │   ├── getState()
│   │   ├── setState()
│   │   └── inheritParentState()
│   │
│   ├── gate.ts              # Tool blocking logic
│   │   ├── READ_ONLY_TOOLS
│   │   ├── MODIFYING_TOOLS
│   │   ├── isToolAllowed()
│   │   ├── checkGate()
│   │   └── createGateHandler()
│   │
│   ├── bash-filter.ts       # Bash command analysis
│   │   ├── BASH_MODIFY_PATTERNS
│   │   ├── BASH_READONLY_PATTERNS
│   │   ├── isBashReadOnly()
│   │   └── analyzeBashCommand()
│   │
│   ├── jj.ts                # JJ command helpers
│   │   ├── isJJRepo()
│   │   ├── getCurrentChangeId()
│   │   ├── getCurrentDescription()
│   │   ├── getDiffSummary()
│   │   └── runJJCommand()
│   │
│   ├── subagent.ts          # Subagent detection
│   │   ├── isSubagentSession()
│   │   └── getParentSessionId()
│   │
│   ├── messages.ts          # User-facing messages
│   │   ├── GATE_BLOCK_MESSAGE
│   │   ├── NOT_JJ_REPO_MESSAGE
│   │   ├── JJ_INIT_SUCCESS
│   │   └── PUSH_DESCRIPTION_WARNING
│   │
│   └── tools/
│       ├── jj-init.ts       # jj_init tool
│       ├── jj-status.ts     # jj_status tool
│       ├── jj-describe.ts   # jj_describe tool
│       ├── jj-push.ts       # jj_push tool
│       ├── jj-git-init.ts   # jj_git_init tool
│       └── jj-abandon.ts    # jj_abandon tool
│
└── tests/                   # Test files (if needed)
    ├── gate.test.ts
    ├── bash-filter.test.ts
    └── tools.test.ts
```

---

## Package Configuration

### package.json

```json
{
  "name": "jj-opencode",
  "version": "0.1.0",
  "description": "OpenCode plugin for JJ VCS - enforces 'define change before implementation' workflow",
  "main": "index.ts",
  "type": "module",
  "keywords": [
    "opencode",
    "opencode-plugin",
    "jj",
    "jujutsu",
    "vcs",
    "version-control"
  ],
  "author": "DPS",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/dps/jj-opencode"
  },
  "peerDependencies": {
    "@opencode-ai/plugin": ">=0.1.0"
  },
  "devDependencies": {
    "@opencode-ai/plugin": "latest",
    "typescript": "^5.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["*.ts", "lib/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

---

## Plugin AGENTS.md Content

```markdown
---
name: jj-opencode
description: "JJ VCS integration - enforces 'define change before implementation'"
alwaysApply: true
---

# jj-opencode Plugin

This plugin enforces JJ's workflow philosophy: **define what you're doing before you do it**.

## Gate Behavior

**Before any file modification**, you must define your change:

1. Call `jj_init("description of your work")`
2. This runs: `jj git fetch && jj new main@origin -m "description"`
3. Gate unlocks - you can now edit files
4. When done, call `jj_push()` to validate and push

## Available Tools

| Tool | Purpose | When Available |
|------|---------|----------------|
| `jj_init(description)` | Create new change, unlock gate | Always |
| `jj_status()` | Show change ID, description, gate state | Always |
| `jj_describe(message)` | Update change description | After jj_init |
| `jj_push()` | Validate description, push to remote | After jj_init |
| `jj_abandon()` | Abandon change, reset gate | After jj_init |
| `jj_git_init()` | Initialize JJ in non-JJ repo | Only if not JJ repo |

## What's Blocked

Until `jj_init` is called:
- All file write/edit operations
- Bash commands that modify files
- LSP rename/code actions that modify files
- AST grep replace operations

What's always allowed:
- Reading files
- Searching (grep, glob, find)
- LSP queries (hover, definitions, references)
- Web searches and documentation lookups
- Spawning subagents (they inherit gate state)

## Workflow

```
1. Session starts → Gate LOCKED
2. User requests work → You see what needs doing
3. Call jj_init("add feature X") → Gate UNLOCKED
4. Make all your edits
5. Call jj_push() → Validates and pushes
```

## Subagents

Subagents (via Task tool) inherit the parent session's gate state.
If parent has unlocked the gate, subagents can edit files.
All edits go to the same JJ change.

## Error Recovery

- If you edit before jj_init → You'll be prompted to describe your work
- If jj_push fails → Check `jj_status()` and try again
- If you need to start over → Call `jj_abandon()` then `jj_init()`
```

---

## Implementation Notes

### Session Created Handler

```typescript
event: async ({ event }) => {
  if (event.type === 'session.created') {
    const sessionId = event.properties.info.id
    
    // Check for subagent
    const parentId = await getParentSessionId(client, sessionId)
    if (parentId && sessionState.has(parentId)) {
      inheritParentState(sessionId, parentId)
      return
    }
    
    // Check if JJ repo
    const isJJ = await isJJRepo(ctx.$)
    
    if (!isJJ) {
      sessionState.set(sessionId, {
        gateUnlocked: false,
        changeId: null,
        changeDescription: '',
        isJJRepo: false,
        modifiedFiles: [],
      })
      // Will show jj_git_init option when edit is attempted
      return
    }
    
    // Check current change state
    const changeId = await getCurrentChangeId(ctx.$)
    const description = await getCurrentDescription(ctx.$)
    
    // If there's already a described change, consider gate unlocked
    const hasActiveChange = description && description.trim().length > 0
    
    sessionState.set(sessionId, {
      gateUnlocked: hasActiveChange,
      changeId: changeId,
      changeDescription: description || '',
      isJJRepo: true,
      modifiedFiles: [],
    })
  }
}
```

### Bash Command Handler

```typescript
function handleBashCommand(command: string, state: SessionState): void {
  // Check read-only patterns first (whitelist)
  for (const pattern of BASH_READONLY_PATTERNS) {
    if (pattern.test(command)) {
      return // Allow
    }
  }
  
  // Check modify patterns (blocklist)
  for (const pattern of BASH_MODIFY_PATTERNS) {
    if (pattern.test(command)) {
      if (!state.gateUnlocked) {
        throw new Error(GATE_BLOCK_MESSAGE)
      }
      return // Allow (gate is unlocked)
    }
  }
  
  // Unknown command - allow by default (may reconsider)
  return
}
```

---

## Future Enhancements (Post-MVP)

1. **Parallel change support**: `jj_parallel(description)` to create sibling changes
2. **Change switching**: `jj_switch(changeId)` to switch between active changes
3. **Squash support**: `jj_squash()` to squash into parent
4. **Split support**: `jj_split()` for interactive splitting
5. **Configuration file**: Optional `jj-opencode.json` for customization
6. **Toast notifications**: Show gate unlock/push status in TUI
7. **Metrics**: Track blocked attempts, time to unlock, etc.

---

## Testing Plan

1. **Unit tests**: Gate logic, bash filtering, state management
2. **Integration tests**: Full plugin lifecycle with mock JJ commands
3. **Manual testing**: 
   - New session in JJ repo
   - New session in non-JJ repo  
   - Subagent inheritance
   - Various bash commands
   - Push flow with validation

---

## Success Criteria

- [ ] Gate blocks all modifying tools before `jj_init`
- [ ] Gate allows all read-only tools without `jj_init`
- [ ] `jj_init` creates change and unlocks gate
- [ ] `jj_push` validates and pushes successfully
- [ ] Subagents inherit parent gate state
- [ ] Non-JJ repos offer `jj_git_init`
- [ ] Bash commands correctly filtered
- [ ] Clear error messages guide agent behavior
