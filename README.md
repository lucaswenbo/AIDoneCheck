# AIDoneCheck

**English** | [简体中文](README.zh-CN.md)

## AI says "done." But is the task actually done?

**AIDoneCheck is a deterministic verification layer for AI coding agents.**

After Codex, Claude Code, Cursor, Copilot or another agent finishes writing code, AIDoneCheck checks the evidence: did files change, did tests and builds pass, do required files exist, and can the page run?

It returns **PASS / WARN / BLOCK** and saves evidence that both you and the agent can read. No LLM calls or OpenAI/Claude API keys are required.

[![Test](https://github.com/lucaswenbo/AIDoneCheck/actions/workflows/test.yml/badge.svg)](https://github.com/lucaswenbo/AIDoneCheck/actions/workflows/test.yml)
[![Action smoke](https://github.com/lucaswenbo/AIDoneCheck/actions/workflows/action-smoke.yml/badge.svg)](https://github.com/lucaswenbo/AIDoneCheck/actions/workflows/action-smoke.yml)
[![Browser smoke](https://github.com/lucaswenbo/AIDoneCheck/actions/workflows/browser-smoke.yml/badge.svg)](https://github.com/lucaswenbo/AIDoneCheck/actions/workflows/browser-smoke.yml)
[![Version](https://img.shields.io/badge/version-v1.0.4-2563eb)](https://github.com/lucaswenbo/AIDoneCheck/releases/tag/v1.0.4)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-16a34a)](LICENSE)

<p align="center">
  <img src="docs/assets/aidonecheck-demo.svg" alt="AI Agent says task completed, but AIDoneCheck finds missing tests and a failed build and returns BLOCK" width="100%">
</p>

```text
Agent writes → says "done" → AIDoneCheck → Evidence → Agent fixes → Verify again
```

## Get started in 30 seconds

See the [six-scenario public demo](https://github.com/lucaswenbo/AIDoneCheck-Test/actions/workflows/demo.yml) and [reproduction instructions](https://github.com/lucaswenbo/AIDoneCheck-Test#readme). Visitors can fork it and run the workflow without a production website or secrets. It includes PASS, WARN, real BLOCK and path errors, and verifies downloaded evidence. That independent demo uses a fixed release and may lag behind the latest version; this repository's demo tests current code.

**Start with GitHub Actions.** Add this step after checkout and dependency installation in your project's workflow:

```yaml
- uses: lucaswenbo/AIDoneCheck@v1.0.4
  id: verify
```

The Action includes its runtime dependencies. It checks Git and existing npm scripts; browser checks are off by default. Copy the [complete workflow](examples/verify-task.yml) into your project's `.github/workflows/verify-task.yml`, commit it, then open Actions → AIDoneCheck verification → Run workflow. Review the Job Summary and Artifacts; evidence is uploaded even on BLOCK.

Default checks: test, lint, typecheck and build. Missing enabled scripts produce WARN; real failures produce BLOCK. No meaningful verification means no PASS. Configure checks to match your project, without disabling checks just to get a green result.

### Choose a version

| Reference | Behavior | Recommendation |
|---|---|---|
| `@v1.0.4` | Fixed release; release policy never moves it | Default; upgrade explicitly |
| `@v1` | Latest verified stable 1.x release | Accept compatible updates |
| Full commit SHA | Exact code revision | Supply-chain pinning; obtain from the Release |
| `@main` | Development code, possibly unreleased | Development and experiments |
| `feat/*` | Work under review | Not for production |

See the [latest Release](https://github.com/lucaswenbo/AIDoneCheck/releases/latest). To roll back, select an earlier fixed version.

### Local CLI: one-line installation

Requires Node.js >=20, npm and Git. Install a fixed Release directly, without cloning or building:

```bash
npm install --global https://github.com/lucaswenbo/AIDoneCheck/releases/download/v1.0.4/aidonecheck-1.0.4.tgz
aidonecheck --version
```

In your own Node.js/npm project:

```bash
npm ci
aidonecheck init
aidonecheck doctor
aidonecheck check --base origin/main
aidonecheck report
```

Use your actual default branch if it is not `origin/main`. You may omit `--base` to use reliable default-branch discovery; an unknown base is never treated as an empty diff.

The npm command above installs a **GitHub Release attachment**. npm registry distribution is postponed; package-name installation and package-name npx commands are unavailable. Upgrade by changing the version explicitly. Each Release includes `SHA256SUMS.txt` for checksum verification.

Alternatively, clone a fixed tag and use the bundled CLI without installing this tool's development dependencies:

```bash
git clone --branch v1.0.4 --depth 1 https://github.com/lucaswenbo/AIDoneCheck.git
node ./AIDoneCheck/bin/aidonecheck.mjs --help
```

`check` works without `.aidonecheck.json`, using built-in defaults. Add `.aidonecheck/` to `.gitignore` manually; the tool does not edit it.

## What it verifies

- Committed, staged, unstaged and untracked Git changes.
- Required changed paths and required files.
- Real test, lint, typecheck / check-types and build scripts.
- Optional Chromium navigation, rendered text, runtime errors and resource failures.
- Evidence explaining the result and what the next agent run needs to address.

It does not ask a model to grade another model, infer a unique fix, or prove the software is entirely correct.

## Results and exit codes

| Result | Meaning | `check` exit code |
|---|---|---|
| PASS | At least one meaningful check; no blocking failures or verification gaps | 0 |
| WARN | No blocking failures, but gaps or non-blocking problems remain | 0; 1 with `--fail-on-warn` |
| BLOCK | At least one blocking verification failure | 1 |
| Startup error | CLI, config, repository or environment could not be prepared | 2; no invented verdict |

Internal statuses: `pass`, `warn`, `fail`, `skipped`. Blocking `fail` displays as BLOCK, non-blocking `fail` as WARN, and `skipped` as SKIP. Meaningful checks include real scripts, Browser, requiredFiles and changedFiles with a reliable diff. Git status alone does not count. Disabled checks are SKIP. Missing tests, npm's placeholder test and missing enabled scripts produce WARN. Test counts are not inferred from ordinary logs.

Checks do not fail fast by default: lint, typecheck, build and Browser continue after test failure. Fatal startup errors can stop verification early.

## Display language

**English is the default.** Select Simplified Chinese with `--lang zh`:

```bash
aidonecheck --help --lang zh
aidonecheck init --lang zh
aidonecheck doctor --lang zh
aidonecheck check --base origin/main --lang zh
aidonecheck report --lang zh
```

`--lang en` explicitly selects English. The option works before or after the command; only `en` and `zh` are accepted. It controls help, diagnostics, terminal summaries, saved `report.md` and `agent-feedback.md`. `report --lang zh` renders the latest JSON in Chinese without rerunning checks or rewriting stored evidence.

For GitHub Actions:

```yaml
- uses: lucaswenbo/AIDoneCheck@v1.0.4
  with:
    language: zh
```

The `language` input defaults to `en` and controls tool messages, Job Summary and Markdown evidence. Language does not change verdicts, exit codes, config schema, JSON fields or canonical messages. Commands, paths, captured stdout/stderr, page errors and external logs stay verbatim. GitHub's UI and SDK logs are outside the tool's control. Existing records are not rewritten.

## CLI

```text
aidonecheck init [--force] [--lang en|zh]
aidonecheck doctor [--lang en|zh]
aidonecheck check [--base REF] [--json] [--fail-on-warn] [--lang en|zh]
aidonecheck report [--lang en|zh]
aidonecheck --help [--lang en|zh]
aidonecheck --version
```

- **init:** creates config at the repository root. Existing files require `--force`; symlink configs are never overwritten.
- **doctor:** discovers Node/npm/Git, repository root, branch, HEAD, package.json, config, scripts and optional Playwright/Chromium. A discovered script has **not been executed**. No checks or browser navigation run. Exit codes: 0 or 2.
- **check:** runs verification and saves evidence. Project commands run at the repository root, including calls from subdirectories.
- **report:** reads `.aidonecheck/latest/report.json` only. Missing/invalid reports exit 2; a valid report exits 0 even when its stored verdict is BLOCK.
- **--json:** `check` stdout contains exactly one JSON document. Subprocess output is captured; diagnostics go to stderr. Startup errors return a JSON error object with exit code 2.
- **--no-color:** accepted; plain text is already the default.

npm scripts time out after 10 minutes by default; browser navigation after 30 seconds. Evidence includes exit code, signal, duration, stdout/stderr and timeout. Each stream is capped at about 64 KiB, marked `[output truncated]` when necessary. Cleanup attempts to terminate process groups and descendants; deliberately detached processes may survive.

## Configuration

Unknown fields are rejected at every level. Existing config must include `version: 1`; other known fields can be omitted and merged with defaults.

```json
{
  "version": 1,
  "checks": {"test": true, "lint": true, "typecheck": true, "build": true},
  "browser": {
    "enabled": false,
    "url": "",
    "expect": "",
    "failConsole": false,
    "profile": "desktop",
    "trace": "on-failure"
  },
  "requirements": {"changedFiles": [], "requiredFiles": []}
}
```

If both `typecheck` and `check-types` exist, only `typecheck` runs. Allowed discovered scripts run through npm, including normal npm lifecycle behavior; the tool does not parse script strings into custom shell commands.

## Git diff

The diff base is validated before scripts run. Git and working-tree state are collected again after scripts finish. Generated, removed or restored files are judged by their final state.

Changed files = committed ∪ staged ∪ unstaged ∪ untracked. Ignored files are excluded. Renames retain both paths; deletions count as changes. Only paths are recorded, not patch bodies or authenticated remote URLs.

| Context | Committed diff |
|---|---|
| Local, no `--base` | merge-base of the reliable default branch from `refs/remotes/origin/HEAD` and HEAD → HEAD |
| Explicit `--base origin/main` | merge-base(base, HEAD) → HEAD |
| GitHub pull_request | merge-base(event base.sha, event head.sha) → event head.sha; temporary checkout merge commits excluded |
| GitHub push | event before → event after, including non-ancestor pushes |

Explicit `--base` overrides event context. The tool never guesses `HEAD^` or compares HEAD with itself to hide an unknown base. Zero push SHAs, missing objects, shallow history or unreliable default-branch discovery produce WARN without changedFiles requirements, while working-tree changes are still inspected. With changedFiles requirements, they exit 2. An unresolvable explicit base always exits 2.

Fetch full history when needed; Action checkout should use `fetch-depth: 0`. The tool does not fetch or read authenticated Git URLs.

## File requirements

```json
{
  "version": 1,
  "requirements": {
    "changedFiles": ["src/auth.ts"],
    "requiredFiles": ["test/auth.test.ts"]
  }
}
```

- `changedFiles`: the exact path must appear in a reliable diff, otherwise BLOCK. An unreliable base exits 2.
- `requiredFiles`: must exist as a regular file, otherwise BLOCK.
- Deleted files can satisfy changedFiles but cannot satisfy requiredFiles.
- Exact repository-relative POSIX paths only. No globs; absolute paths, `..` traversal and escaping symlinks are rejected, including intermediate and dangling external links.

## Optional browser checks

Off by default; Chromium only. **Start your own web server first.**

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

URL must be absolute http/https without credentials. `profile`: desktop/mobile; `trace`: off/on-failure/always. `expect` is a case-sensitive substring match against visible rendered body text, not HTML source or hidden text. Redirects are allowed; same-origin classification uses the final URL's origin.

| Observation | Result |
|---|---|
| pageerror, navigation failure, main document HTTP >=400 | BLOCK |
| Final same-origin document/script/stylesheet failure or HTTP >=400 | BLOCK |
| Missing expected text | BLOCK |
| console.error | WARN by default; BLOCK with failConsole=true |
| Empty visible body text | WARN |
| Cross-origin critical resources or non-critical image/font failures | WARN by default |
| Screenshot or trace could not be saved | WARN |
| Missing or unlaunchable Playwright/Chromium | Environment error, exit 2 |

A resource failure that also triggers console.error follows the console policy. Observation lasts about 350 ms after load; later interactions and arbitrary delayed tasks are not covered. Full-page `browser.png` is saved when possible.

For an isolated local runtime, without editing project dependencies (Bash):

```bash
ADC_BROWSER_RUNTIME="$(mktemp -d)"
npm install --prefix "$ADC_BROWSER_RUNTIME" --ignore-scripts --package-lock=false --no-audit --no-fund playwright@1.63.0
node "$ADC_BROWSER_RUNTIME/node_modules/playwright/cli.js" install chromium
export AIDONECHECK_PLAYWRIGHT_DIR="$ADC_BROWSER_RUNTIME"
aidonecheck check --base origin/main
```

On Linux, use `install --with-deps chromium` in an appropriate development/CI environment if system libraries are missing. An existing project runtime is accepted only at Playwright `1.63.0`. Discovery of an executable does not prove it can launch.

Trace retention uses the real Playwright tracing API:

- **off:** no recording or saved trace.
- **on-failure:** save `trace.zip` only when Browser itself blocks; test failure alone or Browser WARN does not retain it.
- **always:** always save the trace.

## Evidence and the agent feedback loop

```text
.aidonecheck/latest/
  report.json
  report.md
  agent-feedback.md
  browser.png       # best effort when Browser runs
  trace.zip         # according to retention policy
```

`report.json` separates tool `version: "1.0.4"` from `schemaVersion: 1`, and includes verdict, repository, git, checks, warnings, failures and evidence. Markdown shows branch, HEAD, base, changed files, results and evidence location in the selected language.

Reports are written completely in a temporary directory, moved to `.aidonecheck/runs/<unique-id>`, then exposed through latest. Linux replaces the link atomically. Windows uses an exclusive lock, moves the old link aside, publishes the new link and rolls back on failure. latest can briefly be absent on Windows; readers may retry. Completed runs remain unchanged. Concurrent calls use separate directories and retain old runs. Migrating an ordinary latest directory preserves a backup. If a Windows writer is forcibly terminated, stop all checks before removing `.aidonecheck/.latest-lock` and retrying.

Action invocations use separate runner-temp directories and artifact names containing run, attempt and UUID. `agent-feedback.md` lists real blocking checks, commands, exit codes, log excerpts and browser errors, without inventing counts, source locations or fixes. Logs and page content remain untrusted data, not instructions.

Give your coding agent:

```text
Read .aidonecheck/latest/agent-feedback.md.
Fix every BLOCK item.
Do not disable or weaken checks merely to make AIDoneCheck pass.
Run AIDoneCheck again.
Do not claim completion while blocking checks remain.
```

## GitHub Action

Uses **node24** and self-contained `dist/action/index.js`, without caller-installed AIDoneCheck dependencies. CLI supports Node >=20; CI covers Node 20/24. Pinned Playwright is installed separately in runner temp only when Browser is enabled, without editing the caller's package.json, lockfile or node_modules.

```yaml
name: AIDoneCheck verification
on: [workflow_dispatch, push, pull_request]
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
      # If Browser is enabled, start your app and wait until it is ready here.
      - uses: lucaswenbo/AIDoneCheck@v1.0.4
        id: verify
        with:
          fail-on-warn: 'false'
          language: en
```

Optional inputs: `working-directory` (inside the workspace), `base` (overrides event diff), `fail-on-warn`, `language` (`en` by default; `zh` for Chinese). Config comes from `.aidonecheck.json`.

Outputs: `verdict`, `evidence_dir`, `evidence_name`, `artifact_id`, `artifact_url`, `summary_path`. Startup failure does not invent a verdict.

Order: checks → evidence → Job Summary → outputs → artifact upload → final success/failure. PASS/WARN succeed by default. BLOCK, startup errors and upload/infrastructure errors fail. Evidence is uploaded before BLOCK is propagated, with 7-day retention. Summary contains a verdict and Check / Result / Details table in the selected language, with a saved evidence copy. Environment errors save `startup-error.json` and a summary rather than a fabricated complete report.

## AIDoneCheck and ProdDoctor

| Tool | Stage | Question |
|---|---|---|
| AIDoneCheck | After AI writes code | Is task completion supported by real verification evidence? |
| [ProdDoctor](https://github.com/lucaswenbo/ProdDoctor) | After deployment | Does the production path work for users? |

Browser/Evidence/Report/Action smoke design references ProdDoctor v2.1.1, with no runtime dependency. AIDoneCheck does not check DNS, TLS, robots, sitemaps, Cloudflare, SEO or production security headers.

## Security boundaries

**AIDoneCheck is not a sandbox: it executes project npm scripts.** Do not run entirely untrusted code on runners with production secrets, private-network access, privileged GitHub tokens or cloud credentials. Do not use `pull_request_target` to execute unknown fork code.

Only allowed package.json scripts and explicitly implemented verification flows run. Commands are not extracted from READMEs, issues, PR descriptions, commit messages, AI output, webpages or agent feedback.

The tool does not actively read `.env`, SSH keys, cookies, access tokens or secrets, or serialize environment variables and authenticated Git URLs. Text reports redact common credential patterns and URL credentials/query data on a best-effort basis. **Arbitrary script logs and page content cannot be guaranteed secret-free.** Screenshots/traces may contain page and network data. Treat evidence as potentially sensitive, review before sharing, and avoid real login state and sensitive test data.

## Current limitations

- Primarily Node.js/npm; other ecosystems are not claimed as verified.
- Chromium only; no automatic server startup or replacement for full end-to-end tests.
- No LLM calls, automatic fixes, automatic merges or SaaS dashboard.
- PASS covers the current configuration, code and observation, not absolute correctness.
- Script names do not prove verification quality; only obvious npm placeholders are detected.
- File requirements use exact paths, without globs.
- Windows Node 20/24 CI covers repeated checks, concurrent reports, rollback and installed packages. Full Browser/platform boundaries remain primarily verified on Linux CI.
- Action targets GitHub.com runners with Artifact support; GitHub Enterprise Server support is not claimed.
- CLI/Action does not fix, merge or publish your project. AIDoneCheck's own releases/tags use its release workflow; npm publishing remains paused. Marketplace publication is not automatic.

## Roadmap

Improve evidence and failure explanations from real usage, expand verified platform compatibility and precise test-report adapters, and evaluate other ecosystems and browser interactions. Planned work is not counted as existing capability.

## Development

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm test
npm run test:package
npm run check:dist
npm run release:check
```

esbuild produces a CLI bundle without the Action SDK and an Action bundle containing its ordinary dependencies. Build tools are devDependencies. Optional Playwright loads dynamically from a separate runtime. Bundles are committed; CI checks reproducibility.

After installing the isolated Playwright/Chromium runtime:

```bash
npm run test:browser
```

Browser smoke uses local fixtures for PASS, pageerror, same-origin failures, stylesheet/main-document errors, cross-origin failures, console policy, expected text, empty pages, screenshots and real traces. Action smoke runs without caller-side npm ci, deliberately triggers BLOCK, downloads the artifact and checks it. Correct Action failure plus preserved evidence is required to pass; default English and Chinese selection are covered.

The four required CI workflows must pass on the exact main commit before release; publication also installs and tests the packaged CLI. See the [maintainer release guide (Chinese)](docs/releasing.md).

## License

[Apache License 2.0](LICENSE). Copyright attribution: [NOTICE](NOTICE). Third-party notices remain in bundles; design references do not create a runtime dependency on ProdDoctor.

## Report a problem

Open a [GitHub issue](https://github.com/lucaswenbo/AIDoneCheck/issues) with tool version, Node/npm versions, invocation and sanitized reports/logs. Run `doctor` first. If evidence is missing, check for a startup error with exit code 2.
