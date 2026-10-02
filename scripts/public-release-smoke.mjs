import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const {version}=JSON.parse(await fs.readFile('package.json','utf8'));
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Invalid release version');
const publish=process.argv.includes('--publish-npm');
if(publish && (process.env.GITHUB_REPOSITORY!=='lucaswenbo/AIDoneCheck' || process.env.GITHUB_ACTIONS!=='true'))throw new Error('npm publication is restricted to the trusted AIDoneCheck workflow');
const filename=`aidonecheck-${version}.tgz`;
const base=`https://github.com/lucaswenbo/AIDoneCheck/releases/download/v${version}`;
async function download(name){const r=await fetch(`${base}/${name}`);if(!r.ok)throw new Error(`Public download failed: HTTP ${r.status}`);return Buffer.from(await r.arrayBuffer());}
const [data,sum]=await Promise.all([download(filename),download('SHA256SUMS.txt')]);
assert.equal(sum.toString().trim(),`${createHash('sha256').update(data).digest('hex')}  ${filename}`);
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'aidonecheck-public-'));
try{
  const file=path.join(tmp,filename);await fs.writeFile(file,data);
  execFileSync(process.execPath,['scripts/package-smoke.mjs',file],{stdio:'inherit'});
  console.log('Public Release URL, checksum and installed CLI verified');
  if(publish) {
    const registry='https://registry.npmjs.org';
    const response=await fetch(`${registry}/aidonecheck/${version}`);
    const integrity='sha512-'+createHash('sha512').update(data).digest('base64');
    if(response.status===404)execFileSync('npm',['publish',file,'--access','public','--provenance',`--registry=${registry}`],{stdio:'inherit'});
    else {
      if(!response.ok)throw new Error(`npm version lookup failed: HTTP ${response.status}`);
      assert.equal((await response.json()).dist.integrity,integrity,'Published npm version differs from the Release package');
      console.log(`aidonecheck@${version} already published with identical bytes`);
    }
    const metadata=JSON.parse(execFileSync('npm',['view',`aidonecheck@${version}`,'--json',`--registry=${registry}`],{encoding:'utf8'}));
    assert.equal(metadata.dist.integrity,integrity,'npm must contain exactly the Release tarball');
    execFileSync(process.execPath,['scripts/package-smoke.mjs','--npm'],{stdio:'inherit'});
    console.log(`Verified npm registry package aidonecheck@${version}`);
  }
}finally{await fs.rm(tmp,{recursive:true,force:true});}
