from flask import Flask, request, jsonify
from backend.analyzer import analyze_images
from file_ops import apply_actions

app = Flask(__name__)

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({ "status": "ok" }), 200

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    folder_path = data.get("folder_path")
    if not folder_path:
        return jsonify({ "error": "Missing folder_path" }), 400

    results = analyze_images(folder_path)
    return jsonify(results), 200

@app.route("/apply-actions", methods=["POST"])
def apply():
    data = request.get_json()
    actions = data.get("actions")
    base_folder = data.get("base_folder") 
    if not actions:
        return jsonify({ "error": "Missing actions" }), 400

    result = apply_actions(actions, base_folder)
    return jsonify(result), 200

if __name__ == "__main__":
    app.run(port=5000)