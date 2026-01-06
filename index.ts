import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

const MODIFYING_TOOLS = new Set([
  'write', 'edit',
  'lsp_rename', 'lsp_code_action_resolve',
  'ast_grep_replace'
])

// Session state: track if gate was opened (edits were allowed) this session
const sessionState = new Map<string, { gateOpened: boolean }>()

async function getCurrentDescription($: any): Promise<string> {
  try {
    return (await $`jj log -r @ --no-graph -T description`.text()).trim()
  } catch {
    return ''
  }
}

async function isJJRepo($: any): Promise<boolean> {
  try {
    await $`jj root`.text()
    return true
  } catch {
    return false
  }
}

async function isSubagent(client: any, sessionID: string): Promise<boolean> {
  try {
    const session = await client.session.get({ path: { id: sessionID } })
    return !!session.data?.parentID
  } catch {
    return false
  }
}

async function getChangeInfo($: any, rev: string = '@'): Promise<{ id: string; description: string; stats: string }> {
  try {
    const id = (await $`jj log -r ${rev} --no-graph -T 'change_id.shortest(8)'`.text()).trim()
    const description = (await $`jj log -r ${rev} --no-graph -T description`.text()).trim()
    const stats = (await $`jj diff -r ${rev} --stat`.text()).trim()
    return { id, description, stats }
  } catch {
    return { id: '', description: '', stats: '' }
  }
}

async function getCommitStack($: any, bookmark: string, targetRev: string): Promise<string[]> {
  try {
    const output = (await $`jj log -r '${bookmark}@origin..${targetRev}' --no-graph -T 'change_id.shortest(8) ++ " " ++ description.first_line() ++ "\n"'`.text()).trim()
    return output ? output.split('\n').filter(Boolean) : []
  } catch {
    return []
  }
}

interface PushTarget {
  revision: string
  info: { id: string; description: string; stats: string }
  stack: string[]
  needsConfirmation: boolean
}

async function findPushTarget($: any, bookmark: string): Promise<PushTarget | null> {
  const atInfo = await getChangeInfo($, '@')
  if (atInfo.description && atInfo.stats) {
    const stack = await getCommitStack($, bookmark, '@')
    return { revision: '@', info: atInfo, stack, needsConfirmation: false }
  }

  const parentInfo = await getChangeInfo($, '@-')
  if (parentInfo.description && parentInfo.stats) {
    const stack = await getCommitStack($, bookmark, '@-')
    return { revision: '@-', info: parentInfo, stack, needsConfirmation: false }
  }

  try {
    const unpushedOutput = (await $`jj log -r '${bookmark}@origin..@' --no-graph -T 'change_id.shortest(8) ++ "|" ++ description.first_line() ++ "\n"'`.text()).trim()
    const unpushedLines = unpushedOutput ? unpushedOutput.split('\n').filter(Boolean) : []
    
    const nonEmptyCommits = []
    for (const line of unpushedLines) {
      const [changeId] = line.split('|')
      const info = await getChangeInfo($, changeId)
      if (info.stats) {
        nonEmptyCommits.push({ changeId, info })
      }
    }

    if (nonEmptyCommits.length > 0) {
      const tipCommit = nonEmptyCommits[0]
      const stack = await getCommitStack($, bookmark, tipCommit.changeId)
      return {
        revision: tipCommit.changeId,
        info: tipCommit.info,
        stack,
        needsConfirmation: true
      }
    }
  } catch {}

  return null
}

async function isImmutable($: any, revset: string = '@'): Promise<boolean> {
  try {
    const result = (await $`jj log -r '${revset}' --no-graph -T 'if(immutable, "true", "false")'`.text()).trim()
    return result === 'true'
  } catch {
    return false
  }
}

const JJ_ERROR_PATTERNS: Array<{ pattern: RegExp; message: (match: RegExpMatchArray) => string }> = [
  {
    pattern: /Commit (\S+) is immutable/i,
    message: (m) => `Cannot modify commit ${m[1]} - it's immutable (already pushed).

Recovery options:
• Continue with new work: jj describe -m "next task"
• Start fresh from main: jj new main@origin -m "description"
• Undo recent operation: jj undo`
  },
  {
    pattern: /working copy is stale/i,
    message: () => `Working copy is stale.

Recovery: jj workspace update-stale`
  },
]

function parseJjError(stderr: string): string | null {
  for (const { pattern, message } of JJ_ERROR_PATTERNS) {
    const match = stderr.match(pattern)
    if (match) return message(match)
  }
  return null
}

const plugin: Plugin = async ({ $, client }) => ({
  name: 'jj-opencode',

  tool: {
    jj_push: tool({
      description: `Push current JJ change to a bookmark (default: main). 
Auto-detects push target: checks @ first, then @- if @ is empty (common after session idle).
Only specify 'bookmark' if user explicitly requested a specific branch.`,
      args: {
        bookmark: tool.schema.string().optional().describe(
          "Target bookmark/branch. ONLY set if user explicitly specified. Defaults to 'main'."
        ),
        confirmed: tool.schema.boolean().optional().describe(
          "Set to true after user confirms the push preview."
        ),
      },
      async execute(args) {
        if (!await isJJRepo($)) {
          return "Not a JJ repository."
        }

        const bookmark = args.bookmark || 'main'
        const target = await findPushTarget($, bookmark)

        if (!target) {
          return `Nothing to push. No unpushed changes between \`${bookmark}@origin\` and \`@\`.`
        }

        if (await isImmutable($, target.revision)) {
          return `Target commit is already immutable (pushed). Start new work: jj describe -m "description"`
        }

        const { revision, info, stack, needsConfirmation } = target
        const totalCommits = stack.length

        if (!args.confirmed) {
          let preview = `## Push Preview\n\n`
          preview += `**Target:** \`${revision}\` ${revision !== '@' ? '(@ is empty)' : ''}\n\n`
          preview += `**${totalCommits} commit(s) will be pushed to \`${bookmark}\`:**\n\n`
          preview += `\`\`\`\n`
          for (const commit of stack) {
            preview += `${commit}\n`
          }
          preview += `\`\`\`\n\n`
          preview += `**Files in tip commit:**\n\`\`\`\n${info.stats}\n\`\`\`\n\n`
          
          if (needsConfirmation) {
            preview += `⚠️  **Note:** Had to search beyond \`@-\` to find changes. Please verify this is correct.\n\n`
          }
          
          preview += `After pushing, these commits become **immutable**.\n\n`
          preview += `Call with \`confirmed: true\` to push.`
          
          return preview
        }

        try {
          if (revision === '@') {
            await $`jj new`.text()
            await $`jj bookmark set ${bookmark} -r @-`.text()
          } else {
            await $`jj bookmark set ${bookmark} -r ${revision}`.text()
          }
          
          await $`jj git push -b ${bookmark}`.text()

          const postPushDesc = (await $`jj log -r @ --no-graph -T description`.text()).trim()
          const isClean = !postPushDesc
          
          let result = `Pushed ${totalCommits} commit(s) to \`${bookmark}\`:\n\n`
          for (const commit of stack) {
            result += `• ${commit}\n`
          }
          result += `\nThese commits are now **immutable**.`
          
          if (isClean) {
            result += ` Working copy is clean and ready.`
          } else {
            result += `\n\n⚠️  Working copy has description set. Run \`jj new\` if starting fresh work.`
          }
          
          return result
        } catch (error: any) {
          const recoveryMessage = parseJjError(error.message)
          if (recoveryMessage) {
            return recoveryMessage
          }
          return `Push failed: ${error.message}`
        }
      },
    }),
  },

  "tool.execute.before": async ({ tool: toolName, sessionID }) => {
    if (!MODIFYING_TOOLS.has(toolName)) return
    if (!await isJJRepo($)) return
    
    const description = await getCurrentDescription($)
    if (description.length > 0) {
      const state = sessionState.get(sessionID) || { gateOpened: false }
      state.gateOpened = true
      sessionState.set(sessionID, state)
      return
    }

    const subagent = await isSubagent(client, sessionID)
    
    if (subagent) {
      throw new Error(
        `BLOCKED: JJ gate is closed.\n\n` +
        `You are a subagent. Return to the parent agent with this message:\n\n` +
        `"Cannot edit files - no JJ change description set. ` +
        `Parent must run: jj describe -m \\"description\\" before delegating file edits."`
      )
    }

    throw new Error(
      `Describe your intent before editing:\n\n` +
      `    jj describe -m "what you're about to do"\n\n` +
      `When done, run \`jj new\` to commit and start fresh.`
    )
  },

  event: async ({ event }) => {
    const props = event.properties as Record<string, unknown> | undefined

    if (event.type === "session.deleted") {
      const sessionID = props?.sessionID as string | undefined
      if (sessionID) sessionState.delete(sessionID)
      return
    }

    if (event.type === "session.idle") {
      const sessionID = props?.sessionID as string | undefined
      if (!sessionID) return

      if (await isSubagent(client, sessionID)) return

      const state = sessionState.get(sessionID)
      if (!state?.gateOpened) return

      if (!await isJJRepo($)) return

      const stats = (await $`jj diff --stat`.text()).trim()
      if (!stats || stats.includes("0 files changed")) return

      const description = await getCurrentDescription($)
      if (!description) return

      try {
        await $`jj new`.quiet()
        sessionState.set(sessionID, { gateOpened: false })
      } catch {
        // Silent fail - user will see uncommitted work next session
      }
    }
  },
})

export default plugin
