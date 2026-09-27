import * as core from '@actions/core';
import { DefaultArtifactClient } from '@actions/artifact';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { check } from './engine.js';
import { repository, actionEvent } from './git.js';
import { loadConfig } from './config.js';
import { runNpm, runCommand } from './command.js';
import { markdown, exitCode } from './report.js';
import { displayMessage } from './display.js';
import { redact, within } from './safety.js';
import { PLAYWRIGHT_VERSION, StartupError } from './types.js';
export async function installBrowserRuntime():Promise<void> {
  const directory=await fs.mkdtemp(path.join(process.env.RUNNER_TEMP??os.tmpdir(),'aidonecheck-playwright-'));
  await fs.writeFile(path.join(directory,'package.json'),'{"private":true}\n');
  const installed=await runNpm(['install','--prefix',directory,'--ignore-scripts','--package-lock=false','--no-audit','--no-fund',`playwright@${PLAYWRIGHT_VERSION}`],directory);
  if(installed.exitCode!==0||installed.timedOut)throw new StartupError('Isolated Playwright installation failed');
  const browsers=path.join(directory,'browsers');
  const result=await runCommand(process.execPath,[path.join(directory,'node_modules/playwright/cli.js'),'install','--with-deps','chromium'],{cwd:directory,env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:browsers}});
  if(result.exitCode!==0||result.timedOut)throw new StartupError('Isolated Chromium installation failed');
  // Process-local only: do not modify caller repository or subsequent steps' environment.
  process.env.AIDONECHECK_PLAYWRIGHT_DIR=directory;
  process.env.PLAYWRIGHT_BROWSERS_PATH=browsers;
}
async function action():Promise<void> {
  const id=randomUUID();
  const dir=path.join(process.env.RUNNER_TEMP??os.tmpdir(),`aidonecheck-evidence-${id}`);
  const name=`aidonecheck-${process.env.GITHUB_RUN_ID??'local'}-${process.env.GITHUB_RUN_ATTEMPT??'1'}-${id}`;
  let failed=false;
  try {
    const workspace=await fs.realpath(process.env.GITHUB_WORKSPACE??process.cwd());
    const cwd=await fs.realpath(path.resolve(workspace,core.getInput('working-directory')||'.'));
    if(!within(workspace,cwd))throw new StartupError('working-directory must be within GITHUB_WORKSPACE');
    const repo=await repository(cwd);
    if(!within(workspace,repo.root))throw new StartupError('Repository root must be within GITHUB_WORKSPACE');
    const config=await loadConfig(repo.root);
    if(config.browser.enabled)await installBrowserRuntime();
    const failOnWarn=core.getBooleanInput('fail-on-warn');
    const report=await check({cwd:repo.root,config,base:core.getInput('base')||undefined,event:await actionEvent(),evidenceDirectory:dir});
    const summary=markdown(report);
    await fs.writeFile(path.join(dir,'summary.md'),summary);
    if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
    core.setOutput('verdict',report.verdict);
    failed=exitCode(report,failOnWarn)!==0;
    core.info(`AIDoneCheck 结论： ${report.verdict}`);
  }catch(e){
    failed=true;
    const message=redact((e as Error).message);
    await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(dir,'startup-error.json'),JSON.stringify({tool:'AIDoneCheck',error:message,exitCode:2},null,2)+'\n');
    const summary=`# AIDoneCheck — ERROR\n\n发生启动或基础设施错误，验证未完成。\n\n${displayMessage(message).replace(/[<>]/g,'')}\n`;
    await fs.writeFile(path.join(dir,'summary.md'),summary);
    if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
    core.error(displayMessage(message));
  }
  core.setOutput('evidence_dir',dir);core.setOutput('evidence_name',name);
  core.setOutput('summary_path',path.join(dir,'summary.md'));
  try {
    const files=(await fs.readdir(dir)).map(file=>path.join(dir,file));
    const artifact=await new DefaultArtifactClient().uploadArtifact(name,files,dir,{retentionDays:7});
    if(!artifact.id)throw new Error('Artifact service returned no artifact ID');
    core.setOutput('artifact_id',String(artifact.id));
    core.setOutput('artifact_url',`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}/artifacts/${artifact.id}`);
  }catch(e){failed=true;core.error(`证据上传失败：${displayMessage(redact((e as Error).message))}`);}
  if(failed)core.setFailed('AIDoneCheck 未通过。请查看已保留的证据和总结。');
}
void action().catch(e=>core.setFailed(displayMessage(redact((e as Error).message))));
