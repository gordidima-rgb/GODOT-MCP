@tool
extends EditorPlugin

var _dock: Control

func _enter_tree() -> void:
    # This dock is editor-only. It does not run in the exported game.
    _dock = preload("res://addons/ai_mcp_bridge/bridge_panel.gd").new()
    add_control_to_dock(DOCK_SLOT_RIGHT_UL, _dock)

func _exit_tree() -> void:
    if _dock != null:
        remove_control_from_docks(_dock)
        _dock.queue_free()
        _dock = null
