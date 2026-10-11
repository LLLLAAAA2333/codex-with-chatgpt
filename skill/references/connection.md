# Optional live connection (macOS)

Read only when the user explicitly requests an actual connection. Local manual
handoff remains usable when a connection is declined or unavailable.

## Permissions and prerequisites

Explain what is requested before taking an action not already authorized:
- dependency/runtime or cloudflared installation;
- installed Skill replacement or Codex configuration edits;
- starting the bridge and a public HTTPS tunnel;
- ChatGPT OAuth authorization and connector changes;
- Cloudflare login, domain/tunnel provisioning, service restart or GitHub actions.

Do not read real tokens, browser profiles/cookies or unrelated private chats.
The one-time pairing code is the only credential used in the visible pairing UI.
A requested live handoff includes selecting or creating its dedicated target
chat and sending the workspace identity check. Do not ask the user to identify
or create it. Inspect only the saved workspace chat or the dedicated chat you
create, and the bound Project page when needed. Do not search unrelated history
to guess a binding. A request to edit this Skill alone does not start a live handoff.

The checkout's CLI is `node <checkout>/bin/c2c.js`. Use `-w <project>` on workspace
commands. `c2c doctor --no-fix` diagnoses; `--fix` explicitly requests repair and
may start a bridge/tunnel. Neither doctor nor setup changes Codex configuration.
`sandbox-allow` is a separate operation requiring permission, never a startup step.
No automated daily updates, installations, Skill replacement or restarts.

## Establishing a requested connection

1. Inspect saved `session --json`, `prefs --json`, `tunnel status --json`, and
   `doctor --no-fix --json`. A null session or `new-workspace` means unbound,
   not a browser or OAuth failure. If the connection is healthy, go directly to
   automatic conversation binding below; skip setup, pairing and connector
   settings. Explain missing prerequisites; never install them merely because
   a diagnostic reports them missing.
2. Only if a public connection is actually missing and no choice is recorded,
   ask whether the user wants a temporary public URL or already has a Cloudflare
   domain and explicitly wants a stable hostname. Reuse an existing choice.
   `tunnel choose --mode named --zone <domain>` can start Cloudflare authorization
   and provisioning; obtain that permission before invoking it. A declined or
   failed named setup does not implicitly authorize a temporary public tunnel.
3. Only when setup is needed and bridge/public-connection permission exists,
   run `setup -w <project> --json`.
   Without public permission, do not invoke setup's default tunnel path.
4. Configure through a visible browser by default; do not ask the user to choose
   a setup mode. Honor an explicit manual preference unless the user requests
   automation. Do not infer OAuth permission from the setup-mode preference.
5. Use the current host's documented browser tools and one visible tab. The old
   `setupBrowserRuntime` / `agent.browsers` APIs are not a required dependency.
   If tools cannot perform a step, report the specific limitation and preserve
   state for manual handoff; do not present tool unavailability as a login request.

Existing UI destinations (verify the actual page before acting):
- developer mode: `https://chatgpt.com/#settings/Security`
- connector management: `https://chatgpt.com/plugins`
- create: `https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins`

Use only this workspace's saved `connectorName` and current `mcpUrl`. Reuse its
existing authorization: never reconnect, recreate the connector or generate a
pairing code just because a chat is new. When setup or repair genuinely requires
OAuth, select OAuth and generate a fresh `c2c pair --json -w <project>` only when
the authorization page is ready; pairing codes expire. Ask the user to handle
login, MFA/CAPTCHA or required consent only when the visible UI or an explicit
authentication failure establishes that it is needed. Explain the concrete step
and resume automatically after completion; do not ask again whether to continue.
Never type or retrieve OAuth tokens. Do not wait for a hardcoded tool count on a
settings screen; validate in the intended conversation with `workspace_info`.
Verify workspace identity before saving/replacing its chat URL.

## Automatic conversation binding

1. Prefer the chat already validated for this workspace in the current Codex
   conversation; otherwise open the saved `session.url`. This applies to both
   `long-chat` and `project` mode, including a new Codex conversation. The CLI's
   `reuseSavedChat: false` hint for project mode alone is not a reason to replace
   an accessible, valid saved chat.
2. If no chat is bound, create one automatically in the saved Project when its
   exact `projectUrl` exists. Without a Project binding, create a dedicated
   ordinary ChatGPT chat and use `long-chat` mode; do not require a Project or
   choose an existing one by display name. Use a workspace-specific title when
   the UI allows it. Respect an explicitly requested destination.
3. In the target chat, use the exact workspace connector to request
   `workspace_info` and compare its returned workspace identity with the local
   workspace. A settings badge or a text-only claim without a successful tool
   result is insufficient. A workspace mismatch blocks binding and sending
   project evidence; correct the connector selection and recheck first.
4. After verification, save the actual conversation URL from the browser:
   `c2c session set -w <project> --mode long-chat --url <verified-chat-url> --connector-name <exact-name>`
   For a bound Project, use `--mode project --project-url <saved-project-url>`
   instead of `--mode long-chat`. Read `session --json` back to confirm the saved
   binding. Do not clear the checkpoint or overwrite task/plan fields.
5. If a saved chat is explicitly unavailable, create a replacement in the same
   bound Project, or an ordinary chat for long-chat mode. Keep the old saved URL
   until the replacement passes verification. A login wall requires login, not
   a replacement chat. An unavailable Project is a destination problem; preserve
   its binding and report it instead of silently moving to a different Project.

If creation or verification times out, inspect the same visible tab and wait for
loading/generation to finish before taking another action. Do not create another
chat or send the same check again while the outcome is uncertain. Never upload the whole
repository into project files. Project instructions should name the workspace
and connector, not an expiring public URL. They should state that ChatGPT advises
and reviews while the human authorizes scope; use the review instruction in
`<checkout>/docs/protocol.md`.

A verified new chat receives the saved approved plan and handoff packet when
that delivery is in the requested scope; it must not
reconstruct authority from project memory or invent a fresh task. Keep the old
saved URL until the new conversation confirms the correct workspace. Clearing a
chat pointer must not discard an active checkpoint. If no plan or packet exists,
establish the binding without fabricating one or starting an implementation task.

## Sending and recovery

Follow the main Skill's stable-message-ID delivery steps for both automated and
manual sending. Check the current visible chat after a timeout. Generating or a
browser timeout does not mean failure. Do not type again while it is generating.
Only visible receipt or human acknowledgement permits marking delivery confirmed.
A review receipt is distinct from review completion and from human approval.

If the bridge state is unknown, do not start another process or delete a connector.
If diagnosis succeeds but ChatGPT fails, do not churn the tunnel automatically.
Distinguish connection, browser, binding and authentication failures. A timeout,
missing tool, or unbound chat does not justify reauthorization. For an explicit
authentication failure, inspect this connector's authorization state and allow
normal renewal; request user reauthorization only if authentication remains
invalid or the UI requires consent. Reuse an existing login session throughout.
If a temporary address expired, explain the needed repair and obtain permission
for restarting and updating/recreating only this workspace's connector. Do not
click reconnect against a known dead URL. Preserve plan, evidence and saved chat
until the replacement validates `workspace_info`.

If a stable-hostname tunnel needs renewed Cloudflare login, explain and obtain
permission; do not delete the ChatGPT connector merely because the tunnel failed.
After two explicit failures of the same settings step, switch to guided manual
steps; a timeout while loading/generating is not an explicit failure. Guide one
concrete action at a time. If configuration cannot complete, retain local state
and export the manual handoff packet instead of repeating configuration indefinitely.
