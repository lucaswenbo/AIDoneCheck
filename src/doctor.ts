import fs from 'node:fs/promises';
import { repository } from './git.js';
import { loadConfig, validatePaths } from './config.js';
import { discover } from './scripts.js';
import { browserRuntime } from './browser.js';
import { environment } from './engine.js';
import { StartupError } from './types.js';
import { redact } from './safety.js';
import { displayMessage } from './display.js';
export async function doctor(cwd:string):Promise<string> {
  const repo=await repository(cwd);
  await environment(repo.root);
  const config=await loadConfig(repo.root);await validatePaths(repo.root,config);
  const scripts=await discover(repo.root);
  const lines=[`PASS Node.js ${process.version}`,'PASS 已发现 npm','PASS 已发现 Git 仓库',`PASS 仓库根目录 ${repo.root}`,`PASS 分支 ${repo.branch}`,`PASS HEAD ${repo.head}`,`${scripts.packageFound?'PASS':'WARN'} package.json ${scripts.packageFound?'已发现':'未发现'}`,'PASS 配置有效（文件不存在时使用内置默认配置）'];
  for(const name of ['test','lint','typecheck','build'] as const)lines.push(!config.checks[name]?`SKIP ${name} 已关闭` : scripts.scripts[name]?`PASS ${name} 脚本已发现 (${scripts.scripts[name]}); 未执行`:`WARN ${name} 未发现真实脚本`);
  lines.push(`${config.browser.enabled?'PASS':'SKIP'} 浏览器 ${config.browser.enabled?'已启用':'已关闭'}`);
  try {
    const {version,executable}=await browserRuntime(repo.root);
    lines.push(`PASS Playwright ${version} 已发现； 未执行`);
    try{await fs.access(executable);lines.push('PASS 已发现 Chromium 可执行文件；未启动');}
    catch{if(config.browser.enabled)throw new StartupError('Chromium is missing');lines.push('WARN 未安装 Chromium（浏览器检查已关闭）');}
  }catch(e){if(config.browser.enabled)throw e;lines.push(`WARN 可选浏览器运行环境： ${displayMessage((e as Error).message)}`);}
  lines.push('仅进行环境发现：未执行 test、lint、typecheck、build，也未导航浏览器页面。');
  return redact(lines.join('\n')+'\n');
}
