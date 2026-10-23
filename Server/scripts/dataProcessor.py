# processing raw data
# computation of coordinates, embeddings, positioning algorithm...
import json
import logging
import os
import time
from config import colsVariation, positioningFunc, embeddingMethod, drmethod
from randomPositioning import randomPositioning
from embeddingPositioning import embeddingPositioning

# logging helpers
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

POSITIONING_FUNCS = {
    "randomPositioning": randomPositioning,
    "embeddingPositioning": embeddingPositioning,
}

# TODO: entrypoint for data retrieval,
# so far testing data
def dbLogin():
    return "server/data/ai_subfield_100k_all_columns.json"

# loading downloaded data from path
def loadData(path):
    log.info("loading %s", path)
    start = time.perf_counter()
    with open(path, "r") as f:
        data = json.load(f)
    log.info("loaded %d rows in %.1fs", len(data["data"]), time.perf_counter() - start)
    return data

# formatting of the processed data file name
def outputPath():
    # <raw file name>_<colsVariation>_<positioningFunc>[_<embeddingMethod>_<drmethod>].json
    folder, fileName = os.path.split(dbLogin())
    name = os.path.splitext(fileName)[0] + "_" + colsVariation + "_" + positioningFunc
    if positioningFunc == "embeddingPositioning":
        name += "_" + embeddingMethod + "_" + drmethod
    return os.path.join(folder, name + ".json")

# write data with outputPath func
def writeData(data):
    path = outputPath()
    log.info("writing %d entries to %s", len(data), path)
    with open(path, "w") as f:
        json.dump(data, f)
    log.info("written %.1f MB", os.path.getsize(path) / 1e6)

# columns to keep variations
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
        "primary_topic",
    ]},
    {"name": "variation2", "cols": []},
    {"name": "variation3", "cols": []},
    {"name": "variation4", "cols": []},
    {"name": "variation5", "cols": []},
]

# main function to begin processing of data
def processData(data, colsVariation, positioningFunc):
    cols = next(v["cols"] for v in colsToProcess if v["name"] == colsVariation)
    log.info("processing: cols variation '%s' (%d columns), positioning '%s'", colsVariation, len(cols), positioningFunc.__name__)
    rawData = [{col: entry[col] for col in cols} for entry in data["data"]]
    return positioningFunc(rawData)

log.info("config: colsVariation=%s positioningFunc=%s embeddingMethod=%s drmethod=%s", colsVariation, positioningFunc, embeddingMethod, drmethod)
dbConnection = dbLogin()
data = loadData(dbConnection)
data = processData(data, colsVariation, POSITIONING_FUNCS[positioningFunc])
writeData(data)
log.info("all done")
