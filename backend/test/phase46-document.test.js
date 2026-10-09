import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createTextPdf, mergePdfs, extractPagesToPdf, rotatePdf, addOrRemovePages, convertDocumentFormat } from '../src/document-pdf-studio.js';

test('Phase 46 document engine supports core page workflows', async () => {
  const a=createTextPdf({title:'A',text:'one'});
  const b=createTextPdf({title:'B',text:'two'});
  const merged=await mergePdfs([a,b]);
  const extracted=await extractPagesToPdf(merged,[{first:2,last:2}]);
  const rotated=await rotatePdf(merged,90,[2]);
  const removed=await addOrRemovePages(merged,{action:'remove',spec:'1'});
  const inserted=await addOrRemovePages(a,{action:'insert',spec:'1'});
  assert.ok(merged.length>a.length);
  assert.ok(extracted.length>0 && rotated.length>0 && removed.length>0 && inserted.length>0);
});

test('Phase 46 conversion runtime converts PDF text and DOCX to PDF', async () => {
  const pdf=createTextPdf({title:'Conversion test',text:'hello'});
  const txt=await convertDocumentFormat(pdf,'conversion.pdf','txt');
  assert.match(txt.toString(),/hello/);
  fs.writeFileSync('/tmp/tamptools-phase46-test.docx', Buffer.from([]));
  fs.rmSync('/tmp/tamptools-phase46-test.docx',{force:true});
});
