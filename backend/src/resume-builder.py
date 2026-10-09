import sys,json,os
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def clean(x): return str(x or '').strip()
def add_heading(doc,text,level=1):
    p=doc.add_paragraph(); r=p.add_run(clean(text)); r.bold=True; r.font.size=Pt(14 if level==1 else 11); return p
def add_bullet(doc,text):
    p=doc.add_paragraph(style='List Bullet'); p.add_run(clean(text)); return p
def build(data,out):
    d=data; doc=Document(); sec=doc.sections[0]; sec.top_margin=Inches(.55);sec.bottom_margin=Inches(.55);sec.left_margin=Inches(.65);sec.right_margin=Inches(.65)
    styles=doc.styles; styles['Normal'].font.name='Aptos'; styles['Normal'].font.size=Pt(9.5)
    p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER; r=p.add_run(clean(d.get('name') or 'Your Name')); r.bold=True;r.font.size=Pt(22)
    p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.add_run(' | '.join([clean(x) for x in [d.get('title'),d.get('email'),d.get('phone'),d.get('location'),d.get('linkedin')] if clean(x)]))
    if clean(d.get('summary')): add_heading(doc,'Professional Summary'); doc.add_paragraph(clean(d['summary']))
    if d.get('experience'):
        add_heading(doc,'Experience')
        for e in d['experience']:
            p=doc.add_paragraph();r=p.add_run(f"{clean(e.get('role'))} — {clean(e.get('company'))}");r.bold=True
            p.add_run(f"  {clean(e.get('dates'))}")
            if clean(e.get('location')): doc.add_paragraph(clean(e['location']))
            for b in e.get('bullets',[]):
                if clean(b): add_bullet(doc,b)
    if d.get('education'):
        add_heading(doc,'Education')
        for e in d['education']:
            p=doc.add_paragraph();r=p.add_run(f"{clean(e.get('degree'))} — {clean(e.get('school'))}");r.bold=True;p.add_run(f"  {clean(e.get('dates'))}")
    if d.get('skills'):
        add_heading(doc,'Skills'); doc.add_paragraph(', '.join([clean(x) for x in d['skills'] if clean(x)]))
    if d.get('certifications'):
        add_heading(doc,'Certifications')
        for e in d['certifications']:
            doc.add_paragraph(f"{clean(e.get('name'))} — {clean(e.get('issuer'))} {clean(e.get('date'))}".strip())
    if d.get('languages'):
        add_heading(doc,'Languages');doc.add_paragraph(', '.join([clean(x) for x in d['languages'] if clean(x)]))
    doc.save(out)

if __name__=='__main__':
    payload=json.loads(sys.stdin.read());build(payload,payload['_out'])
