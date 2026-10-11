---
name: codex-with-chatgpt
description: >
  Coordinate user-approved ChatGPT discussion and review with Codex implementation,
  using saved plans, versioned evidence and manual or optional browser handoff.
  Use when the user asks to use Codex with ChatGPT or connect the two for a project.
---

# Codex with ChatGPT

The purpose is better plans and less context transfer/rework. The human owns the
goal, key method, acceptance criteria and permission scope. ChatGPT advises;
Codex implements, tests and fixes ordinary problems within the approved plan.
A ChatGPT reply is never human authorization.

## Locations and permissions

The codex-with-chatgpt checkout lives at: `<ACTUAL_CHECKOUT_PATH>`
Use `node "<checkout>/bin/c2c.js" <command> -w <project>`; the workspace is the
user's project, which need not be this checkout. Commands below are local unless
explicitly described as connection actions.

Do not auto-update or auto-install. Before installing dependencies/runtime,
installing or replacing this Skill, editing Codex configuration, creating OAuth
authorization, exposing a public tunnel, restarting services, operating GitHub
accounts or pushing code: explain the action and obtain explicit permission.
Reuse permission already granted for that action; do not ask on every tool call.
An ordinary coding request does not grant those categories of permission.
Never auto-stash, reset, or discard local work.

## Approved plan and execution

1. Read `c2c session --json -w <project>` and `c2c plan show -w <project>`.
   Resume the recorded task. Do not rerun completed work because a chat was lost.
2. Save the discussed plan as a readable project Markdown file, using
   `<checkout>/examples/c2c-plan.md` as a guide. Include the goal, assumptions,
   selected method, scope, acceptance checks, review milestones and open questions.
   Let the human confirm the exact version. Do not approve a ChatGPT suggestion
   yourself. After confirmation:
   `c2c plan approve -w <project> --file <relative-plan.md> --task <task-id> --revision 1 --user-confirmation "<reference to the human approval>"`
   This archives the exact text and captures a baseline. A changed plan requires
   a new revision and human confirmation. Approval notes are an audit record,
   not cryptographic proof of consent.
3. Before first execution, `c2c plan begin -w <project>` checks the baseline.
   If it differs, inspect why and get human confirmation before rebasing the plan.
   If already started, inspect checkpoint and changed code and resume; do not
   begin or execute the task a second time. One active executor per workspace.
4. Implement and fix ordinary errors autonomously. Request review only when the
   human asks or an approved milestone is reached. If evidence contradicts a key
   assumption, present the evidence and request discussion; changes to the goal,
   key method, acceptance criteria or permissions still require human approval.
5. Before tests, `c2c plan snapshot -w <project>` returns the code digest. Capture
   stdout/stderr in a local temporary file outside the project. Record success
   and failure with the exact command and exit code:
   `c2c record -w <project> --task <task-id> --iteration 1 --tests "<actual summary>" --exit-status ok --command "<actual command>" --output-file <temp-log> --exit-code 0 --tested-snapshot <digest> --unverified "<remaining limitations>"`
   Use `failed` or `blocked` as appropriate. A record captures the plan reference,
   code identity, filtered diff and bounded new-file bodies. It is an executor
   report, not an independently reproduced test. Never nominate credentials or
   unrelated logs. A rejected duplicate means inspect the existing record, not
   rerun the command. If interrupted after recording, export the existing record.

## Review and recoverable handoff

`c2c handoff export -w <project> --task <task-id> --iteration 1` prints a portable
JSON packet with a stable message ID. It includes the approved plan, code hashes,
actual saved changes, test output if still available, unverified items and
blockers. Show the packet for manual copy/paste. This works without a bridge,
OAuth, tunnel or browser automation. Inspect it before sharing; filename filters
and pattern redaction do not guarantee that all sensitive content is removed.

If connected, prefer MCP for additional code reads. The ten existing tools stay
read-only. `execution_summary` returns the saved plan/checkpoint and records;
`execution_output` provides executor-selected logs. Verify the snapshot before
using current files to review older work. MCP cannot rerun tests.

For manual or automated delivery:

1. Before attempting to send, mark the exported message:
   `c2c handoff delivery -w <project> --message <id> --status uncertain`
2. If the outcome is unknown, retain that state. Inspect the same intended chat
   for this exact ID or ask the human to verify receipt. Do not blindly resend,
   create a new task, or re-execute code.
3. Only after the recipient message is visible or the human confirms receipt:
   `c2c handoff delivery -w <project> --message <id> --status confirmed --confirmation "<observed receipt evidence>"`
   A click/send attempt is not confirmation. Exporting again preserves the ID
   and state; it never sends anything.
4. Ask the reviewer to name the exact files/diffs/output IDs inspected and the
   unverified parts. Save their report separately:
   `c2c handoff review -w <project> --message <id> --reviewer ChatGPT --checked "<specific evidence inspected>" --decision needs_user --notes "<findings and limits>"`
   Valid decisions: `accept`, `changes_requested`, `needs_user`. These describe
   the reviewer's report; none authorizes a new plan. Let the human decide whether
   to adjust the plan. Reuse the approved scope for ordinary fixes.

## Optional live connection

Only when requested, read [connection and recovery](references/connection.md).
For a requested live handoff, automatically reuse a valid workspace chat binding
and existing authorization, or create and verify a dedicated chat before saving
its URL. Do not require the user to supply a target chat. Within this flow, ask
the user to operate the UI only when an observed login, MFA/CAPTCHA, or required
OAuth consent/reauthorization step needs them. A missing binding or a browser
timeout is not evidence that authorization has expired. Other permission
boundaries above still apply; reuse permission already granted.
Use available documented browser tools; if unavailable, keep manual handoff.
`c2c doctor --no-fix` diagnoses; `--fix` explicitly requests connection repair
and may start a bridge/tunnel. Neither doctor nor setup changes Codex configuration.
`sandbox-allow` is a separate action requiring permission. Do not start a public
connection merely to demonstrate this workflow.

## Explicit updates

Only on a human update request: inspect branch, local changes and remote first;
show the proposed revision/change range. Do not auto-stash. Fast-forward only
when safe. Installation, installed Skill replacement and service restart are
separate actions; explain them and obtain any missing permission. Continue the
original task using its saved plan and evidence afterward.
