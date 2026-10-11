import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll } from "vitest";

// No real Git config, Cloudflare credentials or C2C state in tests.
const isolated = fs.mkdtempSync(path.join(os.tmpdir(), "c2c-test-isolation-"));
process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";
process.env.C2C_STATE_DIR = path.join(isolated,"state");
process.env.TUNNEL_ORIGIN_CERT = path.join(isolated,"missing-cert.pem");
process.env.TUNNEL_CRED_FILE = path.join(isolated,"missing-credential.json");
afterAll(()=>fs.rmSync(isolated,{recursive:true,force:true}));
