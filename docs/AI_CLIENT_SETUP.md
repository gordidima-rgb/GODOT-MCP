# AI Client Setup

Use this MCP server from Codex:

```toml
[mcp_servers.godotMCP]
command = "node"
args = [ "<PROJECT_ROOT>/tools/mcp-godot/src/server.mjs", "--project-root", "<PROJECT_ROOT>" ]
startup_timeout_sec = 20
env = { GODOT_PROJECT_ROOT = "<PROJECT_ROOT>", GODOT_MCP_PORT = "8765" }
```

Replace `<PROJECT_ROOT>` with the folder that contains `project.godot`. If you used the PowerShell installer, copy the ready block from `godot-mcp.codex.toml` instead.

Then restart Codex and ask it to run `godot_doctor` first.

## Shared Rules

- Use Godot 4.x APIs only.
- Keep all file changes inside the project root.
- Never write real API keys to source files or logs.
- Start with project scan, scene list, and error checks before larger edits.
