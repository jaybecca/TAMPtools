/* TAMPtools application registry — Phase 55 architecture reset.
   Shared shell lives in app.js; tool applications own their entry page, JS and styles.
   A tool is not considered migrated until it has a dedicated entry point here. */
window.TAMP_APP_REGISTRY={
  'document-pdf-studio':{name:'Document & PDF Studio',entry:'/apps/document-pdf.html',status:'migrated'},
  'image-studio':{name:'Image Studio',entry:'/workspace.html?tool=image-studio',status:'legacy'},
  'invoice-generator':{name:'Invoice Generator',entry:'/workspace.html?tool=invoice-generator',status:'legacy'},
  'proposal-builder':{name:'Proposal Builder',entry:'/apps/proposal-builder.html',status:'active'},
  'qr-code-generator':{name:'QR Code Generator',entry:'/workspace.html?tool=qr-code-generator',status:'legacy'},
  'resume-builder':{name:'Resume Builder',entry:'/apps/resume-builder.html',status:'active'},
  'cover-letter-builder':{name:'Cover Letter Builder',entry:'/workspace.html?tool=cover-letter-builder',status:'legacy'},
  'zip-file-toolkit':{name:'ZIP & File Toolkit',entry:'/workspace.html?tool=zip-file-toolkit',status:'legacy'},
  'career-profile-writer':{name:'Career/Profile Writer',entry:'/workspace.html?tool=career-profile-writer',status:'legacy'},
  'content-studio':{name:'Content Studio',entry:'/workspace.html?tool=content-studio',status:'legacy'},
  'tamp-assistant':{name:'TAMP Assistant',entry:'/workspace.html?tool=tamp-assistant',status:'legacy'}
};
