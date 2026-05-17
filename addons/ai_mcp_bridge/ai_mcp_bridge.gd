@tool
extends EditorPlugin

var _dock: Control
var _panel: Control
var _loading_label: Label

func _get_plugin_name() -> String:
    return "AI MCP Bridge"

func _enter_tree() -> void:
    # This dock is editor-only. It does not run in the exported game.
    _dock = ScrollContainer.new()
    _dock.name = "AI MCP Bridge"
    _dock.custom_minimum_size = Vector2(320, 260)

    _loading_label = Label.new()
    _loading_label.text = "AI MCP Bridge is loading..."
    _loading_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    _dock.add_child(_loading_label)

    add_control_to_dock(DOCK_SLOT_RIGHT_UL, _dock)
    add_tool_menu_item("AI MCP Bridge: reload dock", _reload_dock_from_menu)
    print("AI MCP Bridge plugin loaded. Look for the dock tab on the right side.")
    call_deferred("_build_dock_contents")

func _exit_tree() -> void:
    remove_tool_menu_item("AI MCP Bridge: reload dock")
    if _dock != null:
        remove_control_from_docks(_dock)
        _dock.queue_free()
        _dock = null
        _panel = null
        _loading_label = null

func _reload_dock_from_menu() -> void:
    _build_dock_contents()

func _build_dock_contents() -> void:
    if _dock == null:
        return
    for child in _dock.get_children():
        child.queue_free()
    _loading_label = null

    var panel_script := load("res://addons/ai_mcp_bridge/bridge_panel.gd") as GDScript
    if panel_script == null:
        _show_dock_error("Could not load bridge_panel.gd.")
        return

    _panel = panel_script.new() as Control
    if _panel == null:
        _show_dock_error("Could not create bridge panel.")
        return
    _panel.custom_minimum_size = Vector2(320, 520)
    _dock.add_child(_panel)

func _show_dock_error(message: String) -> void:
    var error_label := Label.new()
    error_label.text = "AI MCP Bridge error:\n" + message + "\nOpen the Output panel for details."
    error_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    _dock.add_child(error_label)
    push_error(message)
