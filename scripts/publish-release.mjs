// Run only in the trusted main publication workflow, after exact-commit CI gates.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {checkVersion,releaseGate,nextVersion} from './release-policy.mjs';
const repo=process.env.GITHUB_REPOSITORY;
if(repo!=='lucaswenbo/AIDoneCheck')throw new Error('Publication is restricted to lucaswenbo/AIDoneCheck');
const sha=process.env.RELEASE_SHA;
if(!/^[0-9a-f]{40}$/.test(sha??''))throw new Error('Expected an exact release commit');
const token=process.env.GH_TOKEN;
if(!token)throw new Error('GITHUB_TOKEN is required');
const apiRoot=`https://api.github.com/repos/${repo}`;
async function api(route,method='GET',body,missing=false){
  const response=await fetch(apiRoot+route,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  if(missing&&response.status===404)return null;
  if(!response.ok)throw new Error(`GitHub API ${method} ${route.split('?')[0]} failed with HTTP ${response.status}`);
  return response.status===204?null:await response.json();
}
async function sameMain(){const main=await api('/git/ref/heads/main');if(main.object.sha!==sha)throw new Error('main advanced; refusing to publish an outdated run');}
async function run(){
  await sameMain();
  if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==sha)throw new Error('Checked out commit differs from release target');
  const runs=await api(`/actions/runs?head_sha=${sha}&event=push&per_page=100`);
  const gate=releaseGate(runs.workflow_runs,sha,repo);
  if(gate.some(g=>!g.ok)){console.log('Release is waiting for successful CI on the exact main commit:',gate.map(g=>`${g.name}=${g.run?.conclusion??g.run?.status??'missing'}`).join(', '));return;}
  const {version,notes}=await checkVersion();const tag=`v${version}`,major=`v${version.split('.')[0]}`;
  const tagged=await api(`/git/ref/tags/${tag}`,'GET',undefined,true);
  let release=await api(`/releases/tags/${tag}`,'GET',undefined,true);
  if(!release)release=(await api('/releases?per_page=100')).find(r=>r.tag_name===tag)??null;
  // Ordinary docs/code commits never overwrite an already-published fixed version.
  if(tagged&&tagged.object.sha!==sha){
    if(release&&!release.draft){console.log(`${tag} is already released; this main commit does not request a new version.`);return;}
    throw new Error('Fixed version tag already points elsewhere; never move it');
  }
  if(release&&!release.draft){console.log(`${tag} already published; reconciling floating major only`);await updateMajor(major,sha);await published();return;}
  const latest=await api('/releases/latest','GET',undefined,true);
  if(!nextVersion(latest?.tag_name?.replace(/^v/,'')??null,version))throw new Error('Version must advance exactly one patch/minor/major level; first release must be 1.0.0');
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'aidonecheck-release-'));
  try{
    const packed=JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination',tmp],{encoding:'utf8'}))[0];
    const tar=path.join(tmp,packed.filename);
    execFileSync(process.execPath,['scripts/package-smoke.mjs',tar],{stdio:'inherit'});
    const data=await fs.readFile(tar);const digest=createHash('sha256').update(data).digest('hex');
    const checksum=Buffer.from(`${digest}  ${packed.filename}\n`);
    const evidence=`\n\n## 发布验证\n\n提交：\`${sha}\`\n\n${gate.map(g=>`- [${g.name}](${g.run.html_url})：通过`).join('\n')}\n\n发布包已经独立安装并验证 PASS、真实测试失败 BLOCK 和 Evidence 保留。\n`;
    await sameMain();
    if(!tagged)await api('/git/refs','POST',{ref:`refs/tags/${tag}`,sha});
    if(!release)release=await api('/releases','POST',{tag_name:tag,target_commitish:sha,name:`AIDoneCheck ${tag}`,body:notes+evidence,draft:true,prerelease:false});
    else await api(`/releases/${release.id}`,'PATCH',{body:notes+evidence,name:`AIDoneCheck ${tag}`});
    async function asset(name,bytes,type){
      const existing=(await api(`/releases/${release.id}/assets`)).find(a=>a.name===name);
      const wanted='sha256:'+createHash('sha256').update(bytes).digest('hex');
      if(existing){if(existing.digest===wanted)return;throw new Error(`Draft asset ${name} differs; refusing to silently overwrite`);}
      const url=`https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
      const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':type,'X-GitHub-Api-Version':'2026-03-10'},body:bytes});
      if(!response.ok)throw new Error(`Release asset upload failed: ${name}, HTTP ${response.status}`);
      const uploaded=await response.json();if(uploaded.digest&&uploaded.digest!==wanted)throw new Error('Uploaded asset digest mismatch');
    }
    await asset(packed.filename,data,'application/gzip');await asset('SHA256SUMS.txt',checksum,'text/plain');
    await sameMain();
    release=await api(`/releases/${release.id}`,'PATCH',{draft:false,prerelease:false,make_latest:'true'});
    await updateMajor(major,sha);await published();
    console.log(`Published ${release.html_url}; ${major} -> ${sha}`);
    if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,`# AIDoneCheck ${tag} 已发布\n\n${release.html_url}\n\n固定版本：${tag}；兼容更新：${major}。\n`);
  }finally{await fs.rm(tmp,{recursive:true,force:true});}
}
async function updateMajor(major,target){
  const existing=await api(`/git/ref/tags/${major}`,'GET',undefined,true);
  if(existing?.object.sha===target)return;
  if(existing)await api(`/git/refs/tags/${major}`,'PATCH',{sha:target,force:true});
  else await api('/git/refs','POST',{ref:`refs/tags/${major}`,sha:target});
}
async function published(){if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,'published=true\n');}
await run();
