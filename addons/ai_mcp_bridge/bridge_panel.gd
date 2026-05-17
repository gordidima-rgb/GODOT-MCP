@tool
extends VBoxContainer

const DEFAULT_PORT := 8765
const MAX_HISTORY := 8
const ALLOWED_ROOT_TYPES := ["Node2D", "Node3D", "Control", "CharacterBody2D", "CharacterBody3D"]

var _running := false
var _server := TCPServer.new()
var _clients: Array[StreamPeerTCP] = []
var _last_commands: Array[String] = []
var _last_errors: Array[String] = []

var _status_label: Label
var _port_label: Label
var _commands_label: RichTextLabel
var _errors_label: RichTextLabel
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
