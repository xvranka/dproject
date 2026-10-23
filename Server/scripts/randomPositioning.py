# baseline - random positioning of nodes
import logging
import random
import time

log = logging.getLogger(__name__)

def randomColor():
    return "#{:02x}{:02x}{:02x}".format(
        random.randint(0, 255),
        random.randint(0, 255),
        random.randint(0, 255),
    )

def randomPositioning(data):
    start = time.perf_counter()
    total = len(data)
    step = max(total // 10, 1)
    log.info("random positioning: %d entries", total)
    result = []
    for i, entry in enumerate(data, 1):
        entry["x"] = round(random.uniform(-100, 100), 4)
        entry["y"] = round(random.uniform(-100, 100), 4)
        entry["z"] = round(random.uniform(-100, 100), 4)
        entry["color"] = randomColor()
        result.append(entry)
        if i % step == 0:
            log.info("random positioning: %d/%d (%d%%)", i, total, i * 100 // total)
    log.info("random positioning: done in %.1fs", time.perf_counter() - start)
    return result
