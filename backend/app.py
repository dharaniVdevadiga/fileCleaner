from flask import Flask, request, jsonify
from flask_cors import CORS

from .analyzer import analyze_images
from .file_ops import apply_actions

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.get("/ping")
def ping():
    return jsonify({"status": "ok"}), 200


@app.post("/analyze")
def analyze():
    data = request.get_json(silent=True) or {}
    folder_path = data.get("folder_path")
    if not folder_path:
        return jsonify({"error": "Missing folder_path"}), 400

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
    if not actions:
        return jsonify({"error": "Missing actions"}), 400
    try:
        result = apply_actions(actions, base_folder)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5000)
