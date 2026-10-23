# flask server w endpoints
from flask import Flask, jsonify, request
from flask_cors import CORS
import dataHandler
from config import DATASETS

app = Flask(__name__)
CORS(app)

@app.route("/api/data/<dataset_id>", methods=["GET"])
def getData(dataset_id):
    dataset = next((d for d in DATASETS if d["id"] == dataset_id), None)
    if dataset is None:
        return jsonify({"error": "dataset not found"}), 404
    data = dataHandler.fetchDataset(dataset)
    return jsonify(data)

@app.route("/api/data/<dataset_id>/search", methods=["GET"])
def searchData(dataset_id):
    dataset = next((d for d in DATASETS if d["id"] == dataset_id), None)
    if dataset is None:
        return jsonify({"error": "dataset not found"}), 404
    keyword = request.args.get("keyword", "").strip()
    if not keyword:
        return jsonify({"error": "keyword is required"}), 400
    offset = max(request.args.get("offset", 0, type=int), 0)
    limit = min(max(request.args.get("limit", 20, type=int), 1), 100)
    data = dataHandler.searchInDataset(dataset, keyword, offset, limit)
    return jsonify(data)


if __name__ == "__main__":
    app.run(debug=True, port=5050)
