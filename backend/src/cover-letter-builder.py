import sys,json
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

def clean(x): return str(x or '').strip()
def build(d,out):
    doc=Document(); sec=doc.sections[0]; sec.top_margin=Inches(.7);sec.bottom_margin=Inches(.7);sec.left_margin=Inches(.8);sec.right_margin=Inches(.8)
    styles=doc.styles; styles['Normal'].font.name='Aptos';styles['Normal'].font.size=Pt(10.5)
    name=doc.add_paragraph();name.alignment=WD_ALIGN_PARAGRAPH.CENTER;r=name.add_run(clean(d.get('name') or 'Your Name'));r.bold=True;r.font.size=Pt(20)
    contact=doc.add_paragraph();contact.alignment=WD_ALIGN_PARAGRAPH.CENTER;contact.add_run(' | '.join([clean(x) for x in [d.get('title'),d.get('email'),d.get('phone'),d.get('location'),d.get('linkedin'),d.get('website')] if clean(x)]))
    if clean(d.get('date')): doc.add_paragraph(clean(d['date']))
    if clean(d.get('hiringManager')): doc.add_paragraph(clean(d['hiringManager']))
    if clean(d.get('employer')): doc.add_paragraph(clean(d['employer']))
    if clean(d.get('employerAddress')): doc.add_paragraph(clean(d['employerAddress']))
    doc.add_paragraph()
    p=doc.add_paragraph();r=p.add_run(f"Re: {clean(d.get('position'))}");r.bold=True
    doc.add_paragraph()
    for para in clean(d.get('letter')).split('\n'):
        if para.strip(): doc.add_paragraph(para)
    doc.save(out)
if __name__=='__main__':
    d=json.loads(sys.stdin.read());build(d,d['_out'])
