import type { Plugin } from "@opencode-ai/plugin"

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

const plugin: Plugin = async ({ $ }) => ({
  name: 'jj-opencode',

  "tool.execute.before": async ({ tool }) => {
    if (!MODIFYING_TOOLS.has(tool)) return
    if (!await isJJRepo($)) return
    
    const description = await getCurrentDescription($)
    if (description.length > 0) return

    throw new Error(
      `Create a checkpoint before editing:\n\n` +
      `    jj new -m "what you're about to do"\n\n` +
      `This ensures every change is tracked and can be undone with \`jj undo\`.`
    )
  },
})

export default plugin
