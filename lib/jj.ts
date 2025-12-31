type Shell = any

function shell($: Shell, cwd?: string): Shell {
  return cwd ? $.cwd(cwd) : $
}

export async function isJJRepo($: Shell, cwd?: string): Promise<boolean> {
  try {
    await shell($, cwd)`jj root 2>/dev/null`.text()
    return true
  } catch {
    return false
  }
}

export async function getCurrentChangeId($: Shell, cwd?: string): Promise<string | null> {
  try {
    const result = await shell($, cwd)`jj log -r @ --no-graph -T 'change_id.short()' 2>/dev/null`.text()
    return result.trim() || null
  } catch {
    return null
  }
}

export async function getCurrentDescription($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj log -r @ --no-graph -T 'description' 2>/dev/null`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function getDiffSummary($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj diff --stat 2>/dev/null`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function hasUncommittedChanges($: Shell, cwd?: string): Promise<boolean> {
  try {
    const result = await shell($, cwd)`jj diff --stat 2>/dev/null`.text()
    return result.trim().length > 0
  } catch {
    return false
  }
}

export async function getDiffFiles($: Shell, cwd?: string): Promise<string[]> {
  try {
    const result = await shell($, cwd)`jj diff --name-only 2>/dev/null`.text()
    return result.trim().split('\n').filter((f: string) => f.length > 0)
  } catch {
    return []
  }
}

export async function getStatus($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj st 2>/dev/null`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function gitFetch($: Shell, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj git fetch 2>/dev/null`.text()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function newFromMain($: Shell, cwd?: string): Promise<{ success: boolean; error?: string }> {
  const s = shell($, cwd)
  try {
    await s`jj new main@origin 2>/dev/null`.text()
    return { success: true }
  } catch {
    try {
      await s`jj new main 2>/dev/null`.text()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message || String(e) }
    }
  }
}

export async function newChange($: Shell, description: string, cwd?: string): Promise<{ success: boolean; changeId?: string; error?: string }> {
  const s = shell($, cwd)
  try {
    await s`jj new main@origin -m ${description} 2>/dev/null`.text()
    const changeId = await getCurrentChangeId($, cwd)
    return { success: true, changeId: changeId || undefined }
  } catch {
    try {
      await s`jj new main -m ${description} 2>/dev/null`.text()
      const changeId = await getCurrentChangeId($, cwd)
      return { success: true, changeId: changeId || undefined }
    } catch (e: any) {
      return { 
        success: false, 
        error: `Could not branch from main@origin or main. Error: ${e.message || String(e)}. Make sure you have a 'main' branch.`
      }
    }
  }
}

export async function describe($: Shell, message: string, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj describe -m ${message} 2>/dev/null`.text()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function abandon($: Shell, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj abandon @ 2>/dev/null`.text()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function bookmarkMove($: Shell, bookmark: string = 'main', cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj bookmark move ${bookmark} --to @ 2>/dev/null`.text()
    return { success: true }
  } catch (e: any) {
    try {
      await shell($, cwd)`jj bookmark create ${bookmark} -r @ 2>/dev/null`.text()
      return { success: true }
    } catch {
      return { success: false, error: e.message || String(e) }
    }
  }
}

export async function gitPush($: Shell, bookmark: string = 'main', cwd?: string): Promise<{ success: boolean; error?: string }> {
  const s = shell($, cwd)
  try {
    await s`jj git push -b ${bookmark} 2>/dev/null`.text()
    return { success: true }
  } catch (e: any) {
    try {
      const commitId = await s`jj log -r @ --no-graph -T 'commit_id' 2>/dev/null`.text()
      await s`git push origin ${commitId.trim()}:${bookmark} 2>/dev/null`.text()
      return { success: true }
    } catch (e2: any) {
      return { success: false, error: e2.message || String(e2) }
    }
  }
}

export async function gitInit($: Shell, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj git init 2>/dev/null`.text()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function undo($: Shell, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj undo 2>/dev/null`.text()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function newChangeFrom($: Shell, from: string, description: string, cwd?: string): Promise<{ success: boolean; changeId?: string; error?: string }> {
  try {
    await shell($, cwd)`jj new ${from} -m ${description} 2>/dev/null`.text()
    const changeId = await getCurrentChangeId($, cwd)
    return { success: true, changeId: changeId || undefined }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function bookmarkSet($: Shell, name: string, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj bookmark set ${name} -r @ 2>/dev/null`.text()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function getWorkspaceName($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj workspace list 2>/dev/null`.text()
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

export async function getWorkspaceRoot($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj workspace root 2>/dev/null`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function workspaceAdd($: Shell, path: string, name: string, revision: string, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj workspace add ${path} --name ${name} -r ${revision} 2>/dev/null`.text()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function workspaceList($: Shell, cwd?: string): Promise<string> {
  try {
    const result = await shell($, cwd)`jj workspace list 2>/dev/null`.text()
    return result.trim()
  } catch {
    return ''
  }
}

export async function workspaceForget($: Shell, name: string, cwd?: string): Promise<{ success: boolean; error?: string }> {
  try {
    await shell($, cwd)`jj workspace forget ${name} 2>/dev/null`.text()
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || String(e) }
  }
}

export async function getBookmarkForChange($: Shell, rev: string = '@', cwd?: string): Promise<string | null> {
  try {
    const result = await shell($, cwd)`jj log -r ${rev} --no-graph -T 'bookmarks' 2>/dev/null`.text()
    const bookmarks = result.trim()
    if (bookmarks && bookmarks.length > 0) {
      return bookmarks.split(' ')[0]
    }
    return null
  } catch {
    return null
  }
}

export async function ensureWorkspacesIgnored($: Shell, repoRoot: string, cwd?: string): Promise<{ added: boolean; error?: string }> {
  const gitignorePath = `${repoRoot}/.gitignore`
  const s = shell($, cwd)
  try {
    let content = ''
    try {
      content = await s`cat ${gitignorePath} 2>/dev/null`.text()
    } catch {
      // File doesn't exist, that's fine
    }
    
    if (content.includes('.workspaces')) {
      return { added: false }
    }
    
    const addition = content.endsWith('\n') || content === '' 
      ? '.workspaces/' 
      : '\n.workspaces/'
    // Use tee -a for safe append
    await s`echo ${addition} | tee -a ${gitignorePath} 2>/dev/null`.text()
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
export async function getEmptyCommits($: Shell, cwd?: string): Promise<EmptyCommit[]> {
  try {
    const result = await shell($, cwd)`jj log -r 'empty() & ~immutable() & ~@' --no-graph -T 'change_id.short() ++ "|" ++ description.first_line() ++ "|" ++ bookmarks ++ "\n"' 2>/dev/null`.text()
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

export interface WorkspaceAnalysis {
  stale: StaleWorkspace[]
  active: StaleWorkspace[]
}

export async function analyzeWorkspaces($: Shell, cwd?: string): Promise<WorkspaceAnalysis> {
  const result: WorkspaceAnalysis = { stale: [], active: [] }
  try {
    const s = shell($, cwd)
    const listResult = await s`jj workspace list 2>/dev/null`.text()
    const lines = listResult.trim().split('\n')
    
    for (const line of lines) {
      const match = line.match(/^(\S+):\s+(\S+)\s*(.*)$/)
      if (!match) continue
      
      const [, name, changeId, rest] = match
      
      if (name === 'default') continue
      if (rest.includes('@')) continue
      
      const isEmpty = rest.includes('(empty)')
      const hasNoDescription = rest.includes('(no description set)')
      
      try {
        const output = await s`jj log -r '${changeId} & ::main' --no-graph -T 'change_id' 2>/dev/null`.text()
        const isMerged = output.trim().length > 0
        
        if (isMerged) {
          result.stale.push({ name, changeId, reason: 'already merged to main' })
        } else if (isEmpty && hasNoDescription) {
          result.stale.push({ name, changeId, reason: 'empty workspace' })
        } else if (isEmpty) {
          result.active.push({ name, changeId, reason: 'has description but no changes' })
        }
      } catch {
        if (isEmpty && hasNoDescription) {
          result.stale.push({ name, changeId, reason: 'empty workspace' })
        }
      }
    }
    
    return result
  } catch {
    return result
  }
}

export async function getStaleWorkspaces($: Shell, cwd?: string): Promise<StaleWorkspace[]> {
  const analysis = await analyzeWorkspaces($, cwd)
  return analysis.stale
}

/**
 * JJ abandon output includes "Deleted bookmarks: foo, bar" when bookmarks are removed
 */
export async function abandonCommits($: Shell, changeIds: string[], cwd?: string): Promise<{ success: boolean; abandoned: number; deletedBookmarks: string[]; error?: string }> {
  if (changeIds.length === 0) {
    return { success: true, abandoned: 0, deletedBookmarks: [] }
  }
  
  try {
    const result = await shell($, cwd)`jj abandon ${changeIds} 2>/dev/null`.text()
    const bookmarkMatch = result.match(/Deleted bookmarks?:\s*(.+)/i)
    const deletedBookmarks = bookmarkMatch 
      ? bookmarkMatch[1].split(',').map((b: string) => b.trim()).filter((b: string) => b.length > 0)
      : []
    return { success: true, abandoned: changeIds.length, deletedBookmarks }
  } catch (e: any) {
    return { success: false, abandoned: 0, deletedBookmarks: [], error: e.message || String(e) }
  }
}

export interface WorkspaceLocation {
  isInsideWorkspace: boolean
  repoRoot: string
  currentWorkspaceSlug: string | null
}

/**
 * Detect if a path is inside a .workspaces/ directory and extract the repo root.
 * Used to prevent nested workspace creation - if we're already in a workspace,
 * new workspaces should be created as siblings at the repo root.
 */
export function detectWorkspaceLocation(currentPath: string): WorkspaceLocation {
  const match = currentPath.match(/^(.+?)\/\.workspaces\/([^/]+)/)
  if (match) {
    return {
      isInsideWorkspace: true,
      repoRoot: match[1],
      currentWorkspaceSlug: match[2],
    }
  }
  return {
    isInsideWorkspace: false,
    repoRoot: currentPath,
    currentWorkspaceSlug: null,
  }
}
