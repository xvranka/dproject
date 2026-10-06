import json
import random

# CONFIG FOR PROCESSING
colsVariation = "default"

def dbLogin():
    return "server/data/ai_subfield_100k_all_columns.json"

def loadData(path):
    with open(path, "r") as f:
        data = json.load(f)
    return data

def writeData(data, path):
    with open(path, "w") as f:
        json.dump(data, f)

def randomColor():
    return "#{:02x}{:02x}{:02x}".format(
        random.randint(0, 255),
        random.randint(0, 255),
        random.randint(0, 255),
    )

def randomPositioning(data):
    result = []
    for entry in data:
        entry["x"] = round(random.uniform(-100, 100), 4)
        entry["y"] = round(random.uniform(-100, 100), 4)
        entry["z"] = round(random.uniform(-100, 100), 4)
        entry["color"] = randomColor()
        result.append(entry)
    return result

colsToProcess = [
    {"name": "default", "cols": [
        "id",
        "title",
        "publication_year",
        "language",
        "cited_by_count",
        "domain",
        "field_name",
        "subfield",
        "topics",
    ]},
    {"name": "variation2", "cols": []},
    {"name": "variation3", "cols": []},
    {"name": "variation4", "cols": []},
    {"name": "variation5", "cols": []},
]

def processData(data, colsVariation, positioningFunc):
    cols = next(v["cols"] for v in colsToProcess if v["name"] == colsVariation)
    rawData = [{col: entry[col] for col in cols} for entry in data["data"]]
    return positioningFunc(rawData)

dbConnection = dbLogin()
data = loadData(dbConnection)
data = processData(data, "default", randomPositioning)
writeData(data, "server/data/ai_subfield_100k_all_columns_processed_" + colsVariation + ".json")
