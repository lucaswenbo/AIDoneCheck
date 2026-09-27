import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const cli=path.join(project,'bin/aidonecheck.mjs');
export const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
export async function write(root,file,content){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),typeof content==='string'?content:JSON.stringify(content,null,2)+'\n');}
export async function fixture(t,scripts={test:'node -e "console.log(\'real check\')"'}){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'aidonecheck-test-'));
  t?.after(()=>fs.rm(root,{recursive:true,force:true}));
  git(root,'init','-b','main');git(root,'config','user.name','AIDoneCheck fixture');git(root,'config','user.email','fixture@example.invalid');
  await write(root,'.gitignore','.aidonecheck/\nignored.txt\nnode_modules/\n');
  await write(root,'package.json',{name:'fixture',version:'1.0.0',scripts});await write(root,'file.txt','initial\n');
  git(root,'add','.');git(root,'commit','-m','fixture base');
  const base=git(root,'rev-parse','HEAD');git(root,'update-ref','refs/remotes/origin/main',base);git(root,'symbolic-ref','refs/remotes/origin/HEAD','refs/remotes/origin/main');
  return {root,base};
}
export const quietConfig=(extra={})=>({version:1,checks:{test:false,lint:false,typecheck:false,build:false},...extra});
export function runCli(root,args,extraEnv={}){
  const env={...process.env,GITHUB_ACTIONS:'false',...extraEnv};
  return spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8',env,timeout:45_000,maxBuffer:1024*1024});
}
