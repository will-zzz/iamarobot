extends Control

@onready var http_request = HTTPRequest.new()
@onready var player_container = $PlayerContainer
@onready var text_input = $TextInput
var player_names = []
var current_turn = -1  # -1 means no one is chatting, 0 to 5 are player indices
var turn_timer = 0

func _ready():
	add_child(http_request)
	http_request.request_completed.connect(_on_request_completed)
	start_game()

	# Set the TextInput node for capturing human input
	text_input.connect("text_entered", Callable(self, "_on_text_entered"))

func start_game():
	var url = "http://localhost:3000/start-game"
	var headers = ["Content-Type: application/json"]
	var body = JSON.stringify({"name": "Godot Connect"})
	http_request.request(url, headers, HTTPClient.METHOD_POST, body)
	
func _on_request_completed(result, response_code, headers, body):
	if response_code == 200 or response_code == 201:
		var response_text = body.get_string_from_utf8()
		var json = JSON.parse_string(response_text)
		if json and "players" in json:
			player_names = json["players"]
			print("Received player data:", player_names)  # Debugging line
			player_names.shuffle()  # Randomize order
			display_players()
		else:
			print("Invalid JSON response")
	else:
		print("HTTP Request failed with code:", response_code)

func display_players():
	for player in player_names:
		var player_name = player["name"] if player is Dictionary and "name" in player else str(player)

		var player_cube = ColorRect.new()
		player_cube.custom_minimum_size = Vector2(100, 100)
		player_cube.color = Color(randf(), randf(), randf(), 1.0)  # Random colors

		var label = Label.new()
		label.text = player_name
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

		player_cube.add_child(label)
		player_container.add_child(player_cube)