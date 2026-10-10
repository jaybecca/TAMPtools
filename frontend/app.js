/* TAMPtools — consolidated core bundle. */

/* ===== theme.js ===== */

(()=>{const r=document.documentElement,s=localStorage.getItem('tamptools-theme');if(s==='dark')r.dataset.theme='dark';function u(){document.querySelectorAll('.theme-toggle').forEach(b=>b.textContent=r.dataset.theme==='dark'?'☀':'☾')}window.toggleTheme=()=>{r.dataset.theme=r.dataset.theme==='dark'?'light':'dark';localStorage.setItem('tamptools-theme',r.dataset.theme);u()};document.addEventListener('click',e=>{if(e.target.closest('.theme-toggle'))toggleTheme()});document.addEventListener('DOMContentLoaded',u)})();


/* ===== shell.js ===== */

(()=>{
  const path=location.pathname;
  const categories=[
    ['Mail','✉','Mail'],
    ['Images','▧','Images'],
    ['Documents','▤','Documents & PDF'],
    ['Files','▦','Files & Storage'],
    ['Batch','⚙','Batch'],
    ['Business','▥','Business'],
    ['Career','◎','Career & Content'],
    ['Assistant','✦','TAMP Assistant']
  ];
  const sidebarGroups=[
    {key:'Mail',icon:'✉',tools:[['mail-manager','Mail Manager','/mail-manager.html',[['Search & filter','/mail-manager.html#search'],['Import .eml','/mail-manager.html#import'],['Connect Gmail / Outlook','/mail-manager.html#connect'],['Add another domain','/mail-manager.html#domains']]]]},
    {key:'Images',icon:'◈',tools:[['image-studio','Image Studio','/workspace.html?tool=image-studio',[['Background removal','/workspace.html?tool=image-studio&action=background'],['Resize & crop','/workspace.html?tool=image-studio&action=resize'],['Compress & convert','/workspace.html?tool=image-studio&action=compress']]]]},
    {key:'Documents',icon:'▤',tools:[['document-pdf-studio','Document & PDF Studio','/apps/document-pdf.html?view=organize',[]]]},
    {key:'Files',icon:'▰',tools:[['storage-manager','Storage Manager','/files.html',[['File browser','/files.html#browser'],['Storage scan','/files.html#scan'],['Recovery','/files.html#trash']]],['zip-file-toolkit','ZIP & File Toolkit','/workspace.html?tool=zip-file-toolkit',[['Create ZIP','/workspace.html?tool=zip-file-toolkit&action=zip'],['Extract ZIP','/workspace.html?tool=zip-file-toolkit&action=unzip'],['Protect archive','/workspace.html?tool=zip-file-toolkit&action=protect']]]]},
    {key:'Batch',icon:'⚡',tools:[['batch-studio','Batch Studio','/batch-studio.html',[['Convert','/batch-studio.html#convert'],['Compress','/batch-studio.html#compress'],['Rename / organize','/batch-studio.html#rename']]]]},
    {key:'Business',icon:'▦',tools:[['invoice-generator','Invoice Generator','/apps/invoice-generator.html',[]],['proposal-builder','Proposal Builder','/apps/proposal-builder.html',[['Build proposal','/workspace.html?tool=proposal-builder'],['Pricing & terms','/workspace.html?tool=proposal-builder#details']]],['qr-code-generator','QR Code Generator','/workspace.html?tool=qr-code-generator',[['URL / text QR','/workspace.html?tool=qr-code-generator'],['Contact / Wi-Fi','/workspace.html?tool=qr-code-generator#types']]],['spreadsheet-data-cleaner','Spreadsheet & Data Cleaner','/spreadsheet-studio.html',[['Clean data','/spreadsheet-studio.html#clean'],['Duplicates','/spreadsheet-studio.html#duplicates']]]] },
    {key:'Career',icon:'✎',tools:[['resume-builder','Resume Builder','/workspace.html?tool=resume-builder',[['Build resume','/workspace.html?tool=resume-builder'],['Tailor to job','/workspace.html?tool=resume-builder#tailor']]],['cover-letter-builder','Cover Letter Builder','/workspace.html?tool=cover-letter-builder',[['Write cover letter','/workspace.html?tool=cover-letter-builder']]],['career-profile-writer','Career/Profile Writer','/workspace.html?tool=career-profile-writer',[['Bio & summary','/workspace.html?tool=career-profile-writer'],['Application responses','/workspace.html?tool=career-profile-writer#applications']]],['content-studio','Content Studio','/workspace.html?tool=content-studio',[['Blog & articles','/workspace.html?tool=content-studio'],['Website & product copy','/workspace.html?tool=content-studio#web']]]]},
    {key:'Assistant',icon:'✦',tools:[['tamp-assistant','TAMP Assistant','/workspace.html?tool=tamp-assistant',[['Build workflow','/workspace.html?tool=tamp-assistant'],['Analyze a file','/workspace.html?tool=tamp-assistant#analyze']]]]}
  ];
  const side=()=>`<aside class="sidebar" id="sidebar">
    <div class="sidebar-scroll">
      <div class="sidebar-brand sidebar-brand-text"><span class="side-label">TAMPTOOLS WORKSPACE</span></div>
      <div class="side-label" data-i18n="workspace">Workspace</div>
      <nav class="side-nav" aria-label="Workspace tools">
        <a class="side-home" href="/dashboard.html"><span>⌂</span><span data-i18n="dashboard">Dashboard</span></a><a class="side-home" href="/templates.html"><span>▤</span><span>Templates</span></a>
        ${sidebarGroups.map(g=>`<details class="side-group"><summary><span class="side-group-icon">${g.icon}</span><span class="label" data-i18n="cat_${g.key}">${g.key}</span><span class="side-chevron">⌄</span></summary><div class="side-tools">${g.tools.map(([k,n,u,subs])=>`<details class="side-tool"><summary><span class="side-tool-dot"></span><span>${n}</span><span class="side-chevron">⌄</span></summary><div class="side-subtools"><a href="${u}" data-tool-link="${k}">Open ${n}</a>${(subs||[]).map(([sn,su])=>`<a href="${su}" data-tool-link="${k}">${sn}</a>`).join('')}</div></details>`).join('')}</div></details>`).join('')}
      </nav>
    </div>
    <div class="sidebar-bottom"><div class="side-user"><div class="avatar" id="sideAvatar">?</div><div class="user-copy"><b id="sideUserName">Loading…</b><small id="sideUserEmail"></small></div></div></div>
  </aside>`;
  const top=()=>`<header class="app-topbar"><div class="topbar-left"><button class="mobile-menu" id="mobileMenu" type="button" aria-label="Open menu">☰</button><a class="app-topbar-brand" href="/dashboard.html"><img src="/logo.png" alt="TAMPtools"></a><a class="topbar-dashboard" href="/dashboard.html">Dashboard</a><a class="topbar-dashboard" href="/pricing.html">Pricing</a><a class="topbar-dashboard" href="/templates.html">Templates</a></div><div class="app-actions"><a class="topbar-action" href="/support.html">Support</a><div class="avatar-menu"><span class="avatar avatar-trigger" id="topAvatar">?</span><div class="avatar-dropdown" id="avatarDropdown"><div class="avatar-menu-user"><b id="avatarMenuName">Account</b><small id="avatarMenuEmail"></small></div><a href="/profile.html">Profile</a><a href="/settings.html">Settings</a><a href="/notifications.html">Notifications</a><button type="button" id="menuSignout">Sign out</button></div></div></div></header>`;
  async function boot(){
    const l=document.querySelector('.app-layout');if(!l)return;
    if(!document.getElementById('sidebar'))l.insertAdjacentHTML('afterbegin',side()); else if(document.body.classList.contains('phase3-shell')){document.getElementById('sidebar')?.remove();l.insertAdjacentHTML('afterbegin',side());}
    if(!document.querySelector('.app-main .app-topbar'))document.querySelector('.app-main').insertAdjacentHTML('afterbegin',top());
    const existingAvatar=document.getElementById('topAvatar');
    existingAvatar?.setAttribute('aria-haspopup','menu'); existingAvatar?.setAttribute('aria-expanded','false');
    const sidebar=document.getElementById('sidebar');
    document.getElementById('mobileMenu').onclick=()=>sidebar.classList.toggle('open');
    const signout=async()=>{try{await fetch('/api/auth/signout',{method:'POST',credentials:'include'})}finally{location.href='/index.html'}}; document.getElementById('menuSignout')?.addEventListener('click',signout); const avatar=document.getElementById('topAvatar'),menu=document.getElementById('avatarDropdown'); if(avatar&&menu) avatar.onclick=()=>{const open=menu.classList.toggle('open');avatar.setAttribute('aria-expanded',String(open))}; document.addEventListener('click',e=>{if(menu&&avatar&&!e.target.closest('.avatar-menu')){menu.classList.remove('open');avatar.setAttribute('aria-expanded','false')}});
    document.querySelectorAll('[data-tool-link]').forEach(a=>{const app=window.TAMP_APP_REGISTRY?.[a.dataset.toolLink];if(app&&app.status!=='legacy'&&app.entry)a.href=app.entry;a.addEventListener('click',()=>sidebar.classList.remove('open'))});
    try{const r=await fetch('/api/auth/me',{credentials:'include',cache:'no-store'});if(r.status===401){location.href='/signin.html?next='+encodeURIComponent(location.pathname);return}const d=await r.json();const name=d.user.name||'there';document.getElementById('sideUserName').textContent=name;document.getElementById('sideUserEmail').textContent=d.user.email||'';document.getElementById('topAvatar').textContent=name.slice(0,2).toUpperCase();document.getElementById('avatarMenuName')?.replaceChildren(document.createTextNode(name));document.getElementById('avatarMenuEmail')?.replaceChildren(document.createTextNode(d.user.email||''))}catch{location.href='/signin.html?next='+encodeURIComponent(location.pathname)}
  }
  document.addEventListener('DOMContentLoaded',boot);
  async function setupGoogleSignIn(){
    const btn=document.getElementById('googleSignIn'), msg=document.getElementById('googleUnavailable');
    if(!btn&&!msg)return;
    try{const r=await fetch('/api/auth/google/status',{cache:'no-store'});const d=await r.json();if(d.configured){if(btn)btn.hidden=false;if(msg)msg.hidden=true}else{if(btn)btn.hidden=true;if(msg){msg.hidden=false;msg.textContent='Google sign-in is not configured. You can use email and password below.'}}}catch{if(btn)btn.hidden=true;if(msg){msg.hidden=false;msg.textContent='Google sign-in is unavailable. You can use email and password below.'}}
  }
  document.addEventListener('DOMContentLoaded',setupGoogleSignIn);
})();


/* ===== i18n.js ===== */

(()=>{
  const state={locale:null,dictionary:{},phrases:{}};
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const common={
    'Dashboard':'dashboard','All Tools':'tools','Pricing':'pricing','Settings':'settings','Support':'support','Sign in':'signIn','Get started':'getStarted','Sign out':'signOut','Search tools...':'search','Choose your plan':'choosePlan','Continue':'continue','Language':'language','Currency':'currency','Use tool':'useTool','Upgrade Plan':'upgrade','Upgrade':'upgrade','Workspace':'workspace','Tool areas':'toolAreas','Choose an area':'chooseArea','Select a workspace area to see its tools here. Your sidebar stays uncluttered.':'chooseAreaText','Search tools in this area…':'areaSearch','Higher limits and priority support.':'higherLimits','View plans':'viewPlans','Social & Publishing':'cat_Social','Content & AI':'cat_ContentAI','Leads & Email':'cat_LeadEmail','Documents & Career':'cat_Documents','PDF Tools':'cat_PDF','Images & Design':'cat_Images','Business Tools':'cat_Business','Create a campaign →':'createCampaign','MY WORKSPACE':'myWorkspace','Your TAMPtools workspace, trial, plan and usage at a glance.':'workspaceIntro','30-DAY ALL-ACCESS TRIAL':'trialTitle','Choose a plan':'choosePlan','ACCOUNT':'account','CURRENT PLAN':'currentPlan','THIS MONTH':'thisMonth','USAGE BY TOOL':'usageByTool','PLAN LIMITS':'planLimits','ACTIVITY':'activity','REPORTING':'reporting','GROW':'grow','Manage account':'manageAccount','Change password':'changePassword','Generate report →':'generateReport','Need more capacity?':'needCapacity','Upgrade plan →':'upgradePlanArrow'
  };
  const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
  const extra={
    en:{workspace:'Workspace',toolAreas:'Work areas',chooseArea:'Choose an area',chooseAreaText:'Open a focused workspace without leaving TAMPtools.',areaSearch:'Search tools in this area…',higherLimits:'Higher limits and priority support.',viewPlans:'View plans',cat_Mail:'Mail',cat_Images:'Images',cat_Documents:'Documents & PDF',cat_Files:'Files & Storage',cat_Batch:'Batch',cat_Business:'Business',cat_Career:'Career & Content',cat_Assistant:'TAMP Assistant',myWorkspace:'MY WORKSPACE',workspaceIntro:'Your digital operations base for files, documents, communication and business work.',createCampaign:'Open workspace →',trialTitle:'30-DAY ALL-ACCESS TRIAL',account:'ACCOUNT',currentPlan:'CURRENT PLAN',thisMonth:'THIS MONTH',usageByTool:'USAGE BY TOOL',planLimits:'PLAN LIMITS',activity:'ACTIVITY',reporting:'REPORTING',grow:'GROW',manageAccount:'Manage account',changePassword:'Change password',generateReport:'Generate report →',needCapacity:'Need more capacity?',upgradePlanArrow:'Upgrade plan →',globalSearch:'Search tools, templates, or content…',backToDashboard:'Back to dashboard',workspaceWiredNotice:'This workspace is wired into your account, plan limits and usage tracking.',orConnector:'or',createFreeAccount:'create a free account',toRunIt:'to run it.',generating:'Generating…',removingBackground:'Removing background…',splitting:'Splitting…',resultPlaceholder:'Your result will appear here.',addLineItemsPrompt:'Add line items to see the total.',signInToUseThisTool:'Sign in to use this tool.'},
    fr:{workspace:'Espace de travail',toolAreas:'Zones d’outils',chooseArea:'Choisissez une zone',chooseAreaText:'Sélectionnez une zone de travail pour voir ses outils ici. La barre latérale reste épurée.',areaSearch:'Rechercher des outils dans cette zone…',higherLimits:'Limites supérieures et assistance prioritaire.',viewPlans:'Voir les offres',cat_Social:'Réseaux sociaux',cat_ContentAI:'Contenu et IA',cat_LeadEmail:'Prospects et e-mails',cat_Documents:'Documents et carrière',cat_PDF:'Outils PDF',cat_Images:'Images et design',cat_Business:'Outils professionnels',myWorkspace:'MON ESPACE',workspaceIntro:'Votre espace TAMPtools, essai, offre et utilisation en un coup d’œil.',createCampaign:'Créer une campagne →',trialTitle:'ESSAI COMPLET DE 30 JOURS',account:'COMPTE',currentPlan:'OFFRE ACTUELLE',thisMonth:'CE MOIS-CI',usageByTool:'UTILISATION PAR OUTIL',planLimits:'LIMITES DE L’OFFRE',activity:'ACTIVITÉ',reporting:'RAPPORTS',grow:'DÉVELOPPEMENT',manageAccount:'Gérer le compte',changePassword:'Modifier le mot de passe',generateReport:'Générer un rapport →',needCapacity:'Besoin de plus de capacité ?',upgradePlanArrow:'Mettre à niveau →',globalSearch:'Rechercher des outils, modèles ou contenus…',backToDashboard:'Retour au tableau de bord',workspaceWiredNotice:'Cet espace est connecté à votre compte, vos limites de plan et votre suivi d’utilisation.',orConnector:'ou',createFreeAccount:'créer un compte gratuit',toRunIt:'pour l’utiliser.',generating:'Génération…',removingBackground:'Suppression de l’arrière-plan…',splitting:'Découpage…',resultPlaceholder:'Votre résultat apparaîtra ici.',addLineItemsPrompt:'Ajoutez des lignes pour voir le total.',signInToUseThisTool:'Connectez-vous pour utiliser cet outil.'},
    es:{workspace:'Espacio de trabajo',toolAreas:'Áreas de herramientas',chooseArea:'Elige un área',chooseAreaText:'Selecciona un área para ver sus herramientas aquí. La barra lateral permanece limpia.',areaSearch:'Buscar herramientas en esta área…',higherLimits:'Límites superiores y soporte prioritario.',viewPlans:'Ver planes',cat_Social:'Redes sociales',cat_ContentAI:'Contenido e IA',cat_LeadEmail:'Clientes y correo',cat_Documents:'Documentos y carrera',cat_PDF:'Herramientas PDF',cat_Images:'Imágenes y diseño',cat_Business:'Herramientas de negocio',myWorkspace:'MI ESPACIO',workspaceIntro:'Tu espacio TAMPtools, prueba, plan y uso de un vistazo.',createCampaign:'Crear campaña →',trialTitle:'PRUEBA COMPLETA DE 30 DÍAS',account:'CUENTA',currentPlan:'PLAN ACTUAL',thisMonth:'ESTE MES',usageByTool:'USO POR HERRAMIENTA',planLimits:'LÍMITES DEL PLAN',activity:'ACTIVIDAD',reporting:'INFORMES',grow:'CRECIMIENTO',manageAccount:'Gestionar cuenta',changePassword:'Cambiar contraseña',generateReport:'Generar informe →',needCapacity:'¿Necesitas más capacidad?',upgradePlanArrow:'Mejorar plan →',globalSearch:'Buscar herramientas, plantillas o contenido…',backToDashboard:'Volver al panel',workspaceWiredNotice:'Este espacio de trabajo está conectado a tu cuenta, los límites de tu plan y el seguimiento de uso.',orConnector:'o',createFreeAccount:'crear una cuenta gratuita',toRunIt:'para usarlo.',generating:'Generando…',removingBackground:'Eliminando el fondo…',splitting:'Dividiendo…',resultPlaceholder:'Tu resultado aparecerá aquí.',addLineItemsPrompt:'Agrega artículos para ver el total.',signInToUseThisTool:'Inicia sesión para usar esta herramienta.'},
    pt:{workspace:'Espaço de trabalho',toolAreas:'Áreas de ferramentas',chooseArea:'Escolha uma área',chooseAreaText:'Selecione uma área para ver as ferramentas aqui. A barra lateral fica organizada.',areaSearch:'Pesquisar ferramentas nesta área…',higherLimits:'Limites maiores e suporte prioritário.',viewPlans:'Ver planos',cat_Social:'Redes sociais',cat_ContentAI:'Conteúdo e IA',cat_LeadEmail:'Leads e e-mail',cat_Documents:'Documentos e carreira',cat_PDF:'Ferramentas PDF',cat_Images:'Imagens e design',cat_Business:'Ferramentas de negócio',myWorkspace:'MEU ESPAÇO',workspaceIntro:'Seu espaço TAMPtools, teste, plano e uso em um só lugar.',createCampaign:'Criar campanha →',trialTitle:'TESTE COMPLETO DE 30 DIAS',account:'CONTA',currentPlan:'PLANO ATUAL',thisMonth:'ESTE MÊS',usageByTool:'USO POR FERRAMENTA',planLimits:'LIMITES DO PLANO',activity:'ATIVIDADE',reporting:'RELATÓRIOS',grow:'CRESCIMENTO',manageAccount:'Gerir conta',changePassword:'Alterar palavra-passe',generateReport:'Gerar relatório →',needCapacity:'Precisa de mais capacidade?',upgradePlanArrow:'Atualizar plano →',globalSearch:'Pesquisar ferramentas, modelos ou conteúdo…',backToDashboard:'Voltar ao painel',workspaceWiredNotice:'Este espaço de trabalho está ligado à sua conta, aos limites do plano e ao acompanhamento de uso.',orConnector:'ou',createFreeAccount:'criar uma conta gratuita',toRunIt:'para o usar.',generating:'Gerando…',removingBackground:'Removendo o fundo…',splitting:'Dividindo…',resultPlaceholder:'O seu resultado aparecerá aqui.',addLineItemsPrompt:'Adicione itens para ver o total.',signInToUseThisTool:'Entre para usar esta ferramenta.'},
    de:{workspace:'Arbeitsbereich',toolAreas:'Werkzeugbereiche',chooseArea:'Bereich auswählen',chooseAreaText:'Wählen Sie einen Bereich, um die Werkzeuge hier zu sehen. Die Seitenleiste bleibt übersichtlich.',areaSearch:'Werkzeuge in diesem Bereich suchen…',higherLimits:'Höhere Limits und bevorzugter Support.',viewPlans:'Tarife ansehen',cat_Social:'Social & Publishing',cat_ContentAI:'Inhalte & KI',cat_LeadEmail:'Leads & E-Mail',cat_Documents:'Dokumente & Karriere',cat_PDF:'PDF-Tools',cat_Images:'Bilder & Design',cat_Business:'Business-Tools',myWorkspace:'MEIN ARBEITSBEREICH',workspaceIntro:'Ihr TAMPtools-Arbeitsbereich, Testzeitraum, Tarif und Nutzung auf einen Blick.',createCampaign:'Kampagne erstellen →',trialTitle:'30-TAGE-VOLLZUGRIFF-TEST',account:'KONTO',currentPlan:'AKTUELLER TARIF',thisMonth:'DIESEN MONAT',usageByTool:'NUTZUNG NACH TOOL',planLimits:'TARIFLIMITS',activity:'AKTIVITÄT',reporting:'BERICHTE',grow:'WACHSTUM',manageAccount:'Konto verwalten',changePassword:'Passwort ändern',generateReport:'Bericht erstellen →',needCapacity:'Mehr Kapazität benötigt?',upgradePlanArrow:'Tarif upgraden →',globalSearch:'Tools, Vorlagen oder Inhalte suchen…',backToDashboard:'Zurück zum Dashboard',workspaceWiredNotice:'Dieser Arbeitsbereich ist mit Ihrem Konto, Ihren Tariflimits und der Nutzungsverfolgung verbunden.',orConnector:'oder',createFreeAccount:'ein kostenloses Konto erstellen',toRunIt:'um es zu nutzen.',generating:'Wird generiert…',removingBackground:'Hintergrund wird entfernt…',splitting:'Wird aufgeteilt…',resultPlaceholder:'Ihr Ergebnis wird hier angezeigt.',addLineItemsPrompt:'Fügen Sie Posten hinzu, um die Summe zu sehen.',signInToUseThisTool:'Melden Sie sich an, um dieses Tool zu nutzen.'},
    ar:{workspace:'مساحة العمل',toolAreas:'مجالات الأدوات',chooseArea:'اختر مجالاً',chooseAreaText:'اختر مجالاً لعرض أدواته هنا. سيبقى الشريط الجانبي مرتباً.',areaSearch:'ابحث عن أدوات في هذا المجال…',higherLimits:'حدود أعلى ودعم أولوية.',viewPlans:'عرض الخطط',cat_Social:'التواصل والنشر',cat_ContentAI:'المحتوى والذكاء الاصطناعي',cat_LeadEmail:'العملاء والبريد',cat_Documents:'المستندات والمسار المهني',cat_PDF:'أدوات PDF',cat_Images:'الصور والتصميم',cat_Business:'أدوات الأعمال',myWorkspace:'مساحة عملي',workspaceIntro:'مساحة TAMPtools والتجربة والخطة والاستخدام في لمحة واحدة.',createCampaign:'إنشاء حملة ←',trialTitle:'تجربة كاملة لمدة 30 يوماً',account:'الحساب',currentPlan:'الخطة الحالية',thisMonth:'هذا الشهر',usageByTool:'الاستخدام حسب الأداة',planLimits:'حدود الخطة',activity:'النشاط',reporting:'التقارير',grow:'النمو',manageAccount:'إدارة الحساب',changePassword:'تغيير كلمة المرور',generateReport:'إنشاء تقرير ←',needCapacity:'هل تحتاج إلى سعة أكبر؟',upgradePlanArrow:'ترقية الخطة ←',globalSearch:'ابحث عن الأدوات والقوالب والمحتوى…',backToDashboard:'العودة إلى لوحة التحكم',workspaceWiredNotice:'مساحة العمل هذه مرتبطة بحسابك وحدود خطتك وتتبع الاستخدام.',orConnector:'أو',createFreeAccount:'إنشاء حساب مجاني',toRunIt:'لاستخدامها.',generating:'جارٍ الإنشاء…',removingBackground:'جارٍ إزالة الخلفية…',splitting:'جارٍ التقسيم…',resultPlaceholder:'ستظهر نتيجتك هنا.',addLineItemsPrompt:'أضف بنودًا لرؤية الإجمالي.',signInToUseThisTool:'سجّل الدخول لاستخدام هذه الأداة.'},
    zh:{workspace:'工作区',toolAreas:'工具区域',chooseArea:'选择区域',chooseAreaText:'选择一个工作区即可在这里查看工具，侧边栏保持简洁。',areaSearch:'搜索此区域中的工具…',higherLimits:'更高额度和优先支持。',viewPlans:'查看方案',cat_Social:'社交与发布',cat_ContentAI:'内容与 AI',cat_LeadEmail:'客户与邮件',cat_Documents:'文档与职业',cat_PDF:'PDF 工具',cat_Images:'图像与设计',cat_Business:'商务工具',myWorkspace:'我的工作区',workspaceIntro:'一览 TAMPtools 工作区、试用期、方案和使用情况。',createCampaign:'创建活动 →',trialTitle:'30 天全功能试用',account:'账户',currentPlan:'当前方案',thisMonth:'本月',usageByTool:'按工具使用情况',planLimits:'方案限制',activity:'活动',reporting:'报告',grow:'增长',manageAccount:'管理账户',changePassword:'更改密码',generateReport:'生成报告 →',needCapacity:'需要更多容量？',upgradePlanArrow:'升级方案 →',globalSearch:'搜索工具、模板或内容…',backToDashboard:'返回仪表盘',workspaceWiredNotice:'此工作区已与您的账户、方案限制和使用情况跟踪相关联。',orConnector:'或',createFreeAccount:'创建免费账户',toRunIt:'以使用它。',generating:'生成中…',removingBackground:'正在移除背景…',splitting:'拆分中…',resultPlaceholder:'您的结果将显示在此处。',addLineItemsPrompt:'添加项目以查看总计。',signInToUseThisTool:'请登录以使用此工具。'},
    ja:{workspace:'ワークスペース',toolAreas:'ツールエリア',chooseArea:'エリアを選択',chooseAreaText:'エリアを選択すると、ここにツールが表示されます。サイドバーはすっきり保てます。',areaSearch:'このエリアのツールを検索…',higherLimits:'上限アップと優先サポート。',viewPlans:'プランを見る',cat_Social:'ソーシャルと公開',cat_ContentAI:'コンテンツとAI',cat_LeadEmail:'リードとメール',cat_Documents:'文書とキャリア',cat_PDF:'PDFツール',cat_Images:'画像とデザイン',cat_Business:'ビジネスツール',myWorkspace:'マイワークスペース',workspaceIntro:'TAMPtoolsのワークスペース、トライアル、プラン、利用状況を一覧表示します。',createCampaign:'キャンペーンを作成 →',trialTitle:'30日間フルアクセス体験',account:'アカウント',currentPlan:'現在のプラン',thisMonth:'今月',usageByTool:'ツール別利用状況',planLimits:'プラン上限',activity:'アクティビティ',reporting:'レポート',grow:'成長',manageAccount:'アカウント管理',changePassword:'パスワード変更',generateReport:'レポートを生成 →',needCapacity:'さらに容量が必要ですか？',upgradePlanArrow:'プランをアップグレード →',globalSearch:'ツール、テンプレート、コンテンツを検索…',backToDashboard:'ダッシュボードに戻る',workspaceWiredNotice:'このワークスペースはあなたのアカウント、プラン上限、利用状況の追跡に連携しています。',orConnector:'または',createFreeAccount:'無料アカウントを作成',toRunIt:'して利用してください。',generating:'生成中…',removingBackground:'背景を削除中…',splitting:'分割中…',resultPlaceholder:'結果はここに表示されます。',addLineItemsPrompt:'明細を追加すると合計が表示されます。',signInToUseThisTool:'このツールを使用するにはサインインしてください。'}
  };

  const labelSets={
    hi:{workspace:'वर्कस्पेस',toolAreas:'टूल क्षेत्र',chooseArea:'क्षेत्र चुनें',viewPlans:'प्लान देखें',settings:'सेटिंग्स',support:'सहायता',upgradePlan:'👑 प्लान अपग्रेड करें',account:'खाता',currentPlan:'वर्तमान प्लान',thisMonth:'इस महीने',activity:'गतिविधि',reporting:'रिपोर्ट',manageAccount:'खाता प्रबंधित करें'},
    it:{workspace:'Area di lavoro',toolAreas:'Aree strumenti',chooseArea:'Scegli un’area',viewPlans:'Vedi piani',settings:'Impostazioni',support:'Supporto',upgradePlan:'👑 Aggiorna piano',account:'ACCOUNT',currentPlan:'PIANO ATTUALE',thisMonth:'QUESTO MESE',activity:'ATTIVITÀ',reporting:'REPORT',manageAccount:'Gestisci account'},
    nl:{workspace:'Werkruimte',toolAreas:'Toolgebieden',chooseArea:'Kies een gebied',viewPlans:'Bekijk plannen',settings:'Instellingen',support:'Ondersteuning',upgradePlan:'👑 Plan upgraden',account:'ACCOUNT',currentPlan:'HUIDIG PLAN',thisMonth:'DEZE MAAND',activity:'ACTIVITEIT',reporting:'RAPPORTEN',manageAccount:'Account beheren'},
    ko:{workspace:'워크스페이스',toolAreas:'도구 영역',chooseArea:'영역 선택',viewPlans:'요금제 보기',settings:'설정',support:'지원',upgradePlan:'👑 요금제 업그레이드',account:'계정',currentPlan:'현재 요금제',thisMonth:'이번 달',activity:'활동',reporting:'보고서',manageAccount:'계정 관리'},
    id:{workspace:'Ruang kerja',toolAreas:'Area alat',chooseArea:'Pilih area',viewPlans:'Lihat paket',settings:'Pengaturan',support:'Dukungan',upgradePlan:'👑 Upgrade paket',account:'AKUN',currentPlan:'PAKET SAAT INI',thisMonth:'BULAN INI',activity:'AKTIVITAS',reporting:'LAPORAN',manageAccount:'Kelola akun'},
    tr:{workspace:'Çalışma alanı',toolAreas:'Araç alanları',chooseArea:'Alan seçin',viewPlans:'Planları görüntüle',settings:'Ayarlar',support:'Destek',upgradePlan:'👑 Planı yükselt',account:'HESAP',currentPlan:'MEVCUT PLAN',thisMonth:'BU AY',activity:'ETKİNLİK',reporting:'RAPORLAR',manageAccount:'Hesabı yönet'},
    pl:{workspace:'Obszar roboczy',toolAreas:'Obszary narzędzi',chooseArea:'Wybierz obszar',viewPlans:'Zobacz plany',settings:'Ustawienia',support:'Wsparcie',upgradePlan:'👑 Ulepsz plan',account:'KONTO',currentPlan:'AKTUALNY PLAN',thisMonth:'TEN MIESIĄC',activity:'AKTYWNOŚĆ',reporting:'RAPORTY',manageAccount:'Zarządzaj kontem'},
    bn:{workspace:'ওয়ার্কস্পেস',toolAreas:'টুল এলাকা',chooseArea:'একটি এলাকা বেছে নিন',viewPlans:'প্ল্যান দেখুন',settings:'সেটিংস',support:'সহায়তা',upgradePlan:'👑 প্ল্যান আপগ্রেড',account:'অ্যাকাউন্ট',currentPlan:'বর্তমান প্ল্যান',thisMonth:'এই মাসে',activity:'কার্যকলাপ',reporting:'রিপোর্ট',manageAccount:'অ্যাকাউন্ট পরিচালনা করুন'},
    sw:{workspace:'Nafasi ya kazi',toolAreas:'Maeneo ya zana',chooseArea:'Chagua eneo',viewPlans:'Tazama mipango',settings:'Mipangilio',support:'Msaada',upgradePlan:'👑 Boresha mpango',account:'AKAUNTI',currentPlan:'MPANGO WA SASA',thisMonth:'MWEZI HUU',activity:'SHUGHULI',reporting:'RIPOTI',manageAccount:'Dhibiti akaunti'},
    he:{workspace:'סביבת עבודה',toolAreas:'אזורי כלים',chooseArea:'בחרו אזור',viewPlans:'הצגת תוכניות',settings:'הגדרות',support:'תמיכה',upgradePlan:'👑 שדרוג תוכנית',account:'חשבון',currentPlan:'תוכנית נוכחית',thisMonth:'החודש',activity:'פעילות',reporting:'דוחות',manageAccount:'ניהול החשבון'},
    ur:{workspace:'ورک اسپیس',toolAreas:'ٹول کے شعبے',chooseArea:'شعبہ منتخب کریں',viewPlans:'پلان دیکھیں',settings:'ترتیبات',support:'مدد',upgradePlan:'👑 پلان اپ گریڈ کریں',account:'اکاؤنٹ',currentPlan:'موجودہ پلان',thisMonth:'اس ماہ',activity:'سرگرمی',reporting:'رپورٹس',manageAccount:'اکاؤنٹ منظم کریں'}
  };
  const extraAliases={hi:'en',it:'en',nl:'en',ko:'en',id:'en',tr:'en',pl:'en',bn:'en',sw:'en',he:'en',ur:'en'};
  function mergeExtras(lang){const base=extra[lang]||extra[extraAliases[lang]]||extra.en; const phrases=(window.TAMP_UI_PHRASES||{})[lang]||{}; state.phrases=phrases;for(const [k,v] of Object.entries(base)) if(!state.dictionary[k]) state.dictionary[k]=v; for(const [k,v] of Object.entries(labelSets[lang]||{})) state.dictionary[k]=v}
  function translateTextNode(node){
    const raw=norm(node.nodeValue); if(!raw)return;
    const key=common[raw]||raw; const lower=raw.toLowerCase(); const matchKey=Object.keys(state.dictionary).find(k=>k.toLowerCase()===lower); const value=state.phrases[raw]||state.dictionary[key]||state.dictionary[raw]||(matchKey?state.dictionary[matchKey]:undefined);
    if(value && value!==raw) node.nodeValue=node.nodeValue.replace(raw,value);
  }
  function translateNodes(){
    document.querySelectorAll('[data-i18n]').forEach(el=>{const k=el.dataset.i18n;if(state.dictionary[k])el.textContent=state.dictionary[k]});
    document.querySelectorAll('[data-i18n-aria]').forEach(el=>{const k=el.dataset.i18nAria;if(state.dictionary[k])el.setAttribute('aria-label',state.dictionary[k])});
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{const k=el.dataset.i18nPlaceholder;if(state.dictionary[k])el.setAttribute('placeholder',state.dictionary[k])});
    document.querySelectorAll('a,button,label,h1,h2,h3,h4,p,span,small,strong,li,option').forEach(el=>{
      if(el.closest('script,style'))return;
      [...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(translateTextNode);
      const ph=el.getAttribute?.('placeholder'); if(ph){const v=state.phrases[ph]||state.dictionary[common[ph]||ph];if(v)el.setAttribute('placeholder',v)}
    });
    document.documentElement.lang=state.locale?.language||'en';
    document.documentElement.dir=['ar','he','fa','ur'].includes(state.locale?.language)?'rtl':'ltr';
  }
  function addControls(){
    const isAuth=document.body.classList.contains('auth-clean');
    const host=isAuth?$('.auth-toolbar'):($('.nav-actions')||$('.app-actions')); if(!host || host.querySelector('.locale-controls')) return;
    const wrap=document.createElement('div'); wrap.className='locale-controls';
    wrap.innerHTML=`<select id="localeLanguage" aria-label="Language">${[['en','English (US)'],['en_gb','English (UK)'],['zh','中文（简体）'],['es','Español'],['hi','हिन्दी'],['fr','Français'],['ar','العربية'],['bn','বাংলা'],['pt','Português'],['ru','Русский'],['id','Bahasa Indonesia'],['ur','اردو'],['de','Deutsch'],['ja','日本語'],['pcm','Naijá'],['ar_eg','العربية المصرية'],['mr','मराठी'],['vi','Tiếng Việt'],['te','తెలుగు'],['ha','Hausa'],['zu','isiZulu'],['tr','Türkçe']].map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>${isAuth?'':'<select id="localeCurrency" aria-label="Currency"></select>'}`;
    host.prepend(wrap);
    const lang=$('#localeLanguage'),cur=$('#localeCurrency');
    lang.value=localStorage.getItem('tamptools-language')||state.locale?.language||'en';
    if(cur) (state.locale?.supportedCurrencies||[]).forEach(c=>{const o=document.createElement('option');o.value=c.code;o.textContent=`${c.code} — ${c.symbol}`;cur.appendChild(o)});
    if(cur) cur.value=localStorage.getItem('tamptools-currency')||state.locale?.currency||'USD';
    lang.onchange=()=>{localStorage.setItem('tamptools-language',lang.value);load(lang.value,cur.value)};
    if(cur) cur.onchange=()=>{localStorage.setItem('tamptools-currency',cur.value);document.dispatchEvent(new CustomEvent('tamptools:currency',{detail:{currency:cur.value}}));translateNodes()};
  }
  async function load(langOverride,currencyOverride){
    try{
      try{window.TAMP_UI_PHRASES=await fetch('/ui-translations.json',{cache:'no-store'}).then(r=>r.json())}catch{}
      const detected=await fetch('/api/locale',{cache:'no-store'}).then(r=>r.json());
      const language=langOverride||localStorage.getItem('tamptools-language')||detected.language||'en';
      const currency=currencyOverride||localStorage.getItem('tamptools-currency')||detected.currency||'USD';
      const dict=await fetch('/api/i18n?lang='+encodeURIComponent(language),{cache:'no-store'}).then(r=>r.json());
      state.locale={...detected,language,currency}; state.dictionary=dict.translations||{}; mergeExtras(language);
      addControls(); const l=$('#localeLanguage'),c=$('#localeCurrency');if(l)l.value=language;if(c)c.value=currency;
      translateNodes(); document.dispatchEvent(new CustomEvent('tamptools:locale',{detail:state.locale}));
    }catch(e){console.warn('Locale setup unavailable',e)}
  }
  window.TAMPtoolsI18n={load,translate:translateNodes,get state(){return state}};
  document.addEventListener('DOMContentLoaded',()=>load());
})();


/* ===== app.js ===== */

(()=>{
const fallback=[
['✉️','Mail Manager','Search, organize, archive and write better email.','Mail'],['🖼️','Image Studio','Create, clean, convert and improve images.','Images'],['📄','Document & PDF Studio','Build, edit, OCR, compare and manage documents.','Documents & PDF'],['📁','Storage Manager','Find large, duplicate and old files and organize storage.','Files & Storage'],['▦','ZIP & File Toolkit','Create, extract, split and protect archives.','Files & Storage'],['⚙️','Batch Studio','Process many files in one controlled workflow.','Batch'],['🧾','Invoice Generator','Create professional invoices.','Business'],['📋','Proposal Builder','Build structured business proposals.','Business'],['▦','QR Code Generator','Create branded QR codes.','Business'],['📊','Spreadsheet & Data Cleaner','Clean, normalize and export business data.','Data'],['📄','Resume Builder','Build and tailor professional resumes.','Career & Content'],['💼','Cover Letter Builder','Create tailored job application letters.','Career & Content'],['✍️','Career/Profile Writer','Write bios, summaries and application responses.','Career & Content'],['📝','Content Studio','Create blogs, website copy, product descriptions and reports.','Career & Content'],['✦','TAMP Assistant','Use natural language to discover tools and orchestrate workflows.','TAMP Assistant']
];
let tools=fallback.map((x,i)=>({id:i+1,icon:x[0],name:x[1],description:x[2],category:x[3],key:x[1].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),implementation:'real'}));
const toolDetails={
 'Mail Manager':['Search and filter email','Folders, labels and bulk actions','Email writing and follow-ups'],
 'Image Studio':['Background removal and replacement','Resize, compress and convert','Watermark, shadow and product cleanup'],
 'Document & PDF Studio':['Create, merge, split and organize PDFs','OCR and text/data extraction','Compare, clean and protect documents'],
 'Storage Manager':['Find large, duplicate and old files','Bulk rename, move and organize','Safe cleanup with recovery support'],
 'ZIP & File Toolkit':['ZIP and unzip archives','Split, merge and package files','Protect and preview archive contents'],
 'Batch Studio':['Process 1–500 files at once','Convert, compress and rename in bulk','Merge, split, watermark and package'],
 'Invoice Generator':['Line items, taxes and discounts','Payment terms and business details','Export and send through Mail Manager'],
 'Proposal Builder':['Business and service proposals','Deliverables, timeline and pricing','AI-assisted sections and export'],
 'QR Code Generator':['URL, text, contact and Wi-Fi QR codes','Logo and brand styling','Download ready-to-use codes'],
 'Spreadsheet & Data Cleaner':['CSV, XLS, XLSX and TSV cleanup','Duplicates, missing data and normalization','Sort, filter, merge and export'],
 'Resume Builder':['Guided professional templates','AI-assisted job customization','PDF and DOCX-ready export'],
 'Cover Letter Builder':['Job-specific cover letters','Professional tone and AI rewriting','PDF and DOCX-ready export'],
 'Career/Profile Writer':['Bios and career summaries','Application responses','LinkedIn profile text assistance'],
 'Content Studio':['Blogs and long-form articles','Website and product copy','FAQs, reports and business writing'],
 'TAMP Assistant':['Find the right TAMPtools workflow','Generate, rewrite and analyze','Connect multiple tools into one job']
};
let plans=[
 {name:'Free',usd:0,gbp:0,ngn:0,monthlyUses:30,features:{tools:'All',storageMb:500,teamMembers:1,analytics:'Basic',prioritySupport:false}},
 {name:'Lite',usd:1.5,gbp:1.2,ngn:1500,monthlyUses:250,features:{tools:'All',storageMb:5120,teamMembers:1,analytics:'Basic',prioritySupport:false}},
 {name:'Pro',usd:5,gbp:4,ngn:5000,monthlyUses:2500,features:{tools:'All',storageMb:51200,teamMembers:1,protectedArchives:true,advancedMail:true,workflowAutomation:true,analytics:'Advanced',prioritySupport:true}},
 {name:'Business',usd:15,gbp:12,ngn:15000,monthlyUses:10000,features:{tools:'All',storageMb:512000,teamMembers:25,sharedWorkspace:true,teamProjects:true,adminControls:true,usageAnalytics:true,centralBilling:true,sharedTemplates:true,businessWorkflows:true,apiAccess:true,auditLogs:true,prioritySupport:true}}
].map(p=>({...p,localizedPrices:{USD:p.usd,GBP:p.gbp,NGN:p.ngn}}));
let billingCycle='monthly';
const yearlyOf=v=>Math.round(v*12*0.8*100)/100;
let trial={days:30,access:'All tools',limits:{}};
let activeCategory='All';
let localeCurrency=localStorage.getItem('tamptools-currency')||'NGN';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(v,c)=>new Intl.NumberFormat(undefined,{style:'currency',currency:c,maximumFractionDigits:['JPY','KRW','VND','IDR','HUF','CLP','COP','NGN'].includes(c)?0:2}).format(v||0);
function renderTools(q=''){
 const grid=$('toolGrid'); if(!grid)return;
 const x=q.trim().toLowerCase();
 const matches=tools.filter(t=>(activeCategory==='All'||t.category===activeCategory)&&(!x||t.name.toLowerCase().includes(x)||t.description.toLowerCase().includes(x)));
 grid.innerHTML=matches.map(t=>{const details=toolDetails[t.name]||[t.description];return `<article class="tool-card tool-card-detailed"><div><div class="tool-icon">${t.icon}</div><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p><ul class="tool-feature-list">${details.slice(0,3).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="tool-bottom"><button class="btn btn-soft" data-tool="${esc(t.key)}" type="button">Use tool</button><span class="tool-arrow">→</span></div></article>`}).join('')||'<div class="panel" style="grid-column:1/-1">No matching tools. Try another category or search.</div>';
 grid.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>openTool(b.dataset.tool)));
 window.TAMPtoolsI18n?.translate?.();
}
function setCategory(category){
 activeCategory=category;
 document.querySelectorAll('[data-category]').forEach(b=>{const on=b.dataset.category===category;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});
 renderTools($('toolSearch')?.value||'');
}
async function openTool(key){
 const t=tools.find(x=>x.key===key);if(!t)return;
 const direct={'mail-manager':'/mail-manager.html','storage-manager':'/files.html','zip-file-toolkit':'/workspace.html?tool=zip-file-toolkit','batch-studio':'/batch-studio.html','spreadsheet-data-cleaner':'/spreadsheet-studio.html'};
 location.href=window.TAMP_APP_REGISTRY?.[t.key]?.entry||direct[t.key]||('/workspace.html?tool='+encodeURIComponent(t.key));
}
function renderPlans(){
 const c=localeCurrency,g=$('pricingGrid');if(!g)return;
 // Only real, enforced limits are shown here — one combined monthly action pool,
 // scheduling window, team seats, and analytics/support tier. The granular
 // per-tool numbers in plan.features are internal planning targets, not
 // customer-facing promises, since only these are actually checked in code.
 g.innerHTML=plans.map((p,i)=>{
   const f=p.features||{};
   const bullets=[];
   bullets.push(f.tools==='All' ? 'All 15 primary tools' : `${f.tools||8} tools (see included list)`);
   bullets.push(p.monthlyUses===null||p.monthlyUses===undefined ? 'Fair-use monthly actions' : `${p.monthlyUses} actions / month`);
   if(f.schedulingDays) bullets.push(`Schedule posts up to ${f.schedulingDays} day${f.schedulingDays===1?'':'s'} ahead`);
   if(f.teamMembers) bullets.push(`${f.teamMembers} team member${f.teamMembers===1?'':'s'}`);
   if(f.analytics) bullets.push(`${f.analytics} analytics`);
   if(f.prioritySupport) bullets.push('Priority support');
   if(f.apiAccess) bullets.push('API access');
   if(f.clientWorkspaces) bullets.push('Client workspaces');
   const picks=bullets.map(b=>`<li>${esc(b)}</li>`).join('');
   const featured=p.name==='Pro';
   const button=p.name==='Free'?'Stay on Free':'Choose '+p.name;
   const base=p.localizedPrices?.[c] ?? p[c.toLowerCase()] ?? 0;
   const shown=billingCycle==='yearly'?yearlyOf(base):base;
   const periodLabel=billingCycle==='yearly'?'/ year':'/ month';
   const subLabel=billingCycle==='yearly'&&base>0?`<div class="price-tagline">${money(yearlyOf(base)/12,c)} / month billed yearly</div>`:'';
   return `<article class="price-card ${featured?'featured':''}"><p class="eyebrow">${featured?'MOST POPULAR':esc(p.name)}</p><h3>${esc(p.name)}</h3><div class="price">${money(shown,c)} <small>${periodLabel}</small></div>${subLabel}<p class="price-tagline">${p.name==='Free'?'Useful forever.':p.name==='Starter'?'For individuals and small businesses.':p.name==='Growth'?'For growing businesses and automation.':p.name==='Pro'?'For professionals and serious businesses.':'For teams and higher-volume workflows.'}</p><ul>${picks}</ul><button class="btn btn-primary" data-plan="${i}" type="button">${button}</button></article>`;
 }).join('');
 g.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{
   const p=plans[Number(b.dataset.plan)];
   if(!p)return;
   if(p.name==='Free'){location.href='/signup.html';return;}
   const m=$('modal');if(!m)return;m.hidden=false;$('plan').innerHTML=plans.map((x,j)=>`<option value="${j}">${esc(x.name)}</option>`).join('');$('plan').value=b.dataset.plan;
 });
}

async function getSession(){try{const r=await fetch('/api/auth/me',{credentials:'include',cache:'no-store'});if(r.ok)return await r.json();return null}catch{return null}}
function applyAuthState(me){
 const signedIn=Boolean(me);
 // Public homepage: never show Dashboard, Sign out, Sign in, or Get started after authentication.
 // Dashboard navigation belongs inside the authenticated workspace.
 document.querySelectorAll('.auth-signin,.auth-signup,a[href="/signin.html"],a[href="/signup.html"],a[href="/dashboard.html"],#signoutBtn').forEach(x=>x.hidden=signedIn);
 document.querySelectorAll('[data-auth-cta="signup"],[data-auth-cta="signin"],[data-auth-cta="dashboard"],[data-auth-cta="signout"]').forEach(x=>x.hidden=signedIn);
 const host=$('authSessionActions');
 if(host) host.innerHTML='';
}
async function boot(){
 renderTools();renderPlans();
  try{const r=await fetch('/api/tools',{cache:'no-store'});if(r.ok){const d=await r.json();if(Array.isArray(d.tools)&&d.tools.length)tools=d.tools;}}catch{}
 try{const r=await fetch('/api/plans',{cache:'no-store'});if(r.ok){const d=await r.json();if(Array.isArray(d.plans)&&d.plans.length)plans=d.plans; if(d.trial)trial=d.trial;}}catch{}
 renderTools();renderPlans();
 try{const loc=await fetch('/api/locale',{cache:'no-store'}).then(r=>r.json());localeCurrency=localStorage.getItem('tamptools-currency')||loc.currency||'USD';const cc=$('checkoutCurrency');if(cc){cc.innerHTML=(loc.supportedCurrencies||[]).map(x=>`<option value=\"${x.code}\">${x.code} — ${x.symbol}</option>`).join('');cc.value=localeCurrency;}const routeMsg=$('checkoutRouteMsg');if(routeMsg){try{const rt=await fetch('/api/payments/route').then(r=>r.json());routeMsg.textContent=rt.provider==='flutterwave'?'Payment method: Flutterwave — selected automatically for your region/currency.':rt.provider==='paddle'?'Payment method: Paddle — selected automatically for your region/currency.':'Payment method will be selected automatically.';}catch{}}renderPlans();}catch{}
 applyAuthState(await getSession());
 const y=$('currentYear');if(y)y.textContent=new Date().getFullYear();
}
document.addEventListener('tamptools:currency',e=>{localeCurrency=e.detail.currency;renderPlans();const c=document.getElementById('checkoutCurrency');if(c)c.value=localeCurrency;});
document.addEventListener('DOMContentLoaded',()=>{
 boot();
 const search=$('toolSearch');if(search)search.addEventListener('input',()=>renderTools(search.value));
 document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>setCategory(b.dataset.category)));
 document.querySelectorAll('[data-billing-cycle]').forEach(b=>b.addEventListener('click',()=>{billingCycle=b.dataset.billingCycle;document.querySelectorAll('[data-billing-cycle]').forEach(x=>x.classList.toggle('active',x===b));renderPlans();}));
 const cycle=$('billingCycle');if(cycle)cycle.addEventListener('change',()=>{const p=plans[$('plan')?.value||0];const msg=$('checkoutMsg');if(msg&&p)msg.textContent=cycle.value==='yearly'?'Annual billing selected — the checkout will use the annual price configured for this plan/currency.':'Monthly billing selected.';});
 document.querySelectorAll('[data-category-target]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();setCategory(a.dataset.categoryTarget||'All');document.getElementById('tools')?.scrollIntoView({behavior:'smooth',block:'start'});}));
 const close=$('closeModal');if(close)close.onclick=()=>{$('modal').hidden=true};
 const modal=$('modal');if(modal)modal.addEventListener('click',e=>{if(e.target.id==='modal')e.currentTarget.hidden=true});
 const form=$('checkoutForm');if(form)form.addEventListener('submit',async e=>{e.preventDefault();const p=plans[$('plan').value],msg=$('checkoutMsg');try{const r=await fetch('/api/payments/create-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('email').value,plan:p.name,currency:(document.getElementById('checkoutCurrency')?.value||localeCurrency),billingCycle:(document.getElementById('billingCycle')?.value||'monthly'),promoCode:(document.getElementById('checkoutPromo')?.value||'')})});const d=await r.json();if(!r.ok)throw Error(d.error||'Checkout unavailable');msg.textContent=d.message||'Checkout created.';if(d.checkoutUrl)location.href=d.checkoutUrl}catch(x){msg.textContent=x.message;msg.className='form-message error'}});
});
})();

// Phase 4.4 promo-code UX: validation happens on the server before checkout.\ndocument.addEventListener('DOMContentLoaded',()=>{const apply=document.getElementById('applyPromo');apply?.addEventListener('click',async()=>{const msg=document.getElementById('promoMsg');try{const r=await fetch('/api/payments/promo/validate',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:document.getElementById('checkoutPromo')?.value,plan:document.getElementById('plan')?.value,currency:document.getElementById('checkoutCurrency')?.value,billingCycle:document.getElementById('billingCycle')?.value||'monthly'})});const d=await r.json();if(!r.ok)throw Error(d.error||'Invalid promo code.');msg.textContent=`✓ ${d.code} applied — save ${d.discountAmount} ${d.currency}.`;msg.dataset.valid='true';}catch(e){msg.textContent=e.message;msg.dataset.valid='false'}})});\n

/* ===== auth.js ===== */

(()=>{const $=id=>document.getElementById(id),m=(id,t,k='error')=>{const e=$(id);if(e){e.textContent=t;e.className='form-message '+k}},api=async function api(u,o={}){let r;try{r=await fetch(u,{credentials:'include',...o})}catch{throw Error('Cannot reach the TAMPtools server. Start the backend with npm run dev and try again.')}const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||`Request failed (HTTP ${r.status}).`);return d},next=()=>{const n=new URLSearchParams(location.search).get('next');return n&&n.startsWith('/')?n:'/dashboard.html'};document.addEventListener('DOMContentLoaded',()=>{const s=$('signinForm');s?.addEventListener('submit',async e=>{e.preventDefault();const b=s.querySelector('button[type=submit]');b.disabled=true;b.textContent='Signing in…';try{await api('/api/auth/signin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('signinEmail').value.trim(),password:$('signinPassword').value})});location.replace(next())}catch(x){m('signinMessage',x.message)}finally{b.disabled=false;b.textContent='Sign in'}});const g=$('signupForm');g?.addEventListener('submit',async e=>{e.preventDefault();if($('signupPassword').value!==$('signupConfirm').value){m('signupMessage','Passwords do not match.');return}const b=g.querySelector('button[type=submit]');b.disabled=true;b.textContent='Creating account…';try{await api('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('signupName').value.trim(),email:$('signupEmail').value.trim(),password:$('signupPassword').value})});location.replace(next())}catch(x){m('signupMessage',x.message)}finally{b.disabled=false;b.textContent='Create account'}});const c=$('changePasswordForm');c?.addEventListener('submit',async e=>{e.preventDefault();if($('newPassword').value!==$('confirmNewPassword').value){m('changePasswordMessage','New passwords do not match.');return}try{await api('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:$('currentPassword').value,newPassword:$('newPassword').value})});m('changePasswordMessage','Password changed successfully.','success');c.reset()}catch(x){m('changePasswordMessage',x.message)}});const y=$('currentYear');if(y)y.textContent=new Date().getFullYear()})})();

/* ===== password-toggle.js ===== */

(()=>{document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>{const i=document.getElementById(b.dataset.toggle);if(!i)return;i.type=i.type==='password'?'text':'password';b.textContent=i.type==='password'?'Show':'Hide'})))})();


/* ===== phase2-auth-recovery.js ===== */
(()=>{const api=async(u,o={})=>{const r=await fetch(u,{credentials:'include',...o});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||`Request failed (HTTP ${r.status}).`);return d};const msg=(id,t,k='error')=>{const e=document.getElementById(id);if(e){e.textContent=t;e.className='form-message '+k}};document.addEventListener('DOMContentLoaded',()=>{const f=document.getElementById('forgotForm');f?.addEventListener('submit',async e=>{e.preventDefault();try{const d=await api('/api/auth/forgot-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('forgotEmail').value.trim()})});msg('forgotMessage',d.message,'success');f.reset()}catch(x){msg('forgotMessage',x.message)}});const r=document.getElementById('resetForm');r?.addEventListener('submit',async e=>{e.preventDefault();if(document.getElementById('resetPassword').value!==document.getElementById('resetConfirm').value){msg('resetMessage','Passwords do not match.');return}const token=new URLSearchParams(location.search).get('token');if(!token){msg('resetMessage','This reset link is missing its token.');return}try{const d=await api('/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,password:document.getElementById('resetPassword').value})});msg('resetMessage',d.message,'success');setTimeout(()=>location.replace('/dashboard.html'),700)}catch(x){msg('resetMessage',x.message)}});const v=document.getElementById('verifyMessage');if(v){const token=new URLSearchParams(location.search).get('token');if(!token){document.getElementById('verifyTitle').textContent='Verification link missing';v.textContent='Open the verification email link again or request a new one from your account settings.';return}api('/api/auth/verify-email?token='+encodeURIComponent(token)).then(d=>{document.getElementById('verifyTitle').textContent='Email verified';v.textContent=d.message;document.getElementById('verifyAction').hidden=false}).catch(x=>{document.getElementById('verifyTitle').textContent='Verification failed';v.textContent=x.message})}})})();

/* ===== phase3-ui.js ===== */
(()=>{
 const groups=[
  ['Mail','✉','Mail','Search, organize, archive and write better email.',['Mail Manager']],
  ['Images','▧','Images','Create, clean, convert and improve images.',['Image Studio']],
  ['Documents','▤','Documents & PDF','Build, edit, extract and manage documents.',['Document & PDF Studio']],
  ['Files','▦','Files & Storage','Organize local and imported files with confidence.',['Storage Manager','ZIP & File Toolkit']],
  ['Batch','⚙','Batch','Process many files in one controlled workflow.',['Batch Studio']],
  ['Business','▥','Business','Create the practical assets your business needs.',['Invoice Generator','Proposal Builder','QR Code Generator','Spreadsheet & Data Cleaner']],
  ['Career','◎','Career & Content','Build careers, profiles and business content.',['Resume Builder','Cover Letter Builder','Career/Profile Writer','Content Studio']],
  ['Assistant','✦','TAMP Assistant','Ask, generate, analyze and connect workflows across TAMPtools.',['TAMP Assistant']]
 ];
 const toolLinks={
  'Invoice Generator':'/apps/invoice-generator.html','Proposal Builder':'/apps/proposal-builder.html','QR Code Generator':'/workspace.html?tool=qr-code-generator','Resume Builder':'/apps/resume-builder.html','Cover Letter Builder':'/workspace.html?tool=cover-letter-builder','Content Studio':'/workspace.html?tool=content-studio','TAMP Assistant':'/workspace.html?tool=tamp-assistant','Image Studio':'/workspace.html?tool=image-studio','Document & PDF Studio':'/apps/document-pdf.html'
 };
 const registryKeys={'Invoice Generator':'invoice-generator','Proposal Builder':'proposal-builder','QR Code Generator':'qr-code-generator','Resume Builder':'resume-builder','Cover Letter Builder':'cover-letter-builder','Content Studio':'content-studio','TAMP Assistant':'tamp-assistant','Image Studio':'image-studio','Document & PDF Studio':'document-pdf-studio'};
 Object.entries(registryKeys).forEach(([name,key])=>{const entry=window.TAMP_APP_REGISTRY?.[key]?.entry;if(entry)toolLinks[name]=entry});
 window.TAMP_PHASE3_GROUPS=groups;
 window.TAMP_PHASE3_TOOL_LINKS=toolLinks;
 function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function commandMarkup(){return `<div class="command-backdrop" id="commandBackdrop" hidden><section class="command-palette" role="dialog" aria-modal="true" aria-labelledby="commandTitle"><div class="command-head"><div><p class="eyebrow">TAMPtools</p><h2 id="commandTitle">Search your workspace</h2></div><button class="icon-btn" id="closeCommand" aria-label="Close">×</button></div><input id="commandInput" class="command-input" autocomplete="off" placeholder="Search tools, work areas, templates…"><div id="commandResults" class="command-results"></div><p class="command-hint">Enter to open · Esc to close</p></section></div>`}
 function renderResults(q=''){const box=document.getElementById('commandResults');if(!box)return;const needle=q.trim().toLowerCase();const items=[];groups.forEach(g=>{if(!needle||g[2].toLowerCase().includes(needle)||g[3].toLowerCase().includes(needle))items.push({type:'area',name:g[2],desc:g[3],icon:g[1],key:g[0]});g[4].forEach(t=>{if(!needle||t.toLowerCase().includes(needle)||g[2].toLowerCase().includes(needle))items.push({type:'tool',name:t,desc:g[2],icon:g[1],href:toolLinks[t]})})});box.innerHTML=items.slice(0,12).map((x,i)=>`<button class="command-item" data-command-index="${i}" data-href="${x.href||''}" data-category="${x.key||''}"><span class="command-icon">${x.icon}</span><span><strong>${esc(x.name)}</strong><small>${esc(x.desc)}</small></span><kbd>${x.type==='area'?'AREA':'OPEN'}</kbd></button>`).join('')||'<div class="command-empty">No matches. Try “PDF”, “invoice”, “image” or “resume”.</div>';box.querySelectorAll('.command-item').forEach(b=>b.addEventListener('click',()=>{const href=b.dataset.href;if(href)location.href=href;else{const groups=window.TAMP_PHASE3_GROUPS||[],links=window.TAMP_PHASE3_TOOL_LINKS||{};const g=groups.find(x=>x[0]===b.dataset.category);if(g&&g[4]?.[0]){const href=links[g[4][0]];if(href)location.href=href;}else close();}}))}
 function open(){const bd=document.getElementById('commandBackdrop');if(!bd)return;bd.hidden=false;document.body.classList.add('command-open');const i=document.getElementById('commandInput');i.value='';renderResults();setTimeout(()=>i.focus(),0)}
 function close(){const bd=document.getElementById('commandBackdrop');if(!bd)return;bd.hidden=true;document.body.classList.remove('command-open')}
 document.addEventListener('DOMContentLoaded',()=>{document.querySelector('.app-main')?.insertAdjacentHTML('beforeend',commandMarkup());const input=document.getElementById('commandInput');input?.addEventListener('input',()=>renderResults(input.value));document.getElementById('closeCommand')?.addEventListener('click',close);document.getElementById('commandBackdrop')?.addEventListener('click',e=>{if(e.target.id==='commandBackdrop')close()});document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open()}if(e.key==='Escape')close()});document.getElementById('globalSearch')?.addEventListener('focus',e=>{e.preventDefault();open()})});window.TAMPopenCommand=open;
})();

/* ===== dashboard.js ===== */
(()=>{
 const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const groups=window.TAMP_PHASE3_GROUPS||[];const links=window.TAMP_PHASE3_TOOL_LINKS||{};let active='All';
 const api=async(u)=>{const r=await fetch(u,{credentials:'include',cache:'no-store'});const d=await r.json().catch(()=>({}));if(r.status===401){location.href='/signin.html?next=/dashboard.html';return null}if(!r.ok)throw Error(d.error||`Request failed (HTTP ${r.status}).`);return d};
 function render(){const grid=$('dashboardToolGrid');if(!grid)return;const q=($('dashboardToolSearch')?.value||'').trim().toLowerCase();const filtered=groups.filter(g=>!q||g[2].toLowerCase().includes(q)||g[3].toLowerCase().includes(q)||g[4].some(t=>t.toLowerCase().includes(q)));grid.innerHTML=filtered.map(g=>`<article class="work-area-card" data-area="${esc(g[0])}"><div class="work-area-icon">${g[1]}</div><div class="work-area-copy"><p class="eyebrow">${esc(g[0])}</p><h3>${esc(g[2])}</h3><p>${esc(g[3])}</p><div class="tool-pills">${g[4].map(t=>`<span>${esc(t)}</span>`).join('')}</div></div><button class="btn btn-soft area-open" type="button" data-area-open="${esc(g[0])}">Open area →</button></article>`).join('')||'<div class="panel" style="grid-column:1/-1">No matching work area.</div>';grid.querySelectorAll('[data-area-open]').forEach(b=>b.addEventListener('click',()=>openArea(b.dataset.areaOpen)));}
 function openArea(key){const g=groups.find(x=>x[0]===key);if(!g)return;const first=g[4][0];const href=links[first];if(href){location.href=href;return}const msg=$('dashboardToolMsg');if(msg){msg.textContent=`${g[2]} workspace is part of the TAMPtools interface foundation and will connect to its processing module in the relevant build phase.`;msg.className='form-message success'}}
 async function boot(){if(!$('profileName'))return;try{const d=await api('/api/account');if(!d)return;const u=d.user||{};const first=String(u.name||'there').trim().split(/\s+/)[0]||'there';const pn=$('profileName');if(pn)pn.textContent=u.name||'Account';const pe=$('profileEmail');if(pe)pe.textContent=u.email||'';const welcome=$('accountFirstName');if(welcome)welcome.textContent=first;const used=Number(d.usage?.used||0),limit=d.usage?.limit;const ub=$('usageBar');if(ub)ub.style.width=limit?`${Math.min(100,used/limit*100)}%`:'0%';if($('usageUsed'))$('usageUsed').textContent=used;if($('usageLimit'))$('usageLimit').textContent=limit==null?'/ Unlimited':`/ ${limit}`;if($('usageText'))$('usageText').textContent=limit==null?'Fair-use monthly pool':`${Math.max(0,limit-used)} actions remaining`;const st=d.storage||{};if($('storageUsed'))$('storageUsed').textContent=`${st.usedMb||0} MB`;if($('storageBar'))$('storageBar').style.width=st.limitMb?`${Math.min(100,(st.usedMb||0)/st.limitMb*100)}%`:'0%';if($('storageText'))$('storageText').textContent=st.limitMb?`${st.fileCount||0} files · ${st.limitMb} MB limit`:`${st.fileCount||0} files`;if($('planName'))$('planName').textContent=d.plan?.name||'Free';if($('planDescription'))$('planDescription').textContent=d.plan?.description||'Your TAMPtools workspace';if($('statCompleted'))$('statCompleted').textContent=Number(d.stats?.completed||used);if($('statFiles'))$('statFiles').textContent=Number(d.stats?.filesProcessed||0);if($('statAi'))$('statAi').textContent=Number(d.stats?.aiWork||0);if($('statStorage'))$('statStorage').textContent=`${Number(d.stats?.storageMb||st.usedMb||0).toFixed(1)} MB`;if($('statStorageSub'))$('statStorageSub').textContent=`${Number(st.fileCount||0)} files in workspace`;renderActivity(d);renderProjects(d)}catch(e){const m=$('dashboardToolMsg');if(m){m.textContent=e.message;m.className='form-message error'}}render()}
 function renderActivity(d){const el=$('recentUsage');if(!el)return;const rows=d.recentUsage||d.usageEvents||[];el.innerHTML=rows.length?rows.slice(0,5).map(x=>`<div class="activity-item"><strong>${esc(x.toolKey||x.tool||'TAMPtools')}</strong><span class="muted"> · ${esc(x.createdAt||x.created_at||'')}</span></div>`).join(''):'<div class="muted">Your recent work will appear here.</div>'}
 function renderProjects(d){const el=$('savedProjects');if(!el)return;const rows=d.savedProjects||[];el.innerHTML=rows.length?rows.slice(0,5).map(x=>`<div class="activity-item"><strong>${esc(x.name)}</strong><span class="muted"> · ${esc(x.toolKey||x.tool_key||'Project')}</span></div>`).join(''):'<div class="muted">Save a project from a workspace to see it here.</div>'}
 document.addEventListener('DOMContentLoaded',()=>{if(!$('dashboardToolGrid'))return;$('dashboardToolSearch')?.addEventListener('input',render);boot()});
})();

/* ===== settings.js ===== */

(()=>{document.addEventListener('DOMContentLoaded',async()=>{if(!document.getElementById('profileForm'))return;const r=await fetch('/api/auth/me',{credentials:'include'});if(r.status===401){location.href='/signin.html?next=/settings.html';return}const d=await r.json();document.getElementById('name').value=d.user.name;document.getElementById('email').value=d.user.email;const billing=document.getElementById('billingPortal');if(billing)billing.onclick=async()=>{const msg=document.getElementById('billingMsg');try{const r=await fetch('/api/payments/portal',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'}});const j=await r.json();if(!r.ok)throw Error(j.error||'Billing portal unavailable.');location.href=j.url}catch(err){msg.textContent=err.message;msg.className='form-message error'}};document.getElementById('profileForm').onsubmit=async e=>{e.preventDefault();const msg=document.getElementById('profileMsg');try{const x=await fetch('/api/account',{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('name').value})});const j=await x.json();if(!x.ok)throw Error(j.error||'Unable to save.');msg.textContent='Name updated successfully.';msg.className='form-message success'}catch(err){msg.textContent=err.message;msg.className='form-message error'}};const sm=document.getElementById('securityMsg');const vs=document.getElementById('verificationStatus');const rv=document.getElementById('resendVerification');const rs=document.getElementById('revokeSessions');try{const sr=await fetch('/api/account/security',{credentials:'include'});const sec=await sr.json();vs.textContent=sec.emailVerified?'✓ Email verified.':'Your email is not verified yet.';if(sec.emailVerified)rv.hidden=true}catch{}rv?.addEventListener('click',async()=>{try{const x=await fetch('/api/auth/resend-verification',{method:'POST',credentials:'include'});const j=await x.json();if(!x.ok)throw Error(j.error||'Unable to resend verification.');sm.textContent=j.sent?'Verification email sent.':'Email delivery is not configured yet.';sm.className='form-message '+(j.sent?'success':'')}catch(err){sm.textContent=err.message;sm.className='form-message error'}});rs?.addEventListener('click',async()=>{try{const x=await fetch('/api/auth/revoke-sessions',{method:'POST',credentials:'include'});const j=await x.json();if(!x.ok)throw Error(j.error||'Unable to revoke sessions.');sm.textContent='Other sessions have been signed out.';sm.className='form-message success'}catch(err){sm.textContent=err.message;sm.className='form-message error'}})})})();

/* ===== support.js ===== */

(()=>{document.addEventListener('DOMContentLoaded',async()=>{try{const r=await fetch('/api/support',{cache:'no-store'});const d=await r.json();document.getElementById('supportEmail').href='mailto:'+d.email;document.getElementById('supportEmail').textContent=d.email;if(d.whatsappAvailable){const a=document.getElementById('whatsappLink');a.href='https://wa.me/'+d.whatsappNumber;a.hidden=false;document.getElementById('whatsappNotice').textContent='Open WhatsApp to send text, a voice note or photos.'}}catch{}})})();
/* Persistent brand mark: recover gracefully if a cached/partial logo asset fails. */
document.addEventListener('error',e=>{const img=e.target;if(img&&img.tagName==='IMG'&&/\/logo\.png(?:$|\?)/.test(img.src)&&!img.dataset.logoFallback){img.dataset.logoFallback='1';img.alt='TAMPtools';img.style.visibility='visible';img.removeAttribute('src');img.outerHTML='<span class="brand-fallback">TAMP<span>tools</span></span>';}},true);



// Reveal Microsoft sign-in only when its backend configuration is available.
(() => {
  const initMicrosoftSignIn = () => {
    const button = document.getElementById("microsoftSignIn");
    if (!button) return;
    fetch("/api/auth/microsoft/status", { cache: "no-store" })
      .then(response => response.json())
      .then(data => { button.hidden = !data.configured; })
      .catch(() => { button.hidden = true; });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMicrosoftSignIn, { once: true });
  } else {
    initMicrosoftSignIn();
  }
})();
