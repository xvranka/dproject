# functions for data retrieval and optimisation techniques
import json

def fetchDataset(dataset):
    with open(dataset["processedPath"], "r") as f:
        data = json.load(f)
    return data

_searchIndexCache = {}

def getSearchIndex(dataset):
    # lightweight (id, title, authors) index built once from the raw file, which holds the authors
    key = dataset["rawPath"]
    if key not in _searchIndexCache:
        with open(key, "r") as f:
            raw = json.load(f)
        _searchIndexCache[key] = [
            {
                "id": entry["id"],
                "title": entry["title"],
                "authors": entry["authors"] or "",
                "titleLower": entry["title"].lower(),
            }
            for entry in raw["data"]
        ]
    return _searchIndexCache[key]

def searchInDataset(dataset, keyword, offset=0, limit=20):
    keyword = keyword.lower()
    matches = [e for e in getSearchIndex(dataset) if keyword in e["titleLower"]]
    page = matches[offset:offset + limit]
    return {
        "total": len(matches),
        "results": [{"id": e["id"], "title": e["title"], "authors": e["authors"]} for e in page],
    }

# TODO: optimisation techniques and research