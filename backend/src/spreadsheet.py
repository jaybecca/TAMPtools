import sys,json,csv
from pathlib import Path
import openpyxl
from copy import copy

def main():
    op=sys.argv[1]; path=sys.argv[2]
    if op=='sheets':
        wb=openpyxl.load_workbook(path, read_only=True, data_only=False)
        print(json.dumps({'sheets':wb.sheetnames})); wb.close(); return
    if op=='read':
        sheet=sys.argv[3] if len(sys.argv)>3 and sys.argv[3] else None
        limit=int(sys.argv[4]) if len(sys.argv)>4 and sys.argv[4] else 0
        wb=openpyxl.load_workbook(path, read_only=True, data_only=False)
        ws=wb[sheet] if sheet and sheet in wb.sheetnames else wb.active
        rows=[]
        for row in ws.iter_rows(values_only=True):
            rows.append(['' if v is None else str(v) for v in row])
            if limit and len(rows)>=limit: break
        print(json.dumps({'rows':rows,'sheet':ws.title,'sheets':wb.sheetnames}))
        wb.close(); return
    if op=='write':
        payload=json.load(sys.stdin); wb=openpyxl.Workbook(); ws=wb.active; ws.title=payload.get('sheet','Cleaned Data')
        for r in payload.get('rows',[]): ws.append(r)
        for c in ws[1]: f=copy(c.font); f.bold=True; c.font=f
        for col in ws.columns:
            letter=col[0].column_letter; maxlen=min(60,max([len(str(x.value or '')) for x in col[:100]] or [10])); ws.column_dimensions[letter].width=max(10,maxlen+2)
        if payload.get('summary'):
            s=wb.create_sheet('Cleaning Summary');
            for row in payload['summary']: s.append(row)
        if payload.get('changes'):
            s=wb.create_sheet('Change Log'); s.append(['Source Row','Column','Before','After','Reason'])
            for x in payload['changes']: s.append([x.get('sourceRow'),x.get('column'),x.get('before'),x.get('after'),x.get('reason')])
        if payload.get('removedRows'):
            s=wb.create_sheet('Removed Rows'); s.append(['Source Row','Reason','Duplicate Of'])
            for x in payload['removedRows']: s.append([x.get('sourceRow'),x.get('reason'),x.get('duplicateOf','')])
        wb.save(path); print(json.dumps({'ok':True})); return
    raise SystemExit('Unknown operation')
if __name__=='__main__': main()
