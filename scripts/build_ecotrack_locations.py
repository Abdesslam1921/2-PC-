import json
import sqlite3
from pathlib import Path

source = Path('/home/ubuntu/webdev-static-assets/algeria_cities_ar_0980081c.json')
if not source.exists():
    source = Path('/home/ubuntu/webdev-static-assets/algeria_cities_ar.json')
with source.open(encoding='utf-8') as handle:
    arabic_locations = json.load(handle)
with Path('/home/ubuntu/webdev-static-assets/algeria-cities-2025.json').open(encoding='utf-8') as handle:
    bilingual = json.load(handle)

def normalize_arabic(value: str) -> str:
    return ''.join({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي'}.get(char, char) for char in value.strip().replace('ـ', ''))

latin_by_key = {}
for row in bilingual['communes']:
    latin_by_key[(f'{row["wilaya_id"]:02d}', normalize_arabic(row['commune_name_arabic']))] = {'latinName': row['commune_name_latin'], 'wilayaLatinName': next((wilaya['wilaya_name_latin'] for wilaya in bilingual['wilayas'] if wilaya['wilaya_id'] == row['wilaya_id']), '')}

merged = []
missing = []
for row in arabic_locations:
    key = (row['wilaya_code'], normalize_arabic(row['commune_name']))
    latin = latin_by_key.get(key)
    if not latin:
        missing.append(key)
        merged.append(row)
    else:
        merged.append({**row, **latin})

output = Path('/home/ubuntu/webdev-static-assets/algeria_cities_ecotrack.json')
with output.open('w', encoding='utf-8') as handle:
    json.dump(merged, handle, ensure_ascii=False, separators=(',', ':'))
print({'source': len(arabic_locations), 'merged': len(merged), 'missing': len(missing), 'output': str(output)})
print('missing sample:', missing[:10])
