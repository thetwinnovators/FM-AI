/**
 * Renders a self-contained Flow Academy HTML export.
 * All CSS, JS, and course data are inlined — no external dependencies.
 * The viewer JS uses only textContent / createElement — never innerHTML on
 * untrusted data — so the export is safe to open locally.
 */

import { buildCoursePackage } from './buildCoursePackage.js'

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeJson(obj) {
  // Prevent </script> from closing the embedding tag
  return JSON.stringify(obj).replace(/<\//g, '<\\/')
}

// ── CSS ───────────────────────────────────────────────────────────────────────

function buildCSS() {
  return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#060812;--border:rgba(255,255,255,0.07);--teal:#0d9488;--indigo:#6366f1;--card:#eef0f4;--card-fg:#0f172a;--font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;--mono:'JetBrains Mono','Fira Code',Consolas,monospace}
html,body{height:100%}
body{background:var(--bg);color:#fff;font-family:var(--font);min-height:100vh;display:flex;flex-direction:column}
.hdr{display:flex;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--border);background:rgba(13,148,136,0.06);flex-shrink:0}
.hdr-logo{font-size:13px;font-weight:700;letter-spacing:.04em;color:#2dd4bf}
.hdr-title{font-size:13px;color:rgba(255,255,255,.4);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hdr-badge{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border-radius:6px;border:1px solid rgba(45,212,191,.3);color:#2dd4bf;background:rgba(45,212,191,.08);flex-shrink:0}
.layout{display:flex;flex:1;min-height:0}
.sidebar{width:236px;flex-shrink:0;border-right:1px solid var(--border);background:rgba(6,8,18,.6);display:flex;flex-direction:column;overflow-y:auto}
.sb-sec{padding:12px 12px 8px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.22)}
.sb-home{display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:12px;font-weight:600;color:rgba(255,255,255,.5);cursor:pointer;border:none;background:none;width:100%;text-align:left;border-bottom:1px solid var(--border);transition:color .15s}
.sb-home:hover{color:#2dd4bf}
.sb-item{display:flex;align-items:flex-start;gap:8px;padding:8px 14px;cursor:pointer;border:none;background:none;width:100%;text-align:left;border-left:2px solid transparent;transition:all .15s}
.sb-item:hover:not(.lk){background:rgba(255,255,255,.03)}
.sb-item.ac{background:rgba(13,148,136,.12);border-left-color:#0d9488}
.sb-item.lk{opacity:.35;cursor:not-allowed}
.dot{width:14px;height:14px;border-radius:50%;flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700}
.dot.p{background:#0d9488;color:#fff}.dot.u{border:1.5px solid rgba(45,212,191,.6)}.dot.l{background:rgba(255,255,255,.07)}
.sb-lbl{font-size:11.5px;color:rgba(255,255,255,.6);line-height:1.4}
.sb-item.ac .sb-lbl{color:rgba(255,255,255,.92);font-weight:600}
.main{flex:1;overflow-y:auto;padding:24px}
.card{max-width:720px;margin:0 auto;background:var(--card);color:var(--card-fg);border-radius:16px;border:1px solid rgba(100,116,139,.3);padding:40px 48px 52px}
.c-title{font-size:25px;font-weight:800;color:#0f172a;line-height:1.25;margin-bottom:10px}
.c-sum{font-size:15px;color:#475569;line-height:1.6;margin-bottom:20px}
.meta-r{display:flex;gap:16px;font-size:13px;color:#64748b;margin-bottom:22px;flex-wrap:wrap}
.pb{background:#e2e8f0;border-radius:99px;height:6px;margin-bottom:22px;overflow:hidden}
.pb-f{height:100%;border-radius:99px;background:linear-gradient(90deg,#0d9488,#6366f1);transition:width .4s}
.start-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:12px;font-size:14px;font-weight:700;color:#fff;border:none;cursor:pointer;background:linear-gradient(135deg,#0d9488,#6366f1);margin-bottom:28px;transition:opacity .15s}
.start-btn:hover{opacity:.88}
.sh{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:12px}
.obj{background:#f0fdf9;border:1px solid #ccfbf1;border-radius:12px;padding:16px 18px;margin-bottom:22px}
.obj-i{display:flex;align-items:flex-start;gap:9px;font-size:14px;color:#0f4a3f;line-height:1.5;margin-bottom:7px}
.obj-i:last-child{margin-bottom:0}
.ck{color:#0d9488;font-weight:700;flex-shrink:0}
.chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:26px}
.chip{padding:4px 12px;border-radius:8px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:12px;font-weight:600;color:#475569}
.l-list{display:flex;flex-direction:column;gap:8px}
.l-row{display:flex;align-items:flex-start;gap:12px;padding:13px 15px;border-radius:12px;border:1px solid #e2e8f0;background:rgba(255,255,255,.7);cursor:pointer;transition:all .15s;text-align:left;width:100%}
.l-row:hover:not(.lk){border-color:#99f6e4;background:rgba(240,253,250,.6)}
.l-row.ps{border-color:#a7f3d0;background:rgba(240,253,249,.5)}
.l-row.lk{opacity:.5;cursor:not-allowed}
.l-ico{font-size:15px;flex-shrink:0;margin-top:1px}
.l-t{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:3px}
.l-s{font-size:12px;color:#64748b;line-height:1.4}
.l-sc{font-size:11px;font-weight:700;color:#059669;background:#d1fae5;padding:2px 7px;border-radius:6px;border:1px solid #a7f3d0;flex-shrink:0;margin-top:2px}
.l-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#0d9488;margin-bottom:8px}
.l-title{font-size:22px;font-weight:800;color:#0f172a;margin-bottom:18px}
.prose p{font-size:15px;color:#334155;line-height:1.75;margin-bottom:14px}
.prose p:last-child{margin-bottom:0}
code.ic{font-family:var(--mono);font-size:.85em;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.18);color:#4338ca;border-radius:4px;padding:1px 5px}
pre.cb{background:#1a1d2e;border-radius:12px;overflow:hidden;margin:12px 0 18px;font-family:var(--mono);font-size:12px}
.cb-hdr{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,.05)}
.tl{display:flex;gap:6px}.tl span{width:10px;height:10px;border-radius:50%;display:block}
.cb-lang{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.2)}
.cb-body{padding:14px 18px;color:#cdd6f4;line-height:1.6;white-space:pre-wrap;word-break:break-all}
.ex-card{border:1px solid #e0e7ff;border-radius:12px;overflow:hidden;margin-bottom:14px}
.ex-hdr{padding:13px 17px 11px;background:#eef2ff}
.ex-lbl{font-size:13px;font-weight:700;color:#4338ca;margin-bottom:3px}
.ex-desc{font-size:13px;color:rgba(67,56,202,.8);line-height:1.5}
.ex-code{padding:10px;background:#f8f9fc;border-top:1px solid #e0e7ff}
.recap{background:#f0fdf9;border:1px solid #ccfbf1;border-radius:12px;padding:15px 17px;margin-bottom:26px;font-size:14px;color:#0f4a3f;line-height:1.6}
.recap-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#0d9488;margin-bottom:7px;display:block}
.q-hdr{margin-bottom:18px}
.q-title{font-size:17px;font-weight:800;color:#0f172a;margin-bottom:3px}
.q-sub{font-size:13px;color:#64748b}
.q-card{background:rgba(255,255,255,.7);border:1px solid #e2e8f0;border-radius:12px;padding:17px;margin-bottom:13px}
.q-txt{font-size:15px;font-weight:700;color:#0f172a;margin-bottom:13px;line-height:1.5}
.q-num{color:#94a3b8;font-weight:500;margin-right:6px}
.opt{display:block;width:100%;text-align:left;padding:10px 13px;border-radius:9px;border:1.5px solid #e2e8f0;background:#fff;font-size:13px;color:#334155;margin-bottom:7px;cursor:pointer;transition:all .13s}
.opt:hover:not(.dis){border-color:#99f6e4;background:#f0fdf9}
.opt.sel{border-color:#0d9488;background:#f0fdf9;color:#0f4a3f;font-weight:600}
.opt.ok{border-color:#10b981;background:#d1fae5;color:#065f46;font-weight:600}
.opt.no{border-color:#f87171;background:#fee2e2;color:#7f1d1d}
.opt.dis{cursor:default}
.opt-l{font-weight:700;color:#94a3b8;margin-right:5px}
.opt.sel .opt-l{color:#0d9488}.opt.ok .opt-l{color:#059669}.opt.no .opt-l{color:#dc2626}
.expl{margin-top:9px;padding:9px 13px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;color:#475569;line-height:1.5}
.sub-btn{width:100%;padding:13px;border-radius:12px;border:none;cursor:pointer;font-size:14px;font-weight:700;color:#fff;margin-top:6px;transition:opacity .15s;background:linear-gradient(135deg,#0d9488,#6366f1)}
.sub-btn:disabled{background:#e2e8f0;color:#94a3b8;cursor:not-allowed}
.sub-btn:not(:disabled):hover{opacity:.88}
.res{text-align:center;padding:26px 22px;border-radius:14px;border:2px solid;margin-top:18px}
.res.ok{border-color:#10b981;background:#d1fae5}
.res.no{border-color:#f87171;background:#fee2e2}
.res-sc{font-size:46px;font-weight:900;margin-bottom:5px}
.res.ok .res-sc{color:#065f46}.res.no .res-sc{color:#7f1d1d}
.res-lbl{font-size:14px;font-weight:600;margin-bottom:13px}
.res.ok .res-lbl{color:#047857}.res.no .res-lbl{color:#b91c1c}
.res-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.r-btn{padding:8px 18px;border-radius:9px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:opacity .15s}
.r-btn:hover{opacity:.8}
.r-btn.pr{background:linear-gradient(135deg,#0d9488,#6366f1);color:#fff}
.r-btn.sc{background:#f1f5f9;color:#334155;border:1px solid #e2e8f0}
.nav-strip{display:flex;gap:10px;margin-top:26px;padding-top:18px;border-top:1px solid #e2e8f0}
.ng{padding:34px 22px;text-align:center;border-radius:14px;background:#f8fafc;border:1px dashed #cbd5e1}
.ng p{font-size:14px;color:#64748b;margin-bottom:8px}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
`
}

// ── Viewer JS ─────────────────────────────────────────────────────────────────

function buildViewerJS() {
  return `
(function(){
var C=JSON.parse(document.getElementById('__c__').textContent);
var O=JSON.parse(document.getElementById('__o__').textContent);
var guided=O.viewerMode==='guided';
var S={view:'syllabus',li:0,ans:{},sub:{},scores:{},unlocked:{}};

C.lessons.forEach(function(l){
  if(!guided||l.status==='unlocked'||l.status==='passed')S.unlocked[l.id]=true;
  if(l.bestScore!=null){
    var ps=(l.quiz&&l.quiz.passingScore)||70;
    S.scores[l.id]={score:l.bestScore,passed:l.bestScore>=ps};
    S.sub[l.id]=true;
  }
});

function pct(){
  var d=C.lessons.filter(function(l){return S.scores[l.id]&&S.scores[l.id].passed;}).length;
  return C.lessons.length?Math.round(d/C.lessons.length*100):0;
}
function isLocked(l){return guided&&!S.unlocked[l.id];}

/* DOM helpers — no innerHTML on untrusted data */
function el(tag,cls,txt){
  var e=document.createElement(tag);
  if(cls)e.className=cls;
  if(txt!=null)e.textContent=txt;
  return e;
}
function btn(cls,txt,fn){var b=el('button',cls,txt);if(fn)b.addEventListener('click',fn);return b;}

/* Code block detection (mirrors LessonView heuristic) */
function isCodeLine(line){
  var t=line.trim();if(!t)return false;
  if(/^(def |elif |else:|for |while |try:|except|import |from |return |class |print\\(|if [a-z_]|const |let |function )/.test(t))return true;
  if(/^[a-z_]\\w*\\s*(\\[.*\\])?\\s*=(?!=)/.test(t))return true;
  if(/^[a-z_]\\w*\\s*\\(/.test(t))return true;
  if(/^(\\s{2,}|\\t)/.test(line)&&t.length>0)return true;
  return false;
}

/* Auto-detect inline code tokens using split with capture group */
var CODE_SPLIT=/(\.[a-zA-Z_]\\w*\\([^)]{0,30}\\)|[a-z_][a-z0-9]*(?:_[a-z0-9]+)+)/;
var BTICK_SPLIT=/(\`[^\`\\n]+\`)/;

function makeParagraph(text){
  var p=document.createElement('p');
  /* Level 1: split on backtick spans */
  var bparts=text.split(BTICK_SPLIT);
  bparts.forEach(function(bp){
    if(bp.length>2&&bp.charAt(0)==='\`'&&bp.charAt(bp.length-1)==='\`'){
      p.appendChild(el('code','ic',bp.slice(1,-1)));
      return;
    }
    /* Level 2: auto-detect .method() and snake_case tokens */
    var cparts=bp.split(CODE_SPLIT);
    cparts.forEach(function(cp,ci){
      if(!cp)return;
      /* Odd indices are captured code tokens */
      if(ci%2===1){p.appendChild(el('code','ic',cp));}
      else{p.appendChild(document.createTextNode(cp));}
    });
  });
  return p;
}

function makeCodeBlock(code,lang){
  var wrap=el('pre','cb');
  var hdr=el('div','cb-hdr');
  var tl=el('div','tl');
  ['#ff5f57','#febc2e','#28c840'].forEach(function(c){var s=document.createElement('span');s.style.background=c;tl.appendChild(s);});
  hdr.appendChild(tl);
  if(lang)hdr.appendChild(el('span','cb-lang',lang));
  wrap.appendChild(hdr);
  var body=el('div','cb-body');body.textContent=code;
  wrap.appendChild(body);
  return wrap;
}

function renderExplanation(text){
  var frag=document.createDocumentFragment();
  if(!text)return frag;
  text.split(/\\n\\n+/).forEach(function(para){
    if(para.split('\\n').some(isCodeLine)){frag.appendChild(makeCodeBlock(para,''));}
    else{frag.appendChild(makeParagraph(para));}
  });
  return frag;
}

/* Header */
function setHeader(ctx,title){document.getElementById('htitle').textContent=ctx+' · '+title;}

/* Sidebar */
function renderSidebar(){
  var sb=document.getElementById('sb');
  sb.innerHTML='';
  sb.appendChild(btn('sb-home','⌂ Course Overview',goSyllabus));
  sb.appendChild(el('div','sb-sec','Lessons'));
  C.lessons.forEach(function(l,i){
    var ac=S.view==='lesson'&&S.li===i;
    var lk=isLocked(l);
    var ps=S.scores[l.id]&&S.scores[l.id].passed;
    var item=el('button','sb-item'+(ac?' ac':'')+(lk?' lk':''));
    if(!lk)item.addEventListener('click',function(n){return function(){openLesson(n);};}(i));
    item.appendChild(el('div','dot '+(ps?'p':lk?'l':'u'),ps?'✓':''));
    item.appendChild(el('div','sb-lbl',l.title));
    sb.appendChild(item);
  });
}

/* Syllabus */
function goSyllabus(){
  S.view='syllabus';
  renderSidebar();
  var mc=document.getElementById('mc');
  mc.innerHTML='';
  var card=el('div','card');
  card.appendChild(el('h1','c-title',C.title));
  if(C.summary)card.appendChild(el('p','c-sum',C.summary));
  var meta=el('div','meta-r');
  meta.appendChild(el('span',null,'🕒 ~'+C.estimatedDurationMinutes+' min'));
  meta.appendChild(el('span',null,'📚 '+C.lessons.length+' lessons'));
  var p=pct();
  if(p>0){var ps2=el('span',null,p+'% complete');ps2.style.color='#0d9488';ps2.style.fontWeight='700';meta.appendChild(ps2);}
  card.appendChild(meta);
  if(p>0){var pb=el('div','pb');var pf=el('div','pb-f');pf.style.width=p+'%';pb.appendChild(pf);card.appendChild(pb);}
  /* Start/continue */
  var next=null;
  for(var ni=0;ni<C.lessons.length;ni++){
    var nl=C.lessons[ni];
    if(!isLocked(nl)&&!(S.scores[nl.id]&&S.scores[nl.id].passed)){next=ni;break;}
  }
  if(next!==null){
    var sb2=btn('start-btn',p===0?'▶ Start Lesson 1':'▶ Continue — '+C.lessons[next].title,function(n){return function(){openLesson(n);};}(next));
    card.appendChild(sb2);
  }
  if(C.objectives&&C.objectives.length){
    card.appendChild(el('div','sh','🎯 What you will learn'));
    var ob=el('div','obj');
    C.objectives.forEach(function(o){var it=el('div','obj-i');it.appendChild(el('span','ck','✓'));it.appendChild(document.createTextNode(o));ob.appendChild(it);});
    card.appendChild(ob);
  }
  if(C.keyVocabulary&&C.keyVocabulary.length){
    card.appendChild(el('div','sh','Key Vocabulary'));
    var ch=el('div','chips');
    C.keyVocabulary.forEach(function(w){ch.appendChild(el('span','chip',w));});
    card.appendChild(ch);
  }
  card.appendChild(el('div','sh','Lessons'));
  var ll=el('div','l-list');
  C.lessons.forEach(function(l,i){
    var lk=isLocked(l),ps3=S.scores[l.id]&&S.scores[l.id].passed,sc=S.scores[l.id]?S.scores[l.id].score:null;
    var row=el('button','l-row'+(ps3?' ps':'')+(lk?' lk':''));
    if(!lk)row.addEventListener('click',function(n){return function(){openLesson(n);};}(i));
    row.appendChild(el('span','l-ico',ps3?'✅':lk?'🔒':'⭕'));
    var info=el('div');info.style.flex='1';info.style.minWidth='0';
    info.appendChild(el('div','l-t',(i+1)+'. '+l.title));
    if(l.summary)info.appendChild(el('div','l-s',l.summary));
    row.appendChild(info);
    if(sc!==null)row.appendChild(el('span','l-sc',sc+'%'));
    ll.appendChild(row);
  });
  card.appendChild(ll);
  mc.appendChild(card);
  setHeader('Course Overview',C.title);
}

/* Lesson */
function openLesson(index){
  S.view='lesson';S.li=index;
  renderSidebar();
  var l=C.lessons[index];
  var mc=document.getElementById('mc');
  mc.innerHTML='';
  mc.scrollTop=0;
  var card=el('div','card');
  card.appendChild(el('div','l-lbl','Lesson '+(index+1)+' of '+C.lessons.length));
  card.appendChild(el('h1','l-title',l.title));
  if(!l.explanation){
    var ng=el('div','ng');
    ng.appendChild(el('p',null,'📡 Content not yet generated when this course was exported.'));
    ng.appendChild(el('p',null,'Open in Flow Academy to generate, then re-export.'));
    card.appendChild(ng);
    mc.appendChild(card);
    setHeader('Lesson '+(index+1),l.title);
    return;
  }
  if(l.objectives&&l.objectives.length){
    var ob2=el('div','obj');ob2.style.marginBottom='22px';
    ob2.appendChild(el('div','sh','🎯 Objectives'));
    l.objectives.forEach(function(o){var it=el('div','obj-i');it.appendChild(el('span','ck','✓'));it.appendChild(document.createTextNode(o));ob2.appendChild(it);});
    card.appendChild(ob2);
  }
  var prose=el('div','prose');
  prose.appendChild(renderExplanation(l.explanation));
  card.appendChild(prose);
  if(l.examples&&l.examples.length){
    card.appendChild(el('div','sh','💡 Examples'));
    l.examples.forEach(function(ex,ei){
      var ec=el('div','ex-card');
      var eh=el('div','ex-hdr');
      eh.appendChild(el('div','ex-lbl','Example '+(ei+1)+'.'));
      if(ex.description)eh.appendChild(el('div','ex-desc',ex.description));
      ec.appendChild(eh);
      if(ex.code){var ew=el('div','ex-code');ew.appendChild(makeCodeBlock(ex.code,ex.language||''));ec.appendChild(ew);}
      card.appendChild(ec);
    });
  }
  if(l.recap){
    var rc=el('div','recap');rc.appendChild(el('span','recap-lbl','📌 Recap'));rc.appendChild(document.createTextNode(l.recap));card.appendChild(rc);
  }
  if(l.quiz&&l.quiz.questions&&l.quiz.questions.length){card.appendChild(buildQuiz(l,index));}
  var ns=el('div','nav-strip');
  if(index>0)ns.appendChild(btn('r-btn sc','← Previous',function(n){return function(){openLesson(n);};}(index-1)));
  ns.appendChild(btn('r-btn sc','Course Overview',goSyllabus));
  if(index<C.lessons.length-1&&!isLocked(C.lessons[index+1])){
    ns.appendChild(btn('r-btn pr','Next →',function(n){return function(){openLesson(n);};}(index+1)));
  }
  card.appendChild(ns);
  mc.appendChild(card);
  setHeader('Lesson '+(index+1),l.title);
}

/* Quiz */
function buildQuiz(l,idx){
  var lid=l.id,sub=S.sub[lid],score=S.scores[lid],ans=S.ans[lid]||{},qs=l.quiz.questions,ps=(l.quiz.passingScore)||70;
  var wrap=el('div');
  var qh=el('div','q-hdr');
  qh.appendChild(el('div','sh','📝 Quiz'));
  qh.appendChild(el('div','q-title',l.title));
  qh.appendChild(el('div','q-sub','Answer all '+qs.length+' questions · '+ps+'% to pass'));
  wrap.appendChild(qh);
  qs.forEach(function(q,qi){
    var qc=el('div','q-card');
    var qt=el('div','q-txt');qt.appendChild(el('span','q-num',(qi+1)+'.'));qt.appendChild(document.createTextNode(q.question));qc.appendChild(qt);
    q.options.forEach(function(opt,oi){
      var letter=String.fromCharCode(65+oi);
      var isSel=ans[qi]===oi;
      var cls='opt'+(sub?' dis':'')+(sub&&oi===q.correctIndex?' ok':sub&&isSel&&oi!==q.correctIndex?' no':!sub&&isSel?' sel':'');
      var ob=el('button',cls);
      if(!sub)ob.addEventListener('click',function(li2,qi2,oi2){return function(){pick(li2,qi2,oi2,idx);};}(lid,qi,oi));
      ob.appendChild(el('span','opt-l',letter+'.'));
      ob.appendChild(document.createTextNode(opt));
      qc.appendChild(ob);
    });
    if(sub&&O.includeAnswerExplanations&&q.explanation)qc.appendChild(el('div','expl',q.explanation));
    wrap.appendChild(qc);
  });
  if(!sub){
    var answered=Object.keys(ans).length,all=answered===qs.length;
    var sb3=btn('sub-btn',all?'Submit answers':'Answer all questions ('+answered+' / '+qs.length+')',all?function(){doSubmit(lid,idx);}:null);
    if(!all)sb3.disabled=true;
    wrap.appendChild(sb3);
  } else if(score){
    var passed=score.passed;
    var res=el('div','res '+(passed?'ok':'no'));
    res.appendChild(el('div','res-sc',score.score+'%'));
    res.appendChild(el('div','res-lbl',passed?'🎉 Passed!':'❌ Keep practising'));
    if(!passed){var rb=el('div','res-btns');rb.appendChild(btn('r-btn sc','Retry Quiz',function(){retry(lid,idx);}));res.appendChild(rb);}
    wrap.appendChild(res);
  }
  return wrap;
}

function pick(lid,qi,oi,idx){
  if(!S.ans[lid])S.ans[lid]={};S.ans[lid][qi]=oi;
  var mc=document.getElementById('mc');var st=mc.scrollTop;
  openLesson(idx);mc.scrollTop=st;
}

function doSubmit(lid,idx){
  var l=C.lessons[idx],qs=l.quiz.questions,ans=S.ans[lid]||{},correct=0;
  qs.forEach(function(q,qi){if(ans[qi]===q.correctIndex)correct++;});
  var score=Math.round(correct/qs.length*100),ps=(l.quiz.passingScore)||70,passed=score>=ps;
  S.sub[lid]=true;S.scores[lid]={score:score,passed:passed};
  if(guided&&passed&&idx<C.lessons.length-1)S.unlocked[C.lessons[idx+1].id]=true;
  var mc=document.getElementById('mc');var st=mc.scrollTop;
  openLesson(idx);mc.scrollTop=st;
}

function retry(lid,idx){delete S.ans[lid];delete S.sub[lid];delete S.scores[lid];openLesson(idx);}

renderSidebar();goSyllabus();
})();
`
}

// ── Public API ────────────────────────────────────────────────────────────────

export function renderFlowAcademyExportHTML(course, opts = {}) {
  const {
    includeProgress           = false,
    viewerMode                = 'read_only',
    includeAnswerExplanations = true,
  } = opts

  const pkg        = buildCoursePackage(course, { includeProgress })
  const courseJson = safeJson(pkg.course)
  const optJson    = safeJson({ viewerMode, includeAnswerExplanations })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Flow Academy — ${esc(course.title)}</title>
<style>${buildCSS()}</style>
</head>
<body>
<div class="hdr">
  <span class="hdr-logo">⬡ Flow Academy</span>
  <span class="hdr-title" id="htitle">${esc(course.title)}</span>
  <span class="hdr-badge">${viewerMode === 'guided' ? 'Guided' : 'Read-only'}</span>
</div>
<div class="layout">
  <div class="sidebar" id="sb"></div>
  <div class="main" id="mc"></div>
</div>
<script type="application/json" id="__c__">${courseJson}</script>
<script type="application/json" id="__o__">${optJson}</script>
<script>${buildViewerJS()}</script>
</body>
</html>`
}

export function downloadCourseHTML(course, opts = {}) {
  const html     = renderFlowAcademyExportHTML(course, opts)
  const slug     = course.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40)
  const filename = `flow-academy-${slug}.html`
  const blob     = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url      = URL.createObjectURL(blob)
  const a        = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
