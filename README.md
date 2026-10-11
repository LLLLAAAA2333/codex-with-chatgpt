# Codex with ChatGPT

English | [简体中文](README.zh-CN.md)

Discuss goals, assumptions and alternatives with ChatGPT. Let Codex implement,
test and debug within a human-approved plan. The objective is better decisions
and less context transfer/rework.

## Start with a local handoff

1. Write a readable project plan using [the template](examples/c2c-plan.md).
   The human confirms the exact goal, method, scope and acceptance criteria.
2. `c2c plan approve --file plan.md --task task1 --revision 1 --user-confirmation "approval reference" -w <project>`
3. `c2c plan begin -w <project>` checks the approved code baseline. Codex then
   implements and fixes ordinary problems autonomously within that scope.
4. At a requested review or named milestone, capture a code digest with
   `plan snapshot`, record the actual test command/output/exit code with `record`,
   and generate the portable evidence packet with `handoff export`.
5. ChatGPT reports which evidence it inspected. The human decides whether the
   plan changes. A ChatGPT suggestion never grants new authority.

See [the protocol](docs/protocol.md) for exact commands, receipt tracking,
version binding and recovery. Local handoff requires no OAuth, tunnel or browser.

## Optional live reads

The existing bridge exposes ten read-only MCP tools for files, search, Git and
execution records. ChatGPT can inspect actual local code on demand. It does not
continuously monitor the workspace, execute commands or independently rerun tests.
Recorded test logs are executor-provided evidence. The browser notifies ChatGPT;
approved plans, checkpoints and evidence remain local.

## Installation and explicit permissions

Node.js >= 20 and the locked project dependencies are required. Before installing
software, replacing an installed Skill, modifying Codex configuration, creating
OAuth authorization, starting a public tunnel, restarting services, operating
accounts or pushing code: explain the action and obtain permission. Never update,
stash, install or restart automatically as part of an ordinary coding request.

After dependency installation is authorized:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run typecheck
pnpm run build
pnpm test
```

Use `node <checkout>/bin/c2c.js`; a global install is unnecessary. If Skill
installation is authorized, copy the entire `skill/` directory including references
and replace its checkout placeholder. Codex home is non-empty `CODEX_HOME` or
`~/.codex` otherwise.

Live connections additionally require cloudflared. `setup` starts a bridge and,
by default, a public tunnel; authorize it separately. `doctor` diagnoses by
default; `doctor --fix` explicitly requests connection repair. Neither changes
Codex configuration. `sandbox-allow` remains a separate authorized operation.
This first workflow targets macOS without adding platform background services.

## Limits and recovery

Git metadata, known credential paths and `.c2cignore` paths are denied. Git
information is available through restricted interfaces. Filename filtering and
pattern redaction cannot guarantee the absence of all secrets. Inspect a packet
before sharing. Snapshots cover readable files only and report omissions.

Delivery can be prepared, uncertain or confirmed. Unknown delivery requires
checking the existing message ID, not resending or rerunning code. A manual packet
is always available if browser automation fails. Approval and reviewer notes are
audit records, not cryptographic identity proofs. One active executor per workspace
is supported. Real browser/OAuth/tunnel verification needs separate authorization.

To undo adoption, stop invoking the Skill/CLI and remove an installed Skill only
if desired. Use `stop` or `unpair` only for services/connections actually created.
Preserve/export plans and evidence before deleting local state. Source changes
remain reviewable and do not require a push.

[Architecture](docs/architecture.md) · [Security](docs/security.md) ·
[Troubleshooting](docs/troubleshooting.md)

MIT license. The existing bridge, OAuth, session and execution-record architecture
is retained; see Git history for original project authorship.
