import path from 'node:path';
import fs from 'node:fs/promises';
import { StartupError } from './types.js';
export function relativePath(input: unknown): string {
  if (typeof input !== 'string' || !input || input.includes('\0') || /[\r\n]/.test(input)) throw new StartupError('Requirement path must be a non-empty relative file path');
  if (path.posix.isAbsolute(input) || path.win32.isAbsolute(input) || /^[a-z]:/i.test(input) || input.includes('\\')) throw new StartupError('Requirement paths must be repository-relative POSIX paths');
  if (input.split('/').includes('..') || /[*?\[\]{}]/.test(input)) throw new StartupError('Path traversal and glob patterns are not supported');
  const normalized = path.posix.normalize(input).replace(/\/$/, '');
  if (!normalized || normalized === '.' || normalized.startsWith('../')) throw new StartupError('Requirement must name an exact file');
  return normalized;
}
export function within(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}
export async function safePath(root: string, input: string): Promise<string> {
  const normalized = relativePath(input);
  const realRoot = await fs.realpath(root);
  let cursor = realRoot;
  // Inspect each ancestor, including dangling links, instead of only realpath(final).
  for (const part of normalized.split('/')) {
    cursor = path.join(cursor, part);
    let stat;
    try { stat = await fs.lstat(cursor); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue; throw e; }
    if (stat.isSymbolicLink()) {
      const target = path.resolve(path.dirname(cursor), await fs.readlink(cursor));
      if (!within(realRoot, target)) throw new StartupError(`Symlink escapes repository: ${normalized}`);
      try { cursor = await fs.realpath(cursor); } catch { throw new StartupError(`Cannot safely resolve symlink: ${normalized}`); }
      if (!within(realRoot, cursor)) throw new StartupError(`Symlink escapes repository: ${normalized}`);
    }
  }
  return path.join(realRoot, normalized);
}
export function redact(text: string): string {
  return text
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/(?:https?|ssh):\/\/[^\s<>"'`]+/gi, (raw) => {
      try { const u = new URL(raw); u.username = ''; u.password = ''; if (u.search) u.search = '?redacted'; u.hash = ''; return u.toString(); } catch { return '[redacted URL]'; }
    })
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|AKIA[A-Z0-9]{16})\b/g, '[REDACTED]')
    .replace(/\b(Bearer\s+)[\w.+\-/=]+/gi, '$1[REDACTED]')
    .replace(/\b((?:password|passwd|secret|api[_-]?key|access[_-]?token|token|cookie|authorization)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}
export function sanitize<T>(value: T): T {
  if (typeof value === 'string') return redact(value) as T;
  if (Array.isArray(value)) return value.map(sanitize) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,sanitize(v)])) as T;
  return value;
}
