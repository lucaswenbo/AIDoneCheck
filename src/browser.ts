// Design references: lucaswenbo/ProdDoctor v2.1.1 (MIT). Independent implementation.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Check, Config, PLAYWRIGHT_VERSION, StartupError } from './types.js';
interface Request { url(): string; resourceType(): string; failure(): {errorText:string} | null }
interface Response { status(): number; url(): string; request(): Request }
interface ConsoleMessage { type(): string; text(): string }
interface Page {
  on(event:'pageerror', listener:(e:Error)=>void):void;
  on(event:'console', listener:(m:ConsoleMessage)=>void):void;
  on(event:'requestfailed', listener:(r:Request)=>void):void;
  on(event:'response', listener:(r:Response)=>void):void;
  goto(url:string,options:Record<string,unknown>):Promise<Response|null>;
  url():string; title():Promise<string>; evaluate<T>(fn:()=>T):Promise<T>;
  screenshot(options:Record<string,unknown>):Promise<unknown>;
  setDefaultTimeout(ms:number):void; setDefaultNavigationTimeout(ms:number):void;
}
interface Context {
  newPage():Promise<Page>;close():Promise<void>;
  tracing:{start(options:Record<string,unknown>):Promise<void>;stop(options?:{path?:string}):Promise<void>};
}
export interface Browser { newContext(options:Record<string,unknown>):Promise<Context>;close():Promise<void> }
interface Playwright { chromium:{executablePath():string;launch(options:Record<string,unknown>):Promise<Browser>} }
export async function browserRuntime(root:string):Promise<{pw:Playwright;version:string;executable:string}> {
  const base=process.env.AIDONECHECK_PLAYWRIGHT_DIR || root;
  const require=createRequire(path.join(path.resolve(base),'package.json'));
  try {
    const version=(require('playwright/package.json') as {version:string}).version;
    if(version!==PLAYWRIGHT_VERSION) throw new StartupError(`Playwright ${PLAYWRIGHT_VERSION} required; found ${version}`);
    const pw=require('playwright') as Playwright;
    const executable=pw.chromium.executablePath();
    return {pw,version,executable};
  } catch(e) {
    if(e instanceof StartupError) throw e;
    throw new StartupError(`Playwright ${PLAYWRIGHT_VERSION} is unavailable; install the optional isolated browser runtime described in README`);
  }
}
export async function prepareBrowser(root:string):Promise<Browser> {
  const {pw,executable}=await browserRuntime(root);
  try {await fs.access(executable);} catch {throw new StartupError('Chromium is missing; install the pinned Playwright Chromium runtime');}
  try {return await pw.chromium.launch({headless:true,timeout:30_000});}
  catch {throw new StartupError('Chromium could not launch; check runtime/system dependencies (environment error)');}
}
const bounded=(s:string)=>s.length>2000?s.slice(0,2000)+' [output truncated]':s;
const timeout=<T>(p:Promise<T>,ms:number):Promise<T>=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Browser inspection timed out')),ms);p.then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});});
export async function runBrowser(browser:Browser,config:Config['browser'],directory:string):Promise<Check[]> {
  const start=performance.now();
  const checks:Check[]=[];
  const failures:string[]=[],warnings:string[]=[],pageErrors:string[]=[],consoleErrors:string[]=[];
  const resources:{url:string;resourceType:string;status?:number;error?:string}[]=[];
  let context:Context|undefined,page:Page|undefined,traceStarted=false;
  let finalUrl='',title='',textLength=0,expectMatched=false,mainStatus:number|null=null,screenshot=false,trace=false,eventsTruncated=false;
  const push=<T>(arr:T[],value:T)=>{if(arr.length<200)arr.push(value);else eventsTruncated=true;};
  try {
    context=await browser.newContext(config.profile==='mobile'?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3}:{viewport:{width:1440,height:900}});
    if(config.trace!=='off') {try {await context.tracing.start({screenshots:true,snapshots:true,sources:false});traceStarted=true;} catch{warnings.push('Trace recording could not start');}}
    page=await context.newPage();page.setDefaultTimeout(30_000);page.setDefaultNavigationTimeout(30_000);
    page.on('pageerror',e=>push(pageErrors,bounded(e.message)));
    page.on('console',m=>{if(m.type()==='error')push(consoleErrors,bounded(m.text()));});
    page.on('requestfailed',r=>push(resources,{url:r.url(),resourceType:r.resourceType(),error:bounded(r.failure()?.errorText??'request failed')}));
    page.on('response',r=>{if(r.status()>=400)push(resources,{url:r.url(),resourceType:r.request().resourceType(),status:r.status()});});
    try {
      const response=await page.goto(config.url,{waitUntil:'load',timeout:30_000});
      mainStatus=response?.status()??null;
      if(!response)failures.push('Navigation did not return a main document response');
      else if(response.status()>=400)failures.push(`Main document HTTP ${response.status()}`);
      // Bounded observation window after load; not a claim about future interactions.
      await new Promise(resolve=>setTimeout(resolve,350));
      title=await timeout(page.title(),5000);
      const text=await timeout(page.evaluate(()=>{
        const body=document.body;
        if(!body)return '';
        const style=getComputedStyle(body);
        if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return '';
        return body.innerText;
      }),5000);
      textLength=text.trim().length;expectMatched=!config.expect||text.includes(config.expect);
      if(!textLength)warnings.push('Visible body text is empty');
      if(!expectMatched)failures.push('Expected case-sensitive substring is missing from visible body text');
    } catch(e) {failures.push(`Navigation / page inspection failed: ${bounded((e as Error).message)}`);}
  } catch(e) {failures.push(`Browser check failed: ${bounded((e as Error).message)}`);}
  finally {
    if(page) {
      finalUrl=page.url();
      try {await page.screenshot({path:path.join(directory,'browser.png'),fullPage:true,timeout:10_000});screenshot=true;}
      catch{warnings.push('Full-page screenshot could not be saved');}
    } else warnings.push('Screenshot unavailable because no browser page was created');
    if(pageErrors.length)failures.push(...pageErrors.map(e=>`pageerror: ${e}`));
    if(consoleErrors.length) (config.failConsole?failures:warnings).push(...consoleErrors.map(e=>`console.error: ${e}`));
    let finalOrigin='';try{finalOrigin=new URL(finalUrl).origin;}catch{/* navigation already failed */}
    for(const resource of resources) {
      const critical=['document','script','stylesheet'].includes(resource.resourceType);
      let same=false;try{same=new URL(resource.url).origin===finalOrigin;}catch{/* malformed resource URL */}
      const detail=`${resource.resourceType} ${resource.status?`HTTP ${resource.status}`:resource.error}: ${resource.url}`;
      if(critical && same)failures.push(detail);else warnings.push(detail);
    }
    if(eventsTruncated)warnings.push('Browser event list truncated after 200 entries per category');
    if(context && traceStarted) {
      try {
        const keep=config.trace==='always'||(config.trace==='on-failure'&&failures.length>0);
        await context.tracing.stop(keep?{path:path.join(directory,'trace.zip')}:{});trace=keep;
      }catch{warnings.push('Playwright trace could not be saved');}
    }
    if(context)await context.close().catch(()=>warnings.push('Browser context cleanup failed'));
  }
  checks.push({id:'browser',status:failures.length?'fail':warnings.length?'warn':'pass',blocking:failures.length>0,meaningful:true,details:failures.length?failures.join('; '):warnings.length?warnings.join('; '):'Chromium navigation, runtime and rendered content checks passed',data:{finalUrl,title,mainStatus,textLength,expectMatched,profile:config.profile,pageErrors,consoleErrors,resources,failures,warnings,screenshot,trace,durationMs:Math.round(performance.now()-start)}});
  // Preserve nonblocking gaps even when the Browser check is blocking.
  if(failures.length && warnings.length)checks.push({id:'browser-warnings',status:'warn',blocking:false,meaningful:false,details:warnings.join('; ')});
  return checks;
}
