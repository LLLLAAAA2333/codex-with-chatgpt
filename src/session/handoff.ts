import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Workspace } from "../workspace/manager.js";
import { gitDiff, runGit } from "../workspace/git.js";
import { getStateDir, writeSecureJson } from "../config/paths.js";
import { mergeSession, readSession, writeSession, type ApprovedPlanRef } from "./state.js";
import { sanitizeExecutionOutput } from "../execution/sanitize.js";

const hash = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const snapshotSchema = z.object({
  head: z.string().regex(/^[a-f0-9]{40,64}$/),
  digest: z.string(),
  files: z.array(z.object({ path: z.string(), digest: z.string().nullable() })),
  omitted: z.number().int().nonnegative(),
});
export type CodeSnapshot = z.infer<typeof snapshotSchema>;
const planSchema = z.object({
  taskId: identifier,
  revision: z.number().int().positive(),
  digest: z.string(),
  text: z.string(),
  approvedBy: z.literal("user"),
  confirmation: z.string().min(1),
  approvedAt: z.string(),
  baseline: snapshotSchema,
});
export type ApprovedPlan = z.infer<typeof planSchema>;
export const evidenceSchema = z.object({
  id: z.string(),
  plan: z.object({ taskId: identifier, revision: z.number().int().positive(), digest: z.string() }),
  code: snapshotSchema,
  baseCommit: z.string(),
  diff: z.string(),
  untrackedFiles: z.array(z.object({ path: z.string(), content: z.string().nullable(), note: z.string().optional() })),
  unverified: z.array(z.string()),
  blockers: z.array(z.string()),
  source: z.literal("executor_report"),
  testedSnapshot: z.string().optional(),
  reportDigest: z.string().optional(),
});
export type ExecutionEvidence = z.infer<typeof evidenceSchema>;

/** Fingerprint only readable project files. Omitted paths are never read or named. */
export function snapshotWorkspace(ws: Workspace): CodeSnapshot {
  const head = runGit(ws.root, ["rev-parse", "HEAD"]);
  if (!head.ok || !/^[a-f0-9]{40,64}$/.test(head.stdout.trim())) throw new Error("A Git repository with a commit is required.");
  const inventory = runGit(ws.root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "."]);
  if (!inventory.ok) throw new Error("Cannot inventory workspace");
  const trackedResult = runGit(ws.root, ["ls-files", "--cached", "-z", "--", "."]);
  if (!trackedResult.ok) throw new Error("Cannot inventory tracked files");
  const tracked = new Set(trackedResult.stdout.split("\0").filter(Boolean));
  const names = [...new Set(inventory.stdout.split("\0").filter(Boolean))].sort();
  if (names.length > 10000) throw new Error("Snapshot exceeds 10000 files; narrow the workspace.");
  const files: CodeSnapshot["files"] = [];
  let bytes = 0, omitted = 0;
  for (const name of names) {
    if (ws.ignoreRules.isSensitive(name) || (!tracked.has(name) && ws.ignoreRules.isNoise(name))) { omitted++; continue; }
    let resolved: {abs: string; rel: string};
    try { resolved = ws.resolve(name); } catch { omitted++; continue; }
    let stat: fs.Stats;
    try { stat = fs.lstatSync(resolved.abs); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      files.push({ path: name, digest: null }); continue;
    }
    // Do not follow links when producing a portable evidence inventory.
    if (fs.lstatSync(path.join(ws.root, name)).isSymbolicLink() || !stat.isFile()) { omitted++; continue; }
    bytes += stat.size;
    if (stat.size > 8 * 1024 * 1024 || bytes > 64 * 1024 * 1024) throw new Error("Snapshot exceeds byte limits; narrow the workspace.");
    files.push({ path: name, digest: hash(fs.readFileSync(resolved.abs)) });
  }
  return { head: head.stdout.trim(), files, omitted, digest: hash(JSON.stringify({ head: head.stdout.trim(), files, omitted })) };
}

function planFile(ws: Workspace, ref: Pick<ApprovedPlanRef, "taskId" | "revision">): string {
  identifier.parse(ref.taskId);
  z.number().int().positive().parse(ref.revision);
  return path.join(getStateDir(), "sessions", ws.id, "plans", `${ref.taskId}-${ref.revision}.json`);
}

export function loadPlan(ws: Workspace, ref: ApprovedPlanRef): ApprovedPlan {
  const plan = planSchema.parse(JSON.parse(fs.readFileSync(planFile(ws, ref), "utf8")));
  if (plan.digest !== ref.digest || hash(plan.text) !== ref.digest || plan.taskId !== ref.taskId || plan.revision !== ref.revision) {
    throw new Error("Approved plan does not match its reference; recover before continuing.");
  }
  return plan;
}

export function activePlan(ws: Workspace): ApprovedPlan | null {
  const ref = readSession(ws.id)?.checkpoint?.approvedPlan;
  return ref ? loadPlan(ws, ref) : null;
}

export function approvePlan(ws: Workspace, input: { file: string; taskId: string; revision: number; confirmation: string }): ApprovedPlan {
  if (!input.confirmation.trim()) throw new Error("Record the user's explicit confirmation, not ChatGPT's recommendation.");
  const source = ws.resolve(input.file);
  if (fs.statSync(source.abs).size > 64 * 1024) throw new Error("Plan exceeds 64 KiB");
  const text = fs.readFileSync(source.abs, "utf8");
  if (!text.trim()) throw new Error("Plan is empty");
  const file = planFile(ws, input);
  const previous = readSession(ws.id);
  const current = previous?.checkpoint?.approvedPlan;
  const sameTask = previous?.taskId === input.taskId;
  let plan: ApprovedPlan;
  if (fs.existsSync(file)) {
    plan = planSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
    if (plan.digest !== hash(text) || hash(plan.text) !== plan.digest || plan.taskId !== input.taskId || plan.revision !== input.revision) {
      throw new Error("This plan revision already exists with different content; obtain confirmation of a new revision.");
    }
    // An approval retry must never reset an execution that has already started.
    if (current?.taskId === plan.taskId && current.revision === plan.revision && current.digest === plan.digest) return plan;
    if (snapshotWorkspace(ws).digest !== plan.baseline.digest) throw new Error("Code changed since archived approval; inspect before recovering it.");
  } else {
    plan = planSchema.parse({ ...input, text, digest: hash(text), approvedBy: "user", approvedAt: new Date().toISOString(), baseline: snapshotWorkspace(ws) });
  }
  if (current?.taskId === input.taskId && input.revision <= current.revision) throw new Error("Plan revision must increase; cannot restore an older approval over the current plan.");
  if (!fs.existsSync(file)) writeSecureJson(file, plan);
  writeSession(ws.id, mergeSession(previous ? { ...previous, checkpoint: undefined } : null, {
    taskId: plan.taskId, iteration: sameTask ? previous?.checkpoint?.iteration ?? previous?.iteration ?? 0 : 0, lastState: "PLAN_APPROVED",
    checkpoint: { protocolState: "PLAN_APPROVED", waitingFor: "none", approvedPlan: {taskId:plan.taskId, revision:plan.revision, digest:plan.digest}, nextExpectedStep: "Check baseline with plan begin, then execute within the approved scope." },
  }));
  return plan;
}

export function beginPlan(ws: Workspace): void {
  const plan = activePlan(ws);
  const saved = readSession(ws.id);
  if (!plan || !saved?.checkpoint) throw new Error("No approved plan");
  if (saved.checkpoint.protocolState !== "PLAN_APPROVED") throw new Error("Task already started; inspect checkpoint and resume without re-executing completed work.");
  if (snapshotWorkspace(ws).digest !== plan.baseline.digest) throw new Error("Code changed since approval; inspect the change and obtain confirmation of the new baseline.");
  writeSession(ws.id, mergeSession(saved, { checkpoint: { protocolState: "EXECUTING", waitingFor: "none" } }));
}

export function captureEvidence(ws: Workspace, plan: ApprovedPlan, input: { unverified?: string[]; blockers?: string[]; testedSnapshot?: string; reportDigest?: string }): ExecutionEvidence {
  const code = snapshotWorkspace(ws);
  if (input.testedSnapshot && input.testedSnapshot !== code.digest) throw new Error("Tested snapshot differs from current code. Preserve the old results and re-test current code.");
  const delta = gitDiff(ws, { mode: "head", baseCommit: plan.baseline.head, maxBytes: 256 * 1024 });
  if (!delta.isRepo || delta.hasMore) throw new Error("Cannot capture complete bounded diff; split the milestone.");
  const sanitized = sanitizeExecutionOutput(delta.diff);
  if (!sanitized.allowed) throw new Error("Diff contains restricted material; withhold it and review locally.");
  // The existing sanitizer can truncate. Never label a partial diff complete.
  const unverified = [...(input.unverified ?? []), "Test commands and results are reported by the executor; no independent rerun."];
  if (!input.testedSnapshot) unverified.push("No pre-test snapshot supplied; test-to-code association is unverified.");
  if (sanitized.truncated) unverified.push("Saved diff is truncated; inspect additional changes locally or through MCP at the same snapshot.");
  if (code.omitted) unverified.push(`${code.omitted} paths omitted by policy or unsupported file type; snapshot covers readable files only.`);
  const inventory = runGit(ws.root, ["ls-files", "--others", "--exclude-standard", "-z", "--", "."]);
  if (!inventory.ok) throw new Error("Cannot inventory untracked files");
  const untrackedFiles: ExecutionEvidence["untrackedFiles"] = [];
  let bytes = 0;
  for (const name of inventory.stdout.split("\0").filter(Boolean)) {
    if (!code.files.some(f => f.path === name)) continue;
    const {abs} = ws.resolve(name);
    const content = fs.readFileSync(abs);
    bytes += content.length;
    if (content.includes(0) || content.length > 64 * 1024 || bytes > 256 * 1024) {
      untrackedFiles.push({path:name, content:null, note:"Body omitted; binary or size limit. Digest is in code.files."});
      unverified.push(`Untracked body not included: ${name}`); continue;
    }
    const body = sanitizeExecutionOutput(content.toString("utf8"));
    untrackedFiles.push({path:name, content:body.allowed ? body.text : null, note:!body.allowed ? "restricted" : body.truncated ? "truncated" : undefined});
  }
  if (snapshotWorkspace(ws).digest !== code.digest) throw new Error("Workspace changed while evidence was collected; retry collection, not execution.");
  const data = { plan:{ taskId:plan.taskId, revision:plan.revision, digest:plan.digest }, code, baseCommit:plan.baseline.head, diff:sanitized.text, untrackedFiles, unverified, blockers:input.blockers ?? [], source:"executor_report" as const, testedSnapshot:input.testedSnapshot, reportDigest:input.reportDigest };
  return { id:hash(JSON.stringify(data)), ...data };
}
