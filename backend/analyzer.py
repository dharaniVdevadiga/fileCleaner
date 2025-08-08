import os
import cv2
from PIL import Image
import imagehash

def is_blurry(image_path, threshold=300.0):
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    print(variance)
    print(variance < threshold)
    return variance < threshold

def analyze_images(folder_path):
    image_data = []
    seen_hashes = {}

    for filename in os.listdir(folder_path):
        if not filename.lower().endswith((".jpg", ".jpeg", ".png")):
            continue

        path = os.path.join(folder_path, filename)
        data = {
            "file": filename,
            "path": path,
            "status": [],
            "action": None,
        }

        # Check blurriness
        try:
            if is_blurry(path):
                data["status"].append("blurry")
        except:
            continue

        # Check duplicates
        try:
            img = Image.open(path)
            img_hash = imagehash.phash(img)

            # Convert hash to string to compare consistently
            found_duplicate = False
            for prev_hash, prev_file in seen_hashes.items():
                if img_hash - prev_hash <= 5: 
                    data["status"].append("duplicate")
                    data["duplicate_of"] = prev_file
                    found_duplicate = True
                    break

            if not found_duplicate:
                seen_hashes[img_hash] = filename

        except:
            continue

        # Set default action
        if data["status"]:
            data["action"] = "delete"
        else:
            data["action"] = "move"
            data["suggested_folder"] = "Clean/"

        image_data.append(data)

    return image_data

is_blurry("backend/test.jpg")