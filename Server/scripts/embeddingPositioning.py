import colorsys
import logging
import time
import config
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize

log = logging.getLogger(__name__)

def assignColor(data, colorCol="primary_topic"):
    # one color per distinct value: sorted values get evenly spaced hues, lightness cycles so neighbouring hues differ
    log.info("colors: assigning by '%s'", colorCol)
    values = sorted({entry.get(colorCol) or "Unknown" for entry in data})
    lightness = (0.45, 0.6, 0.75)
    palette = {}
    for i, value in enumerate(values):
        r, g, b = colorsys.hls_to_rgb(i / len(values), lightness[i % len(lightness)], 0.7)
        palette[value] = "#{:02x}{:02x}{:02x}".format(round(r * 255), round(g * 255), round(b * 255))
    for entry in data:
        entry["color"] = palette[entry.get(colorCol) or "Unknown"]
    log.info("colors: %d distinct values -> %d colors", len(values), len(palette))

def tfidf(data, textCols=("title", "abstract"), nComponents=100, maxFeatures=50000):
    # TF-IDF baseline: one text per entry (missing columns skipped), reduced with SVD to dense vectors
    start = time.perf_counter()
    missing = [col for col in textCols if data and col not in data[0]]
    if missing:
        log.warning("tfidf: columns %s are not in the data, they will be ignored", missing)
    texts = [" ".join(str(entry[col]) for col in textCols if entry.get(col)) for entry in data]
    empty = sum(1 for text in texts if not text)
    log.info("tfidf: built %d texts from %s (%d empty)", len(texts), list(textCols), empty)
    vectorizer = TfidfVectorizer(stop_words="english", max_features=maxFeatures, sublinear_tf=True)
    matrix = vectorizer.fit_transform(texts)
    log.info("tfidf: matrix %s, %.1fs elapsed", matrix.shape, time.perf_counter() - start)
    svd = TruncatedSVD(n_components=nComponents, random_state=42)
    reduced = svd.fit_transform(matrix)
    log.info("tfidf: SVD to %d dims keeps %.1f%% of variance, done in %.1fs",
             nComponents, svd.explained_variance_ratio_.sum() * 100, time.perf_counter() - start)
    return normalize(reduced)

EMBEDDING_METHODS = {
    "tfidf": tfidf,
}

def createEmbeddings(data):
    log.info("embeddings: method '%s'", config.embeddingMethod)
    return EMBEDDING_METHODS[config.embeddingMethod](data)

def umapReduce(embeddings, nNeighbors=15, minDist=0.1):
    # imported here because umap is slow to import and only needed for this method
    import umap
    start = time.perf_counter()
    jobs = 1 if config.umapSeed is not None else config.umapJobs
    log.info("umap: reducing %s to 3D (n_neighbors=%d, min_dist=%s, seed=%s, jobs=%d), this is the slow step",
             embeddings.shape, nNeighbors, minDist, config.umapSeed, jobs)
    reducer = umap.UMAP(n_components=3, n_neighbors=nNeighbors, min_dist=minDist, metric="cosine",
                        random_state=config.umapSeed, n_jobs=jobs, verbose=True)
    coords = reducer.fit_transform(embeddings)
    log.info("umap: done in %.1fs", time.perf_counter() - start)
    return coords

DR_METHODS = {
    "umap": umapReduce,
}

def assignCoordinates(data, embeddings):
    log.info("dimensionality reduction: method '%s'", config.drmethod)
    coords = DR_METHODS[config.drmethod](embeddings)
    # center and scale into the same -100..100 range as randomPositioning
    coords = coords - coords.mean(axis=0)
    coords = coords / abs(coords).max() * 100
    for entry, (x, y, z) in zip(data, coords):
        entry["x"] = round(float(x), 4)
        entry["y"] = round(float(y), 4)
        entry["z"] = round(float(z), 4)

def embeddingPositioning(data):
    start = time.perf_counter()
    log.info("embedding positioning: %d entries", len(data))
    embeddings = createEmbeddings(data)
    for entry, vector in zip(data, embeddings):
        entry["embedding"] = [round(float(v), 4) for v in vector]
    assignCoordinates(data, embeddings)
    assignColor(data)
    log.info("embedding positioning: done in %.1fs", time.perf_counter() - start)
    return data
