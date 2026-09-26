import fs from 'node:fs/promises';
import path from 'node:path';
import { Config, StartupError } from './types.js';
import { relativePath, safePath } from './safety.js';
export const defaults: Config = {
  version: 1, checks: { test: true, lint: true, typecheck: true, build: true },
  browser: { enabled: false, url: '', expect: '', failConsole: false, profile: 'desktop', trace: 'on-failure' },
  requirements: { changedFiles: [], requiredFiles: [] }
};
function object(value: unknown, where: string, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StartupError(`${where} must be an object`);
  const result = value as Record<string, unknown>;
  for (const key of Object.keys(result)) if (!keys.includes(key)) throw new StartupError(`Unknown config field: ${where}.${key}`);
  return result;
}
export function parseConfig(value: unknown): Config {
  const source = object(value, 'config', ['version','checks','browser','requirements']);
  if (source.version !== 1) throw new StartupError('config.version is required and must equal 1');
  const out = structuredClone(defaults);
  if (source.checks !== undefined) {
    const checks = object(source.checks, 'checks', Object.keys(out.checks));
    for (const [key, val] of Object.entries(checks)) {
      if (typeof val !== 'boolean') throw new StartupError(`checks.${key} must be boolean`);
      out.checks[key as keyof Config['checks']] = val;
    }
  }
  if (source.browser !== undefined) {
    const b = object(source.browser, 'browser', Object.keys(out.browser));
    for (const key of ['enabled','failConsole'] as const) if (b[key] !== undefined) {
      if (typeof b[key] !== 'boolean') throw new StartupError(`browser.${key} must be boolean`);
      out.browser[key] = b[key];
    }
    for (const key of ['url','expect'] as const) if (b[key] !== undefined) {
      if (typeof b[key] !== 'string') throw new StartupError(`browser.${key} must be string`);
      out.browser[key] = b[key];
    }
    if (b.profile !== undefined) {
      if (b.profile !== 'desktop' && b.profile !== 'mobile') throw new StartupError('Invalid browser.profile');
      out.browser.profile = b.profile;
    }
    if (b.trace !== undefined) {
      if (b.trace !== 'off' && b.trace !== 'on-failure' && b.trace !== 'always') throw new StartupError('Invalid browser.trace');
      out.browser.trace = b.trace;
    }
  }
  if (out.browser.url || out.browser.enabled) {
    try {
      const u = new URL(out.browser.url);
      if (!['http:','https:'].includes(u.protocol) || !u.hostname || u.username || u.password || !/^https?:\/\//i.test(out.browser.url)) throw new Error();
    } catch { throw new StartupError('browser.url must be an absolute http/https URL without credentials'); }
  }
  if (source.requirements !== undefined) {
    const req = object(source.requirements, 'requirements', ['changedFiles','requiredFiles']);
    for (const key of ['changedFiles','requiredFiles'] as const) if (req[key] !== undefined) {
      if (!Array.isArray(req[key])) throw new StartupError(`requirements.${key} must be an array`);
      out.requirements[key] = [...new Set(req[key].map(relativePath))];
    }
  }
  return out;
}
export async function loadConfig(root: string): Promise<Config> {
  let raw: string;
  try { raw = await fs.readFile(await safePath(root,'.aidonecheck.json'), 'utf8'); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(defaults); throw e; }
  try { return parseConfig(JSON.parse(raw)); } catch (e) { throw new StartupError(`Invalid .aidonecheck.json: ${(e as Error).message}`); }
}
export async function validatePaths(root: string, config: Config): Promise<void> {
  for (const value of [...config.requirements.changedFiles,...config.requirements.requiredFiles]) await safePath(root,value);
}
export async function init(root: string, force: boolean): Promise<void> {
  const filename = await safePath(root, '.aidonecheck.json');
  // Never follow a config symlink for an overwrite.
  if (force && (await fs.lstat(filename).catch(() => null))?.isSymbolicLink()) throw new StartupError('Refusing to overwrite a symlink config');
  try { await fs.writeFile(filename, JSON.stringify(defaults,null,2)+'\n', { flag: force ? 'w' : 'wx' }); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new StartupError('.aidonecheck.json already exists; use init --force to overwrite'); throw e; }
}
