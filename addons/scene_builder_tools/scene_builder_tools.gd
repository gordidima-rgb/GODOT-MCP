@tool
extends EditorPlugin

func _enter_tree() -> void:
    add_tool_menu_item("Scene Builder Tools: Show Status", _show_status)

func _exit_tree() -> void:
    remove_tool_menu_item("Scene Builder Tools: Show Status")

func _show_status() -> void:
    print("Scene Builder Tools is installed. Use MCP create_scene/create_script first for safe scaffold operations.")
