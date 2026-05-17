@tool
extends VBoxContainer

const DEFAULT_PORT := 8765
const MAX_HISTORY := 8
const INSTRUCTIONS_PATH := "res://docs/AI_AGENT_INSTRUCTIONS.md"
const CLIENT_SETUP_PATH := "res://docs/AI_CLIENT_SETUP.md"
const ALLOWED_ROOT_TYPES := ["Node2D", "Node3D", "Control", "CharacterBody2D", "CharacterBody3D"]
const CLIENT_NAMES := ["Codex", "Visual Studio / VS Code", "Claude"]

var _running := false
var _server := TCPServer.new()
var _clients: Array[StreamPeerTCP] = []
var _last_commands: Array[String] = []
var _last_errors: Array[String] = []

var _status_label: Label
var _port_label: Label
var _commands_label: RichTextLabel
var _errors_label: RichTextLabel
var _client_select: OptionButton
var _client_setup_label: RichTextLabel
var _instruction_edit: TextEdit
var _start_button: Button
var _stop_button: Button

func _init() -> void:
    name = "AI MCP Bridge"

func _ready() -> void:
    _build_ui()
    _refresh_status()
    set_process(true)

func _process(_delta: float) -> void:
    if not _running:
        return
    _accept_new_clients()
    _read_client_commands()

func _build_ui() -> void:
    var title := Label.new()
    title.text = "AI MCP Bridge"
    title.add_theme_font_size_override("font_size", 18)
    add_child(title)

    _status_label = Label.new()
    add_child(_status_label)

    _port_label = Label.new()
    add_child(_port_label)

    var row := HBoxContainer.new()
    add_child(row)

    _start_button = Button.new()
    _start_button.text = "Start"
    _start_button.pressed.connect(_on_start_pressed)
    row.add_child(_start_button)

    _stop_button = Button.new()
    _stop_button.text = "Stop"
    _stop_button.pressed.connect(_on_stop_pressed)
    row.add_child(_stop_button)

    _build_instruction_ui()
    _build_chat_ui()

    var commands_title := Label.new()
    commands_title.text = "Last commands"
    add_child(commands_title)

    _commands_label = RichTextLabel.new()
    _commands_label.custom_minimum_size = Vector2(260, 110)
    _commands_label.fit_content = true
    add_child(_commands_label)

    var errors_title := Label.new()
    errors_title.text = "Last errors"
    add_child(errors_title)

    _errors_label = RichTextLabel.new()
    _errors_label.custom_minimum_size = Vector2(260, 110)
    _errors_label.fit_content = true
    add_child(_errors_label)

func _build_instruction_ui() -> void:
    var separator := HSeparator.new()
    add_child(separator)

    var client_title := Label.new()
    client_title.text = "AI client"
    add_child(client_title)

    _client_select = OptionButton.new()
    for client_name in CLIENT_NAMES:
        _client_select.add_item(String(client_name))
    _client_select.item_selected.connect(_on_client_selected)
    add_child(_client_select)

    _client_setup_label = RichTextLabel.new()
    _client_setup_label.custom_minimum_size = Vector2(360, 120)
    _client_setup_label.fit_content = true
    add_child(_client_setup_label)

    var setup_button := Button.new()
    setup_button.text = "Save client setup"
    setup_button.tooltip_text = "Write docs/AI_CLIENT_SETUP.md with setup notes for the selected client."
    setup_button.pressed.connect(_on_save_client_setup_pressed)
    add_child(setup_button)

    var instruction_title := Label.new()
    instruction_title.text = "Instruction for AI agent"
    add_child(instruction_title)

    _instruction_edit = TextEdit.new()
    _instruction_edit.custom_minimum_size = Vector2(360, 150)
    _instruction_edit.placeholder_text = "Describe what the AI should build, inspect, or fix in this Godot project."
    _instruction_edit.text = _default_instruction_text()
    add_child(_instruction_edit)

    var save_instruction_button := Button.new()
    save_instruction_button.text = "Save instruction"
    save_instruction_button.tooltip_text = "Write docs/AI_AGENT_INSTRUCTIONS.md for Codex, VS Code, or Claude."
    save_instruction_button.pressed.connect(_on_save_instruction_pressed)
    add_child(save_instruction_button)

    _on_client_selected(0)

func _build_chat_ui() -> void:
    var separator := HSeparator.new()
    add_child(separator)

    var chat_script := load("res://addons/ai_mcp_bridge/chat_panel.gd") as GDScript
    if chat_script == null:
        var error_label := Label.new()
        error_label.text = "Editor chat could not load. Check the Output panel."
        error_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
        add_child(error_label)
        record_error("Could not load chat_panel.gd.")
        return

    var chat_panel := chat_script.new() as Control
    if chat_panel == null:
        var error_label := Label.new()
        error_label.text = "Editor chat could not start. Check the Output panel."
        error_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
        add_child(error_label)
        record_error("Could not create chat panel.")
        return
    add_child(chat_panel)

func _on_start_pressed() -> void:
    # This bridge listens only on localhost. It is for editor-side commands, not public networking.
    var error := _server.listen(DEFAULT_PORT, "127.0.0.1")
    if error != OK:
        record_error("Could not start bridge: %s" % error_string(error))
        return
    _running = true
    record_command("Start bridge requested")
    _refresh_status()

func _on_stop_pressed() -> void:
    _server.stop()
    _clients.clear()
    _running = false
    record_command("Stop bridge requested")
    _refresh_status()

func record_command(command: String) -> void:
    _last_commands.push_front(command)
    _last_commands = _last_commands.slice(0, MAX_HISTORY)
    _refresh_history()

func record_error(error: String) -> void:
    _last_errors.push_front(error)
    _last_errors = _last_errors.slice(0, MAX_HISTORY)
    _refresh_history()

func _refresh_status() -> void:
    if _status_label == null:
        return
    _status_label.text = "Status: " + ("running" if _running else "stopped")
    _port_label.text = "Port: %d on 127.0.0.1" % DEFAULT_PORT
    _start_button.disabled = _running
    _stop_button.disabled = not _running
    _refresh_history()

func _refresh_history() -> void:
    if _commands_label == null:
        return
    _commands_label.text = "\n".join(_last_commands) if not _last_commands.is_empty() else "No commands yet."
    _errors_label.text = "\n".join(_last_errors) if not _last_errors.is_empty() else "No errors yet."

func _on_client_selected(_index: int) -> void:
    if _client_setup_label == null:
        return
    _client_setup_label.text = _client_setup_text(_current_client_name())

func _on_save_instruction_pressed() -> void:
    var content := _instruction_edit.text.strip_edges()
    if content.is_empty():
        content = _default_instruction_text()
    var header := "# AI Agent Instructions\n\n"
    header += "Selected client: %s\n\n" % _current_client_name()
    header += "Project root: `%s`\n\n" % _project_root_for_docs()
    var result := _write_text_file(INSTRUCTIONS_PATH, header + content + "\n")
    if bool(result.get("ok", false)):
        record_command("Saved AI instructions to %s" % INSTRUCTIONS_PATH)
    else:
        record_error(String(result.get("error", "Could not save AI instructions.")))

func _on_save_client_setup_pressed() -> void:
    var content := "# AI Client Setup\n\n"
    content += _client_setup_text(_current_client_name())
    content += "\n\n## Shared Rules\n\n"
    content += "- Use Godot 4.x APIs only.\n"
    content += "- Keep all file changes inside the project root.\n"
    content += "- Never write real API keys to source files or logs.\n"
    content += "- Start with project scan, scene list, and error checks before larger edits.\n"
    var result := _write_text_file(CLIENT_SETUP_PATH, content)
    if bool(result.get("ok", false)):
        record_command("Saved client setup to %s" % CLIENT_SETUP_PATH)
    else:
        record_error(String(result.get("error", "Could not save client setup.")))

func _current_client_name() -> String:
    if _client_select == null:
        return String(CLIENT_NAMES[0])
    var selected := _client_select.selected
    if selected < 0 or selected >= CLIENT_NAMES.size():
        return String(CLIENT_NAMES[0])
    return String(CLIENT_NAMES[selected])

func _default_instruction_text() -> String:
    var lines := [
        "Work with this Godot 4.x project through the safe MCP tools.",
        "First inspect the project, list scenes and scripts, then make small scoped changes.",
        "Do not delete existing files unless the user explicitly asks for it.",
        "When creating scripts, add short comments that help a beginner understand the code.",
        "If image or 3D generation providers are set to none, save generation jobs instead of calling external APIs."
    ]
    return "\n".join(lines)

func _client_setup_text(client_name: String) -> String:
    var project_root := _project_root_for_docs()
    match client_name:
        "Codex":
            return "\n".join([
                "Use this MCP server from Codex:",
                "",
                "```toml",
                "[mcp_servers.godotMCP]",
                "command = \"node\"",
                "args = [ \"" + project_root + "/tools/mcp-godot/src/server.mjs\", \"--project-root\", \"" + project_root + "\" ]",
                "startup_timeout_sec = 20",
                "```",
                "",
                "Then restart Codex and ask it to run `godot_project_scan` first."
            ])
        "Visual Studio / VS Code":
            return "\n".join([
                "Use the MCP server with a Visual Studio or VS Code extension that supports MCP stdio servers.",
                "",
                "Server command:",
                "`node " + project_root + "/tools/mcp-godot/src/server.mjs --project-root " + project_root + "`",
                "",
                "Keep provider keys in `.env`; do not paste secrets into editor prompts."
            ])
        "Claude":
            return "\n".join([
                "Add this project as a local stdio MCP server in Claude Desktop or another Claude MCP client.",
                "",
                "Server command:",
                "`node " + project_root + "/tools/mcp-godot/src/server.mjs --project-root " + project_root + "`",
                "",
                "After reconnecting, start with `godot_help` and `godot_project_scan`."
            ])
        _:
            return "Select a supported AI client."

func _write_text_file(res_path: String, content: String) -> Dictionary:
    if not _is_safe_res_path(res_path, ".md"):
        return _error_response("Unsafe documentation path.")
    var docs_dir := ProjectSettings.globalize_path("res://docs")
    var dir_error := DirAccess.make_dir_recursive_absolute(docs_dir)
    if dir_error != OK:
        return _error_response("Could not create docs folder: %s" % error_string(dir_error))
    var file := FileAccess.open(res_path, FileAccess.WRITE)
    if file == null:
        return _error_response("Could not open documentation file for writing.")
    file.store_string(content)
    file.close()
    return {"ok": true, "path": res_path}

func _project_root_for_docs() -> String:
    return ProjectSettings.globalize_path("res://").replace("\\", "/").trim_suffix("/")

func _accept_new_clients() -> void:
    while _server.is_connection_available():
        var client := _server.take_connection()
        if client != null:
            _clients.append(client)
            record_command("Client connected")

func _read_client_commands() -> void:
    for client in _clients.duplicate():
        if client.get_status() != StreamPeerTCP.STATUS_CONNECTED:
            _clients.erase(client)
            continue
        var available := client.get_available_bytes()
        if available <= 0:
            continue
        var text := client.get_utf8_string(available).strip_edges()
        if text.is_empty():
            continue
        var parsed: Variant = JSON.parse_string(text)
        var response := _handle_bridge_command(parsed)
        client.put_data((JSON.stringify(response) + "\n").to_utf8_buffer())

func _handle_bridge_command(request: Variant) -> Dictionary:
    if typeof(request) != TYPE_DICTIONARY:
        return _error_response("Request must be a JSON object.")
    var command := String(request.get("command", ""))
    record_command(command)
    match command:
        "status":
            return {"ok": true, "running": _running, "port": DEFAULT_PORT}
        "create_script":
            return _bridge_create_script(request)
        "create_scene":
            return _bridge_create_scene(request)
        "add_node":
            return _bridge_add_node(request)
        "update_node":
            return _bridge_update_node(request)
        "attach_script":
            return _bridge_attach_script(request)
        _:
            return _error_response("Unsupported bridge command: %s" % command)

func _bridge_create_script(request: Dictionary) -> Dictionary:
    var script_path := String(request.get("path", ""))
    if not _is_safe_res_path(script_path, ".gd"):
        return _error_response("Unsafe or invalid script path.")
    if FileAccess.file_exists(script_path) and not bool(request.get("overwrite", false)):
        return _error_response("Script exists. Pass overwrite=true to replace it.")
    var base := String(request.get("extends", "Node"))
    if not _is_identifier(base):
        return _error_response("Invalid extends type.")
    var content := String(request.get("content", "extends %s\n\n# Created by AI MCP Bridge inside the Godot editor.\nfunc _ready() -> void:\n    pass\n" % base))
    var file := FileAccess.open(script_path, FileAccess.WRITE)
    if file == null:
        return _error_response("Could not open script for writing.")
    file.store_string(content)
    file.close()
    return {"ok": true, "path": script_path}

func _bridge_create_scene(request: Dictionary) -> Dictionary:
    var scene_path := String(request.get("path", ""))
    if not _is_safe_res_path(scene_path, ".tscn"):
        return _error_response("Unsafe or invalid scene path.")
    if FileAccess.file_exists(scene_path) and not bool(request.get("overwrite", false)):
        return _error_response("Scene exists. Pass overwrite=true to replace it.")
    var root_type := String(request.get("root_type", "Node2D"))
    var root := _make_node(root_type)
    if root == null:
        return _error_response("Unsupported root type: %s" % root_type)
    root.name = String(request.get("root_name", "GeneratedScene"))
    var packed := PackedScene.new()
    var pack_error := packed.pack(root)
    root.free()
    if pack_error != OK:
        return _error_response("Could not pack scene: %s" % error_string(pack_error))
    var save_error := ResourceSaver.save(packed, scene_path)
    if save_error != OK:
        return _error_response("Could not save scene: %s" % error_string(save_error))
    return {"ok": true, "path": scene_path, "root_type": root_type}

func _bridge_add_node(request: Dictionary) -> Dictionary:
    var scene_path := String(request.get("scene_path", ""))
    if not _is_safe_res_path(scene_path, ".tscn"):
        return _error_response("Unsafe or invalid scene path.")
    var root := _load_scene_root(scene_path)
    if root == null:
        return _error_response("Could not load scene.")
    var parent_path := String(request.get("parent_path", "."))
    var parent := root if parent_path in [".", "/", root.name] else root.get_node_or_null(parent_path)
    if parent == null:
        root.free()
        return _error_response("Parent node not found.")
    var node := _make_node(String(request.get("node_type", "")))
    if node == null:
        root.free()
        return _error_response("Unsupported node type.")
    node.name = String(request.get("node_name", "GeneratedNode"))
    parent.add_child(node)
    node.owner = root
    _apply_basic_properties(node, request.get("properties", {}))
    return _save_scene_root(scene_path, root)

func _bridge_update_node(request: Dictionary) -> Dictionary:
    var scene_path := String(request.get("scene_path", ""))
    if not _is_safe_res_path(scene_path, ".tscn"):
        return _error_response("Unsafe or invalid scene path.")
    var root := _load_scene_root(scene_path)
    if root == null:
        return _error_response("Could not load scene.")
    var node_path := String(request.get("node_path", "."))
    var node := root if node_path in [".", "/", root.name] else root.get_node_or_null(node_path)
    if node == null:
        root.free()
        return _error_response("Node not found.")
    _apply_basic_properties(node, request.get("properties", {}))
    return _save_scene_root(scene_path, root)

func _bridge_attach_script(request: Dictionary) -> Dictionary:
    var script_path := String(request.get("script_path", ""))
    if not _is_safe_res_path(script_path, ".gd"):
        return _error_response("Unsafe or invalid script path.")
    if not FileAccess.file_exists(script_path):
        var created := _bridge_create_script({"path": script_path, "extends": request.get("extends", "Node")})
        if not bool(created.get("ok", false)):
            return created
    var scene_path := String(request.get("scene_path", ""))
    if not _is_safe_res_path(scene_path, ".tscn"):
        return _error_response("Unsafe or invalid scene path.")
    var root := _load_scene_root(scene_path)
    if root == null:
        return _error_response("Could not load scene.")
    var node_path := String(request.get("node_path", "."))
    var node := root if node_path in [".", "/", root.name] else root.get_node_or_null(node_path)
    if node == null:
        root.free()
        return _error_response("Node not found.")
    node.set_script(load(script_path))
    return _save_scene_root(scene_path, root)

func _load_scene_root(scene_path: String) -> Node:
    var packed := load(scene_path) as PackedScene
    if packed == null:
        return null
    return packed.instantiate()

func _save_scene_root(scene_path: String, root: Node) -> Dictionary:
    var packed := PackedScene.new()
    var pack_error := packed.pack(root)
    root.free()
    if pack_error != OK:
        return _error_response("Could not pack scene: %s" % error_string(pack_error))
    var save_error := ResourceSaver.save(packed, scene_path)
    if save_error != OK:
        return _error_response("Could not save scene: %s" % error_string(save_error))
    return {"ok": true, "path": scene_path}

func _make_node(type_name: String) -> Node:
    match type_name:
        "Node":
            return Node.new()
        "Node2D":
            return Node2D.new()
        "Node3D":
            return Node3D.new()
        "Control":
            return Control.new()
        "CharacterBody2D":
            return CharacterBody2D.new()
        "CharacterBody3D":
            return CharacterBody3D.new()
        "Sprite2D":
            return Sprite2D.new()
        "Camera2D":
            return Camera2D.new()
        "Camera3D":
            return Camera3D.new()
        "Marker2D":
            return Marker2D.new()
        "Marker3D":
            return Marker3D.new()
        "Label":
            return Label.new()
        "Button":
            return Button.new()
        _:
            return null

func _apply_basic_properties(node: Node, properties: Variant) -> void:
    if typeof(properties) != TYPE_DICTIONARY:
        return
    for key in properties.keys():
        var value: Variant = properties[key]
        match String(key):
            "position":
                if node is Node2D and value is Array and value.size() == 2:
                    node.position = Vector2(float(value[0]), float(value[1]))
                elif node is Node3D and value is Array and value.size() == 3:
                    node.position = Vector3(float(value[0]), float(value[1]), float(value[2]))
            "scale":
                if node is Node2D and value is Array and value.size() == 2:
                    node.scale = Vector2(float(value[0]), float(value[1]))
                elif node is Node3D and value is Array and value.size() == 3:
                    node.scale = Vector3(float(value[0]), float(value[1]), float(value[2]))
            "rotation":
                if node is Node2D:
                    node.rotation = float(value)
                elif node is Node3D and value is Array and value.size() == 3:
                    node.rotation = Vector3(float(value[0]), float(value[1]), float(value[2]))
            "visible":
                if node is CanvasItem:
                    node.visible = bool(value)
                elif node is Node3D:
                    node.visible = bool(value)
            "text":
                if node is Label or node is Button:
                    node.text = String(value)

func _is_safe_res_path(res_path: String, extension: String) -> bool:
    if not res_path.begins_with("res://"):
        return false
    if res_path.contains("..") or res_path.contains("\\") or res_path.contains("\u0000"):
        return false
    if extension != "" and not res_path.ends_with(extension):
        return false
    var absolute := ProjectSettings.globalize_path(res_path)
    var root := ProjectSettings.globalize_path("res://")
    return absolute.begins_with(root)

func _is_identifier(value: String) -> bool:
    return value.is_valid_identifier()

func _error_response(message: String) -> Dictionary:
    record_error(message)
    return {"ok": false, "error": message}
