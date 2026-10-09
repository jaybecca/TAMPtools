import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const gs = process.env.GHOSTSCRIPT_BIN || 'gs';
const pdfunite = process.env.PDFUNITE_BIN || 'pdfunite';
const pdftoppm = process.env.PDFTOPPM_BIN || 'pdftoppm';
const pdftotext = process.env.PDFTOTEXT_BIN || 'pdftotext';
const tesseract = process.env.TESSERACT_BIN || 'tesseract';
const pdfinfo = process.env.PDFINFO_BIN || 'pdfinfo';

const safeBase = (name='document') => path.basename(name).replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._-]/g,'_') || 'document';
const tempDir = prefix => fs.promises.mkdtemp(path.join(os.tmpdir(), `tamptools-${prefix}-`));
const run = (bin,args,options={}) => execFileAsync(bin,args,{maxBuffer:32*1024*1024,...options});



export async function inspectPdf(buffer, { maxPages = 80, thumbWidth = 220 } = {}) {
  const dir = await tempDir('pdfinspect');
  const input = path.join(dir, 'input.pdf');
  try {
    await fs.promises.writeFile(input, buffer);
    let pageCount = 0;
    try {
      const info = await run(pdfinfo, [input]);
      const match = String(info.stdout || '').match(/Pages:\s+(\d+)/i);
      pageCount = match ? Number(match[1]) : 0;
    } catch (error) {
      // pdfinfo is optional; Ghostscript is already required by the PDF engine.
      try {
        const info = await run(gs, ['-q','-dNODISPLAY','-dNOSAFER','-c',`(${input}) (r) file runpdfbegin pdfpagecount = quit`]);
        pageCount = Number.parseInt(String(info.stdout || '').trim(), 10) || 0;
      } catch (fallbackError) {
        const missing = error?.code === 'ENOENT' ? 'The PDF runtime is missing pdfinfo. Ghostscript fallback also failed.' : (error?.message || 'Unable to inspect this PDF.');
        throw new Error(missing);
      }
    }
    if (!pageCount) throw new Error('Unable to read the PDF page count. Make sure the server PDF runtime is installed.');
    const renderedCount = Math.min(pageCount, Math.max(1, Number(maxPages) || 80));
    const prefix = path.join(dir, 'thumb');
    try {
      await run(pdftoppm, ['-jpeg', '-scale-to', String(Math.max(140, Number(thumbWidth) || 220)), '-f', '1', '-l', String(renderedCount), input, prefix]);
    } catch (renderError) {
      // pdftoppm is a convenience binary, not a required part of the PDF runtime.
      // Deployments often have Ghostscript but not Poppler. Render the same pages
      // through Ghostscript so uploads, thumbnails and OCR keep working.
      if (renderError?.code !== 'ENOENT') throw renderError;
      await run(gs, ['-q','-dSAFER','-dBATCH','-dNOPAUSE','-sDEVICE=jpeg','-r110',`-dFirstPage=1`,`-dLastPage=${renderedCount}`,`-sOutputFile=${prefix}-%d.jpg`,input]);
    }
    const names = (await fs.promises.readdir(dir)).filter(x => /^thumb(?:-\d+)?\.jpg$/i.test(x)).sort((a,b) => Number((a.match(/(\d+)/)||[0,0])[1]) - Number((b.match(/(\d+)/)||[0,0])[1]));
    const pages = [];
    for (let i = 0; i < names.length; i++) {
      const image = await fs.promises.readFile(path.join(dir, names[i]));
      pages.push({ pageIndex:i, pageNumber:i+1, thumbnail:`data:image/jpeg;base64,${image.toString('base64')}` });
    }
    return { pageCount, pages, truncated: renderedCount < pageCount };
  } finally { await fs.promises.rm(dir, { recursive:true, force:true }).catch(()=>{}); }
}

export async function composePdf({ sources, pages }) {
  const dir = await tempDir('pdfcompose');
  try {
    const sourcePaths = [];
    for (let i=0;i<sources.length;i++) {
      const p = path.join(dir, `source-${i}.pdf`);
      await fs.promises.writeFile(p, sources[i]);
      sourcePaths.push(p);
    }
    const manifestPath = path.join(dir, 'manifest.json');
    const output = path.join(dir, 'output.pdf');
    await fs.promises.writeFile(manifestPath, JSON.stringify({ paths:sourcePaths, pages, output }));
    const script = path.join(path.dirname(new URL(import.meta.url).pathname), 'pdf-compose.py');
    try { execFileSync('python3', [script], { input: JSON.stringify({ paths:sourcePaths, pages, output }), maxBuffer:32*1024*1024 }); }
    catch (error) { throw new Error(String(error?.stderr || error?.message || 'Unable to compose PDF.').trim()); }
    return fs.promises.readFile(output);
  } finally { await fs.promises.rm(dir, { recursive:true, force:true }).catch(()=>{}); }
}

export async function mergePdfs(buffers){
  if(buffers.length < 2) throw new Error('Select at least two PDF files to merge.');
  const dir=await tempDir('pdfmerge');
  try { const inputs=[]; for(let i=0;i<buffers.length;i++){const p=path.join(dir,`in-${i}.pdf`);await fs.promises.writeFile(p,buffers[i]);inputs.push(p);} const out=path.join(dir,'merged.pdf'); await run(pdfunite,[...inputs,out]); return fs.promises.readFile(out); }
  finally { await fs.promises.rm(dir,{recursive:true,force:true}).catch(()=>{}); }
}

export async function convertPdfToImages(buffer, format='png', allPages=false){
  const dir=await tempDir('pdfrender'); const input=path.join(dir,'input.pdf');
  try {
    await fs.promises.writeFile(input,buffer);
    const ext=(format==='jpg'||format==='jpeg')?'jpg':'png';
    const prefix=path.join(dir,'page');
    try {
      const args=['-r150'];
      if(ext==='jpg') args.push('-jpeg'); else args.push('-png');
      if(!allPages) args.push('-f','1','-singlefile');
      args.push(input,prefix);
      await run(pdftoppm,args);
    } catch (renderError) {
      if (renderError?.code !== 'ENOENT') throw renderError;
      const device=ext==='jpg'?'jpeg':'png16m';
      const args=['-q','-dSAFER','-dBATCH','-dNOPAUSE',`-sDEVICE=${device}`,'-r150'];
      if(!allPages) args.push('-dFirstPage=1','-dLastPage=1');
      args.push(`-sOutputFile=${prefix}${allPages?'-%d':''}.${ext}`,input);
      await run(gs,args);
    }
    const files=(await fs.promises.readdir(dir)).filter(x=>new RegExp(`^page(?:-\\d+)?\\.${ext}$`,'i').test(x)).sort((a,b)=>Number((a.match(/(\d+)/)||[0,0])[1])-Number((b.match(/(\d+)/)||[0,0])[1]));
    if(!files.length) throw new Error('Unable to render the PDF.');
    return Promise.all(files.map(async f=>({name:f,buffer:await fs.promises.readFile(path.join(dir,f)),mime:ext==='png'?'image/png':'image/jpeg'})));
  } finally { await fs.promises.rm(dir,{recursive:true,force:true}).catch(()=>{}); }
}

function pdfObjectText(text){ return String(text).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/\r?\n/g,' '); }
export function createTextPdf({title='TAMPtools Document',text=''}){
  const lines=String(text||'').split(/\r?\n/).flatMap(line=>{const words=line.split(/\s+/);const out=[];let cur='';for(const w of words){if((cur+' '+w).trim().length>92){out.push(cur);cur=w;}else cur=(cur+' '+w).trim();}out.push(cur);return out;}).slice(0,500);
  const content=[]; content.push('BT /F1 18 Tf 54 760 Td ('+pdfObjectText(title.slice(0,120))+') Tj ET'); let y=730; for(const line of lines){content.push(`BT /F1 10 Tf 54 ${y} Td (${pdfObjectText(line)}) Tj ET`); y-=15;if(y<45){break;}}
  const objects=[]; objects.push('<< /Type /Catalog /Pages 2 0 R >>'); objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'); objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'); objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'); const stream=content.join('\n'); objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  let pdf='%PDF-1.4\n'; const offsets=[0]; for(let i=0;i<objects.length;i++){offsets[i+1]=Buffer.byteLength(pdf);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}; const xref=Buffer.byteLength(pdf); pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`; for(let i=1;i<offsets.length;i++) pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`; pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`; return Buffer.from(pdf);
}

export async function imageToPdf(buffer){
  const { default: sharp } = await import('sharp');
  const jpg=await sharp(buffer,{failOn:'none'}).rotate().flatten({background:'#ffffff'}).jpeg({quality:92}).toBuffer();
  const meta=await sharp(jpg).metadata(); const w=meta.width||1200,h=meta.height||800; const maxW=540,maxH=720; const scale=Math.min(maxW/w,maxH/h); const pw=Math.max(72,Math.round(w*scale)),ph=Math.max(72,Math.round(h*scale));
  const imageObj=`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n${jpg.toString('binary')}\nendstream`;
  const content=`q\n${pw} 0 0 ${ph} ${(612-pw)/2} ${(792-ph)/2} cm\n/Im0 Do\nQ`;
  const objs=[]; objs.push('<< /Type /Catalog /Pages 2 0 R >>');objs.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');objs.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);objs.push(imageObj);
  let pdf='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objs.length;i++){offsets[i+1]=Buffer.byteLength(pdf);pdf+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(pdf,'binary');
}

export async function imagesToPdf(buffers){
  if(!Array.isArray(buffers)||!buffers.length) throw new Error('Select at least one image.');
  const pages=[];
  for(const buffer of buffers) pages.push(await imageToPdf(buffer));
  return pages.length===1 ? pages[0] : mergePdfs(pages);
}

export async function extractPdfTextFull(buffer){const dir=await tempDir('pdftext');try{const input=path.join(dir,'input.pdf'),out=path.join(dir,'out.txt');await fs.promises.writeFile(input,buffer);await run(pdftotext,['-layout',input,out]);return (await fs.promises.readFile(out,'utf8')).replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();}finally{await fs.promises.rm(dir,{recursive:true,force:true}).catch(()=>{});}}

export async function ocrPdf(buffer,lang='eng'){const pages=await convertPdfToImages(buffer,'png',true);const dir=await tempDir('pdfocr');try{const texts=[];for(let i=0;i<pages.length;i++){const p=path.join(dir,`page-${i+1}.png`);const out=path.join(dir,`page-${i+1}`);await fs.promises.writeFile(p,pages[i].buffer);await run(tesseract,[p,out,'-l',lang],{maxBuffer:8*1024*1024});texts.push(await fs.promises.readFile(`${out}.txt`,'utf8'));}return texts.join('\n\n').replace(/\n{3,}/g,'\n\n').trim();}finally{await fs.promises.rm(dir,{recursive:true,force:true}).catch(()=>{});}}

export async function protectPdf(buffer,{userPassword='',ownerPassword=''}){if(!userPassword&&!ownerPassword)throw new Error('Provide a user or owner password.');const dir=await tempDir('pdfprotect');try{const input=path.join(dir,'in.pdf'),out=path.join(dir,'protected.pdf');await fs.promises.writeFile(input,buffer);await run(gs,['-q','-dSAFER','-dBATCH','-dNOPAUSE','-sDEVICE=pdfwrite','-dCompatibilityLevel=1.4','-dEncryptionR=3','-dKeyLength=128',`-sUserPassword=${userPassword}`,`-sOwnerPassword=${ownerPassword||userPassword}`,`-sOutputFile=${out}`,input]);return fs.promises.readFile(out);}finally{await fs.promises.rm(dir,{recursive:true,force:true}).catch(()=>{});}}

export async function reorderPdf(buffer,order){const dir=await tempDir('pdforder');try{const input=path.join(dir,'in.pdf');await fs.promises.writeFile(input,buffer);const parts=[];for(let i=0;i<order.length;i++){const n=Number(order[i]);const out=path.join(dir,`p-${i}.pdf`);await run(gs,['-q','-dSAFER','-dBATCH','-dNOPAUSE','-sDEVICE=pdfwrite','-dFirstPage='+n,'-dLastPage='+n,'-sOutputFile='+out,input]);parts.push(out);}const merged=path.join(dir,'ordered.pdf');await run(pdfunite,[...parts,merged]);return fs.promises.readFile(merged);}finally{await fs.promises.rm(dir,{recursive:true,force:true}).catch(()=>{});}}

export function cleanupText(text){return String(text||'').replace(/[ \t]+/g,' ').replace(/\s+([,.;:!?])/g,'$1').replace(/([,.;:!?])(?=[A-Za-z])/g,'$1 ').replace(/\n{3,}/g,'\n\n').split(/\n/).map(x=>x.trim()).join('\n').trim();}

export function compareText(a,b){const aa=String(a).split(/\n/).filter(Boolean),bb=String(b).split(/\n/).filter(Boolean);const setA=new Set(aa),setB=new Set(bb);return {added:bb.filter(x=>!setA.has(x)),removed:aa.filter(x=>!setB.has(x)),same:aa.filter(x=>setB.has(x)),summary:`${bb.filter(x=>!setA.has(x)).length} added, ${aa.filter(x=>!setB.has(x)).length} removed, ${aa.filter(x=>setB.has(x)).length} unchanged lines.`};}

export async function extractPagesToPdf(buffer, ranges){
  const dir=await tempDir('pdfextract');
  try{
    const input=path.join(dir,'input.pdf'); await fs.promises.writeFile(input,buffer);
    const parts=[];
    for(let i=0;i<ranges.length;i++){
      const out=path.join(dir,`part-${i}.pdf`);
      await run(gs,['-q','-dSAFER','-dBATCH','-dNOPAUSE','-sDEVICE=pdfwrite',`-dFirstPage=${ranges[i].first}`,`-dLastPage=${ranges[i].last}`,`-sOutputFile=${out}`,input]);
      parts.push(out);
    }
    const merged=path.join(dir,'extracted.pdf');
    if(parts.length===1) return fs.promises.readFile(parts[0]);
    await run(pdfunite,[...parts,merged]); return fs.promises.readFile(merged);
  } finally { await fs.promises.rm(dir,{recursive:true,force:true}).catch(()=>{}); }
}

export async function rotatePdf(buffer,degrees,pages=[]){
  const dir=await tempDir('pdfrotate');
  try{
    const input=path.join(dir,'input.pdf'),output=path.join(dir,'rotated.pdf'),pageArg=pages.join(',');
    await fs.promises.writeFile(input,buffer);
    const script=path.join(path.dirname(new URL(import.meta.url).pathname),'../scripts/rotate_pdf.py');
    await run(process.env.PYTHON_BIN||'python3',[script,input,output,String(degrees),pageArg],{maxBuffer:8*1024*1024});
    return fs.promises.readFile(output);
  }catch(e){throw new Error('Page rotation requires the TAMPtools PDF runtime (Python + pypdf) to be installed on the server.');}
  finally{await fs.promises.rm(dir,{recursive:true,force:true}).catch(()=>{});}
}

export async function addOrRemovePages(buffer,{action='remove',spec=''}){
  const count=await (async()=>{const dir=await tempDir('pdfpages-count');try{const input=path.join(dir,'in.pdf');await fs.promises.writeFile(input,buffer);const {stdout}=await run(gs,['-q','-dNODISPLAY','-dNOSAFER','-c',`(${input}) (r) file runpdfbegin pdfpagecount = quit`]);return Number.parseInt(String(stdout).trim(),10);}finally{await fs.promises.rm(dir,{recursive:true,force:true}).catch(()=>{});}})();
  const {parsePageRanges}=await import('./pdf-splitter.js');
  const ranges=parsePageRanges(spec.replace(/^position\s+/i,''));
  if(action==='remove'){
    const remove=new Set(); for(const r of ranges) for(let p=r.first;p<=r.last;p++) remove.add(p);
    const keep=[]; for(let p=1;p<=count;p++) if(!remove.has(p)) keep.push({first:p,last:p});
    if(!keep.length) throw new Error('At least one page must remain.');
    return extractPagesToPdf(buffer,keep);
  }
  const position=Number(String(spec).replace(/\D/g,'')); if(!Number.isFinite(position)||position<1||position>count+1) throw new Error(`Insert position must be between 1 and ${count+1}.`);
  const parts=[];
  if(position>1) parts.push(await extractPagesToPdf(buffer,[{first:1,last:position-1}]));
  parts.push(createTextPdf({title:'',text:''}));
  if(position<=count) parts.push(await extractPagesToPdf(buffer,[{first:position,last:count}]));
  const dir=await tempDir('pdfinsert');try{const paths=[];for(let i=0;i<parts.length;i++){const p=path.join(dir,`part-${i}.pdf`);await fs.promises.writeFile(p,parts[i]);paths.push(p);}const out=path.join(dir,'inserted.pdf');await run(pdfunite,[...paths,out]);return fs.promises.readFile(out);}finally{await fs.promises.rm(dir,{recursive:true,force:true}).catch(()=>{});}
}

export async function convertDocumentFormat(buffer,originalName,target,scope='all'){
  const ext=String(originalName).toLowerCase().split('.').pop();
  if(ext===target) return Buffer.from(buffer);
  if(['png','jpg'].includes(target) && ext==='pdf') return (await convertPdfToImages(buffer,target,scope!=='first')).map(x=>x.buffer);
  if(target==='txt' && ext==='pdf') return Buffer.from(await extractPdfTextFull(buffer),'utf8');
  if(target==='docx' && ext==='pdf'){
    const dir=await tempDir('pdftodocx'); try{
      const input=path.join(dir,'input.pdf'),output=path.join(dir,'output.docx'); await fs.promises.writeFile(input,buffer);
      const script=path.join(path.dirname(new URL(import.meta.url).pathname),'../scripts/pdf_to_docx.py');
      await run(process.env.PYTHON_BIN||'python3',[script,input,output],{maxBuffer:8*1024*1024});
      return fs.promises.readFile(output);
    }catch{throw new Error('PDF to Word requires the TAMPtools document conversion runtime on the server.');}finally{await fs.promises.rm(dir,{recursive:true,force:true}).catch(()=>{});}
  }
  const dir=await tempDir('pdfconvert');try{
    const input=path.join(dir,`input.${ext||'bin'}`);await fs.promises.writeFile(input,buffer);
    const formatMap={pdf:'pdf:writer_pdf_Export',docx:'docx',pptx:'pptx',xlsx:'xlsx',odt:'odt',txt:'txt:Text'};if(!formatMap[target])throw new Error('That conversion format is not supported.');
    await run(process.env.LIBREOFFICE_BIN||'soffice',['--headless','--convert-to',formatMap[target],'--outdir',dir,input],{maxBuffer:8*1024*1024});
    const expected=path.join(dir,`${path.basename(input,path.extname(input))}.${target}`);if(!(await fs.promises.stat(expected).catch(()=>null)))throw new Error('Office conversion is unavailable or the source document could not be converted.');return fs.promises.readFile(expected);
  }finally{await fs.promises.rm(dir,{recursive:true,force:true}).catch(()=>{});}
}
