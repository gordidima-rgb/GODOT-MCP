# AI Client Setup

Use this repository as a local MCP-powered Godot integration package. Keep the project path updated if you clone it somewhere else.

## Codex

Add the local MCP server to Codex:

```toml
[mcp_servers.godotMCP]
command = "node"
args = [ "C:/Users/gdima/Documents/learn-personal/tools/mcp-godot/src/server.mjs", "--project-root", "C:/Users/gdima/Documents/learn-personal" ]
startup_timeout_sec = 20
```

Restart Codex and ask it to run `godot_project_scan` first.

## Visual Studio / VS Code

Use the MCP server with a Visual Studio or VS Code extension that supports MCP stdio servers.

```powershell
node C:/Users/gdima/Documents/learn-personal/tools/mcp-godot/src/server.mjs --project-root C:/Users/gdima/Documents/learn-personal
```

Keep provider keys in `.env`; do not paste secrets into editor prompts.

## Claude

Add this project as a local stdio MCP server in Claude Desktop or another Claude MCP client.

```powershell
node C:/Users/gdima/Documents/learn-personal/tools/mcp-godot/src/server.mjs --project-root C:/Users/gdima/Documents/learn-personal
```

After reconnecting, start with `godot_help` and `godot_project_scan`.

## Shared Rules

- Use Godot 4.x APIs only.
- Keep all file changes inside the project root.
- Never write real API keys to source files or logs.
- Start with project scan, scene list, and error checks before larger edits.
