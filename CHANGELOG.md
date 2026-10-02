# 更新日志

## 1.0.3 - 2026-10-02

- 修复 Windows 第二次验收替换 latest 目录链接时的 EPERM；串行切换并在失败时恢复旧报告。
- 为 Windows Node 20/24 增加重复 PASS/BLOCK/PASS、并发报告、失败回滚和实际安装包回归验证。
- 新增 npm CLI 分发与固定版本的一行安装入口；保留 GitHub Release 安装包、校验摘要和 Action tags。
- npm 发布使用已经公开验证的同一份 Release 安装包，支持 Trusted Publishing 和相同摘要的安全重试；发布后实际安装验证。

## 1.0.2 - 2026-09-27

- 修复演示中工具英文报告与中文说明混杂的问题：终端、Markdown 报告、Job Summary 和 Agent 反馈说明统一中文。
- 只本地化展示层；保持 JSON 字段、状态、真实命令与原始日志不变。
- 公开演示入口改为独立的 AIDoneCheck-Test，主仓库保留发布前回归测试。
- 加入中文标题、占位测试警告、浏览器失败、路径错误及日志保真回归测试。

## 1.0.1 - 2026-09-27

- 修复 Browser 资源错误记录超过 200 条后，后续同源关键资源失败被漏判为 WARN 的问题；日志限额不再限制失败检测。
- 修复项目脚本新建外部 symlink 后，changedFiles 仍可能得到 PASS 的问题；执行后重新验证路径安全。
- 新增六场景中文可复现演示，可在 Actions 手动运行；每个场景都验证实际结论、报告、上传并下载的 Artifact。
- 为两项修复加入回归测试；发布须通过 Test、Browser smoke、Action smoke 与公开演示四条工作流。
- 固定版本升级为 v1.0.1；v1.0.0 保持不变。

## 1.0.0 - 2026-09-27

- 新增确定性代码任务验收 CLI：init、doctor、check、report。
- 检查可靠 Git diff、精确文件要求，以及实际 npm scripts 执行结果。
- 可选 Chromium 页面检查、真实截图和 Playwright Trace。
- 输出 PASS / WARN / BLOCK 和 JSON、Markdown、Agent feedback Evidence。
- Node 24 自包含 GitHub Action；先保存报告、Summary 和 Artifact，再传播失败。
- 增加 Node 20/24、Browser fixtures、Action BLOCK Evidence 自动化测试。

- 修复脚本删除/恢复文件后仍沿用旧文件要求和 diff 的问题。
- 加入实际 CLI 发布包独立安装测试与 main 精确提交发布验证。
- 发布固定版本 v1.0.0、浮动 v1、中文 Release notes、安装包和校验摘要。
