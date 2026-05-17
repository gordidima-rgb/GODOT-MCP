@tool
extends EditorPlugin

func _enter_tree() -> void:
    # Add real import UI here after the MCP asset import path is validated.
    add_tool_menu_item("Asset Import Helper: Show Status", _show_status)

func _exit_tree() -> void:
    remove_tool_menu_item("Asset Import Helper: Show Status")

func _show_status() -> void:
    print("Asset Import Helper is installed. Use the MCP import_image/import_3d_model tools for safe project-local imports.")
