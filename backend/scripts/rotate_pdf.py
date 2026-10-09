import sys
from pypdf import PdfReader, PdfWriter
src,dst,degrees,pages=sys.argv[1],sys.argv[2],int(sys.argv[3]),sys.argv[4]
selected=None if not pages else {int(x) for x in pages.split(',') if x}
r=PdfReader(src); w=PdfWriter()
for i,p in enumerate(r.pages,1):
    if selected is None or i in selected: p.rotate(degrees)
    w.add_page(p)
with open(dst,'wb') as f: w.write(f)
