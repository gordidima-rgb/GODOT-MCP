# AI Client Setup

Use `docs/MCP_CAPABILITIES.md` as the shared tool map for Codex, Claude, and any other MCP-capable client.
Use `docs/MCP_AGENT_INSTRUCTIONS.md` as the instruction-first operating model: the AI client plans and writes Godot-specific content, while MCP JavaScript tools stay as safe primitives.

## Codex

```toml
[mcp_servers.godotMCP]
command = "node"
args = [ "<PROJECT_ROOT>/tools/mcp-godot/src/server.mjs", "--project-root", "<PROJECT_ROOT>" ]
startup_timeout_sec = 20
env = { GODOT_PROJECT_ROOT = "<PROJECT_ROOT>", GODOT_MCP_PORT = "8765" }
```

Replace `<PROJECT_ROOT>` with the folder that contains `project.godot`. If you used the PowerShell installer, copy the ready block from `godot-mcp.codex.toml` instead.

Then restart Codex and ask it to run:

```text
godot_help category overview
godot_agent_instructions client codex task "<your task>"
godot_doctor
godot_project_scan
godot_check_errors
```

## Claude Desktop

Add the same local stdio server to the Claude Desktop MCP config. Replace `<PROJECT_ROOT>` with the folder that contains `project.godot`.

```json
{
  "mcpServers": {
    "godotMCP": {
      "command": "node",
      "args": [
        "<PROJECT_ROOT>/tools/mcp-godot/src/server.mjs",
        "--project-root",
        "<PROJECT_ROOT>"
      ],
      "env": {
        "GODOT_PROJECT_ROOT": "<PROJECT_ROOT>",
        "GODOT_MCP_PORT": "8765"
      }
    }
  }
}
```

After reconnecting Claude, ask it to read `docs/MCP_AGENT_INSTRUCTIONS.md` and `docs/MCP_CAPABILITIES.md`, then start with `godot_agent_instructions`, `godot_help`, `godot_doctor`, `godot_project_scan`, and `godot_check_errors`.

## Shared Rules

- Use Godot 4.x APIs only.
- Keep all file changes inside the project root.
- Use `res://` paths for Godot-facing references.
- Use `godot_agent_instructions` first so planning stays in the AI client and MCP JS tools stay as safe primitives.
- For complex or unfamiliar mechanics, search GitHub, YouTube, official Godot docs, and credible web sources before implementing; record useful source links and license notes.
- Never write real API keys to source files or logs.
- Start with project scan, scene list, and error checks before larger edits.
- Use dry runs before larger scene/script writes.
- If gameplay scripts changed, run the game or target scene and inspect the Godot console.
- If visible scene objects changed, capture a screenshot and inspect placement.
