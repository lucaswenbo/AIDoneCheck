export const VERSION = '1.0.4';
export const PLAYWRIGHT_VERSION = '1.63.0';
export type Status = 'pass' | 'warn' | 'fail' | 'skipped';
export type Verdict = 'PASS' | 'WARN' | 'BLOCK';
export type ScriptName = 'test' | 'lint' | 'typecheck' | 'build';
export interface Config {
  version: 1;
  checks: Record<ScriptName, boolean>;
  browser: { enabled: boolean; url: string; expect: string; failConsole: boolean; profile: 'desktop' | 'mobile'; trace: 'off' | 'on-failure' | 'always' };
  requirements: { changedFiles: string[]; requiredFiles: string[] };
}
export interface CommandResult {
  exitCode: number | null; signal: string | null; durationMs: number; stdout: string; stderr: string;
  timedOut: boolean; stdoutTruncated: boolean; stderrTruncated: boolean;
}
export interface Check {
  id: string; status: Status; blocking: boolean; meaningful: boolean; details: string;
  command?: string; result?: CommandResult; data?: Record<string, unknown>;
}
export interface GitInfo {
  reliable: boolean; mode: 'local' | 'explicit' | 'pull_request' | 'push';
  base: string | null; head: string; baseRef: string | null; warning: string | null;
  committed: string[]; staged: string[]; unstaged: string[]; untracked: string[]; changedFiles: string[];
}
export interface Report {
  tool: 'AIDoneCheck'; version: string; schemaVersion: 1; verdict: Verdict; createdAt: string;
  repository: { branch: string; head: string };
  git: GitInfo; checks: Check[]; warnings: string[]; failures: string[];
  evidence: { directory: string; files: string[] };
}
export class StartupError extends Error { override name = 'StartupError'; }
export const label = (c: Check): string => c.status === 'fail' ? (c.blocking ? 'BLOCK' : 'WARN') : c.status === 'skipped' ? 'SKIP' : c.status.toUpperCase();
