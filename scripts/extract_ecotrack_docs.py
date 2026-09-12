from bs4 import BeautifulSoup
import re
from pathlib import Path

source = Path('/home/ubuntu/browser_html/documenter_getpostman_com_Tz5je15g_1787751815492.html')
text = BeautifulSoup(source.read_text(errors='ignore'), 'html.parser').get_text('\n')
patterns = re.compile(r'(?i)(/api/v1/[^\s\"<>`\\]+|https?://[^\s\"<>`\\]+)')
for line in text.splitlines():
    line = ' '.join(line.split())
    if not line:
        continue
    if patterns.search(line) or any(word in line.lower() for word in ('commande', 'suivi', 'produits', 'configuration')):
        print(line[:1000])
