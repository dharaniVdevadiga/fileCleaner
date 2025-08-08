import os
import shutil

def apply_actions(actions, base_folder=None):
    summary = { "deleted": [], "moved": [], "failed": [] }

    for item in actions:
        path = item.get("path")
        action = item.get("action")
        suggested_folder = item.get("suggested_folder") 
        target = item.get("target_folder")  

        try:
            if action == "delete":
                os.remove(path)
                summary["deleted"].append(path)

            elif action == "move":
                # Decide destination
                if target:
                    dest_folder = target
                elif base_folder and suggested_folder:
                    dest_folder = os.path.join(base_folder, suggested_folder)
                else:
                    raise Exception("No target folder provided for move action.")

                # Ensure folder exists
                os.makedirs(dest_folder, exist_ok=True)

                filename = os.path.basename(path)
                new_path = os.path.join(dest_folder, filename)
                shutil.move(path, new_path)
                summary["moved"].append(new_path)

            else:
                summary["failed"].append({ "path": path, "error": "Unknown action" })

        except Exception as e:
            summary["failed"].append({ "path": path, "error": str(e) })

    return summary