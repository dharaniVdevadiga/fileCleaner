# tests/test_analyzer.py
import os
from pathlib import Path
from backend.analyzer import analyze_images
import shutil

def test_analyze_images(tmp_path):
    assets = Path(__file__).parent / "assets"
    src = assets / "blurry.jpg"
    assert src.exists(), "tests/assets/blurry.jpg not found"

    # copy into temp dir that analyze_images will scan
    dst = tmp_path / "blurry.jpg"
    shutil.copyfile(src, dst)

    results = analyze_images(str(tmp_path))
    assert isinstance(results, list)
    assert len(results) == 1, f"Expected 1 item, got {len(results)}"
    item = results[0]
    assert item["file"] == "blurry.jpg"
    assert "status" in item and "action" in item
