import json
from pathlib import Path
path = Path('/home/ubuntu/webdev-static-assets/algeria-cities-2025.json')
data = json.loads(path.read_text(encoding='utf-8'))
print(type(data).__name__)
if isinstance(data, dict):
    print(data.keys())
    for key, value in data.items():
        if isinstance(value, list):
            print(key, len(value), value[:2])
