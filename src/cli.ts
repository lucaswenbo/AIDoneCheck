import { check } from './engine.js';
import { doctor } from './doctor.js';
import { init } from './config.js';
import { repository } from './git.js';
import { readReport } from './evidence.js';
import { exitCode, summary } from './report.js';
import { redact } from './safety.js';
import { displayMessage, Language, parseLanguage, text } from './display.js';
import { VERSION, StartupError } from './types.js';
function help(language:Language):string {
  const t=(en:string,zh:string)=>text(language,en,zh);
  return [`AIDoneCheck ${VERSION}`,t('AI says "done." AIDoneCheck checks the evidence.','AI 说“完成了”。AIDoneCheck 检查证据。'),'',t('Usage: aidonecheck <command> [options]','用法：aidonecheck <命令> [选项]'),t('  init [--force]                 Create .aidonecheck.json','  init [--force]                 创建 .aidonecheck.json'),t('  doctor                         Discover environment; do not run checks','  doctor                         只发现环境，不执行验证'),'  check [--base REF] [--json] [--fail-on-warn]',t('  report                         Read the latest report only','  report                         只读取最近一次报告'),t('  --lang en|zh                   Display language (default: en)','  --lang en|zh                   显示语言（默认 en）'),t('  --help                         Show help','  --help                         显示帮助'),t('  --version                      Show version','  --version                      显示版本'),t('  --no-color                     Plain text (always the default)','  --no-color                     纯文本输出（默认始终启用）'),'',t('check exit codes: 0 PASS/WARN; 1 BLOCK (or --fail-on-warn); 2 startup error.','check 退出码：0 PASS/WARN；1 BLOCK（或 --fail-on-warn）；2 启动错误。'),t('doctor/report exit codes: 0 or 2.','doctor/report 退出码：0 或 2。'),''].join('\n');
}
export async function main(argv:string[],cwd=process.cwd()):Promise<number> {
  const json=argv.includes('--json');
  let language:Language='en';
  try {
    const args:string[]=[];
    let hasLanguage=false;
    for(let i=0;i<argv.length;i++) {
      if(argv[i]==='--lang') {
        if(hasLanguage)throw new StartupError('Duplicate option: --lang');
        hasLanguage=true;
        const value=argv[++i];if(!value)throw new StartupError('--lang requires en or zh');
        language=parseLanguage(value);
      }else if(argv[i]!=='--no-color')args.push(argv[i]!);
    }
    if(args.length===1 && ['--help','-h'].includes(args[0]!)){process.stdout.write(help(language));return 0;}
    if(args.length===1 && ['--version','-v'].includes(args[0]!)){process.stdout.write(VERSION+'\n');return 0;}
    if(!args.length){process.stdout.write(help(language));return 0;}
    const command=args.shift();
    if(!['init','doctor','check','report'].includes(command??''))throw new StartupError('Unknown command; use --help');
    if(args.length===1 && args[0]==='--help'){process.stdout.write(help(language));return 0;}
    let force=false,failOnWarn=false,base:string|undefined;
    const seen=new Set<string>();
    for(let i=0;i<args.length;i++) {
      const arg=args[i]!;if(seen.has(arg))throw new StartupError(`Duplicate option: ${arg}`);seen.add(arg);
      if(command==='init' && arg==='--force')force=true;
      else if(command==='check' && arg==='--json')continue;
      else if(command==='check' && arg==='--fail-on-warn')failOnWarn=true;
      else if(command==='check' && arg==='--base'){base=args[++i];if(!base || base.startsWith('-'))throw new StartupError('--base requires a ref');}
      else throw new StartupError(`Invalid option for ${command}: ${arg}`);
    }
    if(command==='init'){const repo=await repository(cwd);await init(repo.root,force);process.stdout.write(text(language,'Created .aidonecheck.json. Add .aidonecheck/ to .gitignore manually.\n','已创建 .aidonecheck.json。建议手动将 .aidonecheck/ 加入 .gitignore。\n'));return 0;}
    if(command==='doctor'){process.stdout.write(await doctor(cwd,language));return 0;}
    if(command==='report'){process.stdout.write(summary(await readReport(cwd),language));return 0;}
    const report=await check({cwd,base,language});
    process.stdout.write(json?JSON.stringify(report)+'\n':summary(report,language));
    return exitCode(report,failOnWarn);
  }catch(e){
    const message=redact((e as Error).message??String(e));
    process.stderr.write(`${text(language,'AIDoneCheck startup error: ','AIDoneCheck 启动错误：')}${displayMessage(message,language)}\n`);
    if(json)process.stdout.write(JSON.stringify({tool:'AIDoneCheck',version:VERSION,error:{kind:'startup',message},exitCode:2})+'\n');
    return 2;
  }
}
