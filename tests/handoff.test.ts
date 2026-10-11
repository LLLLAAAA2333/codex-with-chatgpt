import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Workspace } from "../src/workspace/manager.js";
import { activePlan, approvePlan, beginPlan, captureEvidence, snapshotWorkspace } from "../src/session/handoff.js";
import { clearChatPointer, mergeSession, readSession, sessionFile, writeSession } from "../src/session/state.js";
import { cleanup, git, isolateStateDir, makeGitRepo, makeTmpDir, write } from "./helpers.js";

let root: string, state: string, ws: Workspace;
beforeEach(() => {
  state = isolateStateDir(); root = makeTmpDir("handoff"); makeGitRepo(root);
  write(root, "plan.md", "Goal: return 43. Assumption: integer input. Method: change constant. Scope: src/index.ts. Acceptance: synthetic test. Review: once complete.");
  ws = new Workspace(root);
});
afterEach(() => { cleanup(root); cleanup(state); delete process.env.C2C_STATE_DIR; });
const approve = () => approvePlan(ws, {file:"plan.md", taskId:"synthetic-task", revision:1, confirmation:"Synthetic human approval fixture, not a live authorization"});

describe("approved handoff", () => {
  it("preserves approved text independently of edits to the discussion file", () => {
    const plan = approve();
    write(root,"plan.md","Changed unapproved goal");
    expect(activePlan(ws)?.text).toBe(plan.text);
    expect(() => beginPlan(ws)).toThrow(/changed since approval/);
    expect(() => approve()).toThrow(/revision already exists/);
  });
  it("refuses duplicate execution and captures committed plus untracked changes", () => {
    const plan = approve(); beginPlan(ws);
    write(root,"src/index.ts","export const answer = 43;\n");
    git(root,"add","src/index.ts"); git(root,"commit","-m","synthetic small task");
    write(root,"test-result.txt","synthetic evidence\n");
    expect(() => beginPlan(ws)).toThrow(/already started/);
    const evidence = captureEvidence(ws, plan, {testedSnapshot:snapshotWorkspace(ws).digest, unverified:["No browser check"], blockers:[]});
    expect(evidence.diff).toContain("answer = 43");
    expect(evidence.code.head).not.toBe(plan.baseline.head);
    expect(evidence.untrackedFiles.find(f=>f.path === "test-result.txt")?.content).toContain("synthetic evidence");
    expect(evidence.source).toBe("executor_report");
    expect(evidence.unverified).toContain("No browser check");
    expect(captureEvidence(ws, plan, {testedSnapshot:snapshotWorkspace(ws).digest, unverified:["No browser check"], blockers:[]}).id).toBe(evidence.id);
  });
  it("rejects test results for a different code snapshot", () => {
    const plan = approve(); const before = snapshotWorkspace(ws).digest;
    write(root,"src/index.ts","changed\n");
    expect(() => captureEvidence(ws,plan,{testedSnapshot:before})).toThrow(/Tested snapshot differs/);
  });
  it("recovers approval interrupted between archive and checkpoint without restarting execution", () => {
    const plan = approve();
    fs.rmSync(sessionFile(ws.id)); // simulate archive saved, checkpoint not yet saved
    expect(approve()).toEqual(plan);
    expect(activePlan(ws)?.digest).toBe(plan.digest);
    beginPlan(ws);
    write(root,"src/index.ts","export const answer = 43;\n");
    expect(approve()).toEqual(plan);
    expect(readSession(ws.id)?.checkpoint?.protocolState).toBe("EXECUTING");
  });
  it("keeps the iteration across revisions and rejects approval rollback", () => {
    const first = approve(); beginPlan(ws);
    writeSession(ws.id,mergeSession(readSession(ws.id),{iteration:2,checkpoint:{protocolState:"EXECUTED_LOCAL"}}));
    write(root,"plan.md","Synthetic revised acceptance criteria approved by fixture human");
    const second = approvePlan(ws,{file:"plan.md",taskId:first.taskId,revision:2,confirmation:"Synthetic revision approval"});
    expect(second.digest).not.toBe(first.digest);
    expect(readSession(ws.id)?.checkpoint?.iteration).toBe(2);
    write(root,"plan.md",first.text);
    expect(approve).toThrow(/revision must increase/);
    expect(activePlan(ws)?.revision).toBe(2);
  });
  it("omits synthetic credentials and Git metadata from snapshots", () => {
    write(root,".env","SYNTHETIC_SECRET=fixture\n");
    git(root,"add","-f",".env");
    const snapshot = snapshotWorkspace(ws);
    expect(snapshot.files.some(f=>f.path === ".env" || f.path.startsWith(".git/"))).toBe(false);
    expect(snapshot.omitted).toBeGreaterThan(0);
  });
  it("keeps approval and checkpoint when forgetting a long chat", () => {
    const plan = approve();
    writeSession(ws.id,mergeSession(readSession(ws.id),{conversationMode:"long-chat",url:"https://chatgpt.com/c/synthetic"}));
    clearChatPointer(ws.id);
    expect(activePlan(ws)?.digest).toBe(plan.digest);
    expect(readSession(ws.id)?.url).toBeUndefined();
  });
  it("does not inherit an earlier task's plan or problems", () => {
    approve();
    const old = mergeSession(readSession(ws.id),{checkpoint:{knownIssues:"Old issue"}});
    const next = mergeSession(old,{taskId:"new-task",checkpoint:{protocolState:"INIT"}});
    expect(next.checkpoint?.approvedPlan).toBeUndefined();
    expect(next.checkpoint?.knownIssues).toBeUndefined();
    expect(next.checkpoint?.iteration).toBe(0);
  });
  it("fails closed on damaged state rather than starting another task", () => {
    approve();
    fs.writeFileSync(sessionFile(ws.id),'{"incomplete":');
    expect(() => readSession(ws.id)).toThrow(/damaged/);
  });
  it("fingerprints tracked lockfiles even when they are hidden from routine listings", () => {
    write(root,"dependency.lock","synthetic version one");
    git(root,"add","dependency.lock"); git(root,"commit","-m","synthetic lockfile");
    const before = snapshotWorkspace(ws).digest;
    write(root,"dependency.lock","synthetic version two");
    expect(snapshotWorkspace(ws).digest).not.toBe(before);
  });
  it("rejects task IDs that could escape the state directory", () => {
    expect(()=>approvePlan(ws,{file:"plan.md",taskId:"../escape",revision:1,confirmation:"fixture"})).toThrow();
  });
});
