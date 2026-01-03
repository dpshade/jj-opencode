import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

const MODIFYING_TOOLS = new Set([
  'write', 'edit',
  'lsp_rename', 'lsp_code_action_resolve',
  'ast_grep_replace'
])

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

async function getChangeInfo($: any): Promise<{ id: string; description: string; stats: string }> {
  try {
    const id = (await $`jj log -r @ --no-graph -T 'change_id.shortest(8)'`.text()).trim()
    const description = (await $`jj log -r @ --no-graph -T description`.text()).trim()
    const stats = (await $`jj diff --stat`.text()).trim()
    return { id, description, stats }
  } catch {
    return { id: '', description: '', stats: '' }
  }
}

const plugin: Plugin = async ({ $, client }) => ({
  name: 'jj-opencode',

  tool: {
    jj_push: tool({
      description: `Push current JJ change to a bookmark (default: main). 
IMPORTANT: Only specify 'bookmark' if the user explicitly requested a specific branch/bookmark. 
If no bookmark specified, pushes to 'main'.
BEFORE calling: Show preview with 'jj log -r @' and 'jj diff --stat', ask user to confirm.`,
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
        const info = await getChangeInfo($)

        if (!info.description) {
          return "Cannot push: no description. Run: jj describe -m \"description\""
        }
        if (!info.stats) {
          return "Cannot push: no file changes."
        }

        if (!args.confirmed) {
          return "Show preview first with 'jj log -r @' and 'jj diff --stat', then call with confirmed: true"
        }

        try {
          await $`jj new`.text()
          await $`jj bookmark set ${bookmark} -r @-`.text()
          await $`jj git push -b ${bookmark}`.text()
          return `Pushed ${info.id} to ${bookmark}`
        } catch (error: any) {
          return `Push failed: ${error.message}`
        }
      },
    }),
  },

  "tool.execute.before": async ({ tool: toolName, sessionID }) => {
    if (!MODIFYING_TOOLS.has(toolName)) return
    if (!await isJJRepo($)) return
    
    const description = await getCurrentDescription($)
    if (description.length > 0) return

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
})

export default plugin
