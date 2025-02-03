extends Control

# Called when the node enters the scene tree for the first time.
func _ready():
	$VBoxContainer/StartButton.pressed.connect(self._on_StartButton_pressed)
	$HTTPRequest.request_completed.connect(self._on_request_completed)

# Called every frame. 'delta' is the elapsed time since the previous frame.
# func _process(delta):
#     pass

func _on_StartButton_pressed():
	var name = $VBoxContainer/NameInput.text
	var json = {"name": name}
	var http_request = $HTTPRequest

	var url = "http://localhost:3000/start-game"
	var headers = ["Content-Type: application/json"]
	var body = JSON.stringify(json)

	http_request.request(url, headers, HTTPClient.METHOD_POST, body)

func _on_request_completed(result, response_code, headers, body):
	if response_code == 201:
		var response = JSON.parse_string(body.get_string_from_utf8())
		print(response)
		
		# Assuming the response contains an array of names
		var names = []
		for player in response.players:
			names.append(player.name)
		
		# Load the new scene
		var game_scene = preload("res://scenes/Game.tscn")
		var game_instance = game_scene.instantiate()
		
		# Pass the names data to the new scene
		game_instance.set_names(names)
		
		# Change the current scene to the new scene
		get_tree().root.call_deferred("add_child", game_instance)
		get_tree().current_scene.queue_free()
		get_tree().current_scene = game_instance
	else:
		print("Error: " + str(response_code))
