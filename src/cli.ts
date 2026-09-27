import { check } from './engine.js';
import { doctor } from './doctor.js';
import { init } from './config.js';
import { repository } from './git.js';
import { readReport } from './evidence.js';
import { exitCode, summary } from './report.js';
import { redact } from './safety.js';
import { displayMessage } from './display.js';
import { VERSION, StartupError } from './types.js';
const HELP=`AIDoneCheck ${VERSION}\nAI 说“完成了”。AIDoneCheck 检查证据。\n\n用法：aidonecheck <命令> [选项]\n  init [--force]                 创建 .aidonecheck.json\n  doctor                         只发现环境，不执行验证\n  check [--base REF] [--json] [--fail-on-warn]\n  report                         只读取最近一次报告\n  --help                         显示帮助\n  --version                      显示版本\n  --no-color                     纯文本输出（默认始终启用）\n\ncheck 退出码：0 PASS/WARN；1 BLOCK（或 --fail-on-warn）；2 启动错误。\ndoctor/report 退出码：0 或 2。\n`;
export async function main(argv:string[],cwd=process.cwd()):Promise<number> {
  const json=argv.includes('--json');
  try {
    const args=argv.filter(a=>a!=='--no-color');
    if(args.length===1 && ['--help','-h'].includes(args[0]!)){process.stdout.write(HELP);return 0;}
    if(args.length===1 && ['--version','-v'].includes(args[0]!)){process.stdout.write(VERSION+'\n');return 0;}
    if(!args.length){process.stdout.write(HELP);return 0;}
    const command=args.shift();
    if(!['init','doctor','check','report'].includes(command??''))throw new StartupError('Unknown command; use --help');
    if(args.length===1 && args[0]==='--help'){process.stdout.write(HELP);return 0;}
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
    if(command==='init'){const repo=await repository(cwd);await init(repo.root,force);process.stdout.write('已创建 .aidonecheck.json。建议手动将 .aidonecheck/ 加入 .gitignore。\n');return 0;}
    if(command==='doctor'){process.stdout.write(await doctor(cwd));return 0;}
    if(command==='report'){process.stdout.write(summary(await readReport(cwd)));return 0;}
    const report=await check({cwd,base});
    process.stdout.write(json?JSON.stringify(report)+'\n':summary(report));
    return exitCode(report,failOnWarn);
  }catch(e){
    const message=redact((e as Error).message??String(e));
    process.stderr.write(`AIDoneCheck 启动错误：${displayMessage(message)}\n`);
    if(json)process.stdout.write(JSON.stringify({tool:'AIDoneCheck',version:VERSION,error:{kind:'startup',message},exitCode:2})+'\n');
    return 2;
  }
}
