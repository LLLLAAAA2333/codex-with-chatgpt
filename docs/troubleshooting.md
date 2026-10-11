# Troubleshooting

Start with the saved task, not a reconnect:

```sh
c2c session --json -w <project>
c2c plan show -w <project>
```

- **Code baseline changed:** inspect the differences, discuss any assumption or
  scope conflict, then obtain human confirmation of a new plan revision. Do not
  silently replace the approval.
- **Task already started:** resume from checkpoint and actual code. Do not begin
  a second execution. If a record exists, export it.
- **Message outcome unknown:** keep delivery uncertain and inspect the exact
  message ID in the intended recipient chat. Ask the human to confirm receipt if
  necessary. Never treat a send attempt as receipt or re-run code after a timeout.
- **Browser unavailable:** `handoff export --task <id> --iteration <n>` provides the
  manual copy/paste packet. Inspect it before sharing. No connection repair is
  required for this path.
- **Damaged session:** preserve the file. Recover the matching archived plan and
  execution record with human review; do not delete it and start a new task.
- **Log unavailable/restricted/truncated:** report that limitation. Inspect saved
  code evidence; do not claim missing test evidence passed.
- **ACCESS_DENIED_SENSITIVE_FILE:** expected for Git metadata, known credential
  names, custom denied paths and their canonical aliases. Do not weaken the rule
  to obtain Git information; use `workspace_info`, `git_status`, `git_diff`.

## Explicitly requested live connections

`c2c doctor --no-fix -w <project>` diagnoses. Default doctor behavior is also
non-repairing. `c2c doctor --fix` can start/restart bridge or tunnel; explain and
obtain repair permission first. Neither doctor nor setup edits Codex configuration.
Use `sandbox-allow` only after configuration permission.

If bridge state is uncertain, do not spawn a second bridge or delete a connector.
A failed probe is not evidence the process stopped. If a temporary public address
expired, repair only after authorization, then revalidate the intended workspace.
Saved conversation replacement must not discard the approved plan/checkpoint.

Do not install missing cloudflared/dependencies, create OAuth authorization,
modify a connector or restart services silently. Ask permission for the specific
operation and retain the manual handoff alternative if declined.

Updates are human-triggered. Inspect branch and local changes first; never auto-
stash. Dependency installation, installed Skill replacement and service restart
require the corresponding authorization. Keep approval archives and execution
records when updating.
