(()=>{
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setShell(title,icon,kicker,desc){document.title=title+' — TAMPtools';const h=$("documentAppHero");if(h)h.innerHTML=`<div class="workspace-hero-card"><div class="workspace-title-block"><div class="workspace-icon">${icon}</div><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${desc}</p></div></div><div class="workspace-hero-actions"><a class="btn btn-soft" href="/templates.html">Templates</a><a class="btn btn-soft" href="/support.html">Support</a><a class="btn btn-primary" href="/dashboard.html">Dashboard</a></div></div>`}

function documentPdfOperationView(view){
  const configs={
    create:{title:'Create & edit PDF',kicker:'CREATE PDF',desc:'Start a clean PDF document from text, then export it as a real PDF.',kind:'create'},
    merge:{title:'Merge PDFs',kicker:'MERGE',desc:'Combine multiple PDF files into one document and download the merged result.',kind:'merge'},
    'image-to-pdf':{title:'Images to PDF',kicker:'IMAGE TO PDF',desc:'Combine up to 20 JPG, PNG or WebP images into one PDF document.',kind:'image-to-pdf'},
    split:{title:'Split PDF',kicker:'SPLIT',desc:'Turn selected page ranges into separate PDF files or a ZIP of multiple parts.',kind:'split'},
    extract:{title:'Extract pages',kicker:'EXTRACT',desc:'Pull specific pages or ranges from a PDF into a new document.',kind:'extract'},
    reorder:{title:'Reorder pages',kicker:'REORDER',desc:'Set an exact page order without opening the full organizer.',kind:'reorder'},
    rotate:{title:'Rotate pages',kicker:'ROTATE',desc:'Rotate all pages or selected page ranges by 90°, 180°, or 270°.',kind:'rotate'},
    compress:{title:'Compress PDF',kicker:'COMPRESS',desc:'Reduce PDF size while choosing the quality level you need.',kind:'compress'},
    convert:{title:'Convert documents',kicker:'CONVERT',desc:'Convert PDF and supported office/image documents into useful formats.',kind:'convert'},
    'add-remove':{title:'Add / remove pages',kicker:'PAGE MANAGEMENT',desc:'Insert a blank page or remove selected pages without leaving the PDF studio.',kind:'add-remove'},
    ocr:{title:'OCR & extract text',kicker:'OCR',desc:'Turn scanned PDF pages into searchable text or extract existing PDF text.',kind:'ocr'}
  };
  const cfg=configs[view]||configs.organize;
  const isCreate=cfg.kind==='create';
  const isMerge=cfg.kind==='merge';
  const formFields={
    create:`<div class="pdf-op-grid"><label>Document title<input id="opTitle" value="TAMPtools Document"></label><label>Content<textarea id="opText" rows="12" placeholder="Type or paste your document text here…"></textarea></label></div>`,
    merge:`<label class="pdf-dropzone"><input id="opFiles" type="file" accept="application/pdf,.pdf" multiple><span class="pdf-drop-icon">＋</span><b>Choose two or more PDFs</b><small>Drop files here or browse. Files will be merged in the order selected.</small><em id="opFileNames">No files selected</em></label>`,
    'image-to-pdf':`<label class="pdf-dropzone"><input id="opFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple><span class="pdf-drop-icon">↑</span><b>Choose images</b><small>Select up to 20 JPG, PNG or WebP images. They become PDF pages in the order selected.</small><em id="opFileNames">No files selected</em></label>`,
    split:`${fileField(false)}<label>Page ranges<input id="opRanges" value="1-3,5" placeholder="1-3,5,8-10"></label>`,
    extract:`${fileField(false)}<label>Pages to extract<input id="opRanges" value="1,3-5" placeholder="1,3-5"></label>`,
    reorder:`${fileField(false)}<label>New page order<input id="opOrder" value="3,1,2" placeholder="3,1,2"></label>`,
    rotate:`${fileField(false)}<div class="pdf-op-grid"><label>Rotation<select id="opDegrees"><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">270° clockwise</option></select></label><label>Pages (optional)<input id="opPages" placeholder="All pages or 1,3-5"></label></div>`,
    compress:`${fileField(false)}<label>Compression level<select id="opLevel"><option value="ebook">Balanced — recommended</option><option value="screen">Smallest file</option><option value="printer">Higher quality</option></select></label>`,
    convert:`${fileField(false)}<label>Convert to<select id="opTarget"><option value="docx">DOCX</option><option value="pptx">PPTX</option><option value="xlsx">XLSX</option><option value="txt">TXT</option><option value="png">PNG</option><option value="jpg">JPG</option><option value="pdf">PDF</option></select></label>`,
    'add-remove':`${fileField(false)}<div class="pdf-op-grid"><label>Action<select id="opAction"><option value="remove">Remove pages</option><option value="insert">Insert blank page</option></select></label><label>Pages / position<input id="opSpec" value="2,5-7" placeholder="Remove: 2,5-7 · Insert: 3"></label></div>`,
    ocr:`${fileField(false)}<div class="pdf-op-grid"><label>OCR language<input id="opLanguage" value="eng" placeholder="eng"></label><label>Operation<select id="opOcrMode"><option value="ocr">OCR scanned pages</option><option value="text">Extract existing text</option></select></label></div>`
  };
  function fileField(multiple){return `<label class="pdf-dropzone compact"><input id="opFiles" type="file" accept="application/pdf,.pdf" ${multiple?'multiple':''}><span class="pdf-drop-icon">↑</span><b>Choose a PDF</b><small>PDF files are processed securely for this operation.</small><em id="opFileNames">No file selected</em></label>`}
  document.title=cfg.title+' — Document & PDF Studio — TAMPtools';
  const root=document.getElementById('documentCanvas');
  root.innerHTML=`<div class="pdf-operation-app"><header class="pdf-operation-header"><div><a class="pdf-back-link" href="/apps/document-pdf.html?view=organize">← PDF Studio</a><span class="eyebrow">${cfg.kicker}</span><h1>${cfg.title}</h1><p>${cfg.desc}</p></div><div class="pdf-op-header-actions"><a class="btn btn-soft" href="/templates.html">Templates</a><a class="btn btn-soft" href="/support.html">Support</a></div></header><div class="pdf-operation-layout"><aside class="pdf-operation-nav"><div class="pdf-op-nav-title">PDF Studio</div>${Object.entries(configs).map(([key,c])=>`<a class="${key===view?'active':''}" href="/apps/document-pdf.html?view=${key}"><span>${key==='merge'?'＋':key==='split'?'⇲':key==='extract'?'✂':key==='reorder'?'↕':key==='rotate'?'↻':key==='compress'?'↓':key==='convert'?'⇄':key==='add-remove'?'±':key==='ocr'?'⌕':key==='create'?'＋':'▤'}</span>${c.title}</a>`).join('')}</aside><main class="pdf-operation-main"><section class="pdf-operation-card"><div class="pdf-operation-form">${formFields[cfg.kind]||''}<button class="btn btn-primary pdf-op-submit" id="opSubmit">${isCreate?'Create PDF':isMerge?'Merge PDFs':cfg.kind==='image-to-pdf'?'Create PDF':`Run ${cfg.title}`}</button><div class="pdf-op-status" id="opStatus">Ready</div></div><div class="pdf-operation-result" id="opResult"><div class="pdf-result-placeholder"><span>▤</span><h2>Your result will appear here</h2><p>Run the operation to generate a real file.</p></div></div></section></main></div></div>`;
  const names=document.getElementById('opFileNames');const files=document.getElementById('opFiles');files?.addEventListener('change',()=>{if(names)names.textContent=[...files.files].map(f=>f.name).join(' · ')||'No file selected';});
  document.getElementById('opSubmit').onclick=()=>runOperation(cfg.kind);
  async function runOperation(kind){
    const status=document.getElementById('opStatus'), result=document.getElementById('opResult'), btn=document.getElementById('opSubmit');
    btn.disabled=true;status.textContent='Working…';
    try{
      let r,d;
      if(kind==='create'){
        r=await fetch('/api/document-pdf/create',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({title:document.getElementById('opTitle').value,text:document.getElementById('opText').value})});
      } else {
        const fd=new FormData();
        if(files?.files?.length) [...files.files].forEach(f=>fd.append(kind==='merge'||kind==='image-to-pdf'?'files':'file',f));
        if(kind==='merge') r=await fetch('/api/document-pdf/merge',{method:'POST',body:fd,credentials:'include'});
        else if(kind==='image-to-pdf') r=await fetch('/api/document-pdf/image-to-pdf',{method:'POST',body:fd,credentials:'include'});
        else if(kind==='split'){fd.append('ranges',document.getElementById('opRanges').value);r=await fetch('/api/document-pdf/split',{method:'POST',body:fd,credentials:'include'});}
        else if(kind==='extract'){fd.append('ranges',document.getElementById('opRanges').value);r=await fetch('/api/document-pdf/extract-pages',{method:'POST',body:fd,credentials:'include'});}
        else if(kind==='reorder'){fd.append('order',document.getElementById('opOrder').value);r=await fetch('/api/document-pdf/organize',{method:'POST',body:fd,credentials:'include'});}
        else if(kind==='rotate'){fd.append('degrees',document.getElementById('opDegrees').value);fd.append('pages',document.getElementById('opPages').value);r=await fetch('/api/document-pdf/rotate',{method:'POST',body:fd,credentials:'include'});}
        else if(kind==='compress'){fd.append('level',document.getElementById('opLevel').value);r=await fetch('/api/document-pdf/compress',{method:'POST',body:fd,credentials:'include'});}
        else if(kind==='convert'){fd.append('target',document.getElementById('opTarget').value);fd.append('scope','all');r=await fetch('/api/document-pdf/convert',{method:'POST',body:fd,credentials:'include'});}
        else if(kind==='add-remove'){fd.append('action',document.getElementById('opAction').value);fd.append('spec',document.getElementById('opSpec').value);r=await fetch('/api/document-pdf/add-remove',{method:'POST',body:fd,credentials:'include'});}
        else if(kind==='ocr'){
          if(document.getElementById('opOcrMode').value==='text') r=await fetch('/api/document-pdf/extract-text',{method:'POST',body:fd,credentials:'include'});
          else {fd.append('language',document.getElementById('opLanguage').value||'eng');r=await fetch('/api/document-pdf/ocr',{method:'POST',body:fd,credentials:'include'});}
        }
      }
      d=await r.json();if(!r.ok)throw new Error(d.error||'Operation failed.');
      const file=d.file||d.files?.[0];
      if(file){result.innerHTML=`<div class="pdf-operation-success"><span class="pdf-success-icon">✓</span><span class="eyebrow">READY</span><h2>${esc(file.filename||'Output')}</h2><p>Your processed document is ready.</p><a class="btn btn-primary" href="${file.downloadUrl}" target="_blank" rel="noopener">Download result</a>${file.previewUrl?`<a class="btn btn-soft" href="${file.previewUrl}" target="_blank" rel="noopener">Open preview</a>`:''}</div>`;}
      else if(d.text!==undefined){result.innerHTML=`<div class="pdf-text-result"><span class="eyebrow">EXTRACTED TEXT</span><textarea readonly>${esc(d.text)}</textarea><button class="btn btn-soft" id="copyExtracted">Copy text</button></div>`;document.getElementById('copyExtracted').onclick=()=>navigator.clipboard?.writeText(d.text||'');}
      status.textContent='Complete';
    }catch(e){status.textContent='Could not complete';result.innerHTML=`<div class="pdf-operation-error"><b>Operation failed</b><p>${esc(e.message)}</p></div>`;}
    finally{btn.disabled=false;}
  }
}

function documentPdfStudio(){
  setShell('Document & PDF Studio','▤','DOCUMENT WORKSPACE','Arrange, edit and export PDF pages in one visual workspace.');
  const c=$('documentCanvas');
  c.innerHTML=`
  <div class="pdf-studio-app">
    <header class="pdf-studio-toolbar">
      <div class="pdf-studio-filebar"><button class="pdf-icon-btn" id="pdfNew" title="New workspace">＋</button><div class="pdf-doc-title"><input id="pdfWorkspaceName" value="Untitled PDF workspace" aria-label="Workspace name"><span id="pdfSaveState">Not saved</span></div></div>
      <div class="pdf-main-actions"><button class="btn btn-soft" id="pdfUndo" disabled>Undo</button><button class="btn btn-soft" id="pdfSave">Save</button><button class="btn btn-primary" id="pdfExport" disabled>Export PDF</button><button class="pdf-toolbar-icon" id="pdfCanvasFocus" type="button">Focus canvas</button></div>
    </header>
    <section class="pdf-upload-strip" id="pdfUploadStrip" aria-label="Upload PDF">
      <div class="pdf-upload-strip-copy"><span class="pdf-upload-strip-icon">↑</span><div><span class="eyebrow">ADD DOCUMENTS</span><strong>Upload PDF files to start working</strong><small>Drop PDFs anywhere in this bar, or choose files. Pages will open on the canvas below.</small></div></div>
      <div class="pdf-upload-strip-actions"><span class="pdf-upload-count" id="pdfUploadCount">No files loaded</span><button class="btn btn-primary" id="pdfUploadChoose">Upload PDF</button><input id="pdfUploadInput" type="file" accept="application/pdf,.pdf" multiple hidden></div>
    </section>
    <div class="pdf-studio-body">
      <aside class="pdf-left-rail">
        <button class="pdf-rail-tool active" data-panel="pages"><span>▤</span><b>Pages</b></button>
        <button class="pdf-rail-tool" data-panel="files"><span>▰</span><b>Sources</b></button>
        <button class="pdf-rail-tool" data-panel="tools"><span>⚙</span><b>Tools</b></button>
        <div class="pdf-rail-spacer"></div>
        <a class="pdf-rail-tool" href="/templates.html"><span>✦</span><b>Templates</b></a>
      </aside>
      <aside class="pdf-panel-column" id="pdfPanelColumn"></aside>
      <main class="pdf-canvas-stage">
        <div class="pdf-canvas-top"><div><span class="eyebrow">DOCUMENT CANVAS</span><strong id="pdfCanvasTitle">No document loaded</strong></div><div class="pdf-canvas-actions"><button class="pdf-small-btn" id="pdfSelectAll">Select all</button><button class="pdf-small-btn" id="pdfDeselect">Clear selection</button><span class="pdf-selection-count" id="pdfSelectionCount">0 selected</span></div></div>
        <div class="pdf-page-scroller" id="pdfPageScroller"><div class="pdf-empty-state" id="pdfEmptyState"><div class="pdf-empty-icon">▤</div><h2>Your document canvas is ready</h2><p>Upload a PDF above to bring its pages onto this large workspace.</p><small>Once loaded, drag pages to reorder, select pages for actions, rotate, duplicate, delete or insert.</small></div><div class="pdf-page-grid" id="pdfPageGrid" hidden></div></div>
        <div class="pdf-canvas-footer"><span id="pdfPageSummary">0 pages</span><div class="pdf-zoom-controls"><button class="pdf-small-btn" id="pdfZoomOut">−</button><span id="pdfZoom">100%</span><button class="pdf-small-btn" id="pdfZoomIn">+</button></div></div>
      </main>
      <aside class="pdf-inspector" id="pdfInspector"><div class="pdf-inspector-empty"><span>☷</span><h3>Page inspector</h3><p>Select a page to see actions and document details.</p></div></aside>
    </div>
  </div>`;
  const preview=$('documentPreview'); if(preview) preview.innerHTML='';
  setupPdfStudioWorkspace();
}

function setupPdfStudioWorkspace(){
  let sources=[], pages=[], selected=new Set(), history=[], workspaceId=null, saveTimer=null, zoom=100, currentPanel='pages', plan='Free', leftCollapsed=false, rightCollapsed=false, focusMode=false;
  const $id=id=>document.getElementById(id), grid=$id('pdfPageGrid'), scroller=$id('pdfPageScroller');
  const escHtml=v=>esc(String(v??''));
  const snapshot=()=>pages.map(p=>({...p}));
  const setSaveState=t=>$id('pdfSaveState').textContent=t;
  const pushHistory=()=>{history.push(snapshot()); if(history.length>30)history.shift(); $id('pdfUndo').disabled=false; scheduleSave();};
  const restoreHistory=()=>{const previous=history.pop();if(!previous)return;pages=previous;selected=new Set();renderPages();$id('pdfUndo').disabled=!history.length;scheduleSave();};
  const selectedPages=()=>pages.filter(p=>selected.has(p.id));
  const updateUploadCount=()=>{const el=$id('pdfUploadCount');if(el)el.textContent=sources.length?`${sources.length} ${sources.length===1?'PDF':'PDFs'} loaded`:'No files loaded';};
  const updateMeta=()=>{const n=pages.length, sel=selected.size;$id('pdfSelectionCount').textContent=`${sel} selected`; $id('pdfPageSummary').textContent=`${n} ${n===1?'page':'pages'} · ${sources.length} ${sources.length===1?'file':'files'}`;$id('pdfExport').disabled=!n;$id('pdfCanvasTitle').textContent=sources[0]?.filename||'No document loaded';updateUploadCount();};
  const renderPages=()=>{
    updateMeta();
    if(!pages.length){grid.hidden=true;$id('pdfEmptyState').hidden=false;renderInspector();return;}
    grid.hidden=false;$id('pdfEmptyState').hidden=true;grid.style.setProperty('--pdf-thumb-scale',String(zoom/100));
    grid.innerHTML=pages.map((p,i)=>`<article class="pdf-page-card ${selected.has(p.id)?'selected':''}" draggable="true" data-page-id="${p.id}" style="--page-rotation:${p.rotation||0}deg"><div class="pdf-page-number"><span>${i+1}</span><button class="pdf-page-menu" data-page-action="more" title="Page actions">•••</button></div><div class="pdf-page-thumb-wrap">${p.blank?'<div class="pdf-blank-page"><span>Blank page</span></div>':`<img class="pdf-page-thumb" src="${p.thumbnail}" alt="Page ${i+1}">`}<div class="pdf-page-overlay"><button data-page-action="rotate" title="Rotate">↻</button><button data-page-action="duplicate" title="Duplicate">⧉</button><button data-page-action="delete" title="Delete">×</button></div></div><div class="pdf-page-caption"><strong>${escHtml(p.label||`Page ${i+1}`)}</strong><span>${p.blank?'Blank':`Source ${Number(p.sourceIndex)+1}`}</span></div></article>`).join('');
    grid.querySelectorAll('.pdf-page-card').forEach(card=>{
      const id=card.dataset.pageId;
      card.addEventListener('click',e=>{if(e.target.closest('button'))return; if(e.shiftKey&&selected.size){const ids=pages.map(p=>p.id), last=ids.indexOf([...selected].at(-1)), now=ids.indexOf(id), [a,b]=last<now?[last,now]:[now,last];selected=new Set(ids.slice(a,b+1));}else if(e.metaKey||e.ctrlKey){selected.has(id)?selected.delete(id):selected.add(id);}else selected=new Set([id]);renderPages();renderInspector();});
      card.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',id);card.classList.add('dragging')});
      card.addEventListener('dragend',()=>card.classList.remove('dragging'));
      card.addEventListener('dragover',e=>e.preventDefault());
      card.addEventListener('drop',e=>{e.preventDefault();const from=pages.findIndex(p=>p.id===e.dataTransfer.getData('text/plain')),to=pages.findIndex(p=>p.id===id);if(from<0||to<0||from===to)return;pushHistory();const [m]=pages.splice(from,1);pages.splice(to,0,m);renderPages();});
      card.querySelectorAll('[data-page-action]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const act=btn.dataset.pageAction;selected=new Set([id]);if(act==='rotate')rotateSelected(90);else if(act==='duplicate')duplicateSelected();else if(act==='delete')deleteSelected();else renderInspector();}));
    });
    renderInspector();
  };
  const renderInspector=()=>{
    const chosen=selectedPages();
    if(!chosen.length){$id('pdfInspector').innerHTML=`<div class="pdf-inspector-empty"><span>☷</span><h3>Page inspector</h3><p>Select a page to see page-level controls, source information and export actions.</p></div>`;return;}
    const p=chosen[0];
    $id('pdfInspector').innerHTML=`<div class="pdf-inspector-head"><span class="eyebrow">PAGE ${pages.indexOf(p)+1}</span><h3>${escHtml(p.label||'PDF page')}</h3><span class="pdf-inspector-meta">${chosen.length>1?`${chosen.length} pages selected`:`Source ${Number(p.sourceIndex)+1} · original page ${Number(p.pageIndex)+1}`}</span></div><div class="pdf-inspector-preview">${p.blank?'<div class="pdf-blank-page"><span>Blank page</span></div>':`<img src="${p.thumbnail}" alt="Selected page">`}</div><div class="pdf-inspector-actions"><button class="btn btn-soft" id="inspRotate">↻ Rotate 90°</button><button class="btn btn-soft" id="inspDuplicate">⧉ Duplicate</button><button class="btn btn-soft danger" id="inspDelete">× Delete</button></div><div class="pdf-inspector-section"><span class="eyebrow">DOCUMENT ACTIONS</span><button class="pdf-action-row" id="inspExtract"><span>✂</span><div><b>Extract selected pages</b><small>Create a new PDF from this selection.</small></div>→</button><button class="pdf-action-row" id="inspSplit"><span>⇲</span><div><b>Split at selection</b><small>Export the selected pages as a separate document.</small></div>→</button></div>`;
    $id('inspRotate').onclick=()=>rotateSelected(90);$id('inspDuplicate').onclick=duplicateSelected;$id('inspDelete').onclick=deleteSelected;$id('inspExtract').onclick=()=>exportPdf(true);$id('inspSplit').onclick=()=>exportPdf(true);
  };
  const rotateSelected=deg=>{if(!selected.size)return;pushHistory();pages=pages.map(p=>selected.has(p.id)?({...p,rotation:((p.rotation||0)+deg)%360}):p);renderPages();};
  const duplicateSelected=()=>{if(!selected.size)return;pushHistory();const out=[];pages.forEach(p=>{out.push(p);if(selected.has(p.id))out.push({...p,id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,label:`${p.label||'Page'} copy`});});pages=out;renderPages();};
  const deleteSelected=()=>{if(!selected.size)return;pushHistory();pages=pages.filter(p=>!selected.has(p.id));selected=new Set();renderPages();};
  const insertBlank=()=>{pushHistory();const first=selectedPages()[0], at=first?pages.findIndex(p=>p.id===first.id)+1:pages.length;const blank={id:`blank-${Date.now()}-${Math.random()}`,blank:true,pageIndex:0,sourceIndex:0,sourceId:null,rotation:0,label:'Blank page'};pages.splice(at,0,blank);selected=new Set([blank.id]);renderPages();};
  const openFiles=()=>{const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='application/pdf,.pdf';input.onchange=()=>input.files?.length&&loadFiles([...input.files]);input.click();};
  async function loadFiles(fileList){
    const valid=fileList.filter(f=>/\.pdf$/i.test(f.name)||f.type==='application/pdf');if(!valid.length)return;
    setSaveState('Inspecting PDFs…');
    const fd=new FormData();valid.forEach(f=>fd.append('files',f));
    try{const r=await fetch('/api/document-pdf/inspect',{method:'POST',body:fd,credentials:'include'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to open the PDF.');
      const baseIndex=sources.length;sources.push(...d.sources);const incoming=[];d.sources.forEach((src,si)=>src.pages.forEach(pg=>incoming.push({id:`${src.id}-${pg.pageIndex}-${Date.now()}-${Math.random()}`,sourceId:src.id,sourceIndex:baseIndex+si,pageIndex:pg.pageIndex,rotation:0,thumbnail:pg.thumbnail,label:src.filename})));pushHistory();pages.push(...incoming);renderPages();showPanel('pages');setSaveState('Unsaved changes');await saveWorkspace();
    }catch(e){alert(e.message);setSaveState('Not saved');}
  }
  async function saveWorkspace(){
    if(!pages.length)return;setSaveState('Saving…');
    const metadata={version:2,sources:sources.map(s=>({id:s.id,filename:s.filename,sizeBytes:s.sizeBytes,pageCount:s.pageCount,truncated:s.truncated})),pages:pages.map(p=>({id:p.id,sourceId:p.sourceId,sourceIndex:p.sourceIndex,pageIndex:p.pageIndex,rotation:p.rotation||0,blank:Boolean(p.blank),label:p.label}))};
    try{const method=workspaceId?'PATCH':'POST',url=workspaceId?`/api/document-pdf/workspaces/${workspaceId}`:'/api/document-pdf/workspaces';const body=workspaceId?{name:$id('pdfWorkspaceName').value,metadata}:{name:$id('pdfWorkspaceName').value,metadata};const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to save workspace.');if(!workspaceId)workspaceId=d.workspace.id;setSaveState(`Saved ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);loadRecent();}catch(e){setSaveState('Save failed');console.error(e);}
  }
  const scheduleSave=()=>{clearTimeout(saveTimer);setSaveState('Unsaved changes');saveTimer=setTimeout(saveWorkspace,900);};
  async function exportPdf(selectionOnly=false){
    const chosen=selectionOnly?selectedPages():pages;if(!chosen.length){alert('Select at least one page.');return null;}
    const body={sourceFileIds:[...new Set(chosen.map(p=>p.sourceId).filter(Boolean))],pages:chosen.map(p=>({fileIndex:sources.findIndex(s=>s.id===p.sourceId),pageIndex:p.pageIndex,rotation:p.rotation||0,blank:Boolean(p.blank)})),filename:`${($id('pdfWorkspaceName').value||'TAMPtools document').trim()}.pdf`};
    if(body.sourceFileIds.length===0&&chosen.some(p=>!p.blank)){alert('A source file is missing.');return null;}
    const btn=$id('pdfExport');btn.disabled=true;btn.textContent='Exporting…';
    try{const r=await fetch('/api/document-pdf/compose',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to export the PDF.');showResult(d.file);return d.file;}catch(e){alert(e.message);return null}finally{btn.disabled=false;btn.textContent='Export PDF';}
  }
  function showResult(file){$id('pdfInspector').innerHTML=`<div class="pdf-result-card"><span class="eyebrow">EXPORT READY</span><h3>${escHtml(file.filename)}</h3><p>Your exported PDF contains the current page order, rotations, deletions and inserted pages.</p><a class="btn btn-primary" href="${file.downloadUrl}" target="_blank" rel="noopener">Download PDF</a><a class="btn btn-soft" href="${file.previewUrl}" target="_blank" rel="noopener">Open preview</a></div>`;}
  async function processUtility(kind, options={}){
    const composed=await exportPdf(false);if(!composed)return;
    try{
      const blob=await fetch(composed.downloadUrl,{credentials:'include'}).then(r=>{if(!r.ok)throw new Error('Unable to prepare the current PDF.');return r.blob()});
      const fd=new FormData();fd.append('file',blob,composed.filename);
      let endpoint='/api/document-pdf/compress';
      if(kind==='compress') fd.append('level',options.level||'ebook');
      if(kind==='convert'){
        endpoint='/api/document-pdf/convert';
        const target=options.target||'docx';
        if(!['docx','txt','png','jpg'].includes(target))throw new Error('This PDF Studio conversion supports PDF → Word, TXT, PNG or JPG.');
        fd.append('target',target);fd.append('scope','all');
      }
      const r=await fetch(endpoint,{method:'POST',body:fd,credentials:'include'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Operation failed.');
      const file=d.file||d.files?.[0];if(file)showResult(file);else if(d.files?.length)showResult(d.files[0]);
    }catch(e){alert(e.message)}
  }
  const panelMarkup={
    pages:`<div class="pdf-panel-head"><span class="eyebrow">PAGES</span><h3>Document pages</h3><p>Drag thumbnails to reorder. Select pages to act on several at once.</p></div><button class="pdf-panel-action" id="panelAddBlank">＋ Insert blank page</button><button class="pdf-panel-action" id="panelExtract">✂ Extract selection</button><div class="pdf-panel-note">Blank pages are optional PDF pages. They are inserted only when you choose this action.</div><div class="pdf-panel-note">Tip: Shift-click selects a range. Command/Ctrl-click adds individual pages.</div>`,
    files:`<div class="pdf-panel-head"><span class="eyebrow">SOURCE FILES</span><h3>${sources.length} loaded</h3><p>Every uploaded PDF appears here. Use the single Upload PDF button above to add more.</p></div><div class="pdf-source-list">${sources.map((s,i)=>`<div class="pdf-source-item"><span class="pdf-source-icon">PDF</span><div><b>${escHtml(s.filename)}</b><small>${s.pageCount} pages · ${formatBytes(s.sizeBytes)}</small></div></div>`).join('')||'<div class="pdf-panel-note">No PDFs loaded yet.</div>'}</div>`,
    tools:`<div class="pdf-panel-head"><span class="eyebrow">PAGE TOOLS</span><h3>Work on the current PDF</h3><p>These controls operate inside this workspace. No separate tool pages.</p></div><section class="pdf-tool-card"><span class="eyebrow">ROTATE PAGES</span><h4>Rotate selected pages</h4><p>Choose a page or several pages, then apply the rotation.</p><div class="pdf-rotate-grid"><button class="pdf-tool-choice" data-rotate="-90">↶ 90°</button><button class="pdf-tool-choice" data-rotate="90">↷ 90°</button><button class="pdf-tool-choice" data-rotate="180">↻ 180°</button><button class="pdf-tool-choice" data-rotate="all90">All pages ↷</button></div><small class="pdf-tool-help">${selected.size?`${selected.size} page${selected.size===1?'':'s'} selected.`:'Select pages on the canvas first.'}</small></section><section class="pdf-tool-card"><span class="eyebrow">COMPRESS PDF</span><h4>Reduce file size</h4><select id="toolCompressLevel"><option value="ebook">Balanced — recommended</option><option value="screen">Smallest file</option><option value="printer">Higher quality</option></select><button class="btn btn-soft btn-wide" id="toolCompressRun">Compress current PDF</button></section><section class="pdf-tool-card"><span class="eyebrow">CONVERT PDF</span><h4>Export to another format</h4><p>PDF → Word, TXT, PNG or JPG.</p><select id="toolConvertTarget"><option value="docx">Word (.docx)</option><option value="txt">Text (.txt)</option><option value="png">PNG images</option><option value="jpg">JPG images</option></select><button class="btn btn-soft btn-wide" id="toolConvertRun">Convert PDF</button></section><section class="pdf-tool-card compact"><button class="pdf-action-row" id="toolInsert"><span>＋</span><div><b>Insert blank page</b><small>Add an empty PDF page after the selection.</small></div>→</button><button class="pdf-action-row" id="toolDelete"><span>×</span><div><b>Delete selected pages</b><small>Remove selected pages from this workspace.</small></div>→</button></section>`,
  };
  function showPanel(name){
    currentPanel=name;
    document.querySelectorAll('.pdf-rail-tool[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));
    $id('pdfPanelColumn').innerHTML=panelMarkup[name];
    $id('panelAddBlank')?.addEventListener('click',insertBlank);
    $id('panelExtract')?.addEventListener('click',()=>exportPdf(true));
    $id('toolCompressRun')?.addEventListener('click',()=>processUtility('compress',{level:$id('toolCompressLevel')?.value||'ebook'}));
    $id('toolConvertRun')?.addEventListener('click',()=>processUtility('convert',{target:$id('toolConvertTarget')?.value||'docx'}));
    $id('toolInsert')?.addEventListener('click',insertBlank);
    $id('toolDelete')?.addEventListener('click',deleteSelected);
    document.querySelectorAll('[data-rotate]').forEach(btn=>btn.addEventListener('click',()=>{
      const value=btn.dataset.rotate;
      if(value==='all90'){if(!pages.length)return;selected=new Set(pages.map(p=>p.id));rotateSelected(90);}
      else rotateSelected(Number(value));
    }));
  }
  async function loadRecent(){try{const r=await fetch('/api/document-pdf/workspaces',{credentials:'include',cache:'no-store'});const d=await r.json();if(!r.ok)return;recent=d.workspaces||[];}catch{}}
  let recent=[];
  async function restoreWorkspace(id){const item=recent.find(x=>Number(x.id)===Number(id));if(!item)return;const meta=item.metadata||{};try{setSaveState('Restoring…');sources=[];pages=[];for(const src of meta.sources||[]){const r=await fetch(`/api/document-pdf/source/${src.id}`,{credentials:'include'});const d=await r.json();if(!r.ok)throw new Error(d.error||`Unable to restore ${src.filename}`);sources.push(d.source);}for(const p of meta.pages||[]){const src=sources.find(s=>Number(s.id)===Number(p.sourceId));const pg=src?.pages?.find(x=>x.pageIndex===Number(p.pageIndex));pages.push({...p,thumbnail:pg?.thumbnail||'',blank:Boolean(p.blank)});}workspaceId=item.id;$id('pdfWorkspaceName').value=item.name;selected=new Set();renderPages();setSaveState('Saved');}catch(e){alert(e.message);setSaveState('Restore failed');}}
  const formatBytes=n=>{const x=Number(n)||0;return x<1024*1024?`${Math.max(1,Math.round(x/1024))} KB`:`${(x/1024/1024).toFixed(1)} MB`;};
  document.querySelectorAll('.pdf-rail-tool[data-panel]').forEach(b=>b.addEventListener('click',()=>showPanel(b.dataset.panel)));
$id('pdfUploadChoose').onclick=()=> $id('pdfUploadInput')?.click();$id('pdfUploadInput').addEventListener('change',e=>{if(e.target.files?.length)loadFiles([...e.target.files]);e.target.value='';});const uploadStrip=$id('pdfUploadStrip');uploadStrip?.addEventListener('dragover',e=>{e.preventDefault();uploadStrip.classList.add('drag-over')});uploadStrip?.addEventListener('dragleave',()=>uploadStrip.classList.remove('drag-over'));uploadStrip?.addEventListener('drop',e=>{e.preventDefault();uploadStrip.classList.remove('drag-over');const dropped=[...(e.dataTransfer?.files||[])];if(dropped.length)loadFiles(dropped)});$id('pdfNew').onclick=()=>{if(pages.length&&!confirm('Start a new PDF workspace? Unsaved changes will be lost.'))return;workspaceId=null;sources=[];pages=[];selected=new Set();history=[];$id('pdfWorkspaceName').value='Untitled PDF workspace';renderPages();setSaveState('Not saved');updateUploadCount();};
  $id('pdfSave').onclick=saveWorkspace;$id('pdfUndo').onclick=restoreHistory;$id('pdfExport').onclick=()=>exportPdf(false);$id('pdfSelectAll').onclick=()=>{selected=new Set(pages.map(p=>p.id));renderPages()};$id('pdfDeselect').onclick=()=>{selected=new Set();renderPages()};$id('pdfZoomOut').onclick=()=>{zoom=Math.max(70,zoom-10);renderPages()};$id('pdfZoomIn').onclick=()=>{zoom=Math.min(180,zoom+10);renderPages()};
  const appRoot=document.querySelector('.pdf-studio-app');
  const applyLayout=()=>{appRoot?.classList.toggle('left-collapsed',leftCollapsed);appRoot?.classList.toggle('right-collapsed',rightCollapsed);appRoot?.classList.toggle('focus-mode',focusMode);$id('pdfCanvasFocus').textContent=focusMode?'Exit focus':'Focus canvas';};
  $id('pdfCanvasFocus').onclick=()=>{focusMode=!focusMode;leftCollapsed=focusMode;rightCollapsed=focusMode;applyLayout();};
  $id('pdfPageScroller').addEventListener('dragover',e=>{if(e.target===scroller)e.preventDefault()});
  $id('pdfWorkspaceName').addEventListener('input',scheduleSave);
  $id('pdfPageScroller').addEventListener('drop',e=>{if(!e.target.closest('.pdf-page-card'))return;});
  loadRecent();showPanel('pages');renderPages();applyLayout();
}

document.addEventListener('DOMContentLoaded',()=>documentPdfStudio());
})();
