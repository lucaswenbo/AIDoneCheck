import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { GitInfo, StartupError } from './types.js';
export async function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve,reject)=>execFile('git',args,{cwd,encoding:'utf8',maxBuffer:32*1024*1024,timeout:30_000,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}},(e,out)=>e?reject(new StartupError(`Git ${args[0]} failed: repository or history unavailable`)):resolve(out)));
}
export async function repository(cwd: string): Promise<{ root: string; branch: string; head: string }> {
  const root=(await git(cwd,['rev-parse','--show-toplevel'])).trim();
  const head=(await git(root,['rev-parse','--verify','HEAD'])).trim();
  const branch=(await git(root,['symbolic-ref','--quiet','--short','HEAD']).catch(()=> 'HEAD (detached)')).trim();
  return {root,branch,head};
}
export type EventContext = {name: string; payload: Record<string, unknown>};
export async function actionEvent(): Promise<EventContext | undefined> {
  if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_EVENT_PATH) return undefined;
  try { return { name: process.env.GITHUB_EVENT_NAME ?? '', payload: JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8')) }; }
  catch { throw new StartupError('Cannot read GitHub event payload'); }
}
async function resolveCommit(root: string, ref: string): Promise<string> {
  if (!ref || ref.startsWith('-') || /[\0\r\n]/.test(ref)) throw new StartupError('Invalid Git base ref');
  return (await git(root,['rev-parse','--verify','--end-of-options',`${ref}^{commit}`])).trim();
}
const names=(s: string) => s.split('\0').filter(Boolean);
async function diff(root: string, args: string[]): Promise<string[]> {
  // Disabling rename detection retains both the deleted and added exact paths.
  return names(await git(root,['diff','--no-ext-diff','--no-textconv','--no-renames','--name-only','-z',...args,'--']));
}
export async function collectGit(root: string, options: {base?: string; event?: EventContext; requireReliable?: boolean}={}): Promise<GitInfo> {
  const info=await repository(root);
  const result: GitInfo={reliable:true,mode:'local',base:null,head:info.head,baseRef:null,warning:null,committed:[],staged:[],unstaged:[],untracked:[],changedFiles:[]};
  result.staged=await diff(root,['--cached']);
  result.unstaged=await diff(root,[]);
  result.untracked=names(await git(root,['ls-files','--others','--exclude-standard','-z']));
  try {
    if (options.base !== undefined) {
      result.mode='explicit';result.baseRef=options.base;
      const base=await resolveCommit(root,options.base);
      result.base=(await git(root,['merge-base',base,info.head])).trim();
    } else if (options.event?.name === 'pull_request') {
      result.mode='pull_request';
      const pr=options.event.payload.pull_request as {base?:{sha?:string};head?:{sha?:string}} | undefined;
      if (!pr?.base?.sha || !pr.head?.sha) throw new StartupError('Missing PR base/head SHA');
      const base=await resolveCommit(root,pr.base.sha);
      result.head=await resolveCommit(root,pr.head.sha);
      result.baseRef=pr.base.sha;
      result.base=(await git(root,['merge-base',base,result.head])).trim();
    } else if (options.event?.name === 'push') {
      result.mode='push';
      const {before,after}=options.event.payload;
      if (typeof before !== 'string' || typeof after !== 'string' || /^0+$/.test(before)) throw new StartupError('Push before SHA is missing or zero');
      result.baseRef=before;
      result.base=await resolveCommit(root,before);result.head=await resolveCommit(root,after);
    } else {
      const ref=(await git(root,['symbolic-ref','--quiet','refs/remotes/origin/HEAD'])).trim();
      if (!ref.startsWith('refs/remotes/origin/')) throw new StartupError('Remote default branch is unavailable');
      result.baseRef=ref;
      result.base=(await git(root,['merge-base',await resolveCommit(root,ref),info.head])).trim();
    }
    if (!result.base) throw new StartupError('Committed base is unavailable');
    result.committed=await diff(root,[result.base,result.head]);
  } catch {
    if (options.base !== undefined) throw new StartupError('Explicit --base cannot be resolved with available Git history');
    result.reliable=false;result.base=null;
    result.warning='Committed diff base is unavailable or unreliable; staged, unstaged and untracked changes were still inspected. Fetch full history and provide --base.';
    if (options.requireReliable) throw new StartupError('changedFiles requires a reliable committed diff base; fetch full history or pass --base');
  }
  result.changedFiles=[...new Set([...result.committed,...result.staged,...result.unstaged,...result.untracked])].sort();
  return result;
}
