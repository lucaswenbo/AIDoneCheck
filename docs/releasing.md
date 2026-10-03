# AIDoneCheck 发布说明

用户应优先使用固定版本 `v1.0.4`；希望自动跟随兼容更新时使用 `v1`。`main` 是开发分支。具体版本 tag 按流程不移动；浮动主版本 tag 只指向已发布的稳定版本。仓库是否强制禁止修改 tag，取决于另外配置的 GitHub 规则，不应混为一谈。

## 当前发布方式

提供具体版本、浮动主版本和 GitHub Release CLI。采用**维护者提交版本 PR，CI 通过后自动发布**：没有依赖额外 GitHub PAT，不自动合并，不自动提升版本号。npm registry 分发暂缓，自动发布默认关闭；准备好的 npm 分发方式不替换 Release。

这个仓库的 GitHub Release 包含可直接安装的 CLI `.tgz` 和 SHA256SUMS.txt；GitHub Action 直接通过 tag 引用仓库中自包含的 dist。

## 日常修改和版本

- 修改通过 PR，修复建议 `fix:`、新功能建议 `feat:`，破坏性变化明确说明。
- 正式发布前由维护者选择版本：修复 patch、新能力 minor、不兼容变化 major。
- 普通 docs/test/chore 变动可不发布新版本。main 前移但版本未变时，发布流程不会覆盖旧版本。
- 第一版为 1.0.0；后续每次只递增一个对应级别。

准备新版本时在同一个 PR 更新：

1. package.json 和 package-lock.json 的版本。
2. src/types.ts 的工具版本（schemaVersion 保持独立）。
3. README、examples 和 release.yml 公共消费验证中的固定版本引用。
4. CHANGELOG 的版本和日期。
5. docs/releases/<版本>.md 的中文发布说明。
6. `npm run build` 生成的 dist。

执行 `npm run license:check` 和 `npm run release:check`，再正常提交 PR。发布检查会强制要求根项目、lockfile、README、LICENSE、NOTICE 与打包内容保持 Apache-2.0 一致。使用 squash 合并，保留有意义的 PR 标题。

## 自动发布验证

`.github/workflows/release.yml` 在 main 的 Test、Browser smoke、Action smoke、AIDoneCheck 可复现演示 完成后运行。四条工作流必须全部是**同一个 main commit 的成功 push run**；PR/fork 的成功结果不能冒充。重跑时以最新 run 为准。

发布程序会：

1. 核对 checkout SHA、当前远程 main SHA、四条 CI 的 SHA 和结果。
2. 核对 package、lockfile、源代码、CLI dist、CHANGELOG 与发布说明版本。
3. 打包 CLI，在独立目录实际安装，验证 PASS、真实测试失败 BLOCK 和报告保留。
4. 再核对 main 未前移，创建固定 tag 和 Draft Release。
5. 上传安装包及 SHA256SUMS.txt，校验上传摘要。
6. 完成后才将 Release 设为正式稳定版，并更新 `vN` 浮动 tag。
7. 只读消费 job 从公开 URL 下载包、检查摘要、实际安装，并分别使用固定版本和浮动主版本 Action 验证接入。
8. 仅仓库变量 `ENABLE_NPM_PUBLISH` 为 `true` 时，消费验证成功后，npm job 才通过 OIDC Trusted Publishing 发布同一份 Release 安装包；核对 npm integrity，并实际从 npm 安装验证 CLI、PASS、真实 BLOCK 和 Evidence。已存在的版本只在摘要完全相同时接受重试，不覆盖。当前保持关闭，npm job 跳过。

仅 Release 发布 job 申请 `contents: write` 和 `actions: read`；npm job 申请 `id-token: write` 和 `contents: read`，普通 CI 保持只读。npm 使用经过校验的公开 Release 包，不执行其他工作流上传的代码，不接收外部 shell 命令。

并发发布串行执行。固定 tag 不允许覆盖；失败重试会复用同 SHA 的 Draft Release，已上传文件摘要不一致时停止，不悄悄覆盖。普通 main 提交不会重新发布旧版本。若 main 已前移，应由新提交对应的完整 CI 再尝试。

## 首次发布与重试

合并包含本工作流的版本 PR 后，main 上四条 CI 全绿即可自动发布，无需新建 Secrets。

首次 npm 发布需要维护者登录自己的 npm 账号：确认 `aidonecheck` 包名可用，先从已验证的 Release 下载对应 `.tgz` 并检查 SHA256SUMS，再执行 `npm publish <下载包> --access public --registry=https://registry.npmjs.org`，按 npm 提示完成账号/双因素认证。不要重打包后冒充同一份 Release。

包建立后，在 npm 包 Settings → Trusted publishing 配置 GitHub Actions：owner `lucaswenbo`、repository `AIDoneCheck`、workflow `release.yml`、environment 留空；允许 `npm publish`。不创建或保存长期 npm Token。完成认证与配置并决定恢复 npm 分发时，将仓库变量 `ENABLE_NPM_PUBLISH` 设为 `true`，随下一次版本发布启用 npm job。暂停期间保持变量未设置或不为 `true`，GitHub Release 和 Action 正常发布。仅同一版本的发布 SHA 可以补发，普通后续提交不会重新发布旧版本。

配置步骤参考 [npm 官方 Trusted Publishing 文档](https://docs.npmjs.com/trusted-publishers/)。

如果遇到网络等基础设施故障，可在 GitHub Actions 的 **Publish verified release** 手动 Run workflow，分支选 main。它仍执行同样的验证，不允许手动绕过。

新 fork 默认不自动发布到上游：发布脚本固定校验 `lucaswenbo/AIDoneCheck`。fork 的维护者若要独立发布，需自行审查并修改发布目标。

## 验证发布

- 查看 Releases 中对应版本和 CLI 附件。
- 固定 tag 与 `vN` 都应指向已验收提交。
- 参考 README，从公开 Release URL 安装 CLI，并验证 `aidonecheck --version`。
- 使用固定 tag 的 Action 再完成一次真实消费测试。
- 执行 `npm view aidonecheck@<版本> dist.integrity`，确认与 Release 安装包的 SHA-512 相同；从 npm 安装并运行验收。只有配置了工作流不等于 npm 已发布。
- 不要将 main 绿灯、Draft Release 或仅创建 tag 当成已完成公开发布。

## 当前没有的自动化

不自动创建 Release Please PR、不自动 bump、不自动 merge，也不自动 Marketplace publish。
