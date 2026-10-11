# Security Model

## Trust boundaries

1. **Workspace root** is the smallest authorization boundary. One bridge serves
   exactly one workspace; every token is bound to `workspace_id`; a token for
   project A returns 403 on project B's bridge.
2. **Workspace content is untrusted.** README, comments, diffs may contain
   prompt injection. Every MCP tool description carries an explicit warning and
   tools never grant capabilities based on file content.
3. **The model never sees long-lived credentials.** Computer Use only ever
   handles the one-time pairing code. Access/refresh tokens travel only inside
   the OAuth redirect/token endpoints between ChatGPT's client and the bridge.

## Threat model → mitigations

| Threat | Mitigation |
| --- | --- |
| MCP URL leaks | URL alone is useless: every `/mcp` request requires a valid bearer token (401 without, 403 wrong workspace) |
| Pairing code brute force | 8 chars from a 31-char CSPRNG alphabet (~40 bits), 5 attempts per session, per-IP rate limit (10/min), 5-minute TTL, one-time use, session destroyed on limit |
| OAuth CSRF | `state` round-tripped verbatim; authorization requests are server-side records keyed by random ids |
| Code interception | PKCE S256 mandatory (plain rejected); authorization codes are one-time, 5-minute TTL, bound to client + redirect URI |
| Token theft | Opaque high-entropy tokens; stored only as SHA-256 hashes; access tokens live 1 h; refresh tokens rotate on every use (replay of the old one fails); revocation endpoint + `c2c unpair` |
| Workspace traversal | `realpath` canonicalization of the deepest existing ancestor; containment check against the canonical root; case-insensitive comparison on macOS/Windows; rejects `..`, absolute escapes, backslash tricks, null bytes |
| Symlink escape | Canonicalization resolves symlinks before the containment check (file and directory symlinks both covered by tests) |
| Sensitive files | Deny-by-default patterns (.git files/directories, .env*, keys, SSH, cloud creds, keychains…) enforced at resolve time — reads, listings, and search all pass through the same gate; `git diff` selects allowed literal paths and disables external diff/textconv; Git reads disable fsmonitor and optional locks; `.env.example` allowed |
| Oversized file / diff DoS | read_file caps lines and bytes per response; git_diff paginates by byte offset with hard caps; search caps matches and file sizes |
| Tunnel exposure | Bridge binds 127.0.0.1 only (refuses 0.0.0.0); the only public surface is HTTPS via the tunnel, protected by OAuth; `/health` reveals only a salted workspace hash |
| Admin API abuse | Loopback-only + random admin token (0600 runtime file) + requests with proxy headers (`cf-connecting-ip`, `x-forwarded-for`) rejected; unauthenticated probes get 404 |
| Log credential leakage | Logger redacts token prefixes, bearer headers, token-like parameters, and pairing-code-shaped strings before writing |
| Execution output leak | Codex may nominate test/build/lint logs; a local sanitizer redacts tokens, pairing-code-shaped strings and home paths, truncates size, and refuses private-key blocks entirely. Restricted items are listed without a body. ChatGPT still cannot run commands. |
| Generated media handoff | ChatGPT's connector remains read-only. The local executor explicitly imports the original browser download into a new workspace-relative path; signatures, size, containment and SVG active-content checks are enforced, and existing files are never overwritten. |
| Checkpoint / resume dump | Checkpoints reference archived plans and execution evidence. Manual export includes selected bounded evidence; unknown delivery retains its message ID and requires receipt verification. Resume does not implicitly authorize re-pairing. |

## Token & scope design

Scopes: `workspace.read`, `workspace.search`, `git.read`, `execution.read`,
`offline_access`. Tools enforce scopes individually (`INSUFFICIENT_SCOPE`).
Access tokens: 1 hour. Refresh tokens: 30 days, rotated. All tokens bound to
`workspace_id` and `client_id`.

## Storage

State lives under the OS-convention app dir
(`~/Library/Application Support/codex-with-chatgpt` on macOS), directories 0700,
files 0600. Named-hostname preference and tunnel metadata live there too
(`tunnels/<workspaceId>.json`) — never in the project. Only SHA-256 hashes of
OAuth access/refresh tokens are persisted. The separate local runtime file contains
an admin credential and must remain owner-readable only.

**V1 limitation**: client registrations and token hashes are file-based rather
than OS-keychain-based. OAuth access/refresh tokens are not stored in plaintext. Keychain
integration is a V2 item.

## What ChatGPT can never do (V1)

Write files, delete files, run shell commands, commit, install packages —
these tools do not exist on the server, through the remote MCP interface. Tool annotations alone are not an enforcement boundary.

## Disclosure limits and local authority

Path filters identify names, not all possible sensitive content. A source file,
example file, test output or approved plan can still contain private data. Pattern
redaction is incomplete by design; inspect exported packets before sharing.
Git metadata is denied through file/image/list/search paths, including `.git`
worktree files and canonical aliases. Needed Git identity/diffs use restricted
interfaces with external diff/textconv/fsmonitor callbacks disabled.

Approval references and reviewer declarations are audit records, not authenticated
human signatures or proof of independent testing. A remote model cannot create
local approvals through MCP. Local CLI users remain trusted. New goal/method/
acceptance/permission changes need explicit human confirmation. Normal coding does
not authorize installing dependencies, editing Codex configuration, replacing an
installed Skill, OAuth, public tunnels, restarts or account operations.
