from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path

from .analyzer import analyze_images
from .file_ops import apply_actions as fo_apply_actions

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.get("/ping")
def ping():
    return jsonify({"status": "ok"}), 200

@app.post("/analyze")
def analyze():
    data = request.get_json(silent=True) or {}
    folder_path = data.get("folder_path")
    if not folder_path or not Path(folder_path).exists():
        return jsonify({"error": "Missing or invalid folder_path"}), 400
    try:
        results = analyze_images(folder_path)
        return jsonify(results), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.post("/apply-actions")
def apply():
    data = request.get_json(silent=True) or {}
    actions = data.get("actions")
    base_folder = data.get("base_folder")
    if not base_folder or not isinstance(actions, list):
        return jsonify({"error": "Missing base_folder or actions"}), 400
    try:
        result = fo_apply_actions(base_folder, actions)  
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5000)