import json, sys
from pypdf import PdfReader, PdfWriter

payload = json.load(sys.stdin)
paths = payload.get('paths', [])
pages = payload.get('pages', [])
out_path = payload['output']

if not paths or not pages:
    raise ValueError('A source PDF and at least one page are required.')

readers = [PdfReader(p) for p in paths]
writer = PdfWriter()
for item in pages:
    if item.get('blank'):
        writer.add_blank_page(width=612, height=792)
        continue
    fi = int(item['fileIndex'])
    pi = int(item['pageIndex'])
    if fi < 0 or fi >= len(readers):
        raise ValueError('Invalid source file.')
    if pi < 0 or pi >= len(readers[fi].pages):
        raise ValueError('Invalid source page.')
    page = readers[fi].pages[pi]
    rotation = int(item.get('rotation', 0)) % 360
    if rotation:
        page = page.rotate(rotation)
    writer.add_page(page)

with open(out_path, 'wb') as fh:
    writer.write(fh)
