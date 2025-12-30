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

// JJ commands that have plugin equivalents - warn but don't block
const JJ_PLUGIN_EQUIVALENT: Record<string, string> = {
  new: 'jj("description") - handles workspace creation and gate state',
  describe: 'jj_describe("message") - keeps plugin state in sync',
};

const JJ_COMMAND_PATTERN = /\bjj\s+(new|describe)\b/i;

export interface JJCommandCheck {
  hasPluginEquivalent: boolean;
  jjSubcommand?: string;
  pluginAlternative?: string;
}

export function checkForJJCommand(command: string): JJCommandCheck {
  const match = command.match(JJ_COMMAND_PATTERN);
  if (!match) {
    return { hasPluginEquivalent: false };
  }

  const subcommand = match[1].toLowerCase();
  const alternative = JJ_PLUGIN_EQUIVALENT[subcommand];

  return {
    hasPluginEquivalent: true,
    jjSubcommand: subcommand,
    pluginAlternative: alternative,
  };
}

// Bash commands that modify files - warn (not block) when gate is locked
const BASH_MODIFY_PATTERNS: RegExp[] = [
  /\bsed\s+-i/,
  /\bperl\s+-[ip]/,
  /(?:^|[;&|)\s])>(?!>)/,
  />>/,
  /\btee\b/,
  /\brm\s/,
  /\bmv\s/,
  /\bcp\s/,
  /\bmkdir\b/,
  /\btouch\b/,
  /\bchmod\b/,
  /\bchown\b/,
  /\bln\s/,
  /\bunlink\b/,
  /\btruncate\b/,
];

export function isModifyingBashCommand(command: string): boolean {
  return BASH_MODIFY_PATTERNS.some(pattern => pattern.test(command));
}

// Detect pushing to main via jj commands - reminds to sync repo root afterwards
const JJ_PUSH_MAIN_PATTERNS: RegExp[] = [
  /jj\s+bookmark\s+move\s+main\s+--to\s+@/i,
  /jj\s+git\s+push\s+(-b|--bookmark)\s+main\b/i,
];

export interface JJPushMainCheck {
  isPushingToMain: boolean;
}

export function checkForJJPushMain(command: string): JJPushMainCheck {
  const isPushing = JJ_PUSH_MAIN_PATTERNS.some(pattern => pattern.test(command));
  return { isPushingToMain: isPushing };
}
