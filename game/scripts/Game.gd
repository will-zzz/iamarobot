extends Control

var names = []

func _ready():
	if names.size() > 0:
		display_people(names)

func set_names(names_array):
	names = names_array
	if is_inside_tree():
		display_people(names)

func display_people(names_array):
	pass