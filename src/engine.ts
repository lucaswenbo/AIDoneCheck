import fs from 'node:fs/promises';
import path from 'node:path';
import { Check, Config, Report, StartupError, VERSION } from './types.js';
import { loadConfig, validatePaths } from './config.js';
import { actionEvent, collectGit, EventContext, repository } from './git.js';
import { discover, runScripts } from './scripts.js';
import { runNpm } from './command.js';
import { safePath } from './safety.js';
import { Browser, prepareBrowser, runBrowser } from './browser.js';
import { finishEvidence, prepareEvidence } from './evidence.js';
import { verdict } from './report.js';
export async function environment(root:string):Promise<void> {
  if(Number(process.versions.node.split('.')[0])<20)throw new StartupError('Node.js >=20 required');
  const npm=await runNpm(['--version'],root,15_000);
  if(npm.exitCode!==0||npm.timedOut)throw new StartupError('npm is unavailable');
}
export interface RunOptions {cwd?:string;base?:string;event?:EventContext;config?:Config;evidenceDirectory?:string;scriptTimeoutMs?:number}
export async function check(options:RunOptions={}):Promise<Report> {
  const repo=await repository(options.cwd??process.cwd());
  const config=options.config??await loadConfig(repo.root);
  await validatePaths(repo.root,config);
  await environment(repo.root);
  const discovery=await discover(repo.root);
  const event=options.event??await actionEvent();
  const gitOptions={base:options.base,event,requireReliable:config.requirements.changedFiles.length>0};
  // Fail unreliable startup requirements before executing project commands.
  await collectGit(repo.root,gitOptions);
  let browser:Browser|undefined;
  if(config.browser.enabled)browser=await prepareBrowser(repo.root);
  let target;
  try {
    const scriptChecks=await runScripts(repo.root,config,discovery,options.scriptTimeoutMs);
    // A project script can replace a previously safe/missing path with a symlink.
    await validatePaths(repo.root,config);
    // Scripts may create, restore or delete files. Report the verified final state.
    const git=await collectGit(repo.root,gitOptions);
    const finalRepo=await repository(repo.root);
    target=await prepareEvidence(repo.root,options.evidenceDirectory);
    const checks:Check[]=[{id:'git',status:git.reliable?'pass':'warn',blocking:false,meaningful:false,details:git.warning??'Committed, staged, unstaged and untracked changes inspected after project scripts'},...scriptChecks];
    if(browser)checks.push(...await runBrowser(browser,config.browser,target.temp));
    else checks.push({id:'browser',status:'skipped',blocking:false,meaningful:false,details:'Browser check disabled'});
    for(const file of config.requirements.changedFiles) {
      const ok=git.changedFiles.includes(file);
      checks.push({id:`changedFiles:${file}`,status:ok?'pass':'fail',blocking:!ok,meaningful:true,details:ok?`Changed file verified: ${file}`:`Required changed file was not in the reliable Git diff: ${file}`});
    }
    for(const file of config.requirements.requiredFiles) {
      let ok=false;
      try{ok=(await fs.stat(await safePath(repo.root,file))).isFile();}catch(e){if(!['ENOENT','ENOTDIR'].includes((e as NodeJS.ErrnoException).code??''))throw e;}
      checks.push({id:`requiredFiles:${file}`,status:ok?'pass':'fail',blocking:!ok,meaningful:true,details:ok?`Required file exists: ${file}`:`Required file is missing or not a regular file: ${file}`});
    }
    if(!checks.some(c=>c.meaningful))checks.push({id:'verification',status:'warn',blocking:false,meaningful:false,details:'No meaningful verification was executed'});
    const files=['report.json','report.md','agent-feedback.md'];
    for(const name of ['browser.png','trace.zip'])if(await fs.stat(path.join(target.temp,name)).catch(()=>null))files.push(name);
    const report:Report={tool:'AIDoneCheck',version:VERSION,schemaVersion:1,verdict:verdict(checks),createdAt:new Date().toISOString(),repository:{branch:finalRepo.branch,head:finalRepo.head},git,checks,warnings:checks.filter(c=>c.status==='warn').map(c=>c.details),failures:checks.filter(c=>c.status==='fail'&&c.blocking).map(c=>c.details),evidence:{directory:options.evidenceDirectory??'.aidonecheck/latest',files}};
    return await finishEvidence(target,report);
  } finally {
    if(target)await fs.rm(target.temp,{recursive:true,force:true}).catch(()=>{});
    if(browser)await browser.close().catch(()=>{});
  }
}
