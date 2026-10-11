import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, makeGitRepo, makeTmpDir, write } from "./helpers.js";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let root: string, state: string;
function cli(...args: string[]) {
  return spawnSync(process.execPath,["--import","tsx/esm",path.join(project,"src/cli/index.ts"),...args,"-w",root],{
    cwd:project,encoding:"utf8",timeout:30000,
    env:{...process.env,C2C_STATE_DIR:state,GIT_CONFIG_GLOBAL:"/dev/null",GIT_CONFIG_SYSTEM:"/dev/null",GIT_CEILING_DIRECTORIES:path.dirname(root)},
  });
}
function ok(...args: string[]): string {
  const r=cli(...args); expect(r.status, r.stderr).toBe(0); return r.stdout;
}
beforeEach(()=>{
  root=makeTmpDir("handoff-cli"); state=makeTmpDir("handoff-cli-state"); makeGitRepo(root);
  write(root,"plan.md","Synthetic plan: change answer to 43; verify exact value; user reviews after the test.");
});
afterEach(()=>{cleanup(root);cleanup(state);});

it("completes a local small task, preserves ambiguous delivery and separates review from approval", ()=>{
  const approval=JSON.parse(ok("plan","approve","--file","plan.md","--task","demo","--revision","1","--user-confirmation","Synthetic human fixture"));
  ok("plan","begin");
  write(root,"src/index.ts","export const answer = 43;\n");
  const snapshot=JSON.parse(ok("plan","snapshot"));
  // Actual local assertion against the synthetic implementation, not invented output.
  const tested=spawnSync(process.execPath,["--import","tsx/esm","--input-type=module","-e",`import assert from 'node:assert/strict'; import {answer} from ${JSON.stringify(path.join(root,"src/index.ts"))}; assert.equal(answer,43); console.log('1 synthetic assertion passed');`],{encoding:"utf8"});
  expect(tested.status).toBe(0);
  const output=write(state,"test-output.txt",tested.stdout+tested.stderr);
  ok("record","--task","demo","--iteration","1","--tests","1 synthetic assertion passed","--command","node: assert.equal(answer,43)","--output-file",output,"--exit-code","0","--tested-snapshot",snapshot.digest,"--unverified","Real browser not exercised");
  const packet=JSON.parse(ok("handoff","export","--task","demo","--iteration","1"));
  expect(packet.approvedPlan.digest).toBe(approval.digest);
  expect(packet.executorReport.evidence.diff).toContain("answer = 43");
  expect(packet.testOutput.text).toContain("1 synthetic assertion passed");
  expect(packet.reviewerReport).toBeNull();
  expect(packet.currentSnapshotMatches).toBe(true);
  ok("handoff","delivery","--message",packet.messageId,"--status","uncertain");
  const retry=JSON.parse(ok("handoff","export","--task","demo","--iteration","1"));
  expect(retry.messageId).toBe(packet.messageId); expect(retry.delivery).toBe("uncertain");
  expect(cli("record","--task","demo","--iteration","1").status).not.toBe(0);
  expect(cli("handoff","delivery","--message",packet.messageId,"--status","confirmed").status).not.toBe(0);
  ok("handoff","delivery","--message",packet.messageId,"--status","confirmed","--confirmation","Synthetic recipient receipt fixture");
  ok("handoff","review","--message",packet.messageId,"--reviewer","Synthetic reviewer","--checked","saved diff and test-output ID","--decision","needs_user","--notes","Human decision required; no browser test");
  const reviewed=JSON.parse(ok("handoff","export","--task","demo","--iteration","1"));
  expect(reviewed.reviewerReport.source).toBe("reviewer_report");
  expect(reviewed.approvedPlan.digest).toBe(approval.digest);
  const saved=JSON.parse(ok("session","--json"));
  expect(saved.session.checkpoint.waitingFor).toBe("USER");
  write(root,"plan.md","Synthetic human-approved revision: retain 43 and check it again at the next milestone.");
  const second=JSON.parse(ok("plan","approve","--file","plan.md","--task","demo","--revision","2","--user-confirmation","Synthetic human revision fixture"));
  ok("plan","begin");
  expect(cli("record","--task","demo","--iteration","0").status).not.toBe(0);
  ok("record","--task","demo","--iteration","2","--unverified","No additional test in this fixture milestone");
  const secondPacket=JSON.parse(ok("handoff","export","--task","demo","--iteration","2"));
  expect(secondPacket.approvedPlan.digest).toBe(second.digest);
  expect(secondPacket.approvedPlan.revision).toBe(2);
  expect(secondPacket.messageId).not.toBe(packet.messageId);
  expect(secondPacket.delivery).toBe("prepared");
  expect(secondPacket.reviewerReport).toBeNull();
  expect(cli("handoff","export","--task","demo","--iteration","1").status).not.toBe(0);
  fs.renameSync(path.join(root,".git"),path.join(state,"synthetic-git-backup"));
  const offline=JSON.parse(ok("handoff","export","--task","demo","--iteration","2"));
  expect(offline.messageId).toBe(secondPacket.messageId);
  expect(offline.currentSnapshotMatches).toBeNull();
  expect(offline.currentSnapshotNote).toContain("unavailable");
  expect(fs.existsSync(path.join(state,"runtime"))).toBe(false);
});

it("doctor defaults to diagnosis and does not create runtime or edit configuration", ()=>{
  const result=cli("doctor","--json");
  expect(result.status).toBe(1);
  const report=JSON.parse(result.stdout);
  expect(report.report.bridge.ok).toBe(false);
  expect(fs.existsSync(path.join(state,"runtime"))).toBe(false);
  expect(report.report.sandbox.detail).toContain("unchanged");
});
