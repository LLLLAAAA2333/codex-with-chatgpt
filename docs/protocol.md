# C2C collaboration protocol

The human confirms the goal, assumptions, chosen method, scope and acceptance
criteria. ChatGPT discusses and reviews; Codex implements and fixes ordinary
problems within that scope. A ChatGPT PLAN or review is a proposal, not authority.

## Durable sources

- Write the discussed plan in a project Markdown file; use `examples/c2c-plan.md`.
- `plan approve` archives the exact text by task/revision under the existing
  state directory (`sessions/<workspaceId>/plans`). Its digest and approval note
  are referenced by the existing session checkpoint. The note records a human
  approval; it is not a signature or proof that a person approved it.
- The baseline contains a full Git commit SHA and hashes of readable tracked and
  untracked files. Sensitive/noise/unsupported paths are omitted and counted.
  This is a bounded review snapshot, not a whole-disk or secret-content guarantee.
- Execution records remain JSONL in `executions/<workspaceId>.jsonl`. Versioned
  records include the plan reference, code snapshot, saved diff from the approved
  baseline commit, bounded untracked bodies, test command/exit code, limitations
  and blockers. Pre-existing changes in the baseline must not be attributed to
  Codex. The saved baseline manifest allows this distinction.
- Test logs are optional sanitized execution outputs. They are executor-provided
  evidence, not an independent rerun. Restricted, truncated, expired or absent
  material must be described accordingly. Output bodies have a 40-item retention
  limit; export a reviewed handoff packet if longer retention is needed.

One active executor per workspace is supported. The store is not a concurrent
multi-executor queue. State JSON uses atomic replacement; damaged sessions stop
recovery rather than silently starting a new task. Clearing a chat pointer keeps
an active checkpoint and plan. Legacy records remain readable but have no
versioned evidence unless it was actually captured.

## Minimal local workflow

All commands below work without OAuth, a tunnel or a live ChatGPT session.
Replace the sample values; capture test logs outside the project so they do not
change the tested code snapshot.

```sh
c2c plan approve -w <project> --file plan.md --task task1 --revision 1 --user-confirmation "human confirmed revision 1 in the current chat"
c2c plan begin -w <project>
# Codex now implements the approved small task.
c2c plan snapshot -w <project>
# Run the agreed test; save its output and actual exit code.
c2c record -w <project> --task task1 --iteration 1 --tests "actual result" --exit-status ok --command "actual test command" --output-file <temporary-log> --exit-code 0 --tested-snapshot <digest> --unverified "browser not checked"
c2c handoff export -w <project> --task task1 --iteration 1
```

`plan begin` refuses changed baselines and already-started tasks. After restart,
read `session --json` and `plan show`: resume unfinished work, or export an
existing record. Do not execute an iteration again just because sending failed.
A duplicate record is rejected rather than silently overwriting earlier evidence.
If recording succeeded before the checkpoint was saved, export recovers that
checkpoint from the existing record.
Revisions increase within a task; execution iteration numbers continue across
revisions. Retrying the same approval with identical text preserves progress and
can recover an archived approval whose checkpoint write was interrupted. It never
restarts execution. Use a new task ID for a separate task.

## Sending and recovery

The packet has a stable `messageId` and may be manually copied to ChatGPT.
It contains actual saved evidence, not only a status message. Inspect the packet
before sharing it. Manual transfer is an explicit exception to the old blanket
rule forbidding pasted diffs/logs: only the selected bounded packet is shared.

Before sending, use `handoff delivery --message <id> --status uncertain`.
A timeout/crash remains uncertain. Check the exact ID in the intended recipient
conversation, or obtain human receipt confirmation. Do not blindly resend.
Only then set `--status confirmed --confirmation "observed receipt evidence"`.
Exporting does not send a message; repeating export preserves the message ID and
delivery status. A confirmed delivery is not a completed review.

The existing local states remain supported, with `PLAN_APPROVED` added:
`PLAN_APPROVED → EXECUTING → EXECUTED_LOCAL → EXECUTED_SENT`.
Delivery is separately `prepared → uncertain → confirmed`. Unknown delivery is
not execution failure and never justifies repeated code execution.

## Reviewing

Request review manually or at named milestones, not after every small edit.
When connected, use `execution_summary` to read the approved plan, checkpoint and
records; use `read_file`, `git_diff`, `git_status` and `execution_output` as needed.
Compare code digests before using live files to review older evidence. Current
MCP reads may differ from the immutable packet. No tool can rerun tests remotely.

The reviewer must distinguish:
- executor-reported outcomes;
- specific files, diffs and output IDs actually inspected;
- unverified checks, withheld/truncated evidence and blockers.

Save the report with:
`handoff review --message <id> --reviewer ChatGPT --checked "specific evidence" --decision needs_user --notes "findings and limits"`.
This stores a reviewer report separately; it does not prove inspection occurred.
Even `accept` is not human approval of changed goals, method, criteria or permissions.
After the milestone the human decides whether to continue or approve a new plan
revision. Ordinary repairs within the existing approved scope need no replanning.

## Optional browser messages

Browser automation is a convenience over the same durable workflow. Use the
available host's documented browser APIs, one visible intended chat, receipt
checks and the saved workspace binding. Do not read private chat histories to
locate a task. If automation fails, export the packet and use manual handoff.
Do not re-pair, install software, replace a connector or restart services merely
to resume. Those actions require their own authorization.

Suggested ChatGPT instruction:
"Review the attached C2C packet against its approved plan. Use the authorized
read-only connector for additional evidence if available. Identify what you
actually inspected and what remains unverified. Return proposed changes for the
human to decide; your suggestions do not authorize execution or scope changes."
