import fs from 'node:fs/promises';
import { repository } from './git.js';
import { loadConfig, validatePaths } from './config.js';
import { discover } from './scripts.js';
import { browserRuntime } from './browser.js';
import { environment } from './engine.js';
import { StartupError } from './types.js';
import { redact } from './safety.js';
import { displayMessage, Language, text } from './display.js';
export async function doctor(cwd:string,language:Language='en'):Promise<string> {
  const t=(en:string,zh:string)=>text(language,en,zh);
  const repo=await repository(cwd);
  await environment(repo.root);
  const config=await loadConfig(repo.root);await validatePaths(repo.root,config);
  const scripts=await discover(repo.root);
  const lines=[`PASS Node.js ${process.version}`,t('PASS npm discovered','PASS 已发现 npm'),t('PASS Git repository discovered','PASS 已发现 Git 仓库'),`${t('PASS Repository root','PASS 仓库根目录')} ${repo.root}`,`${t('PASS Branch','PASS 分支')} ${repo.branch}`,`PASS HEAD ${repo.head}`,`${scripts.packageFound?'PASS':'WARN'} package.json ${scripts.packageFound?t('discovered','已发现'):t('not found','未发现')}`,t('PASS Configuration valid (built-in defaults when the file is absent)','PASS 配置有效（文件不存在时使用内置默认配置）')];
  for(const name of ['test','lint','typecheck','build'] as const)lines.push(!config.checks[name]?`SKIP ${name} ${t('disabled','已关闭')}` : scripts.scripts[name]?`PASS ${name} ${t('script discovered','脚本已发现')} (${scripts.scripts[name]}); ${t('not executed','未执行')}`:`WARN ${name} ${t('no real script found','未发现真实脚本')}`);
  lines.push(`${config.browser.enabled?'PASS':'SKIP'} ${t('Browser','浏览器')} ${config.browser.enabled?t('enabled','已启用'):t('disabled','已关闭')}`);
  try {
    const {version,executable}=await browserRuntime(repo.root);
    lines.push(`PASS Playwright ${version} ${t('discovered; not executed','已发现； 未执行')}`);
    try{await fs.access(executable);lines.push(t('PASS Chromium executable discovered; not launched','PASS 已发现 Chromium 可执行文件；未启动'));}
    catch{if(config.browser.enabled)throw new StartupError('Chromium is missing');lines.push(t('WARN Chromium is missing (browser checks disabled)','WARN 未安装 Chromium（浏览器检查已关闭）'));}
  }catch(e){if(config.browser.enabled)throw e;lines.push(`WARN ${t('Optional browser runtime:','可选浏览器运行环境：')} ${displayMessage((e as Error).message,language)}`);}
  lines.push(t('Discovery only: test, lint, typecheck and build were not executed; no browser navigation was performed.','仅进行环境发现：未执行 test、lint、typecheck、build，也未导航浏览器页面。'));
  return redact(lines.join('\n')+'\n');
}
