import os
import shutil
from typing import List, Dict, Any, Optional


def apply_actions(actions: List[Dict[str, Any]], base_folder: Optional[str] = None) -> Dict[str, Any]:
    summary = {"deleted": [], "moved": [], "failed": []}

    for item in actions or []:
        path = item.get("path")
        action = item.get("action")
        suggested_folder = item.get("suggested_folder")  
        target = item.get("target_folder")               

        try:
            if not path or not action:
                raise ValueError("Missing required fields: path/action")

            if action == "delete":
                os.remove(path)
                summary["deleted"].append(path)

            elif action == "move":
                if target:
                    dest_folder = target
                elif base_folder and suggested_folder:
                    dest_folder = os.path.join(base_folder, suggested_folder)
                else:
                    raise ValueError("No target folder provided for move action.")

                os.makedirs(dest_folder, exist_ok=True)
                filename = os.path.basename(path)
                new_path = os.path.join(dest_folder, filename)
                shutil.move(path, new_path)
                summary["moved"].append(new_path)

            else:
                raise ValueError(f"Unknown action: {action}")

        except Exception as e:
            summary["failed"].append({"path": path, "error": str(e)})

    return summary
