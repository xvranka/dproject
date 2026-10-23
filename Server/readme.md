# Server

Flask API that serves the datasets to the client. Raw and processed data live in `server/data/`.

## Layout

```
server/
  data/          raw + processed dataset files (persistent, not baked into the image)
  scripts/
    main.py            Flask API
    config.py          datasets served + processing settings
    dataProcessor.py   offline processing (embeddings + positioning), writes to data/
```

**Important:** all paths in `config.py` and `dataProcessor.py` (e.g. `server/data/...`) are relative to the project root. Always run commands from the project root, locally and in Docker (the container working directory is `/app`, which plays that role).

## Run locally (without Docker)

From the project root:

```
python3 -m venv .venv
source .venv/bin/activate
pip install -r server/requirements.txt
python server/scripts/dataProcessor.py   # once, and again whenever raw data or processing config changes
python server/scripts/main.py
```

API: `http://localhost:5050/api/data/<dataset_id>`, e.g. `http://localhost:5050/api/data/ai-subfield-100k`.
Search: `GET /api/data/<dataset_id>/search?keyword=...&offset=0&limit=20`.

Port 5000 is avoided on purpose: on macOS the AirPlay Receiver (`ControlCenter`) intercepts it.

## Run with Docker

The image contains only the code (`server/scripts`) and dependencies. The data folder is **not** in the image: it is mounted from the host so it survives container restarts, rebuilds and removal. Put the raw dataset file(s) in `server/data/` before starting.

### Dockerfile alone

Build from the project root (the build context must be the root):

```
docker build -f server/Dockerfile -t dproject-server .
```

Run with the data folder mounted and `config.py` mounted (so config edits need no rebuild):

```
docker run -d --name dproject-server -p 5050:5050 \
  -v "$(pwd)/server/data:/app/server/data" \
  -v "$(pwd)/server/scripts/config.py:/app/server/scripts/config.py:ro" \
  dproject-server
```

Then open `http://localhost:5050/api/data/ai-subfield-100k`.

Using a named volume instead of a host folder: replace the first `-v` with `-v dproject-data:/app/server/data`, and copy the raw file in with `docker cp file.json dproject-server:/app/server/data/`.

Logs / stop / remove:

```
docker logs -f dproject-server
docker stop dproject-server && docker rm dproject-server
```

### Docker Compose

`docker-compose.yml` in the project root runs the server and the client (nginx on `http://localhost:8080`, which proxies `/api` to the server). It mounts `./server/data` (read + write) and `config.py` for you.

```
docker compose up -d --build        # build and start everything
docker compose up -d --build server # server only
docker compose logs -f server
docker compose restart server       # after editing config.py
docker compose down
```

The server alone is not published to the host by compose (only the client is, on 8080). To reach the API directly, add `ports: ["5050:5050"]` to the `server` service, or use `http://localhost:8080/api/...` through the client.

## Running dataProcessor in the container

The server only serves already-processed data; run the processor inside the container to (re)generate it. The output is written to `server/data/`, so it persists on the host.

Compose:

```
docker compose exec server python server/scripts/dataProcessor.py
```

Plain Docker:

```
docker exec -it dproject-server python server/scripts/dataProcessor.py
```

Or open a shell and run it by hand:

```
docker compose exec server bash
cd /app && python server/scripts/dataProcessor.py
```

Keep the working directory at `/app`. It is CPU and memory heavy (TF-IDF + UMAP on 100k rows takes a while). Output file name:

```
<raw file name>_<colsVariation>_<positioningFunc>[_<embeddingMethod>_<drmethod>].json
```

After it finishes, make sure `processedPath` in `config.py` points to the new file (see below), then `docker compose restart server`. A one-off container works too, without a running server: `docker compose run --rm server python server/scripts/dataProcessor.py`.

## Configuring `config.py`

### `DATASETS` (what the API serves)

Each entry is one dataset available at `/api/data/<id>`:

```python
DATASETS = [
    {
        "id": "ai-subfield-100k",       # used in the URL
        "name": "AI Subfield 100k",
        "rawPath": "server/data/ai_subfield_100k_all_columns.json",          # raw file, used for search (authors, titles)
        "processedPath": "server/data/ai_subfield_100k_all_columns_default_embeddingPositioning_tfidf.json",  # output of dataProcessor
    },
]
```

- To add a dataset: copy the raw file into `server/data/`, add an entry, process it, set `processedPath`.
- `processedPath` must match the file name `dataProcessor` produced (see the pattern above). It is **not** updated automatically.
- Paths always start with `server/data/` so they land in the persistent folder.
- Note: `dataProcessor.py` currently reads one hard-coded raw file (`dbLogin()`); it does not loop over `DATASETS`.

### Processing settings (used by `dataProcessor.py`)

| Setting | Options | Meaning |
|---|---|---|
| `colsVariation` | `default` | which columns are kept (defined in `colsToProcess` in `dataProcessor.py`) |
| `positioningFunc` | `randomPositioning`, `embeddingPositioning` | random coordinates (fast, for testing) or embeddings + dimensionality reduction |
| `embeddingMethod` | `tfidf` | text embedding, only for `embeddingPositioning` |
| `drmethod` | `umap` | reduction to 3D, only for `embeddingPositioning` |
| `umapSeed` | `None` or an int | `None`: parallel and fast, results vary slightly per run. An int (e.g. `42`): reproducible, but single core |
| `umapJobs` | int | CPU threads when `umapSeed` is `None`. Set to the cores available to Docker |

Changing the settings changes the output file name, so update `processedPath` accordingly. Changes need a rerun of `dataProcessor`; changes to `DATASETS` need a server restart (`docker compose restart server`). With compose, `config.py` is bind-mounted, so no image rebuild is needed; with a plain `docker run` without the `config.py` mount, rebuild the image.

## Notes

- The Flask `CORS` setting is permissive; fine behind the nginx proxy, tighten it if exposing the API directly.
- Gunicorn runs one worker with 4 threads because the raw-data search index is cached in process memory (large for 100k rows).
