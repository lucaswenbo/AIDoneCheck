import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import {checkLicense} from './check-license.mjs';
export const requiredWorkflows=['Test','Browser smoke','Action smoke','AIDoneCheck 可复现演示'];
export function releaseGate(runs,sha,repository){
  return requiredWorkflows.map(name=>{
    const candidates=runs.filter(r=>r.name===name && r.head_sha===sha && r.head_branch==='main' && r.event==='push' && r.head_repository?.full_name?.toLowerCase()===repository.toLowerCase());
    candidates.sort((a,b)=>b.id-a.id);
    const latest=candidates[0];
    return {name,ok:latest?.status==='completed'&&latest.conclusion==='success',run:latest};
  });
}
export async function checkVersion(root=process.cwd()){
  await checkLicense(root);
  const pkg=JSON.parse(await fs.readFile(`${root}/package.json`,'utf8'));
  if(!/^\d+\.\d+\.\d+$/.test(pkg.version))throw new Error('Only stable semantic versions may be published');
  const source=await fs.readFile(`${root}/src/types.ts`,'utf8');
  if(!source.includes(`export const VERSION = '${pkg.version}';`))throw new Error('Source version differs from package.json');
  const lock=JSON.parse(await fs.readFile(`${root}/package-lock.json`,'utf8'));
  if(lock.version!==pkg.version||lock.packages[''].version!==pkg.version)throw new Error('Lockfile version differs');
  const notes=await fs.readFile(`${root}/docs/releases/${pkg.version}.md`,'utf8');
  if(!notes.includes(`v${pkg.version}`)||/Unreleased/.test(notes))throw new Error('Missing final release notes');
  const changelog=await fs.readFile(`${root}/CHANGELOG.md`,'utf8');
  if(!new RegExp(`## ${pkg.version.replaceAll('.','\\.')} - \\d{4}-\\d{2}-\\d{2}`).test(changelog))throw new Error('Missing dated CHANGELOG release entry');
  const actual=execFileSync(process.execPath,[`${root}/bin/aidonecheck.mjs`,'--version'],{encoding:'utf8'}).trim();
  if(actual!==pkg.version)throw new Error('CLI dist version differs');
  return {version:pkg.version,notes};
}
export function nextVersion(previous,next){
  if(previous===null)return next==='1.0.0';
  const [a,b,c]=previous.split('.').map(Number),[x,y,z]=next.split('.').map(Number);
  return (x===a&&y===b&&z===c+1)||(x===a&&y===b+1&&z===0)||(x===a+1&&y===0&&z===0);
}
