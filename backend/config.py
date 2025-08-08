import os

# Tunables (override via env or .env)
BLUR_THRESHOLD = float(os.getenv("BLUR_THRESHOLD", 300))         # Laplacian variance cutoff
HASH_DISTANCE_MAX = int(os.getenv("HASH_DISTANCE_MAX", 5))       # pHash Hamming distance
ALLOWED_EXTS = tuple(x.strip().lower() for x in os.getenv("ALLOWED_EXTS", ".jpg,.jpeg,.png,.webp").split(","))
MAX_SIDE_FOR_BLUR = int(os.getenv("MAX_SIDE_FOR_BLUR", 1024))    # downscale longest side before blur score

# Heuristics for suggested folders
FOLDER_CLEAN = os.getenv("FOLDER_CLEAN", "Clean/")
FOLDER_SCREENSHOTS = os.getenv("FOLDER_SCREENSHOTS", "Screenshots/")
FOLDER_DOCUMENTS = os.getenv("FOLDER_DOCUMENTS", "Documents/")

DEBUG_LOG = os.getenv("DEBUG_LOG", "0") == "1"