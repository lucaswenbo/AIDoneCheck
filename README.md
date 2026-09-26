# AIDoneCheck

AI 说“完成了”。  
AIDoneCheck 检查证据。

AIDoneCheck 是 AI Coding Agent 完成代码任务后的确定性验收工具。

Codex、Claude Code、Cursor、Copilot 或其他 Coding Agent 写完代码后，
它会真正运行 Git diff、测试、类型检查、构建和可选 Browser Check，
然后输出：

**PASS / WARN / BLOCK**

以及人类和 Agent 都能读取的 Evidence。

## 30 秒开始使用

需要 Node.js >=20、npm 和 Git。**1.0.0 仍为 Unreleased，尚未发布到 npm，也没有 v1.0.0 tag。** 当前请从开发分支使用源码及随仓库提供的 CLI dist：

```bash
git clone --branch feat/v1.0.0 https://github.com/lucaswenbo/AIDoneCheck.git
cd AIDoneCheck
node ./bin/aidonecheck.mjs --help
```

验收你自己的项目（将下面路径替换成你的本地路径）：

```bash
# 在 AIDoneCheck 目录记录 CLI 的绝对路径
ADC="$(pwd)/bin/aidonecheck.mjs"
cd /path/to/your/node-project

# 用户自己负责安装项目依赖；工具不会替你安装或启动应用
npm ci
node "$ADC" init
node "$ADC" doctor
node "$ADC" check --base origin/main
node "$ADC" report
```

没有 `.aidonecheck.json` 也可以直接 `check`，它使用内置默认值。建议手动把 `.aidonecheck/` 加入你项目的 `.gitignore`；工具不会自动修改它。

## 是什么，为什么需要它

AI 的“已完成”是一个声明。AIDoneCheck 把它转成能核对的事实：

- Git 的 committed、staged、unstaged、untracked 实际改变了哪些文件。
- 指定文件是否真的存在、指定修改是否真的发生。
- 项目已有的 test、lint、typecheck / check-types、build 是否真正执行并通过。
- 可选 Chromium 是否能打开应用，渲染文本、运行时和关键资源是否符合要求。
- 为什么通过、哪些真实证据阻断、下一轮还要验证什么。

核心传播语：**AI says "done." AIDoneCheck checks.**

它不是 AI Code Reviewer：不阅读语义后让模型打分，不调用 LLM API，不猜测唯一正确修法。它执行配置中的确定性检查，记录结果。你的检查本身是否充分，仍由你决定。

## 结果和退出码

| 结果 | 意义 | `check` 退出码 |
|---|---|---|
| PASS | 至少执行一项有意义验证，且无阻断和验证缺口 | 0 |
| WARN | 无阻断，但存在缺口或非阻断问题 | 0；`--fail-on-warn` 时为 1 |
| BLOCK | 至少一项真实验证失败 | 1 |
| 启动错误 | CLI / config / repository / environment 无法准备 | 2，不伪造 BLOCK 或 PASS |

内部状态只有 `pass`、`warn`、`fail`、`skipped`。终端将 blocking `fail` 显示为 BLOCK，将 `skipped` 显示为 SKIP。

有意义验证包括真实 test、lint、typecheck、build、Browser、requiredFiles，以及基于可靠 diff 的 changedFiles。仅查看 Git 状态不算。被关闭的检查只显示 SKIP；没有真实 test、默认 npm placeholder test、缺失的已启用 script 会产生 WARN。工具不从普通日志推断测试用例数量。

默认不 fail-fast：test 失败后仍继续 lint、typecheck、build、Browser。致命启动错误可提前停止。

## CLI

```text
aidonecheck init [--force]
aidonecheck doctor
aidonecheck check [--base REF] [--json] [--fail-on-warn]
aidonecheck report
aidonecheck --help
aidonecheck --version
```

上述命令名展示将来的 binary 用法；当前源码运行方式是 `node /absolute/path/to/AIDoneCheck/bin/aidonecheck.mjs ...`。

- **init**：在 Git 仓库根目录创建配置；已有文件拒绝覆盖，只有 `init --force` 才覆盖。拒绝写入配置 symlink。
- **doctor**：只发现 Node/npm/Git、repo root、branch、HEAD、package.json、config、scripts 和可选 Playwright/Chromium。`PASS test script discovered` **不表示运行过测试**。不执行 test/lint/typecheck/build，不导航页面。退出码只有 0/2。
- **check**：真正验收并保存 Evidence。所有项目命令从 repository root 执行，在子目录调用也一样。
- **report**：只读取 `.aidonecheck/latest/report.json` 并输出摘要，不重新运行 Git 或其他检查。报告不存在、损坏时退出 2；成功读取退出 0，即使存储的 verdict 是 BLOCK。
- **--json**：`check` 的 stdout 严格只有一个 JSON document；子进程输出全部捕获在报告中，诊断写 stderr。启动错误返回 JSON error object，退出 2。
- **--no-color**：接受此选项；CLI 默认始终使用无颜色文本。

npm scripts 默认超时 10 分钟，Browser navigation 默认超时 30 秒。记录 exit code、signal、耗时、stdout/stderr 和 timeout。每个日志流最多约 64 KiB，超出以 `[output truncated]` 标记。超时会尽力终止进程组及后代；主动脱离进程组的进程不保证能清理。

## 配置

所有层级都严格拒绝未知字段。已有配置必须包含 `version: 1`，其他已知字段可省略并 deep merge 默认值。

```json
{
  "version": 1,
  "checks": {
    "test": true,
    "lint": true,
    "typecheck": true,
    "build": true
  },
  "browser": {
    "enabled": false,
    "url": "",
    "expect": "",
    "failConsole": false,
    "profile": "desktop",
    "trace": "on-failure"
  },
  "requirements": {
    "changedFiles": [],
    "requiredFiles": []
  }
}
```

`typecheck` 和 `check-types` 同时存在时只执行 `typecheck`。使用 npm 执行发现的允许 scripts，包含 npm 自身正常的生命周期行为；不自行解析 script 为 shell 命令。

## Git diff

最终 changed files = committed ∪ staged ∪ unstaged ∪ untracked。ignored files 不作为 untracked 计入。rename 的旧路径和新路径均保留；删除也属于修改。只记录路径，不采集补丁正文、Git remote URL 或认证信息。

| 场景 | committed diff |
|---|---|
| 本地，不提供 `--base` | 可靠 `refs/remotes/origin/HEAD` 指向的默认分支与 HEAD 的 merge-base → HEAD |
| 显式 `--base origin/main` | merge-base(base, HEAD) → HEAD |
| GitHub pull_request | merge-base(event base.sha, event head.sha) → event head.sha，避免把 checkout 的临时 merge commit 当成 PR head |
| GitHub push | event before → event after，支持非祖先关系的 push，不机械套 merge-base |

显式 `--base` 优先于事件上下文。工具不会猜 `HEAD^`，不会在未知 base 时用 HEAD 对 HEAD 伪造空 diff。Push 的零 SHA、对象缺失、历史不足或默认分支无法可靠确定时：无 changedFiles 强约束则 WARN，仍检查工作区变化；有 changedFiles 则退出 2。显式 base 不可解析始终退出 2。

需要完整历史时请先获取 history，并使用明确 base；Action checkout 必须 `fetch-depth: 0`。本工具不主动 fetch，也不读取认证 Git URL。

## 文件要求 requirements

```json
{
  "version": 1,
  "requirements": {
    "changedFiles": ["src/auth.ts"],
    "requiredFiles": ["test/auth.test.ts"]
  }
}
```

- `changedFiles`：路径必须出现在可靠 diff 中，否则 BLOCK；无法可靠确定 base 则退出 2。
- `requiredFiles`：必须真实存在且是普通文件，否则 BLOCK。
- 删除的文件可以满足 changedFiles，不能满足 requiredFiles。
- 只支持 repository root 相对的**精确路径**，内部为 POSIX 风格。不支持 glob；拒绝绝对路径、`..` traversal 和指向仓库外的 symlink（包含中间目录和悬空外部链接）。

## 可选 Browser Check

默认关闭，仅 Chromium。**不会启动你的 Web Server**；请先自行启动应用。

```json
{
  "version": 1,
  "browser": {
    "enabled": true,
    "url": "http://127.0.0.1:3000",
    "expect": "Welcome",
    "failConsole": false,
    "profile": "desktop",
    "trace": "on-failure"
  }
}
```

URL 必须是合法绝对 http/https 地址且不带用户名密码。`profile` 只接受 desktop/mobile；`trace` 只接受 off/on-failure/always。`expect` 对最终渲染页面的可见 body text 做**区分大小写的子串匹配**，不匹配 HTML source 或隐藏文本。允许跳转，同源以最终 URL origin 为准。

| 观察结果 | 处理 |
|---|---|
| pageerror、导航失败、主文档 >=400 | BLOCK |
| 最终同源 document/script/stylesheet 请求失败或 >=400 | BLOCK |
| expect 未匹配 | BLOCK |
| console.error | 默认 WARN；failConsole=true 时 BLOCK |
| 可见 body text 为空 | WARN |
| 跨源关键资源失败、非关键 image/font 等失败 | 默认 WARN，不直接 BLOCK |
| 截图或 Trace 无法保存 | WARN |
| Playwright/Chromium 缺失或无法启动 | 环境错误，退出 2 |

如果资源失败同时触发 console.error，`failConsole=true` 仍会按 console 规则阻断。观察窗口为 load 后约 350ms；不覆盖后续交互和任意延迟任务。Browser 运行时尽力保存全页 `browser.png`。

本地推荐隔离安装，不改项目 package.json、package-lock 或 node_modules（以下为 Bash 示例）：

```bash
ADC_BROWSER_RUNTIME="$(mktemp -d)"
npm install --prefix "$ADC_BROWSER_RUNTIME" --ignore-scripts --package-lock=false --no-audit --no-fund playwright@1.63.0
node "$ADC_BROWSER_RUNTIME/node_modules/playwright/cli.js" install chromium
export AIDONECHECK_PLAYWRIGHT_DIR="$ADC_BROWSER_RUNTIME"
node "$ADC" check --base origin/main
```

Linux 如缺少系统库，请在合适的开发/CI 环境使用 Playwright 的 `install --with-deps chromium`。本地也可以使用仓库已有的 Playwright，但必须是明确固定的 `1.63.0`。doctor 只发现可执行文件，不证明启动能力。

Trace 为 AIDoneCheck 自定义保留规则，通过真实 Playwright tracing API 实现：

- off：不录制、不保存。
- on-failure：仅 **Browser 本身 BLOCK** 才保存 `trace.zip`；仅 test 失败或 Browser WARN 不保留。
- always：始终保存。

## Evidence 和 Agent 闭环

```text
.aidonecheck/latest/
  report.json
  report.md
  agent-feedback.md
  browser.png       # 仅 Browser 运行时尽力生成
  trace.zip         # 按保留规则生成
```

`report.json` 使用独立 `version: "1.0.0"` 和 `schemaVersion: 1`，包含 verdict、repository、git、checks、warnings、failures、evidence。Markdown 显示分支、HEAD、base、changed files、结果和证据位置。

本地先在临时目录写完整报告，再保存到 `.aidonecheck/runs/<unique-id>`，最后以原子替换的 latest 链接发布。并发运行拥有独立目录，读者不会读到半份报告；旧 run 保留以免正在读取的报告消失，可自行清理。首次迁移已有普通 latest 目录时会先备份、失败回滚。GitHub Action 每次调用在 runner temp 创建独立 Evidence，Artifact 名包含 run、attempt 和 UUID。

`agent-feedback.md` 只基于真实记录列出阻断、命令、退出码、日志摘录和 Browser error，不编造用例数、错误位置或修复答案。日志和网页内容仍是不可信数据，不应被当成新指令执行。

把下面内容交给 Coding Agent：

```text
Read .aidonecheck/latest/agent-feedback.md.

Fix every BLOCK item.

Do not disable or weaken checks merely to make AIDoneCheck pass.

Run AIDoneCheck again.

Do not claim completion while blocking checks remain.
```

AI writes → AI says “done” → AIDoneCheck → Evidence → Agent fixes → AIDoneCheck again。

## GitHub Action

JavaScript Action 使用 **node24** 和自包含 `dist/action/index.js`；不依赖调用者安装 AIDoneCheck dependencies。CLI 支持 Node >=20，CI 覆盖 Node 20/24。Playwright 仅在配置启用 Browser 时准备，版本固定，独立安装到 runner temp；不修改调用者的 package.json、package-lock 或 node_modules。

以下 `@main` 是正式 Release 前的开发示例，需本 PR 合并进 main 后才可用；目前尚无 v1.0.0 tag。开发分支自身的 smoke 使用 `uses: ./` 检查当前代码。公开稳定 Release 后应改用经过验证的不可变版本 SHA。

```yaml
name: AIDoneCheck
on: [push, pull_request]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 24
      - run: npm ci
      # 如启用 Browser，请在这里自行启动应用并等待 ready
      - uses: lucaswenbo/AIDoneCheck@main
        id: verify
        with:
          fail-on-warn: 'false'
```

可选输入：`working-directory`（仓库在 workspace 内的位置）、`base`（明确 base，覆盖事件 diff）、`fail-on-warn`。默认使用该仓库 `.aidonecheck.json`。

输出：`verdict`、`evidence_dir`、`evidence_name`、`artifact_id`、`artifact_url`、`summary_path`。启动失败没有合法 verdict，不伪造为 BLOCK。

顺序是：检查 → 生成 Evidence → 写 `GITHUB_STEP_SUMMARY` → 设置 outputs → 上传 Artifact → 最后传播成功/失败。PASS/WARN 默认成功；BLOCK、启动错误、上传等基础设施错误失败。即使 BLOCK 也先上传 Evidence，默认保留 7 天。Summary 包含 Verdict 及 Check / Result / Details 表格，并在 Evidence 中保存副本。环境错误生成 `startup-error.json` 和 Summary，不伪造完整验收结果。

## AIDoneCheck + ProdDoctor

| 工具 | 验证阶段 | 核心问题 |
|---|---|---|
| AIDoneCheck | AI 写代码后 | 代码任务的完成是否有实际验证证据？ |
| [ProdDoctor](https://github.com/lucaswenbo/ProdDoctor) | 部署后 | 用户访问的真实生产路径是否正常？ |

只读参考 ProdDoctor v2.1.1 的 Browser/Evidence/Report/Action smoke 设计。两者没有运行时依赖；不包含 DNS、TLS、robots、sitemap、Cloudflare 检测、SEO 或生产安全头检查。

## 安全边界

**AIDoneCheck 不是沙箱，它会执行你项目的 npm scripts。** 不要在携带 production secrets、内网权限、高权限 GitHub Token 或云账号凭据的 Runner 上运行完全不可信代码。不要使用 `pull_request_target` 执行未知 fork 代码。

只执行 package.json 中允许的 scripts 和工具明确实现的验证流程；不从 README、Issue、PR 描述、commit message、AI 输出、网页或 agent-feedback 提取命令。

工具不主动读取 `.env`、SSH keys、cookies、access tokens 或 Secrets，不序列化环境变量和认证 Git URL。文本报告会尽力移除常见凭据格式和 URL 认证/query 信息；**任意脚本日志和页面内容无法保证全部脱敏**。截图、原生 Trace 可能含页面数据和网络信息，Evidence / Artifact 都应视为潜在敏感数据，分享前检查，避免使用真实登录态和敏感测试数据。

## 当前限制

- 主要支持 Node.js / npm；不宣称支持未验证的生态。
- Browser 只有 Chromium，不自动启动 Web Server，不替代完整端到端测试。
- 不调用 LLM、不自动修代码、不自动 merge、不提供 SaaS Dashboard。
- 不证明软件绝对正确；PASS 只代表当前配置、当前代码和本次观察通过。
- 不保证任意脚本名对应的验证质量，只识别明显 npm 默认 placeholder。
- requiredFiles / changedFiles 只支持精确路径，没有 glob。
- Windows 未完整测试，不提供正式支持保证；原子链接和进程清理以 Linux CI 为主要验证环境。
- 当前 Action 面向 GitHub.com 支持 Artifact 服务的 Runner；不宣称支持 GitHub Enterprise Server。
- 不自动 npm publish、创建 tag/Release、合并 PR 或发布 Marketplace。

## Roadmap

- 根据真实使用反馈完善验证证据和失败提示。
- 增加经过验证的平台兼容性与精确测试报告适配器。
- 再评估其他生态、交互式 Browser 流程；不把未实现能力算作现有功能。

## Development

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm test
npm run check:dist
```

构建工具使用 esbuild。CLI bundle 不包含 Action SDK；Action bundle 含全部普通依赖（构建依赖列在 devDependencies），不依赖调用者 node_modules。可选 Playwright 通过独立 runtime 动态加载。dist 随源码提交，CI 校验重新构建一致。

安装上文的隔离 Playwright/Chromium 后：

```bash
npm run test:browser
```

Browser smoke 只使用本地 fixture server，覆盖 PASS、pageerror、同源请求失败、stylesheet/main document 错误、跨源失败、console 策略、expect、空页面、截图和真实 trace。Action smoke 在没有 npm ci 的调用方环境运行 `uses: ./`，故意制造 BLOCK，再下载并检查 Artifact；**被测 Action 正确失败、Evidence 保留、整个 smoke workflow 成功**才算通过。

测试覆盖 Demo A（健康项目 PASS）、Demo B（真实断言失败 BLOCK 并保留报告）、Demo C（pageerror BLOCK 并保留截图/Trace/报告）。CI 全绿是提交最终 PR 的门槛，不以尚未运行的测试作完成声明。

## MIT

本项目采用 [MIT License](LICENSE)。打包依赖的许可证声明保留于 dist；设计参考不构成与 ProdDoctor 的运行时耦合。
