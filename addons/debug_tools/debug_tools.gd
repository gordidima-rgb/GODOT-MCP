@tool
extends EditorPlugin

var _dock: VBoxContainer

func _enter_tree() -> void:
    _dock = VBoxContainer.new()
    _dock.name = "Debug Tools"
    var label := Label.new()
    label.text = "Debug tools are ready. Run MCP check_errors after file changes."
    _dock.add_child(label)
    add_control_to_dock(DOCK_SLOT_RIGHT_BL, _dock)

func _exit_tree() -> void:
    if _dock != null:
        remove_control_from_docks(_dock)
        _dock.queue_free()
        _dock = null
