# 更新日志

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
