const REAL_TOOL_NAMES = [
  "PDF Compressor", "AI Social Media Writer", "Social Media Scheduler", "Image Generator", "Image Studio",
  "Lead Generator", "Email Generator", "Background Remover", "QR Code Generator",
  "PDF Splitter", "Image Compressor", "Image Converter", "Proposal Generator",
  "CV / Resume Builder", "Cover Letter Generator", "Invoice Generator",
  "Cold Email Generator", "Blog Post Generator", "AI Business Assistant", "AI Content Writer"
];

const CATEGORY_BY_NAME = {
  "AI Social Media Writer": "Social",
  "Social Media Scheduler": "Social",
  "Image Generator": "Images",
  "Image Studio": "Images",
  "Lead Generator": "Lead & Email",
  "Email Generator": "Lead & Email",
  "Cold Email Generator": "Lead & Email",
  "AI Content Writer": "Content & AI",
  "Blog Post Generator": "Content & AI",
  "AI Business Assistant": "Content & AI",
  "CV / Resume Builder": "Documents",
  "Cover Letter Generator": "Documents",
  "Proposal Generator": "Documents",
  "PDF Converter": "PDF",
  "PDF Merger": "PDF",
  "PDF Splitter": "PDF",
  "PDF Compressor": "PDF",
  "Image Compressor": "Images",
  "Image Converter": "Images",
  "Background Remover": "Images",
  "QR Code Generator": "Business",
  "Invoice Generator": "Business"
};

// Every plan, including Free, gets all 21 tools — the real differentiator
// between plans is the shared monthly-action pool and the scheduling window
// (see planRows in db/database.js), not tool access.
export const TOOL_CATALOG = [
  ["✉️","Mail Manager","Search, organize, archive and write email."],
  ["🖼️","Image Studio","Edit, enhance, resize, convert and process images."],
  ["📄","Document & PDF Studio","Create, merge, split, compress, extract and organize documents."],
  ["📁","Storage Manager","Find large, duplicate and old files and organize storage."],
  ["▦","ZIP & File Toolkit","Zip, unzip, package and manage archives."],
  ["⚙️","Batch Studio","Process many files in one controlled workflow."],
  ["🧾","Invoice Generator","Create professional invoices."],
  ["📋","Proposal Builder","Build structured business proposals."],
  ["▦","QR Code Generator","Create branded QR codes."],
  ["📊","Spreadsheet & Data Cleaner","Clean, normalize and export business data."],
  ["📄","Resume Builder","Build and tailor professional resumes."],
  ["💼","Cover Letter Builder","Create tailored job application letters."],
  ["✍️","Career/Profile Writer","Write bios, summaries and application responses."],
  ["📝","Content Studio","Create blogs, website copy, product descriptions and reports."],
  ["✦","TAMP Assistant","Use natural language to discover tools and orchestrate workflows."]
].map((tool,index)=>({id:index+1,key:tool[1].toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),icon:tool[0],name:tool[1],description:tool[2],category:{"Mail Manager":"Mail","Image Studio":"Images","Document & PDF Studio":"Documents & PDF","Storage Manager":"Files & Storage","ZIP & File Toolkit":"Files & Storage","Batch Studio":"Batch","Invoice Generator":"Business","Proposal Builder":"Business","QR Code Generator":"Business","Spreadsheet & Data Cleaner":"Data","Resume Builder":"Career & Content","Cover Letter Builder":"Career & Content","Career/Profile Writer":"Career & Content","Content Studio":"Career & Content","TAMP Assistant":"TAMP Assistant"}[tool[1]],implementation:"real"}));
