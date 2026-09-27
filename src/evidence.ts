import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Report, StartupError } from './types.js';
import { markdown, feedback, validateReport } from './report.js';
import { safePath, sanitize, within } from './safety.js';
export interface EvidenceTarget { temp: string; final: string; localRoot?: string }
export async function prepareEvidence(root: string, final?: string): Promise<EvidenceTarget> {
  if(final) {
    const parent=path.dirname(final); await fs.mkdir(parent,{recursive:true});
    if(await fs.lstat(final).catch(()=>null)) throw new StartupError('Evidence invocation directory already exists');
    const temp=await fs.mkdtemp(path.join(parent,'.aidonecheck-tmp-'));
    return {temp,final};
  }
  const localRoot=await safePath(root,'.aidonecheck');
  if((await fs.lstat(localRoot).catch(()=>null))?.isSymbolicLink()) throw new StartupError('Evidence root cannot be a symlink');
  await fs.mkdir(localRoot,{recursive:true});
  const runs=path.join(localRoot,'runs');
  if((await fs.lstat(runs).catch(()=>null))?.isSymbolicLink()) throw new StartupError('Evidence runs directory cannot be a symlink');
  await fs.mkdir(runs,{recursive:true});
  return {temp:await fs.mkdtemp(path.join(localRoot,'.tmp-')),final:path.join(runs,randomUUID()),localRoot};
}
export async function finishEvidence(target: EvidenceTarget, report: Report): Promise<Report> {
  const clean=sanitize(report);
  await fs.writeFile(path.join(target.temp,'report.json'),JSON.stringify(clean,null,2)+'\n');
  await fs.writeFile(path.join(target.temp,'report.md'),markdown(clean));
  await fs.writeFile(path.join(target.temp,'agent-feedback.md'),feedback(clean));
  await fs.rename(target.temp,target.final);
  if(target.localRoot) {
    const latest=path.join(target.localRoot,'latest');
    const stat=await fs.lstat(latest).catch(()=>null);
    if(stat?.isSymbolicLink()) {
      const dest=path.resolve(target.localRoot,await fs.readlink(latest));
      if(!within(path.join(target.localRoot,'runs'),dest)) throw new StartupError('Refusing to replace an external latest symlink');
    }
    const link=path.join(target.localRoot,`.latest-${randomUUID()}`);
    // Complete immutable run + atomic pointer swap keeps concurrent readers whole.
    await fs.symlink(process.platform==='win32'?target.final:path.relative(target.localRoot,target.final),link,process.platform==='win32'?'junction':'dir');
    const backup=path.join(target.localRoot,`.previous-${randomUUID()}`);
    if(stat && !stat.isSymbolicLink()) await fs.rename(latest,backup);
    try { await fs.rename(link,latest); }
    catch(e) { if(stat && !stat.isSymbolicLink()) await fs.rename(backup,latest); await fs.rm(link,{force:true}); throw e; }
  }
  return clean;
}
export async function readReport(cwd: string): Promise<Report> {
  // Resolve upward without invoking Git or any verification command.
  let root=path.resolve(cwd);
  while(true) {
    if(await fs.lstat(path.join(root,'.git')).catch(()=>null)) break;
    const parent=path.dirname(root); if(parent===root) {root=path.resolve(cwd);break;} root=parent;
  }
  try { return sanitize(validateReport(JSON.parse(await fs.readFile(await safePath(root,'.aidonecheck/latest/report.json'),'utf8')))); }
  catch { throw new StartupError('Latest report is missing, unreadable or damaged; run aidonecheck check first'); }
}
