# backend/file_ops.py
from __future__ import annotations

import os
import stat
import shutil
from pathlib import Path
from typing import Dict, List, Tuple


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _unique_path(dst: Path) -> Path:
    """
    Avoid overwriting: append (1), (2), ... if needed.
    e.g., photo.jpg -> photo (1).jpg
    """
    if not dst.exists():
        return dst
    stem, suffix = dst.stem, dst.suffix
    parent = dst.parent
    i = 1
    while True:
        candidate = parent / f"{stem} ({i}){suffix}"
        if not candidate.exists():
            return candidate
        i += 1


def _safe_move(src: Path, dst: Path) -> Tuple[Path, Path]:
    """
    Move src -> dst (create parents, uniquify).
    Returns (original_src, final_dst).
    """
    _ensure_dir(dst.parent)
    final_dst = _unique_path(dst)
    shutil.move(str(src), str(final_dst))
    return src, final_dst


def _hard_delete(path: Path) -> bool:
    """
    Permanently delete a file.
    - Returns True on success, False on failure.
    - If the path is a directory (shouldn't happen for images),
      we skip and return False (to avoid accidental folder wipes).
    - Clears read-only bit on Windows if needed.
    """
    try:
        if path.is_dir():
            # Safety: do not delete directories from this endpoint
            return False

        # On Windows, remove read-only attribute if present
        try:
            mode = path.stat().st_mode
            if not (mode & stat.S_IWUSR):
                os.chmod(path, mode | stat.S_IWUSR)
        except Exception:
            # best-effort; continue to attempt delete
            pass

        path.unlink(missing_ok=False)
        return True
    except Exception:
        return False


def apply_actions(base_folder: str, actions: List[Dict]) -> Dict:
    """
    Apply actions with safety:

      - move:
          file -> <base>/<suggested_folder>/<filename>
          (no overwrite; uses unique names like "name (1).ext")

      - delete:
          PERMANENT DELETE (hard delete). This cannot be undone.

    Payload shape expected (per item):
      { "path": str, "action": "move"|"delete", "suggested_folder": "Clean/"? }

    Returns:
      { "moved": [str paths], "deleted": [str paths], "failed": [str paths] }
    """
    base = Path(base_folder)
    moved, deleted, failed = [], [], []

    for act in actions:
        try:
            src = Path(act["path"])
            if not src.exists():
                failed.append(str(src))
                continue

            if act["action"] == "move":
                rel = "Clean/"
                dst = base / rel / src.name
                _, final_dst = _safe_move(src, dst)
                moved.append(str(final_dst))

            elif act["action"] == "delete":
                if _hard_delete(src):
                    deleted.append(str(src))
                else:
                    failed.append(str(src))

            else:
                # unknown action
                failed.append(str(src))

        except Exception:
            failed.append(act.get("path", ""))

    return {"moved": moved, "deleted": deleted, "failed": failed}
