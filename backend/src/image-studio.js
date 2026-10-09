import sharp from 'sharp';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const hexToRgb=(hex)=>{const h=String(hex||'#ffffff').replace('#',''); const v=h.length===3?h.split('').map(x=>x+x).join(''):h; const n=parseInt(v,16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255,alpha:1};};
const safeBase=(name='image')=>path.basename(name).replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9._-]/g,'_')||'image';

export async function readImage(buffer){return sharp(buffer,{failOn:'none'}).rotate().metadata();}

async function removeBg(buffer){
  const { removeBackground } = await import('@imgly/background-removal-node');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tamptools-img-'));
  const input=path.join(dir,'input.png'); const output=path.join(dir,'output.png');
  try { await sharp(buffer,{failOn:'none'}).rotate().png().toFile(input); await removeBackground(input,{output:output}); return fs.readFileSync(output); }
  finally { try{fs.rmSync(dir,{recursive:true,force:true});}catch{} }
}

export async function processImage({buffer,originalName='image.png',operation='enhance',settings={}}){
  let image=sharp(buffer,{failOn:'none'}).rotate();
  const meta=await image.metadata();
  const width=Number(settings.width)||undefined, height=Number(settings.height)||undefined;
  let transparent=false;

  if(operation==='remove-background' || operation==='replace-background' || operation==='background-color'){
    const cut=await removeBg(buffer);
    if(operation==='remove-background') image=sharp(cut,{failOn:'none'}); else {
      const color=hexToRgb(settings.backgroundColor||'#ffffff');
      const base=await sharp({create:{width:meta.width||1200,height:meta.height||1200,channels:4,background:color}}).png().toBuffer();
      image=sharp(base).composite([{input:cut,blend:'over'}]);
    }
    transparent=operation==='remove-background';
  }

  if(operation==='resize') image=image.resize({width:width||meta.width,height:height||meta.height,fit:settings.fit==='cover'?'cover':settings.fit==='fill'?'fill':'inside',withoutEnlargement:settings.upscale!==true});
  if(operation==='crop') image=image.resize({width:width||meta.width,height:height||meta.height,fit:'cover',position:settings.position||'centre'});
  if(operation==='compress') image=image.resize({width:width||undefined,withoutEnlargement:true});
  if(operation==='enhance') image=image.normalize().sharpen({sigma:1.1}).modulate({brightness:1.03,saturation:1.08});

  if(operation==='watermark'){
    const text=String(settings.text||'TAMPtools').slice(0,80);
    const opacity=clamp(Number(settings.opacity)||0.45,0.08,0.9);
    const svg=`<svg width="${meta.width||1200}" height="${meta.height||800}" xmlns="http://www.w3.org/2000/svg"><text x="${(meta.width||1200)-40}" y="${(meta.height||800)-35}" text-anchor="end" font-family="Arial" font-size="${Math.max(18,Math.round((meta.width||1200)/32))}" font-weight="700" fill="#ffffff" fill-opacity="${opacity}" stroke="#000000" stroke-opacity="${Math.min(.28,opacity*.5)}" stroke-width="2">${text.replace(/[&<>]/g,'')}</text></svg>`;
    image=image.composite([{input:Buffer.from(svg),blend:'over'}]);
  }
  if(operation==='shadow' || operation==='reflection'){
    const base=await image.png().toBuffer(); const m=await sharp(base).metadata();
    if(operation==='shadow'){
      const alpha=await sharp(base).extractChannel('alpha').blur(18).tint('#000000').png().toBuffer();
      const canvas=sharp({create:{width:m.width||1200,height:(m.height||800)+40,channels:4,background:{r:255,g:255,b:255,alpha:1}}}).composite([{input:alpha,left:8,top:22,blend:'multiply'},{input:base,left:0,top:0}]);
      image=canvas;
    } else {
      const refl=await sharp(base).flip().modulate({brightness:.55}).blur(.5).png().toBuffer();
      image=sharp({create:{width:m.width||1200,height:(m.height||800)*2+12,channels:4,background:{r:255,g:255,b:255,alpha:1}}}).composite([{input:base,left:0,top:0},{input:refl,left:0,top:(m.height||800)+12}]);
    }
  }

  const format=(settings.format||'webp').toLowerCase();
  const quality=clamp(Number(settings.quality)||88,10,100);
  let outMime='image/webp', extension='webp';
  if(format==='png' || transparent){image=image.png({compressionLevel:9});outMime='image/png';extension='png';}
  else if(format==='jpeg' || format==='jpg'){image=image.flatten({background:'#ffffff'}).jpeg({quality});outMime='image/jpeg';extension='jpg';}
  else if(format==='avif'){image=image.avif({quality});outMime='image/avif';extension='avif';}
  else {image=image.webp({quality});}
  const out=await image.toBuffer();
  return {buffer:out,mimeType:outMime,extension,filename:`${safeBase(originalName)}-${operation}.${extension}`,width:meta.width,height:meta.height,originalSize:buffer.length,outputSize:out.length};
}
