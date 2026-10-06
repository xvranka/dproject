# Server

## Setup

From the project root:

```
python3 -m venv .venv
source .venv/bin/activate
pip install flask flask-cors
```

## Running

Data must be processed once before the server can serve it (only needs to be re-run when the raw source data changes):

```
python server/scripts/dataProcessor.py
```

Then start the server (run from the project root, not from `server/scripts/`, since dataset paths are relative to the project root):

```
python server/scripts/main.py
```

The API is available at `http://localhost:5050`. Fetch a dataset with:

```
GET /api/data/<dataset_id>
```

e.g. `http://localhost:5050/api/data/ai-subfield-100k`

Note: port 5000 is avoided on purpose — on macOS it's used by the AirPlay Receiver service (`ControlCenter`), which otherwise silently intercepts requests instead of Flask.
