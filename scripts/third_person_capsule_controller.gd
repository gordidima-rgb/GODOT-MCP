extends CharacterBody3D

@export var walk_speed: float = 5.0
@export var sprint_speed: float = 8.0
@export var acceleration: float = 18.0
@export var jump_velocity: float = 5.0
@export var turn_speed: float = 12.0
@export var mouse_sensitivity: float = 0.003
@export var camera_height: float = 1.35
@export var min_pitch_degrees: float = -55.0
@export var max_pitch_degrees: float = 20.0

@onready var camera_rig: Node3D = $"../CameraRig"
@onready var camera_pitch: Node3D = $"../CameraRig/CameraPitch"

var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")
var _camera_yaw: float = 0.0
var _camera_pitch: float = deg_to_rad(-12.0)

func _ready() -> void:
    # Capture the mouse so moving it rotates the third-person camera.
    Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
    _sync_camera()

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventMouseMotion and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
        _camera_yaw -= event.relative.x * mouse_sensitivity
        _camera_pitch -= event.relative.y * mouse_sensitivity
        _camera_pitch = clamp(_camera_pitch, deg_to_rad(min_pitch_degrees), deg_to_rad(max_pitch_degrees))

    if event.is_action_pressed("ui_cancel"):
        Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)

    if event is InputEventMouseButton and event.pressed:
        Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

func _physics_process(delta: float) -> void:
    _sync_camera()

    if not is_on_floor():
        velocity.y -= _gravity * delta
    elif _jump_pressed():
        velocity.y = jump_velocity
    else:
        # A tiny downward value keeps floor detection stable on slopes and edges.
        velocity.y = -0.1

    var input_vector := _read_move_input()
    var move_direction := _camera_relative_direction(input_vector)
    var current_speed := sprint_speed if _sprint_pressed() else walk_speed
    var target_velocity := move_direction * current_speed
    var horizontal_velocity := Vector3(velocity.x, 0.0, velocity.z)
    horizontal_velocity = horizontal_velocity.move_toward(target_velocity, acceleration * delta)

    velocity.x = horizontal_velocity.x
    velocity.z = horizontal_velocity.z

    if move_direction.length() > 0.01:
        _face_move_direction(move_direction, delta)

    move_and_slide()

func _sync_camera() -> void:
    camera_rig.global_position = global_position + Vector3(0.0, camera_height, 0.0)
    camera_rig.rotation.y = _camera_yaw
    camera_pitch.rotation.x = _camera_pitch

func _read_move_input() -> Vector2:
    var input_vector := Vector2.ZERO

    if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
        input_vector.x -= 1.0
    if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
        input_vector.x += 1.0
    if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
        input_vector.y += 1.0
    if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
        input_vector.y -= 1.0

    return input_vector.normalized()

func _camera_relative_direction(input_vector: Vector2) -> Vector3:
    if input_vector == Vector2.ZERO:
        return Vector3.ZERO

    var yaw_basis := Basis(Vector3.UP, _camera_yaw)
    var camera_forward := -yaw_basis.z
    var camera_right := yaw_basis.x
    return (camera_right * input_vector.x + camera_forward * input_vector.y).normalized()

func _face_move_direction(move_direction: Vector3, delta: float) -> void:
    # Godot characters face local -Z by convention, so this angle points -Z at movement.
    var target_yaw := atan2(-move_direction.x, -move_direction.z)
    rotation.y = lerp_angle(rotation.y, target_yaw, turn_speed * delta)

func _jump_pressed() -> bool:
    return Input.is_key_pressed(KEY_SPACE)

func _sprint_pressed() -> bool:
    return Input.is_key_pressed(KEY_SHIFT)
