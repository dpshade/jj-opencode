export function logInfo(message: string): void {
  console.log(`[INFO] ${message}`)
}

export const GATE_BLOCK_MESSAGE_PLANNING = `
**Edit blocked**: No JJ change defined.

Before modifying files, I need to create a JJ change. Based on your request, I'll suggest a description.

**Please confirm or modify the description**, then I'll proceed.
`

export const GATE_BLOCK_MESSAGE_EXECUTION = `
**Edit blocked**: No JJ change defined.

Creating a JJ change based on your request, then proceeding with edits.
`

export const GATE_BLOCK_MESSAGE = GATE_BLOCK_MESSAGE_PLANNING

export const NOT_JJ_REPO_MESSAGE = `
**This directory is not a JJ repository.**

I can initialize JJ for you - it's fully Git-compatible and won't affect your existing Git history.

**To get started**, call \`jj_git_init()\` and I'll:
1. Initialize JJ in this directory
2. Ask what change you want to make
3. Set up tracking so all your work is captured

Would you like me to proceed?
`

export const JJ_INIT_SUCCESS = (changeId: string, description: string): string => `
**Change created successfully**

| Field | Value |
|-------|-------|
| Change ID | \`${changeId}\` |
| Description | ${description} |
| Base | \`main@origin\` (latest remote) |

You may now edit files. All changes will be tracked in this change.

When ready to push, call \`jj_push()\`.
`

export const JJ_GIT_INIT_SUCCESS = `
**JJ initialized successfully**

This directory is now a JJ repository. JJ is fully Git-compatible - your existing Git history is preserved.

**Next step**: What change are you about to make?

Call \`jj("description of your work")\` to create your first change and unlock file editing.
`

export const GATE_NOT_UNLOCKED = `
**No active JJ change.**

You need to define your change first. Call:
\`jj("description of your work")\`
`

export const PUSH_DESCRIPTION_WARNING = (description: string, files: string[]): string => `
**Description may not match changes**

Current description: "${description}"
Files modified: ${files.join(', ')}

Consider running \`jj describe -m "new description"\` before pushing.
`

export const PUSH_SUCCESS = (description: string, bookmark: string = 'main'): string => `
**Pushed successfully**

Change "${description.trim()}" has been pushed to **${bookmark}**.

**Gate locked.** To continue working, call \`jj("next task description")\` to create a new checkpoint.
`

export const PUSH_NO_CHANGES = `
**No changes to push.**

The working copy has no modifications. Make some changes first, then call \`jj_push()\`.
`

export const DESCRIPTION_TOO_SHORT = (length: number): string => `
**Description too short** (${length} characters)

Change descriptions must be at least 10 characters. Please provide a meaningful description of what you're implementing.

Example: "Add user authentication to login page"
`

export const DESCRIPTION_SINGLE_WORD = `
**Description must be more than one word**

Single-word descriptions don't provide enough context. Please describe what change you're making.

Example: "Fix pagination bug in user list"
`

export const PUSH_CONFIRMATION = (description: string, files: string[], diffSummary: string): string => `
**Push requires your approval**

| Field | Value |
|-------|-------|
| Description | ${description} |
| Files changed | ${files.length} |

### Files
${files.map(f => '- ' + f).join('\n')}

### Diff Summary
\`\`\`
${diffSummary}
\`\`\`

**Please confirm you want to push these changes.** I will not push without your explicit approval.

To update the description first: \`jj describe -m "new description"\`
`

export const GIT_COMMAND_BLOCKED = (gitSubcommand: string, jjAlternative: string): string =>
  `**Git command blocked** - use JJ instead\n\n` +
  `You tried to run: \`git ${gitSubcommand}\`\n\n` +
  `**JJ equivalent**: \`${jjAlternative}\`\n\n` +
  `This project uses JJ (Jujutsu) for version control. JJ is Git-compatible but provides a better workflow:\n` +
  `- Working copy is always a commit (no staging area)\n` +
  `- Changes are automatically tracked\n` +
  `- Parallel changes are easy with \`jj new\`\n\n` +
  `Use the \`jj_*\` tools or run JJ commands directly.`

export const WORKSPACE_CREATED = (name: string, path: string, description: string): string => `
**Workspace created for parallel development**

| Field | Value |
|-------|-------|
| Workspace | \`${name}\` |
| Path | \`${path}\` |
| Description | ${description} |
| Base | \`main@origin\` (latest remote) |

**To work in this workspace**, start a new OpenCode session:
\`\`\`bash
cd ${path} && opencode
\`\`\`

Then call \`jj("your task description")\` to unlock editing.
`

export const WORKSPACE_LIST_HEADER = `
## JJ Workspaces

| Workspace | Path | Change | Description |
|-----------|------|--------|-------------|`

export const PUSH_SUCCESS_WITH_CLEANUP = (bookmark: string, workspaceName: string): string => `
**Pushed successfully**

Change pushed to **${bookmark}** and synced to origin.

**Cleanup complete:**
- Workspace \`${workspaceName}\` removed
- Session moved to repo root
- Synced with origin

**Gate locked.** Ready for next task - call \`jj("description")\` to start a new change.
`

export const WORKSPACE_EMPTY_CHANGES = (workspaceName: string): string => `
**No changes in workspace \`${workspaceName}\`**

This workspace has no file modifications. Would you like to:
- **Clean up** the workspace without pushing (call \`jj_push(confirm: true)\`)
- **Make changes** first, then push

If this workspace was created accidentally, confirming will clean it up.
`

export const WORKSPACE_CLEANUP_ONLY = (workspaceName: string): string => `
**Workspace cleaned up**

Workspace \`${workspaceName}\` has been removed (no changes were pushed).

**Gate locked.** Ready for next task - call \`jj("description")\` to start a new change.
`

export const JJ_INIT_SUCCESS_WITH_BOOKMARK = (changeId: string, description: string, bookmark: string): string => `
**Change created successfully**

| Field | Value |
|-------|-------|
| Change ID | \`${changeId}\` |
| Description | ${description} |
| Bookmark | \`${bookmark}\` |
| Base | \`main@origin\` (latest remote) |

You may now edit files. All changes will be tracked in this change.

When ready to push, call \`jj_push()\`.
`

export const JJ_INIT_SUCCESS_FROM = (changeId: string, description: string, from: string): string => `
**Change created successfully**

| Field | Value |
|-------|-------|
| Change ID | \`${changeId}\` |
| Description | ${description} |
| Base | \`${from}\` |

You may now edit files. All changes will be tracked in this change.

When ready to push, call \`jj_push()\`.
`

export const JJ_WORKSPACE_REDIRECT = (changeId: string, description: string, workspaceName: string, workspacePath: string): string => `
**Workspace created and session moved**

| Field | Value |
|-------|-------|
| Change ID | \`${changeId}\` |
| Description | ${description} |
| Workspace | \`${workspaceName}\` |
| Path | \`${workspacePath}\` |
| Base | \`main@origin\` (latest remote) |

You may now edit files. All changes will be tracked in this workspace.

**IMPORTANT**: You are now in a new directory. Re-read any files you need to edit from \`${workspacePath}/\` — your previous file reads are from the old location.

When ready to push, call \`jj_push()\`.
`

export interface CleanupPreviewData {
  emptyCommits: Array<{ changeId: string; description: string; bookmarks: string[] }>
  staleWorkspaces: Array<{ name: string; changeId: string; reason: string }>
}

export const CLEANUP_NOTHING_TO_DO = `
**Nothing to clean up**

No empty commits or stale workspaces found.
`

export const CLEANUP_PREVIEW = (data: CleanupPreviewData): string => {
  const lines: string[] = ['**Cleanup preview**', '']
  
  if (data.emptyCommits.length > 0) {
    lines.push(`### Empty commits (${data.emptyCommits.length})`)
    lines.push('')
    lines.push('| Change | Description | Bookmarks |')
    lines.push('|--------|-------------|-----------|')
    for (const c of data.emptyCommits) {
      const bookmarks = c.bookmarks.length > 0 ? c.bookmarks.map(b => `\`${b}\``).join(', ') : '-'
      lines.push(`| \`${c.changeId}\` | ${c.description} | ${bookmarks} |`)
    }
    lines.push('')
  }
  
  if (data.staleWorkspaces.length > 0) {
    lines.push(`### Stale workspaces (${data.staleWorkspaces.length})`)
    lines.push('')
    lines.push('| Workspace | Reason |')
    lines.push('|-----------|--------|')
    for (const w of data.staleWorkspaces) {
      lines.push(`| \`${w.name}\` | ${w.reason} |`)
    }
    lines.push('')
  }
  
  lines.push('**Confirm cleanup?** Call `jj_cleanup(confirm: true)` to proceed.')
  
  return lines.join('\n')
}

export const CLEANUP_SUCCESS = (abandoned: number, workspacesRemoved: number, deletedBookmarks: string[]): string => {
  const lines: string[] = ['**Cleanup complete**', '']
  
  if (abandoned > 0) {
    lines.push(`- Abandoned ${abandoned} empty commit${abandoned === 1 ? '' : 's'}`)
  }
  if (workspacesRemoved > 0) {
    lines.push(`- Removed ${workspacesRemoved} stale workspace${workspacesRemoved === 1 ? '' : 's'}`)
  }
  if (deletedBookmarks.length > 0) {
    lines.push(`- Deleted bookmarks: ${deletedBookmarks.map(b => `\`${b}\``).join(', ')}`)
  }
  
  return lines.join('\n')
}

export const JJ_COMMAND_WARNING = (jjSubcommand: string, pluginAlternative: string): string =>
  `**Note**: Consider using \`${pluginAlternative}\` instead of \`jj ${jjSubcommand}\` — ` +
  `the plugin tool handles workspace creation and gate state automatically.\n\n` +
  `Command executed anyway.`

export const BASH_MODIFY_WARNING = (command: string): string =>
  `**Note**: Modifying files without a JJ change defined.\n\n` +
  `Consider calling \`jj("description")\` first to track your work.\n\n` +
  `Command executed anyway.`

export const JJ_PUSH_MAIN_WARNING = `
**Note**: After pushing to main, sync the repo root with the latest changes:

\`\`\`bash
jj new main@origin
\`\`\`

This updates the default workspace's working copy to include what you just pushed.
Without this, the repo root will be out of sync until the next \`jj git fetch\`.

Command executed anyway.
`
