# security-sandbox

## When To Use

Use this skill when reading or writing project files, running local tools, validating paths, handling secrets, or designing MCP tool safety.

## Rules

- Normalize every path before use.
- Reject paths that leave the project root.
- Allow only whitelisted Godot CLI commands.
- Store secrets in `.env`; keep `.env` ignored.
- Sanitize logs before showing output.

## Limits

- No arbitrary shell commands.
- No recursive delete/move without explicit approval.
- No secrets in logs, generated docs, or committed files.

## Result Checklist

- Path checks are active.
- Shell execution is absent or whitelisted.
- `.env` is ignored and `.env.example` exists.
- Logs and outputs do not contain secrets.
