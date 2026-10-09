import sys
from pypdf import PdfReader
from docx import Document
src,dst=sys.argv[1],sys.argv[2]
doc=Document()
reader=PdfReader(src)
for i,page in enumerate(reader.pages):
    text=(page.extract_text() or '').strip()
    if i: doc.add_page_break()
    for line in text.splitlines() or ['']:
        doc.add_paragraph(line)
doc.save(dst)
