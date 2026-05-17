@tool
extends VBoxContainer

const CHAT_JOB_DIR := "res://generation_jobs/chat"
const MAX_CHAT_MESSAGES := 12

var _chat_messages: Array[Dictionary] = []
var _http_request: HTTPRequest
var _provider_label: Label
var _chat_log: RichTextLabel
var _input: TextEdit
var _send_button: Button
var _queue_button: Button
var _env_cache: Dictionary = {}

func _ready() -> void:
    _http_request = HTTPRequest.new()
    _http_request.request_completed.connect(_on_chat_request_completed)
    add_child(_http_request)

    _build_ui()
    _reload_env()
    _refresh_provider_status()

func _build_ui() -> void:
    var title := Label.new()
    title.text = "Editor chat"
    title.add_theme_font_size_override("font_size", 16)
    add_child(title)

    var provider_row := HBoxContainer.new()
    add_child(provider_row)

    _provider_label = Label.new()
    _provider_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    provider_row.add_child(_provider_label)

    var reload_button := Button.new()
    reload_button.text = "Reload .env"
    reload_button.tooltip_text = "Reload AI_CHAT_* settings from .env and environment variables."
    reload_button.pressed.connect(_on_reload_env_pressed)
    provider_row.add_child(reload_button)

    _chat_log = RichTextLabel.new()
    _chat_log.custom_minimum_size = Vector2(320, 190)
    _chat_log.fit_content = false
    _chat_log.scroll_following = true
    _chat_log.text = "No chat messages yet."
    add_child(_chat_log)

    _input = TextEdit.new()
    _input.custom_minimum_size = Vector2(320, 100)
    _input.placeholder_text = "Ask the local AI provider about this Godot project."
    add_child(_input)

    var button_row := HBoxContainer.new()
    add_child(button_row)

    _send_button = Button.new()
    _send_button.text = "Send"
    _send_button.tooltip_text = "Send to AI_CHAT_PROVIDER. If provider is none, a chat job is saved instead."
    _send_button.pressed.connect(_on_send_pressed)
    button_row.add_child(_send_button)

    _queue_button = Button.new()
    _queue_button.text = "Queue"
    _queue_button.tooltip_text = "Save the prompt as generation_jobs/chat/*.json without network access."
    _queue_button.pressed.connect(_on_queue_pressed)
    button_row.add_child(_queue_button)

func _on_reload_env_pressed() -> void:
    _reload_env()
    _refresh_provider_status()
    _append_status("Reloaded .env settings.")

func _on_send_pressed() -> void:
    var prompt := _input.text.strip_edges()
    if prompt.is_empty():
        _append_status("Write a prompt first.")
        return

    var provider := _chat_provider()
    if provider == "none":
        _queue_prompt(prompt, "provider_none")
        _input.text = ""
        return

    if provider != "openai_compatible" and provider != "openai":
        _append_status("Unsupported AI_CHAT_PROVIDER: %s" % provider)
        return

    var base_url := _env_value("AI_CHAT_BASE_URL", "").strip_edges()
    var model := _env_value("AI_CHAT_MODEL", "").strip_edges()
    if base_url.is_empty():
        _append_status("Set AI_CHAT_BASE_URL in .env before sending.")
        return
    if model.is_empty():
        _append_status("Set AI_CHAT_MODEL in .env before sending.")
        return

    var api_key := _env_value("AI_CHAT_API_KEY", "").strip_edges()
    if base_url.begins_with("https://api.openai.com") and api_key.is_empty():
        _append_status("Set AI_CHAT_API_KEY in .env for api.openai.com.")
        return

    _append_message("user", prompt)
    _input.text = ""
    _send_button.disabled = true
    _queue_button.disabled = true

    var request_error := _send_openai_compatible_request(base_url, model, api_key)
    if request_error != OK:
        _send_button.disabled = false
        _queue_button.disabled = false
        _append_status("Could not start chat request: %s" % error_string(request_error))

func _on_queue_pressed() -> void:
    var prompt := _input.text.strip_edges()
    if prompt.is_empty():
        _append_status("Write a prompt first.")
        return
    _queue_prompt(prompt, "manual_queue")
    _input.text = ""

func _send_openai_compatible_request(base_url: String, model: String, api_key: String) -> Error:
    var messages: Array[Dictionary] = []
    var system_prompt := _env_value("AI_CHAT_SYSTEM_PROMPT", _default_system_prompt()).strip_edges()
    if not system_prompt.is_empty():
        messages.append({"role": "system", "content": system_prompt})
    for message in _chat_messages:
        var role := String(message.get("role", "user"))
        if role != "user" and role != "assistant":
            continue
        messages.append({
            "role": role,
            "content": String(message.get("content", ""))
        })

    var body := {
        "model": model,
        "messages": messages,
        "temperature": _chat_temperature(),
        "stream": false
    }
    var headers := ["Content-Type: application/json"]
    if not api_key.is_empty():
        headers.append("Authorization: Bearer " + api_key)

    return _http_request.request(_chat_url(base_url), headers, HTTPClient.METHOD_POST, JSON.stringify(body))

func _on_chat_request_completed(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
    _send_button.disabled = false
    _queue_button.disabled = false

    if result != HTTPRequest.RESULT_SUCCESS:
        _append_status("Chat request failed: %s" % _http_result_name(result))
        return
    if response_code < 200 or response_code >= 300:
        _append_status("Chat provider returned HTTP %d." % response_code)
        return

    var text := body.get_string_from_utf8()
    var parsed: Variant = JSON.parse_string(text)
    if typeof(parsed) != TYPE_DICTIONARY:
        _append_status("Chat provider returned non-JSON response.")
        return

    var response := parsed as Dictionary
    if response.has("error"):
        _append_status("Chat provider error: %s" % _safe_error_message(response.get("error")))
        return

    var answer := _extract_chat_answer(response)
    if answer.is_empty():
        _append_status("Chat provider returned no assistant message.")
        return
    _append_message("assistant", answer)

func _extract_chat_answer(response: Dictionary) -> String:
    var choices: Variant = response.get("choices", [])
    if not (choices is Array):
        return ""
    var choices_array := choices as Array
    if choices_array.is_empty():
        return ""
    var first: Variant = choices_array[0]
    if typeof(first) != TYPE_DICTIONARY:
        return ""
    var message: Variant = (first as Dictionary).get("message", {})
    if typeof(message) != TYPE_DICTIONARY:
        return ""
    return String((message as Dictionary).get("content", "")).strip_edges()

func _queue_prompt(prompt: String, reason: String) -> void:
    var dir_error := DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(CHAT_JOB_DIR))
    if dir_error != OK:
        _append_status("Could not create chat job folder: %s" % error_string(dir_error))
        return

    var stamp := Time.get_datetime_string_from_system(false).replace("-", "").replace(":", "").replace("T", "_")
    var path := "%s/chat_%s.json" % [CHAT_JOB_DIR, stamp]
    var job := {
        "kind": "editor_chat",
        "reason": reason,
        "provider": _chat_provider(),
        "model": _env_value("AI_CHAT_MODEL", ""),
        "prompt": prompt,
        "created_at": Time.get_datetime_string_from_system(false)
    }
    var file := FileAccess.open(path, FileAccess.WRITE)
    if file == null:
        _append_status("Could not write chat job.")
        return
    file.store_string(JSON.stringify(job, "\t"))
    file.close()
    _append_message("queued", prompt)
    _append_status("Saved chat job: %s" % path)

func _append_message(role: String, content: String) -> void:
    _chat_messages.append({"role": role, "content": content})
    while _chat_messages.size() > MAX_CHAT_MESSAGES:
        _chat_messages.pop_front()
    _refresh_chat_log()

func _append_status(message: String) -> void:
    _append_message("status", message)

func _refresh_chat_log() -> void:
    if _chat_log == null:
        return
    if _chat_messages.is_empty():
        _chat_log.text = "No chat messages yet."
        return
    var lines: Array[String] = []
    for message in _chat_messages:
        var role := String(message.get("role", "message")).capitalize()
        var content := String(message.get("content", ""))
        lines.append("%s:\n%s" % [role, content])
    _chat_log.text = "\n\n".join(lines)

func _reload_env() -> void:
    _env_cache.clear()
    if not FileAccess.file_exists("res://.env"):
        return
    var file := FileAccess.open("res://.env", FileAccess.READ)
    if file == null:
        return
    while not file.eof_reached():
        _parse_env_line(file.get_line())
    file.close()

func _parse_env_line(line: String) -> void:
    var clean := line.strip_edges()
    if clean.is_empty() or clean.begins_with("#"):
        return
    var equals_at := clean.find("=")
    if equals_at <= 0:
        return
    var key := clean.substr(0, equals_at).strip_edges()
    var value := clean.substr(equals_at + 1).strip_edges()
    if value.begins_with("\"") and value.ends_with("\""):
        value = value.substr(1, value.length() - 2)
    elif value.begins_with("'") and value.ends_with("'"):
        value = value.substr(1, value.length() - 2)
    _env_cache[key] = value

func _refresh_provider_status() -> void:
    if _provider_label == null:
        return
    var provider := _chat_provider()
    if provider == "none":
        _provider_label.text = "Provider: none"
        return
    var model := _env_value("AI_CHAT_MODEL", "")
    _provider_label.text = "Provider: %s  Model: %s" % [provider, model if not model.is_empty() else "(not set)"]

func _chat_provider() -> String:
    return _env_value("AI_CHAT_PROVIDER", "none").strip_edges().to_lower()

func _chat_temperature() -> float:
    var raw := _env_value("AI_CHAT_TEMPERATURE", "0.2").strip_edges()
    if not raw.is_valid_float():
        return 0.2
    return clampf(float(raw), 0.0, 2.0)

func _chat_url(base_url: String) -> String:
    var clean := base_url.strip_edges().trim_suffix("/")
    if clean.ends_with("/chat/completions"):
        return clean
    return clean + "/chat/completions"

func _env_value(key: String, fallback: String) -> String:
    var from_os := OS.get_environment(key)
    if not from_os.is_empty():
        return from_os
    return String(_env_cache.get(key, fallback))

func _default_system_prompt() -> String:
    return "You are an AI assistant embedded in the Godot editor. Give concise, beginner-friendly Godot 4.x guidance. Do not ask for secrets."

func _safe_error_message(error_value: Variant) -> String:
    var message := ""
    if typeof(error_value) == TYPE_DICTIONARY:
        message = String((error_value as Dictionary).get("message", "Unknown provider error."))
    else:
        message = String(error_value)
    var api_key := _env_value("AI_CHAT_API_KEY", "")
    if not api_key.is_empty():
        message = message.replace(api_key, "[secret]")
    return message

func _http_result_name(result: int) -> String:
    match result:
        HTTPRequest.RESULT_CHUNKED_BODY_SIZE_MISMATCH:
            return "chunked body size mismatch"
        HTTPRequest.RESULT_CANT_CONNECT:
            return "cannot connect"
        HTTPRequest.RESULT_CANT_RESOLVE:
            return "cannot resolve host"
        HTTPRequest.RESULT_CONNECTION_ERROR:
            return "connection error"
        HTTPRequest.RESULT_TLS_HANDSHAKE_ERROR:
            return "TLS handshake error"
        HTTPRequest.RESULT_NO_RESPONSE:
            return "no response"
        HTTPRequest.RESULT_BODY_SIZE_LIMIT_EXCEEDED:
            return "body size limit exceeded"
        HTTPRequest.RESULT_BODY_DECOMPRESS_FAILED:
            return "body decompress failed"
        HTTPRequest.RESULT_REQUEST_FAILED:
            return "request failed"
        HTTPRequest.RESULT_DOWNLOAD_FILE_CANT_OPEN:
            return "download file cannot open"
        HTTPRequest.RESULT_DOWNLOAD_FILE_WRITE_ERROR:
            return "download file write error"
        HTTPRequest.RESULT_REDIRECT_LIMIT_REACHED:
            return "redirect limit reached"
        HTTPRequest.RESULT_TIMEOUT:
            return "timeout"
        _:
            return "unknown error %d" % result
