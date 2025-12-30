type Shell = any

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function isJJRepo($: Shell): Promise<boolean> {
  try {
    const result = await $.nothrow()`jj root`
    return result.exitCode === 0
  } catch {
    return false
  }
}

export async function getCurrentChangeId($: Shell): Promise<string | null> {
  try {
    const result = await $`jj log -r @ --no-graph -T 'change_id.short()'`.text()
    return result.trim() || null
  } catch {
    return null
  }
}

export async function getCurrentDescription($: Shell): Promise<string> {
  try {
    const result = await $`jj log -r @ --no-graph -T 'description'`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function getDiffSummary($: Shell): Promise<string> {
  try {
    const result = await $`jj diff --stat`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function getDiffFiles($: Shell): Promise<string[]> {
  try {
    const result = await $`jj diff --name-only`.text()
    return result.trim().split('\n').filter((f: string) => f.length > 0)
  } catch {
    return []
  }
}

export async function getStatus($: Shell): Promise<string> {
  try {
    const result = await $`jj st`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function gitFetch($: Shell): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj git fetch`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function newChange($: Shell, description: string): Promise<{ success: boolean; changeId?: string; error?: string }> {
  // Try main@origin first (remote tracking branch)
  try {
    await $`jj new main@origin -m ${description}`
    const changeId = await getCurrentChangeId($)
    return { success: true, changeId: changeId || undefined }
  } catch {
    // Fallback to local main if remote doesn't exist
    try {
      await $`jj new main -m ${description}`
      const changeId = await getCurrentChangeId($)
      return { success: true, changeId: changeId || undefined }
    } catch (e: any) {
      // Don't silently use current change - error out with helpful message
      return { 
        success: false, 
        error: `Could not branch from main@origin or main. Error: ${e.message || String(e)}. Make sure you have a 'main' branch.`
      }
    }
  }
}

export async function describe($: Shell, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj describe -m ${message}`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function abandon($: Shell): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj abandon @`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function bookmarkMove($: Shell, bookmark: string = 'main'): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj bookmark move ${bookmark} --to @`
    return { success: true }
  } catch (e: any) {
    try {
      await $`jj bookmark create ${bookmark} -r @`
      return { success: true }
    } catch {
      return { success: false, error: e.message || String(e) }
    }
  }
}

export async function gitPush($: Shell, bookmark: string = 'main'): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj git push -b ${bookmark}`
    return { success: true }
  } catch (e: any) {
    try {
      const commitId = await $`jj log -r @ --no-graph -T 'commit_id'`.text()
      await $`git push origin ${commitId.trim()}:${bookmark}`
      return { success: true }
    } catch (e2: any) {
      return { success: false, error: e2.message || String(e2) }
    }
  }
}

export async function gitInit($: Shell): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj git init`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function undo($: Shell): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj undo`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function newChangeFromCurrent($: Shell, description: string): Promise<{ success: boolean; changeId?: string; parentId?: string; error?: string }> {
  try {
    const parentId = await getCurrentChangeId($)
    await $`jj new -m ${description}`
    const changeId = await getCurrentChangeId($)
    return { success: true, changeId: changeId || undefined, parentId: parentId || undefined }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function newChangeFrom($: Shell, from: string, description: string): Promise<{ success: boolean; changeId?: string; error?: string }> {
  try {
    await $`jj new ${from} -m ${description}`
    const changeId = await getCurrentChangeId($)
    return { success: true, changeId: changeId || undefined }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function bookmarkSet($: Shell, name: string): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj bookmark set ${name} -r @`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function getWorkspaceName($: Shell): Promise<string> {
  try {
    const result = await $`jj workspace list`.text()
    const lines = result.trim().split('\n')
    for (const line of lines) {
      if (line.includes('@')) {
        const match = line.match(/^(\S+):/)
        if (match) {
          return match[1]
        }
      }
    }
    return 'default'
  } catch {
    return 'default'
  }
}

export async function getWorkspaceRoot($: Shell): Promise<string> {
  try {
    const result = await $`jj workspace root`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function workspaceAdd($: Shell, path: string, name: string, revision: string): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj workspace add ${path} --name ${name} -r ${revision}`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function workspaceList($: Shell): Promise<string> {
  try {
    const result = await $`jj workspace list`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function workspaceForget($: Shell, name: string): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj workspace forget ${name}`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function getBookmarkForChange($: Shell, rev: string = '@'): Promise<string | null> {
  try {
    const result = await $`jj log -r ${rev} --no-graph -T 'bookmarks'`.text()
    const bookmarks = result.trim()
    if (bookmarks && bookmarks.length > 0) {
      return bookmarks.split(' ')[0]
    }
    return null
  } catch {
    return null
  }
}

export async function rebase($: Shell, onto: string): Promise<{ success: boolean; error?: string }> {
  try {
    await $`jj rebase -d ${onto}`
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function squash($: Shell, message?: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (message) {
      await $`jj squash -m ${message}`
    } else {
      await $`jj squash`
    }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function getParentDescription($: Shell): Promise<string> {
  try {
    const result = await $`jj log -r @- --no-graph -T 'description'`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function getRepoRoot($: Shell): Promise<string> {
  try {
    const result = await $`jj root`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function ensureWorkspacesIgnored($: Shell, repoRoot: string): Promise<{ added: boolean; error?: string }> {
  const gitignorePath = `${repoRoot}/.gitignore`
  try {
    let content = ''
    try {
      content = await $`cat ${gitignorePath}`.text()
    } catch {
      // File doesn't exist, that's fine
    }
    
    if (content.includes('.workspaces')) {
      return { added: false }
    }
    
    const addition = content.endsWith('\n') || content === '' 
      ? '.workspaces/\n' 
      : '\n.workspaces/\n'
    await $`echo ${addition} >> ${gitignorePath}`
    return { added: true }
  } catch (e: any) {
    return { added: false, error: e.message || String(e) }
  }
}

export interface EmptyCommit {
  changeId: string
  description: string
  bookmarks: string[]
}

/**
 * JJ template: 'change_id.short() ++ "|" ++ description.first_line() ++ "|" ++ bookmarks'
 * Revset: 'empty() & ~immutable() & ~@' excludes merged commits and current working copy
 */
export async function getEmptyCommits($: Shell): Promise<EmptyCommit[]> {
  try {
    const result = await $`jj log -r 'empty() & ~immutable() & ~@' --no-graph -T 'change_id.short() ++ "|" ++ description.first_line() ++ "|" ++ bookmarks ++ "\n"'`.text()
    const lines = result.trim().split('\n').filter((l: string) => l.length > 0)
    
    return lines.map((line: string) => {
      const [changeId, description, bookmarksStr] = line.split('|')
      const bookmarks = bookmarksStr ? bookmarksStr.split(' ').filter((b: string) => b.length > 0) : []
      return { changeId, description: description || '(no description)', bookmarks }
    })
  } catch {
    return []
  }
}

export interface StaleWorkspace {
  name: string
  changeId: string
  reason: string
}

/**
 * Finds workspaces that are stale: already merged to main or empty.
 * JJ workspace list format: "workspace-name: changeId description"
 */
export async function getStaleWorkspaces($: Shell): Promise<StaleWorkspace[]> {
  try {
    const listResult = await $`jj workspace list`.text()
    const lines = listResult.trim().split('\n')
    const stale: StaleWorkspace[] = []
    
    for (const line of lines) {
      const match = line.match(/^(\S+):\s+(\S+)\s*(.*)$/)
      if (!match) continue
      
      const [, name, changeId, rest] = match
      
      if (name === 'default') continue
      if (rest.includes('@')) continue
      
      const isEmpty = rest.includes('(empty)')
      
      try {
        const ancestorCheck = await $.nothrow()`jj log -r '${changeId} & ::main' --no-graph -T 'change_id'`
        const isMerged = ancestorCheck.exitCode === 0 && ancestorCheck.stdout.toString().trim().length > 0
        
        if (isMerged) {
          stale.push({ name, changeId, reason: 'already merged to main' })
        } else if (isEmpty) {
          stale.push({ name, changeId, reason: 'empty workspace' })
        }
      } catch {
        if (isEmpty) {
          stale.push({ name, changeId, reason: 'empty workspace' })
        }
      }
    }
    
    return stale
  } catch {
    return []
  }
}

/**
 * JJ abandon output includes "Deleted bookmarks: foo, bar" when bookmarks are removed
 */
export async function abandonCommits($: Shell, changeIds: string[]): Promise<{ success: boolean; abandoned: number; deletedBookmarks: string[]; error?: string }> {
  if (changeIds.length === 0) {
    return { success: true, abandoned: 0, deletedBookmarks: [] }
  }
  
  try {
    const result = await $`jj abandon ${changeIds}`.text()
    const bookmarkMatch = result.match(/Deleted bookmarks?:\s*(.+)/i)
    const deletedBookmarks = bookmarkMatch 
      ? bookmarkMatch[1].split(',').map((b: string) => b.trim()).filter((b: string) => b.length > 0)
      : []
    return { success: true, abandoned: changeIds.length, deletedBookmarks }
  } catch (e: any) {
    return { success: false, abandoned: 0, deletedBookmarks: [], error: e.message || String(e) }
  }
}
