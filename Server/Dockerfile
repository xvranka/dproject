FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/server/scripts

COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt

COPY server/scripts server/scripts

# Raw and processed data live here. Mount a host folder or named volume so it persists.
# Paths in config.py are relative to /app, so the working directory must stay /app.
RUN mkdir -p /app/server/data
VOLUME /app/server/data

EXPOSE 5050
# one worker + threads: the search index and data are cached per process (large)
CMD ["gunicorn", "-b", "0.0.0.0:5050", "-w", "1", "--threads", "4", "--timeout", "120", "main:app"]
