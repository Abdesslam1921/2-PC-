import json
from pathlib import Path

path = Path('/home/ubuntu/webdev-static-assets/algeria_cities_ecotrack.json')
rows = json.loads(path.read_text(encoding='utf-8'))
print([row for row in rows if row.get('commune_name') == 'الجزائر الوسطى'])
