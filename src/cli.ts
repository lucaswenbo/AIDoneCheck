import { check } from './engine.js';
import { doctor } from './doctor.js';
import { init } from './config.js';
import { repository } from './git.js';
import { readReport } from './evidence.js';
import { exitCode, summary } from './report.js';
import { redact } from './safety.js';
import { VERSION, StartupError } from './types.js';
const HELP=`AIDoneCheck ${VERSION}\nAI says "done." AIDoneCheck checks.\n\nUsage: aidonecheck <command> [options]\n  init [--force]                 Create .aidonecheck.json\n  doctor                         Discover readiness; never run checks\n  check [--base REF] [--json] [--fail-on-warn]\n  report                         Read the latest report only\n  --help                         Show help\n  --version                      Show version\n  --no-color                     Plain output (always enabled)\n\ncheck exits: 0 PASS/WARN; 1 BLOCK (or --fail-on-warn); 2 startup error.\ndoctor/report exits: 0 or 2.\n`;
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
    if(command==='init'){const repo=await repository(cwd);await init(repo.root,force);process.stdout.write('Created .aidonecheck.json. Consider adding .aidonecheck/ to .gitignore.\n');return 0;}
    if(command==='doctor'){process.stdout.write(await doctor(cwd));return 0;}
    if(command==='report'){process.stdout.write(summary(await readReport(cwd)));return 0;}
    const report=await check({cwd,base});
    process.stdout.write(json?JSON.stringify(report)+'\n':summary(report));
    return exitCode(report,failOnWarn);
  }catch(e){
    const message=redact((e as Error).message??String(e));
    process.stderr.write(`AIDoneCheck startup error: ${message}\n`);
    if(json)process.stdout.write(JSON.stringify({tool:'AIDoneCheck',version:VERSION,error:{kind:'startup',message},exitCode:2})+'\n');
    return 2;
  }
}
