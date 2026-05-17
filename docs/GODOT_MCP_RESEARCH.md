# Godot MCP Research Notes

This document records the ideas adopted from public Godot MCP projects and what remains intentionally out of scope for this local project skeleton.

## Sources Reviewed

- `youichi-uda/godot-mcp-pro`: WebSocket architecture between a Node.js MCP server and Godot EditorPlugin, JSON-RPC 2.0, modes for different client tool limits, heartbeat/reconnect/error suggestions, and a broad feature comparison.
- `Coding-Solo/godot-mcp`: practical baseline for editor launch, project run, debug output capture, project analysis, scene management, UID helpers, and environment variables such as `GODOT_PATH`/`DEBUG`.
- `slangwald/godot-mcp`: clear split between stdio MCP server, editor TCP bridge, and optional game/runtime TCP bridge for screenshots, input, runtime tree, and output logs.
- `alexmeckes/godot-mcp`: strong `godot_help` pattern, task/category/tool-specific discovery, coverage matrix, and workflow-oriented documentation.
- `HaD0Yun/Gopeak-godot-mcp`: compact/full/legacy tool profiles, setup-gated optional groups, runtime/testing/LSP/DAP ambitions, and CI-style validation commands.

## Adopted Now

- Added `godot_help` for tool discovery, workflows, coverage, safety notes, generation notes, and per-tool usage templates.
- Added `godot_bridge_status` so the MCP server can detect the optional Godot editor bridge.
- Added `GODOT_MCP_READ_ONLY`/`READ_ONLY_MODE` guard to block write/run/generation tools without hiding inspection tools.
- Kept the local bridge architecture: Codex/AI client talks MCP stdio to Node.js, while Godot EditorPlugin can expose localhost editor operations.
- Documented capability coverage instead of pretending the skeleton can do every Godot operation.
- Preserved strict project-root path sandboxing and no arbitrary shell execution.
- Split provider adapters from the MCP tool surface.

## Deferred On Purpose

- WebSocket bridge with heartbeat/reconnect. Current bridge is a minimal localhost TCP bridge; WebSocket can be added later if the editor workflow needs persistent sessions.
- Runtime autoload bridge for screenshots/input/runtime tree. This requires explicit project opt-in and should not be injected silently.
- UndoRedo-backed editor mutations. The current EditorPlugin uses Godot API, but full UndoRedo integration needs a more complete command model.
- LSP/DAP/ClassDB introspection. Useful, but setup-gated and not part of a stable first foundation.
- Large tool-profile paging. The current tool count is small; profile modes matter later if the surface grows.
- Delete node/file tools. They are intentionally absent for project safety.

## Local Direction

Keep this project conservative:

1. Prefer read/inspect tools first.
2. Use file-based `.tscn` edits only for simple text scenes.
3. Use `addons/ai_mcp_bridge/` for live editor/API-backed operations.
4. Queue generation jobs by default when providers are absent.
5. Add runtime/debug tools only after the editor bridge is stable and the user explicitly wants them.
