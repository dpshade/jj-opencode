const BASH_MODIFY_PATTERNS: RegExp[] = [
  /\bsed\s+-i/,
  /\bperl\s+-[ip]/,
  /(?:^|[;&|)\s])>(?!>)/, // Redirect with command boundary (fixes false positives)
  />>/,
  /\btee\b/,
  /\bmv\s/,
  /\bcp\s/,
  /\bmkdir\b/,
  /\btouch\b/,
  /\bchmod\b/,
  /\bchown\b/,
  /\bln\s/,
  /\bunlink\b/,
  /\btruncate\b/,
  /\bdd\b/,
  /\binstall\b/,
  /\bjj\s+(new|describe)\b/,
  /\bnpm\s+(install|uninstall|update|init|link|publish)\b/,
  /\byarn\s+(add|remove|install|link)\b/,
  /\bpnpm\s+(add|remove|install|link)\b/,
  /\bbun\s+(add|remove|install|link|create)\b/,
  /\bpip\s+(install|uninstall)\b/,
  /\bcargo\s+(add|remove|install|build)\b/,
  /\bmake\b/,
  /\bninja\b/,
  /\bcmake\b/,
  /\bgcc\b/,
  /\bclang\b/,
  /\brustc\b/,
  /\btsc\b/,
  /\btar\s+[^t]/,
  /\bunzip\b/,
  /\bgunzip\b/,
];

const BASH_READONLY_PATTERNS: RegExp[] = [
  /\bjj\s+(log|st|status|diff|show|op\s+log|file\s+show|git\s+fetch|evolog|bookmark\s+list)\b/,
  /\bcat\b(?!.*[>])/,
  /\bhead\b/,
  /\btail\b/,
  /\bless\b/,
  /\bmore\b/,
  /\bbat\b/,
  /\bgrep\b/,
  /\brg\b/,
  /\bag\b/,
  /\bfind\b(?!.*-exec)/,
  /\bfd\b/,
  /\blocate\b/,
  /\bwhich\b/,
  /\bwhereis\b/,
  /\btype\b/,
  /\bls\b/,
  /\bexa\b/,
  /\blsd\b/,
  /\btree\b/,
  /\bpwd\b/,
  /\bwc\b/,
  /\bdu\b/,
  /\bdf\b/,
  /\bstat\b/,
  /\bfile\b/,
  /\benv\b/,
  /\bprintenv\b/,
  /\becho\s+\$/,
  /\buname\b/,
  /\bhostname\b/,
  /\bdate\b/,
  /\buptime\b/,
  /\bwho\b/,
  /\bps\b/,
  /\btop\b/,
  /\bhtop\b/,
  /\bnpm\s+(list|ls|info|view|outdated|search)\b/,
  /\byarn\s+(list|info|why)\b/,
  /\bpip\s+(list|show|freeze)\b/,
  /\bcargo\s+(tree|search|info)\b/,
];

export interface BashAnalysis {
  isModifying: boolean;
  isReadOnly: boolean;
  matchedPattern?: string;
}

export function analyzeBashCommand(command: string): BashAnalysis {
  // Check MODIFY patterns FIRST (security-critical: prevents bypass via piped commands)
  for (const pattern of BASH_MODIFY_PATTERNS) {
    if (pattern.test(command)) {
      return {
        isModifying: true,
        isReadOnly: false,
        matchedPattern: pattern.source,
      };
    }
  }

  for (const pattern of BASH_READONLY_PATTERNS) {
    if (pattern.test(command)) {
      return {
        isModifying: false,
        isReadOnly: true,
        matchedPattern: pattern.source,
      };
    }
  }

  return { isModifying: false, isReadOnly: false };
}

export function isBashReadOnly(command: string): boolean {
  return !analyzeBashCommand(command).isModifying;
}

const GIT_TO_JJ: Record<string, string> = {
  status: "jj st",
  log: "jj log",
  diff: "jj diff",
  show: "jj show",
  add: "(not needed - JJ auto-tracks all files)",
  commit: 'jj describe -m "message" (working copy is already a commit)',
  push: "jj_push() or jj git push -b <bookmark>",
  checkout: "jj edit <change> or jj new <parent>",
  switch: "jj edit <change>",
  branch: "jj bookmark list / jj bookmark create",
  reset: "jj restore or jj abandon",
  "reset --hard": "jj abandon",
  stash: "(not needed - use jj new for parallel changes)",
  "cherry-pick": "jj rebase -r <change> -d <dest>",
  revert: "jj backout -r <change>",
  merge: "jj new <change1> <change2>",
  rebase: "jj rebase -r <source> -d <dest>",
  pull: "jj git fetch && jj rebase -d main@origin",
  fetch: "jj git fetch",
  clone: "jj git clone <url>",
  init: "jj_git_init() or jj git init",
  remote: "jj git remote",
  tag: "jj bookmark (JJ uses bookmarks)",
  clean: "jj restore --from @-",
  blame: "jj file annotate <file>",
  annotate: "jj file annotate <file>",
  bisect: "(use jj log to find changes)",
  am: "jj git import",
  "format-patch": "jj git export",
};

const GIT_COMMAND_PATTERN = /\bgit\s+([a-z-]+)/i;
const JJ_GIT_PATTERN = /\bjj\s+git\b/i;

export interface GitCommandCheck {
  isGitCommand: boolean;
  gitSubcommand?: string;
  jjAlternative?: string;
}

export function checkForGitCommand(command: string): GitCommandCheck {
  if (JJ_GIT_PATTERN.test(command)) {
    return { isGitCommand: false };
  }

  const match = command.match(GIT_COMMAND_PATTERN);
  if (!match) {
    return { isGitCommand: false };
  }

  const subcommand = match[1].toLowerCase();
  const alternative =
    GIT_TO_JJ[subcommand] || `jj ${subcommand} (check jj --help)`;

  return {
    isGitCommand: true,
    gitSubcommand: subcommand,
    jjAlternative: alternative,
  };
}
