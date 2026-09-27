import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CommandResult, StartupError } from './types.js';
const LIMIT = 64 * 1024;
export function npmCommand(): { executable: string; prefix: string[] } {
  if (process.platform !== 'win32') return { executable: 'npm', prefix: [] };
  const candidates = [path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js')];
  if (process.env.npm_execpath?.endsWith('npm-cli.js')) candidates.push(process.env.npm_execpath);
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) candidates.push(path.join(dir,'node_modules/npm/bin/npm-cli.js'));
  const cli = candidates.find(p => fs.existsSync(p));
  if (!cli) throw new StartupError('Cannot locate npm-cli.js on Windows');
  return { executable: process.execPath, prefix: [cli] };
}
export async function runCommand(executable: string, args: string[], options: { cwd: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }): Promise<CommandResult> {
  const start = performance.now();
  const timeoutMs = options.timeoutMs ?? 600_000;
  return await new Promise((resolve,reject) => {
    // Node's private test-runner context can silently skip nested node --test.
    const childEnv = { ...(options.env ?? process.env) };
    delete childEnv.NODE_TEST_CONTEXT;
    const child = spawn(executable,args,{cwd:options.cwd,env:childEnv,shell:false,detached:process.platform !== 'win32',stdio:['ignore','pipe','pipe']});
    let stdout: Buffer = Buffer.alloc(0), stderr: Buffer = Buffer.alloc(0);
    let outTrunc = false, errTrunc = false, timedOut = false, finished = false;
    let grace: NodeJS.Timeout | undefined, deadline: NodeJS.Timeout | undefined;
    const append = (old: Buffer, chunk: Buffer): Buffer => Buffer.concat([old,chunk.subarray(0,Math.max(0,LIMIT-old.length))]);
    child.stdout.on('data',(chunk: Buffer) => { outTrunc ||= stdout.length+chunk.length>LIMIT; stdout=append(stdout,chunk); });
    child.stderr.on('data',(chunk: Buffer) => { errTrunc ||= stderr.length+chunk.length>LIMIT; stderr=append(stderr,chunk); });
    function kill(signal: NodeJS.Signals) {
      if (!child.pid) return;
      if (process.platform === 'win32') { const killer=spawn('taskkill',['/pid',String(child.pid),'/T','/F'],{stdio:'ignore',shell:false}); killer.on('error',()=>{}); }
      else { try { process.kill(-child.pid,signal); } catch { try { child.kill(signal); } catch { /* already stopped */ } } }
    }
    function done(code: number | null, signal: string | null) {
      if (finished) return; finished=true; clearTimeout(timer); if (deadline) clearTimeout(deadline);
      if (grace) clearTimeout(grace);
      if (timedOut) kill('SIGKILL');
      resolve({exitCode:code,signal,durationMs:Math.round(performance.now()-start),stdout:stdout.toString('utf8')+(outTrunc?'\n[output truncated]':''),stderr:stderr.toString('utf8')+(errTrunc?'\n[output truncated]':''),timedOut,stdoutTruncated:outTrunc,stderrTruncated:errTrunc});
    }
    const timer=setTimeout(()=>{
      timedOut=true; kill('SIGTERM');
      grace=setTimeout(()=>kill('SIGKILL'),300);
      deadline=setTimeout(()=>{kill('SIGKILL');child.stdout.destroy();child.stderr.destroy();done(null,'SIGKILL');},1500);
    },timeoutMs);
    child.on('error', e=>{clearTimeout(timer);if(grace)clearTimeout(grace);if(deadline)clearTimeout(deadline);finished=true;reject(new StartupError(`Cannot start ${path.basename(executable)}: ${e.message}`));});
    child.on('close',done);
  });
}
export async function runNpm(args: string[], cwd: string, timeoutMs?: number): Promise<CommandResult> {
  const npm = npmCommand();
  return runCommand(npm.executable,[...npm.prefix,...args],{cwd,timeoutMs});
}
