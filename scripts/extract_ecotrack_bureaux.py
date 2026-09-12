import json
import re
from pathlib import Path

source = Path('/home/ubuntu/page_texts/hhdexpress.ecotrack.dz_bureaux.md')
lines = [line.strip() for line in source.read_text(encoding='utf-8').splitlines()]
records = []
for index, line in enumerate(lines):
    match = re.match(r'^(\d{2})[- ]+STATION\s+(.+?)[,،]?$', line, re.I)
    if not match:
        continue
    code = match.group(1)
    name = match.group(2).strip().rstrip(',')
    location = next((candidate for candidate in lines[index + 1:index + 5] if ',' in candidate and not candidate.startswith('Voir')), '')
    if not location:
        continue
    wilaya, _, commune = location.partition(',')
    phone = next((candidate for candidate in lines[index + 1:index + 10] if re.search(r'0[567][0-9 ]{8,}', candidate)), '')
    records.append({
        'code': code,
        'name': name,
        'wilayaLatin': wilaya.strip(),
        'communeLatin': commune.strip(),
        'phone': phone,
    })
# de-duplicate exact records while preserving page order
seen = set()
unique = []
for record in records:
    key = tuple(record.items())
    if key not in seen:
        seen.add(key)
        unique.append(record)
output = Path('/home/ubuntu/webdev-static-assets/ecotrack_bureaux.json')
output.write_text(json.dumps(unique, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print({'records': len(unique), 'wilayas': len({record['code'] for record in unique}), 'sample': unique[:3], 'output': str(output)})
