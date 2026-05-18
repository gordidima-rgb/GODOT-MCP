# Godot Setup Skill

Use this skill when installing GODOT-MCP, connecting an MCP client, fixing setup problems, or helping a user prepare a Godot project for AI-assisted work.

## Prerequisites

- Godot 4.x
- Node.js 18 or newer
- A Godot project folder containing `project.godot`
- Optional: enabled `AI MCP Bridge` Godot plugin for editor-backed tools

## Windows Install Flow

1. Open PowerShell in the folder that contains `project.godot`.
2. Run the installer from the README.
3. Restart Godot.
4. Enable or verify the `AI MCP Bridge` dock.
5. Press `Start` in the bridge dock.
6. Connect the AI client to the local MCP server.
7. Run `godot_doctor`.

## Universal MCP Command

```text
node <PROJECT_ROOT>/tools/mcp-godot/src/server.mjs --project-root <PROJECT_ROOT>
```

## Universal MCP Environment

```text
GODOT_PROJECT_ROOT=<PROJECT_ROOT>
GODOT_MCP_PORT=8765
```

## Common Fixes

| Symptom | Fix |
| --- | --- |
| AI client does not see tools | Restart the AI client after changing MCP config. |
| Bridge unreachable | Open Godot, enable `AI MCP Bridge`, choose port, press `Start`. |
| Godot CLI not found | Install Godot on PATH or set `GODOT_CLI` in `.env`. |
| Port occupied | Choose another bridge port and update MCP config. |
| Provider unavailable | Use provider `none`, or configure `.env` and restart the MCP client. |

## Validation

After setup, run:

```text
godot_doctor
godot_project_scan
godot_check_errors
```

Report any setup limitation clearly instead of pretending the environment is ready.
