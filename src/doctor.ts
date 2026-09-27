import fs from 'node:fs/promises';
import { repository } from './git.js';
import { loadConfig, validatePaths } from './config.js';
import { discover } from './scripts.js';
import { browserRuntime } from './browser.js';
import { environment } from './engine.js';
import { StartupError } from './types.js';
import { redact } from './safety.js';
export async function doctor(cwd:string):Promise<string> {
  const repo=await repository(cwd);
  await environment(repo.root);
  const config=await loadConfig(repo.root);await validatePaths(repo.root,config);
  const scripts=await discover(repo.root);
  const lines=[`PASS Node.js ${process.version}`,'PASS npm discovered','PASS Git repository discovered',`PASS repo root ${repo.root}`,`PASS branch ${repo.branch}`,`PASS HEAD ${repo.head}`,`${scripts.packageFound?'PASS':'WARN'} package.json ${scripts.packageFound?'discovered':'not found'}`,'PASS config valid (built-in defaults when absent)'];
  for(const name of ['test','lint','typecheck','build'] as const)lines.push(!config.checks[name]?`SKIP ${name} disabled` : scripts.scripts[name]?`PASS ${name} script discovered (${scripts.scripts[name]}); not executed`:`WARN ${name} real script not found`);
  lines.push(`${config.browser.enabled?'PASS':'SKIP'} Browser ${config.browser.enabled?'enabled':'disabled'}`);
  try {
    const {version,executable}=await browserRuntime(repo.root);
    lines.push(`PASS Playwright ${version} discovered; not executed`);
    try{await fs.access(executable);lines.push('PASS Chromium executable discovered; not launched');}
    catch{if(config.browser.enabled)throw new StartupError('Chromium is missing');lines.push('WARN Chromium not installed (Browser disabled)');}
  }catch(e){if(config.browser.enabled)throw e;lines.push(`WARN optional browser runtime: ${(e as Error).message}`);}
  lines.push('Discovery only: no test/lint/typecheck/build or Browser navigation was executed.');
  return redact(lines.join('\n')+'\n');
}
