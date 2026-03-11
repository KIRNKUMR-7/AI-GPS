import shutil
import os

# Get the script's directory (should be the project root)
root = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(root, "dist")
dst = os.path.join(root, "android", "app", "src", "main", "assets", "public")

print(f"Project Root: {root}")
print(f"Copying from {src} to {dst}...")

if not os.path.exists(src):
    print(f"Error: Source directory {src} not found!")
    exit(1)

if os.path.exists(dst):
    print("Clearing old assets...")
    shutil.rmtree(dst)
os.makedirs(dst, exist_ok=True)

print("Copying new assets...")
for item in os.listdir(src):
    s = os.path.join(src, item)
    d = os.path.join(dst, item)
    if os.path.isdir(s):
        shutil.copytree(s, d)
    else:
        shutil.copy2(s, d)

print("Done.")
