# tests/test_file_ops.py
import os
from backend.file_ops import apply_actions

def test_apply_delete(tmp_path):
    file_path = tmp_path / "to_delete.jpg"
    file_path.write_text("dummy")

    actions = [{"path": str(file_path), "action": "delete"}]
    result = apply_actions(actions)
    
    assert str(file_path) in result["deleted"]
    assert not file_path.exists()

def test_apply_move(tmp_path):
    source = tmp_path / "to_move.jpg"
    source.write_text("dummy")
    target_folder = tmp_path / "Moved"

    actions = [{
        "path": str(source),
        "action": "move",
        "target_folder": str(target_folder)
    }]
    result = apply_actions(actions)

    new_path = target_folder / "to_move.jpg"
    assert str(new_path) in result["moved"]
    assert new_path.exists()
