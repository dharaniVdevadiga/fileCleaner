import os
from typing import List, Dict, Any
import cv2
from PIL import Image, ImageOps
import imagehash

from . import config


def _is_allowed(filename: str) -> bool:
    return filename.lower().endswith(config.ALLOWED_EXTS)


def _read_cv(path: str):
    img = cv2.imread(path)
    if img is None:
        return None
    return img


def _resize_longest_side(img, max_side: int):
    h, w = img.shape[:2]
    m = max(h, w)
    if m <= max_side or max_side <= 0:
        return img
    scale = max_side / float(m)
    new_w, new_h = int(w * scale), int(h * scale)
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def _laplacian_variance_score(path: str) -> float:
    img = _read_cv(path)
    if img is None:
        return -1.0
    img = _resize_longest_side(img, config.MAX_SIDE_FOR_BLUR)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()


def _phash(path: str):
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        return imagehash.phash(im)


def _is_document_like(w: int, h: int) -> bool:
    ar = max(w, h) / max(1.0, min(w, h))
    return 1.3 <= ar <= 1.5  # ~A4 ratio ≈ 1.414


def _suggest_folder(filename: str, cv_img) -> str:
    name = filename.lower()
    if any(k in name for k in ("screenshot", "screen shot", "snip", "snipping")):
        return config.FOLDER_SCREENSHOTS
    if cv_img is not None:
        h, w = cv_img.shape[:2]
        if _is_document_like(w, h):
            return config.FOLDER_DOCUMENTS
    return config.FOLDER_CLEAN


def analyze_images(folder_path: str) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    if not folder_path or not os.path.isdir(folder_path):
        return results

    seen_hashes = []  # list of (hash, filename) so we can do distance tolerance

    for filename in os.listdir(folder_path):
        if not _is_allowed(filename):
            continue

        path = os.path.join(folder_path, filename)
        data: Dict[str, Any] = {
            "file": filename,
            "path": path,
            "status": [],
        }

        blur_score = _laplacian_variance_score(path)
        is_blurry = (blur_score >= 0) and (blur_score < config.BLUR_THRESHOLD)
        data["blur_score"] = float(blur_score)
        data["is_blurry"] = bool(is_blurry)
        if is_blurry:
            data["status"].append("blurry")

        # Duplicate detection (pHash within Hamming distance tolerance)
        duplicate_of = None
        try:
            h = _phash(path)
            for prev_hash, prev_file in seen_hashes:
                if (h - prev_hash) <= config.HASH_DISTANCE_MAX:
                    duplicate_of = prev_file
                    break
            if duplicate_of is None:
                seen_hashes.append((h, filename))
            else:
                data["status"].append("duplicate")
                data["duplicate_of"] = duplicate_of
        except Exception as e:
            pass

        if data["status"]:
            data["action"] = "delete"
        else:
            img_cv = _read_cv(path)
            data["action"] = "move"
            data["suggested_folder"] = _suggest_folder(filename, img_cv)

        results.append(data)

        if config.DEBUG_LOG:
            print(f"[analyze] {filename} score={data['blur_score']:.2f} "
                  f"blurry={data['is_blurry']} status={data['status']}")

    return results