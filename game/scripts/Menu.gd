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
	else:
		print("Error: " + str(response_code))
