import fs from 'node:fs/promises';
import { Check, Config, ScriptName, StartupError } from './types.js';
import { safePath } from './safety.js';
import { runNpm } from './command.js';
export interface Discovery { packageFound: boolean; scripts: Partial<Record<ScriptName,string>>; placeholderTest: boolean }
export async function discover(root: string): Promise<Discovery> {
  let pkg;
  try { pkg=JSON.parse(await fs.readFile(await safePath(root,'package.json'),'utf8')); }
  catch(e) { if((e as NodeJS.ErrnoException).code==='ENOENT') return {packageFound:false,scripts:{},placeholderTest:false}; throw new StartupError('Cannot parse/read package.json'); }
  if(!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new StartupError('package.json must be an object');
  if(pkg.scripts !== undefined && (!pkg.scripts || typeof pkg.scripts !== 'object' || Array.isArray(pkg.scripts))) throw new StartupError('package.json scripts must be an object');
  const source=pkg.scripts ?? {};
  const valid=(key:string) => typeof source[key]==='string' && source[key].trim().length>0;
  const placeholderTest=valid('test') && /^(?:echo\s+)["']?Error:\s*no test specified["']?\s*(?:&&|;)\s*exit\s+1\s*;?\s*$/i.test(source.test.trim());
  const scripts: Discovery['scripts']={};
  for(const key of ['test','lint','typecheck','build'] as const) if(valid(key) && !(key==='test' && placeholderTest)) scripts[key]=key;
  if(!scripts.typecheck && valid('check-types')) scripts.typecheck='check-types';
  return {packageFound:true,scripts,placeholderTest};
}
export async function runScripts(root: string, config: Config, discovery: Discovery, timeoutMs?: number): Promise<Check[]> {
  const checks: Check[]=[];
  for(const id of ['test','lint','typecheck','build'] as const) {
    if(!config.checks[id]) {checks.push({id,status:'skipped',blocking:false,meaningful:false,details:'Disabled by configuration'});continue;}
    const script=discovery.scripts[id];
    if(!script) { checks.push({id,status:'warn',blocking:false,meaningful:false,details:id==='test' && discovery.placeholderTest?'No real test: npm placeholder script discovered':`${id} script not found`});continue; }
    const command=script==='test'?'npm test':`npm run ${script}`;
    const result=await runNpm(script==='test'?['test']:['run',script],root,timeoutMs);
    const ok=result.exitCode===0 && !result.timedOut;
    checks.push({id,status:ok?'pass':'fail',blocking:!ok,meaningful:true,command,result,details:result.timedOut?`${command} timed out` : ok?`${command} passed`:`${command} exited with code ${result.exitCode ?? 'null'}${result.signal?` (${result.signal})`:''}`});
  }
  return checks;
}
