import { Check } from './types.js';
// Presentation only: canonical JSON, commands and captured evidence stay unchanged.
const messages:Record<string,string>={
  'Disabled by configuration':'已按配置关闭',
  'Browser check disabled':'未启用浏览器检查',
  'No real test: npm placeholder script discovered':'没有真实测试：发现 npm 默认占位脚本',
  'No meaningful verification was executed':'未执行任何有意义的验证',
  'Committed, staged, unstaged and untracked changes inspected after project scripts':'已在项目脚本执行后检查已提交、已暂存、未暂存和未跟踪的修改',
  'Committed diff base is unavailable or unreliable; staged, unstaged and untracked changes were still inspected. Fetch full history and provide --base.':'无法可靠确定已提交修改的比较基准；仍检查了暂存区、工作区和未跟踪文件。请获取完整历史并提供 --base。',
  'Chromium navigation, runtime and rendered content checks passed':'Chromium 页面导航、运行时和渲染内容检查通过',
  'Navigation did not return a main document response':'页面导航未返回主文档响应',
  'Visible body text is empty':'页面可见正文为空',
  'Expected case-sensitive substring is missing from visible body text':'页面可见正文未包含指定文本（区分大小写）',
  'Full-page screenshot could not be saved':'无法保存全页截图',
  'Screenshot unavailable because no browser page was created':'未创建浏览器页面，无法生成截图',
  'Trace recording could not start':'无法开始录制浏览器跟踪',
  'Playwright trace could not be saved':'无法保存 Playwright 跟踪文件',
  'Browser context cleanup failed':'浏览器上下文清理失败',
  'Browser event list truncated after 200 entries per category':'浏览器事件的详细记录按类别截断到 200 条；关键失败仍继续检测',
  'Browser inspection timed out':'浏览器页面检查超时',
  'Node.js >=20 required':'需要 Node.js >=20',
  'npm is unavailable':'npm 不可用',
  'Cannot read GitHub event payload':'无法读取 GitHub 事件数据',
  'Invalid Git base ref':'Git 比较基准引用无效',
  'Missing PR base/head SHA':'缺少 PR 的 base/head SHA',
  'Push before SHA is missing or zero':'Push 的 before SHA 缺失或全为零',
  'Remote default branch is unavailable':'无法确定远程默认分支',
  'Committed base is unavailable':'已提交修改的比较基准不可用',
  'Explicit --base cannot be resolved with available Git history':'无法根据现有 Git 历史解析指定的 --base',
  'changedFiles requires a reliable committed diff base; fetch full history or pass --base':'changedFiles 需要可靠的比较基准；请获取完整历史或指定 --base',
  'Requirement path must be a non-empty relative file path':'文件要求必须是非空的相对文件路径',
  'Requirement paths must be repository-relative POSIX paths':'文件要求必须使用相对仓库根目录的 POSIX 路径',
  'Path traversal and glob patterns are not supported':'不支持路径越界或 glob 通配符',
  'Requirement must name an exact file':'文件要求必须指定精确文件路径',
  'Isolated Playwright installation failed':'隔离安装 Playwright 失败',
  'Isolated Chromium installation failed':'隔离安装 Chromium 失败',
  'working-directory must be within GITHUB_WORKSPACE':'working-directory 必须位于 GITHUB_WORKSPACE 内',
  'Repository root must be within GITHUB_WORKSPACE':'仓库根目录必须位于 GITHUB_WORKSPACE 内',
  'Evidence invocation directory already exists':'本次调用的证据目录已存在',
  'Evidence root cannot be a symlink':'证据根目录不能是符号链接',
  'Evidence runs directory cannot be a symlink':'证据 runs 目录不能是符号链接',
  'Refusing to replace an external latest symlink':'拒绝替换指向外部的 latest 符号链接',
  'Evidence publication locked; after stopping all checks, remove .aidonecheck/.latest-lock and retry':'证据发布锁未释放；确认所有检查已停止后，删除 .aidonecheck/.latest-lock 再重试',
  'Latest report is missing, unreadable or damaged; run aidonecheck check first':'最近报告不存在、无法读取或已损坏；请先运行 aidonecheck check',
  'config.version is required and must equal 1':'配置必须包含 version，且值为 1',
  'Invalid browser.profile':'browser.profile 必须为 desktop 或 mobile',
  'Invalid browser.trace':'browser.trace 必须为 off、on-failure 或 always',
  'browser.url must be an absolute http/https URL without credentials':'browser.url 必须是无用户名和密码的绝对 http/https URL',
  'Refusing to overwrite a symlink config':'拒绝覆盖符号链接形式的配置文件',
  '.aidonecheck.json already exists; use init --force to overwrite':'.aidonecheck.json 已存在；需要覆盖时请使用 init --force',
  'Unknown command; use --help':'未知命令；请使用 --help 查看帮助',
  '--base requires a ref':'--base 后必须提供 Git 引用',
  'Cannot locate npm-cli.js on Windows':'在 Windows 上找不到 npm-cli.js',
  'Cannot parse/read package.json':'无法读取或解析 package.json',
  'Chromium is missing':'未安装 Chromium',
  'Chromium is missing; install the pinned Playwright Chromium runtime':'未安装 Chromium；请安装指定版本的 Playwright Chromium',
  'Chromium could not launch; check runtime/system dependencies (environment error)':'Chromium 无法启动；请检查运行环境和系统依赖（环境错误）',
  'Artifact service returned no artifact ID':'产物服务未返回 Artifact ID'
};
export function displayMessage(message:string):string {
  if(Object.hasOwn(messages,message))return messages[message]!;
  const prefix:[string,string][]=[
    ['Symlink escapes repository: ','符号链接指向仓库外部：'],['Cannot safely resolve symlink: ','无法安全解析符号链接：'],
    ['Unknown config field: ','未知配置字段：'],['Duplicate option: ','重复选项：'],
    ['pageerror: ','页面未捕获错误（pageerror）：'],['console.error: ','控制台错误（console.error）：'],
    ['Main document HTTP ','主文档 HTTP 状态码：']
  ];
  for(const [from,to] of prefix)if(message.startsWith(from))return to+message.slice(from.length);
  for(const [from,to] of [['Invalid .aidonecheck.json: ','.aidonecheck.json 配置无效：'],['Navigation / page inspection failed: ','页面导航或检查失败：'],['Browser check failed: ','浏览器检查失败：']] as const)if(message.startsWith(from))return to+displayMessage(message.slice(from.length));
  let m=message.match(/^Same-origin critical resource failure events omitted from detailed evidence: (\d+) \(document\/script\/stylesheet\)$/);
  if(m)return `详细记录之外仍检测到 ${m[1]} 条同源关键资源失败事件（文档、脚本或样式表）`;
  m=message.match(/^(\S+) script not found$/);if(m)return `未发现 ${m[1]} 脚本`;
  m=message.match(/^(.+) must be (an object|boolean|string|an array)$/);if(m)return `${m[1]} 必须是${({'an object':'对象',boolean:'布尔值',string:'字符串','an array':'数组'} as Record<string,string>)[m[2]!]}`;
  m=message.match(/^Git (\S+) failed: repository or history unavailable$/);if(m)return `Git ${m[1]} 失败：仓库或历史不可用`;
  m=message.match(/^Invalid option for (\S+): (.*)$/);if(m)return `${m[1]} 不支持选项：${m[2]}`;
  m=message.match(/^Cannot start (.*): (.*)$/s);if(m)return `无法启动 ${m[1]}；原始错误：${m[2]}`;
  m=message.match(/^Playwright (\S+) required; found (.*)$/);if(m)return `需要 Playwright ${m[1]}，实际发现 ${m[2]}`;
  m=message.match(/^Playwright (\S+) is unavailable; install the optional isolated browser runtime described in README$/);if(m)return `Playwright ${m[1]} 不可用；请按 README 安装可选的隔离浏览器运行环境`;
  m=message.match(/^(document|script|stylesheet|image|font|fetch|xhr|media|other) (.*): (https?:.*)$/s);
  if(m){const types:Record<string,string>={document:'文档',script:'脚本',stylesheet:'样式表',image:'图片',font:'字体',fetch:'fetch',xhr:'XHR',media:'媒体',other:'其他'};return `${types[m[1]!]}请求失败（${m[2]}）：${m[3]}`;}
  return message; // Unrecognized external errors and captured messages stay verbatim.
}
export function checkName(id:string):string {
  const names:Record<string,string>={git:'Git 修改',test:'测试',lint:'代码规范',typecheck:'类型检查',build:'构建',browser:'浏览器','browser-warnings':'浏览器警告',verification:'验证覆盖'};
  if(Object.hasOwn(names,id))return names[id]!;
  if(id.startsWith('changedFiles:'))return '指定修改：'+id.slice(13);
  if(id.startsWith('requiredFiles:'))return '必需文件：'+id.slice(14);
  return id;
}
export function checkDetails(c:Check,checks:Check[]=[]):string {
  if(c.command&&c.result){const r=c.result;return r.timedOut?`${c.command} 执行超时`:c.status==='pass'?`${c.command} 执行通过`:`${c.command} 执行失败，退出码 ${r.exitCode??'无'}${r.signal?`，信号 ${r.signal}`:''}`;}
  if(c.id.startsWith('changedFiles:'))return `${c.status==='pass'?'已在可靠 Git diff 中确认修改':'可靠 Git diff 中未发现要求的修改'}：${c.id.slice(13)}`;
  if(c.id.startsWith('requiredFiles:'))return `${c.status==='pass'?'必需文件存在':'必需文件不存在或不是普通文件'}：${c.id.slice(14)}`;
  if(c.id==='browser'||c.id==='browser-warnings'){
    const data=c.data??checks.find(x=>x.id==='browser')?.data;
    const values=c.id==='browser-warnings'?data?.warnings:c.blocking?data?.failures:data?.warnings;
    if(Array.isArray(values)&&values.length)return values.map(v=>displayMessage(String(v))).join('；');
  }
  return displayMessage(c.details);
}
