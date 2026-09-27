# 点击复现 AIDoneCheck 的真实检查

不需要你的网站、Cloudflare、API Key 或额外 Secrets。演示在 GitHub Runner 内创建临时 Node.js/npm 项目、独立 Git 历史和本地 HTTP server，真正执行测试、TypeScript 类型检查、构建及 Chromium。

[打开演示和运行记录](https://github.com/lucaswenbo/AIDoneCheck/actions/workflows/demo.yml) · [Fork 本仓库](https://github.com/lucaswenbo/AIDoneCheck/fork)

## 先看已经完成的结果

1. 打开上面的演示页面，选择一次已完成的运行。
2. 在 Summary 查看每个场景的“预期 / 实际记录 / 演示断言”，再打开对应 job 的执行日志。
3. 页面底部 Artifacts 或 Summary 的 Evidence 链接可下载报告；GitHub 要求先登录才能下载。
4. 每个场景单独保存 Evidence。Browser 场景含 browser.png 和真实 trace.zip；所有文件上传后又从 GitHub 下载并逐个核对 SHA-256。

Artifact 默认保留 7 天，过期后可以重跑；日志和仓库中的 fixture 保留用于复现。没有取得报告、启动失败或下载失败都会让演示断言失败，不会写成“验证成功”。

## 自己点击运行

**仓库所有者或有写权限的协作者：**

1. 打开 **Actions → AIDoneCheck 可复现演示**。
2. 点击 **Run workflow**，分支选 `main`，再点击 **Run workflow**。
3. 等待六个场景结束，查看 Summary、日志和 Artifacts。

**其他访客：**

1. 点击 **Fork**，把 AIDoneCheck 复制到自己的 GitHub 账号；保留 main 即可。
2. 进入自己 fork 的 **Actions**，如有提示，确认启用工作流。
3. 选择 **AIDoneCheck 可复现演示 → Run workflow → main → Run workflow**。

GitHub 的手动运行需要仓库写权限，因此陌生访客不能直接在上游仓库启动任务。Fork 后的演示使用 `uses: ./`，运行自己选定提交中的源码对应 dist，**不会跳回上游 main**。发布程序只允许上游仓库发布；运行 fork 演示不需要开写权限或新增 Secrets。

正常接入你自己的产品，仍推荐 README 的固定版本 `lucaswenbo/AIDoneCheck@v1.0.1`。演示工作流中的 `uses: ./` 是为了验证当前仓库提交及方便 fork 复现，和产品接入用途不同。

## 六个场景

| 场景 | 真实操作 | 应得到的结果 | 证据重点 |
|---|---|---|---|
| healthy | 把未完成的加法函数改成正确实现 | PASS | test / typecheck / build、changedFiles / requiredFiles 都通过 |
| no-tests | 只保留 npm 默认 placeholder test | WARN | 不冒充运行过真实测试；其他检查照常执行 |
| test-failure | 故意把加法写成减法 | BLOCK | 真实断言、exit code 1、后续类型检查和构建继续 |
| pageerror | 本地页面抛出未捕获 JavaScript 错误 | BLOCK | pageerror、browser.png、trace.zip、agent-feedback.md |
| resource-overflow | 205 个跨源脚本失败后，同源脚本再返回 404 | BLOCK | 前 200 条详细记录之外的关键失败仍被检测、保留 Trace |
| unsafe-path | 项目脚本创建指向仓库外的 symlink | 启动/路径错误 | Action failure、startup-error.json、Summary；没有伪造 verdict |

`ERROR` 是演示表里对启动/路径错误的说明，不是 AIDoneCheck 的第四种 Verdict；CLI 对应退出码 2。它没有完成验收，因此没有正常 report.json，Action 保存独立错误证据。

演示 fixture 没有 lint，所以显式关闭 lint；其他验证不会为变绿而关闭。健康场景同时要求源文件确实修改、构建产物确实存在。源码中最初的 `return 0` 是故意设置的任务基线，不是 AIDoneCheck 的产品实现。

## 为什么有 BLOCK，整个演示却是绿色？

故障由 fixture 故意注入。被测试的 Action 必须实际失败；工作流使用 `continue-on-error` 继续收集证据，然后断言 **真实 outcome、实际 verdict、具体失败原因和 Artifact 内容**。

- 应当 BLOCK 却得到 PASS/WARN：演示失败。
- 应当 PASS 却失败：演示失败。
- 缺报告、缺截图/Trace、没有 Artifact 或下载内容不符：演示失败。
- 故障被正确阻断，证据完整：演示成功，但故障本身没有被修复。

这与生产接入不同。README 的正式接入示例不使用 `continue-on-error`，BLOCK 会阻止验证步骤通过。

## 这次修复的两个真实问题

1. v1.0.0 只保存前 200 条 Browser 资源失败，也只根据这 200 条判断严重性；后来的同源关键资源错误可能被漏掉。v1.0.1 保留详细记录上限，同时单独累计被省略的关键失败事件，按最终 origin 判定。
2. v1.0.0 只在执行项目脚本前校验 changedFiles 路径；脚本随后创建外部 symlink 时，可能错误地 PASS。v1.0.1 在脚本结束后重新校验，拒绝越界路径。

这不是任意不可信代码的沙箱，也不保证软件绝对正确。演示只证明这些具体行为；不使用真实登录态、生产数据或生产网站。

工作流：[.github/workflows/demo.yml](../.github/workflows/demo.yml)；项目 fixture：[demo/fixture](../demo/fixture)；场景断言：[scripts/assert-demo.mjs](../scripts/assert-demo.mjs)。

GitHub 规则参考：[手动运行工作流](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)、[下载 Artifact](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)。
