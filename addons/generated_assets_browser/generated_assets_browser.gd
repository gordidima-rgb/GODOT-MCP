@tool
extends EditorPlugin

var _dock: VBoxContainer

func _enter_tree() -> void:
    _dock = VBoxContainer.new()
    _dock.name = "Generated Assets"
    var label := Label.new()
    label.text = "Generated assets live under res://assets/generated/."
    _dock.add_child(label)
    add_control_to_dock(DOCK_SLOT_LEFT_BR, _dock)

func _exit_tree() -> void:
    if _dock != null:
        remove_control_from_docks(_dock)
        _dock.queue_free()
        _dock = null
