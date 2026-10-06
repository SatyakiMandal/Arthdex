# Arthdex data service for a Hugging Face Docker Space (free CPU Basic: 2 vCPU, 16 GB RAM).
# Build context is the backend/ folder; deploy/huggingface/push.ps1 assembles it.
FROM python:3.14-slim

# tzdata: the backend uses the server's local date for window validation, so run in IST.
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*
ENV TZ=Asia/Kolkata \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/home/user/.cache/huggingface

# Spaces run the container as uid 1000.
RUN useradd -m -u 1000 user
USER user
WORKDIR /home/user/app

# Dependencies first so the layer is cached. The CPU index keeps torch from pulling CUDA wheels.
COPY --chown=user requirements.txt .
RUN pip install --user --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
ENV PATH=/home/user/.local/bin:$PATH

COPY --chown=user . .

# Bake the pinned FinBERT + GoEmotions weights (about 940 MB) into the image so a cold start
# never downloads them. The script also runs a sanity inference and fails the build if broken.
RUN python scripts/download_models.py

EXPOSE 7860
# One process only: the TTL cache and the analyzer's concurrency limit are per process.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
