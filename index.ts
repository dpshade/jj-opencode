import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

/**
 * jj-opencode: Minimal gate enforcement for JJ workflows
 * 
 * Core concept: Block file edits until the agent declares intent via jj("description")
 * 
 * That's it. Everything else is JJ CLI.
 */

type Shell = any

const GATED_TOOLS = new Set([
  'write', 'edit', 
  'lsp_rename', 'lsp_code_action_resolve', 
  'ast_grep_replace'
])

// Minimal session state: just unlocked status and parent reference
const sessions = new Map<string, { unlocked: boolean; parent?: string }>()

async function getDescription($: Shell): Promise<string> {
  try {
    return (await $`jj log -r @ --no-graph -T description 2>/dev/null`.text()).trim()
  } catch { return '' }
}

async function hasChanges($: Shell): Promise<boolean> {
  try {
    return (await $`jj diff --stat 2>/dev/null`.text()).trim().length > 0
  } catch { return false }
}

async function isJJRepo($: Shell): Promise<boolean> {
  try {
    await $`jj root 2>/dev/null`.text()
    return true
  } catch { return false }
}

const plugin: Plugin = async ({ client, $ }) => ({
  name: 'jj-opencode',

  event: async ({ event }) => {
    if (event.type === 'session.created') {
      const id = event.properties.info.id

      // Check for parent session (subagent inheritance)
      const response = await client.session.list()
      const allSessions = response.data || []
      const parent = allSessions.find((s: any) => s.id !== id && sessions.get(s.id)?.unlocked)
      if (parent) {
        sessions.set(id, { unlocked: true, parent: parent.id })
        return
      }

      // Not a JJ repo? Always unlocked (plugin is a no-op)
      if (!await isJJRepo($)) {
        sessions.set(id, { unlocked: true })
        return
      }

      // Unlock if work already in progress
      const [desc, changes] = await Promise.all([getDescription($), hasChanges($)])
      sessions.set(id, { unlocked: desc.length > 0 || changes })
    }

    if (event.type === 'session.deleted') {
      sessions.delete(event.properties.info.id)
    }
  },

  "tool.execute.before": async ({ tool: name, sessionID }) => {
    if (!GATED_TOOLS.has(name)) return
    
    const state = sessions.get(sessionID)
    if (state?.unlocked) return

    // Double-check JJ state (in case of manual jj commands)
    const [desc, changes] = await Promise.all([getDescription($), hasChanges($)])
    if (desc.length > 0 || changes) {
      sessions.set(sessionID, { ...state, unlocked: true })
      return
    }

    throw new Error(
      `**Edit blocked**: Declare your intent first.\n\n` +
      `Call \`jj("description of what you're implementing")\` to unlock editing.\n\n` +
      `This ensures every change has a meaningful commit message from the start.`
    )
  },

  tool: {
    jj: tool({
      description: "Create a JJ change and unlock file editing. Call this BEFORE making any edits.",
      args: {
        description: tool.schema.string().describe("What you're about to implement (min 10 chars)"),
      },
      async execute({ description }, { sessionID }) {
        const desc = description.trim()
        if (desc.length < 10) {
          return `Description too short (${desc.length} chars). Be specific about what you're implementing.`
        }
        if (desc.split(/\s+/).length < 2) {
          return `Description must be more than one word. Example: "Add user authentication"`
        }

        // Fetch latest from remote
        try { await $`jj git fetch 2>/dev/null` } catch {}

        // Create new change from main@origin (or main)
        try {
          await $`jj new main@origin -m ${desc} 2>/dev/null`
        } catch {
          try {
            await $`jj new main -m ${desc} 2>/dev/null`
          } catch (e: any) {
            return `Error creating change: ${e.message}\n\nTry: \`jj new -m "${desc}"\` manually.`
          }
        }

        const changeId = await $`jj log -r @ --no-graph -T 'change_id.short()' 2>/dev/null`.text()
        sessions.set(sessionID, { unlocked: true })

        return `Change \`${changeId.trim()}\` created: "${desc}"\n\nYou may now edit files.`
      },
    }),

    jj_push: tool({
      description: "Push changes to remote. Shows preview first, requires user confirmation.",
      args: {
        confirm: tool.schema.boolean().optional().describe("Set true ONLY after user explicitly approves"),
      },
      async execute({ confirm }, { sessionID }) {
        const [desc, diffStat] = await Promise.all([
          getDescription($),
          $`jj diff --stat 2>/dev/null`.text().catch(() => ''),
        ])

        if (!desc && !diffStat.trim()) {
          return `Nothing to push. Create a change with \`jj("description")\` first.`
        }

        if (!confirm) {
          const files = await $`jj diff --name-only 2>/dev/null`.text().catch(() => '')
          return [
            `**Ready to push:**\n`,
            `**Description:** ${desc || '(none)'}`,
            `\n**Files:**\n\`\`\`\n${files.trim() || '(no changes)'}\n\`\`\``,
            `\n**Diff:**\n\`\`\`\n${diffStat.trim() || '(no diff)'}\n\`\`\``,
            `\n---\n**Confirm push?** Call \`jj_push(confirm: true)\` after user approval.`
          ].join('\n')
        }

        // Move bookmark and push
        try {
          await $`jj bookmark move main --to @ 2>/dev/null`
        } catch {
          try {
            await $`jj bookmark create main -r @ 2>/dev/null`
          } catch {}
        }

        try {
          await $`jj git push -b main 2>/dev/null`
        } catch (e: any) {
          return `Push failed: ${e.message}\n\nTry \`jj git push -b main\` manually.`
        }

        // Lock gate for next task
        sessions.set(sessionID, { unlocked: false })

        // Create fresh change for next task
        try { await $`jj new main@origin 2>/dev/null` } catch {}

        return `Pushed to main. Gate locked for next task.\n\nCall \`jj("description")\` to start new work.`
      },
    }),

    jj_status: tool({
      description: "Show current JJ status and gate state",
      args: {},
      async execute(_, { sessionID }) {
        const state = sessions.get(sessionID)
        const [desc, diffStat, status] = await Promise.all([
          getDescription($),
          $`jj diff --stat 2>/dev/null`.text().catch(() => ''),
          $`jj st 2>/dev/null`.text().catch(() => ''),
        ])

        return [
          `**Gate:** ${state?.unlocked ? 'UNLOCKED' : 'LOCKED'}`,
          `**Description:** ${desc || '(none)'}`,
          `\n**Status:**\n\`\`\`\n${status.trim() || '(clean)'}\n\`\`\``,
          `\n**Diff:**\n\`\`\`\n${diffStat.trim() || '(no changes)'}\n\`\`\``,
        ].join('\n')
      },
    }),
  },
})

export default plugin
