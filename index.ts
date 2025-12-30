import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { createState, getState, setState, inheritParentState, deleteState } from './lib/state.js'
import { checkGate, isGatedTool } from './lib/gate.js'
import { analyzeBashCommand, checkForGitCommand } from './lib/bash-filter.js'
import { getParentSessionId } from './lib/subagent.js'
import * as jj from './lib/jj.js'
import * as messages from './lib/messages.js'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

function validateDescription(description: string): { valid: boolean; message?: string } {
  const trimmed = description.trim()
  
  // Check minimum length
  if (trimmed.length < 10) {
    return {
      valid: false,
      message: messages.DESCRIPTION_TOO_SHORT(trimmed.length),
    }
  }
  
  // Check for single-word descriptions
  const words = trimmed.split(/\s+/).filter(w => w.length > 0)
  if (words.length < 2) {
    return {
      valid: false,
      message: messages.DESCRIPTION_SINGLE_WORD,
    }
  }
  
  return { valid: true }
}

const plugin: Plugin = async (ctx) => {
  const { client, $ } = ctx

  return {
    event: async ({ event }) => {
      if (event.type === 'session.created') {
        const sessionId = event.properties.info.id

        const parentId = await getParentSessionId(client, sessionId)
        if (parentId) {
          const inherited = inheritParentState(sessionId, parentId)
          if (inherited) {
            return
          }
        }

        const isJJRepo = await jj.isJJRepo($)

        if (!isJJRepo) {
          createState(sessionId, {
            gateUnlocked: false,
            isJJRepo: false,
          })
          return
        }

        const changeId = await jj.getCurrentChangeId($)
        const description = await jj.getCurrentDescription($)
        const hasModifications = await jj.hasUncommittedChanges($)
        const hasActiveWork = description.length > 0 || hasModifications
        const workspaceName = await jj.getWorkspaceName($)
        const workspacePath = await jj.getWorkspaceRoot($)
        const bookmark = await jj.getBookmarkForChange($)

        createState(sessionId, {
          gateUnlocked: hasActiveWork,
          changeId,
          changeDescription: description,
          isJJRepo: true,
          workspace: workspaceName,
          workspacePath,
          bookmark,
        })
      }

      if (event.type === 'session.deleted') {
        deleteState(event.properties.info.id)
      }
    },

    "tool.execute.before": async (input, output) => {
      const { tool: toolName, sessionID } = input

      // Our own plugin tools are never blocked - they handle their own logic
      if (toolName.startsWith('jj_') || toolName === 'jj') {
        return
      }

      if (toolName === 'bash') {
        const command = output.args?.command || ''
        
        const gitCheck = checkForGitCommand(command)
        if (gitCheck.isGitCommand) {
          throw new Error(messages.GIT_COMMAND_BLOCKED(
            gitCheck.gitSubcommand!,
            gitCheck.jjAlternative!
          ))
        }

        const bashCheck = analyzeBashCommand(command)
        if (bashCheck.isModifying) {
          const gateCheck = checkGate(sessionID, 'bash')
          if (!gateCheck.allowed) {
            throw new Error(gateCheck.message)
          }
        }
        return
      }

      if (isGatedTool(toolName)) {
        const gateCheck = checkGate(sessionID, toolName)
        if (!gateCheck.allowed) {
          throw new Error(gateCheck.message)
        }
      }
    },

    "tool.execute.after": async (input, output) => {
      const { tool: toolName, sessionID } = input
      const state = getState(sessionID)

      if (!state) return

      if (toolName === 'write' || toolName === 'edit') {
        const filePath = output.metadata?.filePath || output.title
        if (filePath && !state.modifiedFiles.includes(filePath)) {
          setState(sessionID, {
            modifiedFiles: [...state.modifiedFiles, filePath],
          })
        }
      }
    },

    tool: {
      jj: tool({
        description: "Create a new JJ change and unlock file editing. Run this BEFORE making any file edits. When called from the default workspace, automatically creates a dedicated workspace and moves the session there.",
        args: {
          description: tool.schema.string().describe("Description of the work you're about to do"),
          bookmark: tool.schema.string().optional().describe("Create a named bookmark for this change (auto-generated from description if not provided)"),
          from: tool.schema.string().optional().describe("Base revision to branch from (defaults to main@origin)"),
        },
        async execute(args, context) {
          const validation = validateDescription(args.description)
          if (!validation.valid) {
            return validation.message!
          }

          let warning = ''
          const fetchResult = await jj.gitFetch($)
          if (!fetchResult.success) {
            warning = `Note: git fetch skipped (${fetchResult.error})\n\n`
          }

          const currentWorkspace = await jj.getWorkspaceName($)
          const isDefaultWorkspace = currentWorkspace === 'default'

          if (isDefaultWorkspace && !args.from) {
            const currentRoot = await jj.getWorkspaceRoot($)
            const workspaceSlug = slugify(args.description)
            const workspaceName = workspaceSlug
            const workspacesDir = `${currentRoot}/.workspaces`
            const workspacePath = `${workspacesDir}/${workspaceSlug}`

            try {
              await $`mkdir -p ${workspacesDir}`
            } catch {}

            const ignoreResult = await jj.ensureWorkspacesIgnored($, currentRoot)
            let gitignoreNote = ''
            if (ignoreResult.added) {
              gitignoreNote = '**Note**: Added `.workspaces/` to `.gitignore`\n\n'
            }

            const addResult = await jj.workspaceAdd($, workspacePath, workspaceName, 'main@origin')
            if (!addResult.success) {
              return `Error creating workspace: ${addResult.error}`
            }

            try {
              (globalThis as any).process.chdir(workspacePath)
            } catch (e: any) {
              return `Error moving to workspace: ${e.message || String(e)}`
            }

            const describeResult = await jj.describe($, args.description)
            if (!describeResult.success) {
              return `Error describing workspace change: ${describeResult.error}`
            }
            const changeId = await jj.getCurrentChangeId($)

            const bookmarkName = args.bookmark || workspaceSlug
            const bookmarkResult = await jj.bookmarkSet($, bookmarkName)

            setState(context.sessionID, {
              gateUnlocked: true,
              changeId: changeId || null,
              changeDescription: args.description,
              isJJRepo: true,
              workspace: workspaceName,
              workspacePath,
              bookmark: bookmarkResult.success ? bookmarkName : null,
            })

            return warning + gitignoreNote + messages.JJ_WORKSPACE_REDIRECT(
              changeId || 'unknown',
              args.description,
              workspaceName,
              workspacePath
            )
          }

          let newResult: { success: boolean; changeId?: string; error?: string }
          if (args.from) {
            newResult = await jj.newChangeFrom($, args.from, args.description)
          } else {
            newResult = await jj.newChange($, args.description)
          }
          
          if (!newResult.success) {
            return `Error creating change: ${newResult.error}`
          }

          const bookmarkName = args.bookmark || slugify(args.description)
          let bookmarkCreated = false
          if (args.bookmark || args.from) {
            const bookmarkResult = await jj.bookmarkSet($, bookmarkName)
            bookmarkCreated = bookmarkResult.success
          }

          setState(context.sessionID, {
            gateUnlocked: true,
            changeId: newResult.changeId || null,
            changeDescription: args.description,
            isJJRepo: true,
            bookmark: bookmarkCreated ? bookmarkName : null,
          })

          if (bookmarkCreated) {
            return warning + messages.JJ_INIT_SUCCESS_WITH_BOOKMARK(newResult.changeId || 'unknown', args.description, bookmarkName)
          } else if (args.from) {
            return warning + messages.JJ_INIT_SUCCESS_FROM(newResult.changeId || 'unknown', args.description, args.from)
          }
          return warning + messages.JJ_INIT_SUCCESS(newResult.changeId || 'unknown', args.description)
        },
      }),

      jj_status: tool({
        description: "Show current JJ change status, gate state, and diff summary",
        args: {},
        async execute(args, context) {
          const state = getState(context.sessionID)
          const changeId = await jj.getCurrentChangeId($)
          const description = await jj.getCurrentDescription($)
          const diffSummary = await jj.getDiffSummary($)
          const status = await jj.getStatus($)
          const workspaceName = await jj.getWorkspaceName($)
          const bookmark = await jj.getBookmarkForChange($)

          const lines = [
            '## JJ Status',
            '',
            `| Field | Value |`,
            `|-------|-------|`,
            `| Gate | ${state?.gateUnlocked ? 'UNLOCKED' : 'LOCKED'} |`,
            `| JJ Repo | ${state?.isJJRepo ? 'Yes' : 'No'} |`,
            `| Workspace | ${workspaceName} |`,
            `| Bookmark | ${bookmark || state?.bookmark || '(none)'} |`,
            `| Change ID | \`${changeId || 'none'}\` |`,
            `| Description | ${description || '(empty)'} |`,
            '',
            '### Working Copy Status',
            '```',
            status || '(no changes)',
            '```',
            '',
            '### Diff Summary',
            '```',
            diffSummary || '(no diff)',
            '```',
          ]

          return lines.join('\n')
        },
      }),

      jj_push: tool({
        description: "Validate changes and push to remote. ALWAYS shows preview and requests USER permission. Never auto-confirm - wait for explicit user approval before calling with confirm:true. From workspaces, moves main bookmark to current change, pushes, then cleans up workspace.",
        args: {
          bookmark: tool.schema.string().optional().describe("Bookmark name to push (defaults to 'main')"),
          confirm: tool.schema.boolean().optional().describe("Set to true ONLY after receiving explicit user permission to push"),
        },
        async execute(args, context) {
          const state = getState(context.sessionID)
          if (!state?.gateUnlocked) {
            return messages.GATE_NOT_UNLOCKED
          }

          // Detect workspace at runtime instead of using frozen session state
          const actualWorkspace = await jj.getWorkspaceName($)
          const actualWorkspacePath = await jj.getWorkspaceRoot($)
          const isNonDefaultWorkspace = actualWorkspace !== 'default' && actualWorkspace !== ''
          const diffFiles = await jj.getDiffFiles($)
          
          if (diffFiles.length === 0) {
            if (isNonDefaultWorkspace) {
              if (!args.confirm) {
                return messages.WORKSPACE_EMPTY_CHANGES(actualWorkspace)
              }
              const repoRoot = actualWorkspacePath.replace(/\/.workspaces\/[^/]+$/, '')
              await jj.workspaceForget($, actualWorkspace)
              if (repoRoot) {
                try { (globalThis as any).process.chdir(repoRoot) } catch {}
              }
              try { await $`rm -rf ${actualWorkspacePath}` } catch {}
              await jj.gitFetch($)
              setState(context.sessionID, {
                gateUnlocked: false,
                changeId: null,
                changeDescription: '',
                modifiedFiles: [],
                bookmark: null,
                workspace: 'default',
                workspacePath: repoRoot,
              })
              return messages.WORKSPACE_CLEANUP_ONLY(actualWorkspace)
            }
            return messages.PUSH_NO_CHANGES
          }

          const description = await jj.getCurrentDescription($)
          const diffSummary = await jj.getDiffSummary($)

          if (!args.confirm) {
            let confirmMsg = messages.PUSH_CONFIRMATION(description, diffFiles, diffSummary)
            if (isNonDefaultWorkspace) {
              confirmMsg += `\n\n**Workspace cleanup**: After push, \`${actualWorkspace}\` will be removed and you'll return to the main project directory.`
            }
            return confirmMsg
          }

          let warning = ''
          if (description.length < 10) {
            warning = messages.PUSH_DESCRIPTION_WARNING(description, diffFiles) + '\n\n'
          }

          const bookmark = args.bookmark || 'main'
          const bookmarkResult = await jj.bookmarkMove($, bookmark)
          if (!bookmarkResult.success) {
            return `Error moving bookmark '${bookmark}': ${bookmarkResult.error}`
          }

          const pushResult = await jj.gitPush($, bookmark)
          if (!pushResult.success) {
            return `Error pushing: ${pushResult.error}`
          }

          if (isNonDefaultWorkspace) {
            const repoRoot = actualWorkspacePath.replace(/\/.workspaces\/[^/]+$/, '')
            await jj.workspaceForget($, actualWorkspace)
            if (repoRoot) {
              try { (globalThis as any).process.chdir(repoRoot) } catch {}
            }
            try { await $`rm -rf ${actualWorkspacePath}` } catch {}
            await jj.gitFetch($)
            setState(context.sessionID, {
              gateUnlocked: false,
              changeId: null,
              changeDescription: '',
              modifiedFiles: [],
              bookmark: null,
              workspace: 'default',
              workspacePath: repoRoot,
            })
            return warning + messages.PUSH_SUCCESS_WITH_CLEANUP(bookmark, actualWorkspace)
          }

          setState(context.sessionID, {
            gateUnlocked: false,
            changeId: null,
            changeDescription: '',
            modifiedFiles: [],
            bookmark: null,
          })
          return warning + messages.PUSH_SUCCESS(description, bookmark)
        },
      }),

      jj_git_init: tool({
        description: "Initialize JJ in this directory. Only available if not already a JJ repo.",
        args: {},
        async execute(args, context) {
          const state = getState(context.sessionID)
          if (state?.isJJRepo) {
            return "This directory is already a JJ repository. Use `jj()` to create a new change."
          }

          const result = await jj.gitInit($)
          if (!result.success) {
            return `Error initializing JJ: ${result.error}`
          }

          setState(context.sessionID, {
            isJJRepo: true,
          })

          return messages.JJ_GIT_INIT_SUCCESS
        },
      }),

      jj_undo: tool({
        description: "Undo the last JJ operation. Safe recovery from mistakes.",
        args: {},
        async execute(args, context) {
          const result = await jj.undo($)
          if (!result.success) {
            return `Error: ${result.error}`
          }
          return "Undo successful. Last operation has been reverted."
        },
      }),

      jj_describe: tool({
        description: "Update the description of the current JJ change.",
        args: {
          message: tool.schema.string().describe("New description for the current change"),
        },
        async execute(args, context) {
          const state = getState(context.sessionID)
          if (!state?.gateUnlocked) {
            return "No active change. Call `jj()` first to create a change."
          }

          const validation = validateDescription(args.message)
          if (!validation.valid) {
            return validation.message!
          }

          const result = await jj.describe($, args.message)
          if (!result.success) {
            return `Error: ${result.error}`
          }

          setState(context.sessionID, {
            changeDescription: args.message,
          })

          return `Description updated to: "${args.message}"`
        },
      }),

      jj_abandon: tool({
        description: "Abandon the current JJ change and reset the gate. Use to start over.",
        args: {},
        async execute(args, context) {
          const state = getState(context.sessionID)
          if (!state?.gateUnlocked) {
            return "No active change to abandon."
          }

          const result = await jj.abandon($)
          if (!result.success) {
            return `Error: ${result.error}`
          }

          const isNonDefaultWorkspace = state.workspace !== 'default' && state.workspace !== ''

          if (isNonDefaultWorkspace) {
            const repoRoot = state.workspacePath?.replace(/\/.workspaces\/[^/]+$/, '') || ''
            await jj.workspaceForget($, state.workspace!)
            if (repoRoot) {
              try { (globalThis as any).process.chdir(repoRoot) } catch {}
            }
            if (state.workspacePath) {
              try { await $`rm -rf ${state.workspacePath}` } catch {}
            }
            await jj.gitFetch($)
            setState(context.sessionID, {
              gateUnlocked: false,
              changeId: null,
              changeDescription: '',
              modifiedFiles: [],
              bookmark: null,
              workspace: 'default',
              workspacePath: repoRoot,
            })
            return `Change abandoned and workspace \`${state.workspace}\` cleaned up. Gate is now locked. Call \`jj()\` to start a new change.`
          }

          setState(context.sessionID, {
            gateUnlocked: false,
            changeId: null,
            changeDescription: '',
            modifiedFiles: [],
            bookmark: null,
          })

          return "Change abandoned. Gate is now locked. Call `jj()` to start a new change."
        },
      }),

      jj_workspace: tool({
        description: "Create a new JJ workspace for parallel development. Creates workspace in .workspaces/ subdirectory with isolated working copy.",
        args: {
          description: tool.schema.string().describe("Description of the work for this workspace"),
        },
        async execute(args, context) {
          const validation = validateDescription(args.description)
          if (!validation.valid) {
            return validation.message!
          }

          const fetchResult = await jj.gitFetch($)
          let warning = ''
          if (!fetchResult.success) {
            warning = `Note: git fetch skipped (${fetchResult.error})\n\n`
          }

          const currentRoot = await jj.getWorkspaceRoot($)
          const workspaceSlug = slugify(args.description)
          const workspaceName = workspaceSlug
          const workspacesDir = `${currentRoot}/.workspaces`
          const workspacePath = `${workspacesDir}/${workspaceSlug}`

          try {
            await $`mkdir -p ${workspacesDir}`
          } catch {}

          const addResult = await jj.workspaceAdd($, workspacePath, workspaceName, 'main@origin')
          if (!addResult.success) {
            return `Error creating workspace: ${addResult.error}`
          }

          return warning + messages.WORKSPACE_CREATED(workspaceName, workspacePath, args.description)
        },
      }),

      jj_workspaces: tool({
        description: "List all JJ workspaces with their status and changes.",
        args: {},
        async execute(args, context) {
          const listOutput = await jj.workspaceList($)
          if (!listOutput) {
            return "No workspaces found."
          }

          const lines = listOutput.split('\n')
          const rows: string[] = []
          
          for (const line of lines) {
            const match = line.match(/^(\S+):\s+(\S+)\s+(.*)$/)
            if (match) {
              const [, name, changeId, rest] = match
              const isActive = rest.includes('@') ? ' **(active)**' : ''
              const description = rest.replace(/@?\s*/, '').trim()
              rows.push(`| ${name}${isActive} | - | \`${changeId}\` | ${description || '(empty)'} |`)
            }
          }

          if (rows.length === 0) {
            return "No workspaces found."
          }

          return messages.WORKSPACE_LIST_HEADER + '\n' + rows.join('\n')
        },
      }),

      jj_cleanup: tool({
        description: "Clean up empty commits and stale workspaces. Shows preview first, then requires confirm:true to execute.",
        args: {
          confirm: tool.schema.boolean().optional().describe("Set to true to execute cleanup after reviewing preview"),
        },
        async execute(args, context) {
          const emptyCommits = await jj.getEmptyCommits($)
          const staleWorkspaces = await jj.getStaleWorkspaces($)

          if (emptyCommits.length === 0 && staleWorkspaces.length === 0) {
            return messages.CLEANUP_NOTHING_TO_DO
          }

          if (!args.confirm) {
            return messages.CLEANUP_PREVIEW({ emptyCommits, staleWorkspaces })
          }

          let totalAbandoned = 0
          let allDeletedBookmarks: string[] = []

          if (emptyCommits.length > 0) {
            const changeIds = emptyCommits.map(c => c.changeId)
            const result = await jj.abandonCommits($, changeIds)
            if (result.success) {
              totalAbandoned = result.abandoned
              allDeletedBookmarks = result.deletedBookmarks
            }
          }

          let workspacesRemoved = 0
          for (const workspace of staleWorkspaces) {
            const result = await jj.workspaceForget($, workspace.name)
            if (result.success) {
              workspacesRemoved++
            }
          }

          return messages.CLEANUP_SUCCESS(totalAbandoned, workspacesRemoved, allDeletedBookmarks)
        },
      }),
    },
  }
}

export default plugin
