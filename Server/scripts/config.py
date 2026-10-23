# DATASETS SERVED BY main.py
DATASETS = [
    {
        "id": "ai-subfield-100k",
        "name": "AI Subfield 100k",
        "rawPath": "server/data/ai_subfield_100k_all_columns.json",
        # "processedPath": "server/data/ai_subfield_100k_all_columns_processed_default.json"
        "processedPath": "server/data/ai_subfield_100k_all_columns_default_embeddingPositioning_tfidf.json"
    },
]

# CONFIG FOR PROCESSING

# choose from:
#   default
colsVariation = "default"

# choose from:
#   randomPositioning
#   embeddingPositioning
positioningFunc = "embeddingPositioning"

# applicable for embeddingPositioning
# choose from:
#   tfidf
embeddingMethod = "tfidf"

# choose from:
#   umap
drmethod = "umap"

# UMAP settings for embeddingPositioning
# umapSeed: None = parallel and fast, results differ slightly between runs
#           integer (e.g. 42) = reproducible, but UMAP then runs on a single core
umapSeed = None
# umapJobs: number of CPU threads, used only when umapSeed is None (M1 Max has 8 performance cores)
umapJobs = 8


