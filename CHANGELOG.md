# 更新日志

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
