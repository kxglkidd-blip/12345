/* Andrux Page App - Multi-page architecture */
(function(){
'use strict';

/* ===== Config ===== */
var SU='https://nyourvnfzhxbofwmavgq.supabase.co';
var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b3Vydm5memh4Ym9md21hdmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTYwMTIsImV4cCI6MjEwMDY3MjAxMn0.YqztdjSz8kDAf9sHpqVeiMLjfwSbl4kvc8O5sGyJkvg';
var T_USERS='ax_u7';
var T_MSGS='ax_m9';
var T_CONFIG='ax_c3';
var T_GAMES='ax_gs';
var ADMIN_HASH_PARTS=[0x2a,0xdb,0xa7,0x8f,0x2b,0x0e,0x1d,0x27,0x1e,0x57,0x7e,0x4b,0x12,0xf6,0x6d,0xd2,0x38,0x25,0x7a,0xcd,0xad,0xc1,0xd9,0x0c,0xc1,0x2d,0x15,0xbc,0xde,0x01,0xc4,0x3e];

/* i18n helper — translate key via global I18N engine */
function t(k){return(window.I18N&&window.I18N.t)?window.I18N.t(k):k;}

/* ==========================================================
   SECURITY ENGINE — Anti-DDoS / Anti-SQLi / Anti-Hijack / Anti-Spam
   ========================================================== */
var SEC={
  /* --- Rate limiter: max N requests per window --- */
  reqLog:[],
  reqMax:30,          /* max requests per window */
  reqWindow:6000,     /* 6 second sliding window */
  reqCooldown:0,      /* timestamp when ban lifts */
  reqBackoff:1,       /* multiplier for exponential backoff */
  reqBlocked:0,       /* total blocked count */

  /* --- Spam detector --- */
  spamWarnings:{},    /* user_id -> count */
  spamMaxWarn:5,      /* warnings before auto-mute */
  spamWindow:45000,   /* 45s detection window */
  spamPatterns:/(.)\1{8,}|(.{2,})\2{4,}/,  /* char spam / pattern repeat */

  /* --- Session fingerprint --- */
  fpHash:'',          /* SHA-256 of UA+screen+timezone */

  /* --- CSRF token --- */
  csrfToken:'',

  /* --- VM / VPN detection --- */
  vmScore:0,           /* 0-100 risk score */
  vmFlags:[],          /* detected flags */
  mouseJitter:0,       /* mouse trajectory score */
  perfBaseline:0       /* performance baseline ms */
};

/* Build browser fingerprint */
function buildFingerprint(){
  var raw=[
    navigator.userAgent||'',
    screen.width+'x'+screen.height,
    new Date().getTimezoneOffset(),
    navigator.language||''
  ].join('|');
  return crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)).then(function(buf){
    SEC.fpHash=Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
    return SEC.fpHash;
  });
}

/* Generate CSRF token */
function refreshCSRF(){
  SEC.csrfToken=Array.from(crypto.getRandomValues(new Uint8Array(16))).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  return SEC.csrfToken;
}

/* ==========================================================
   VM / VPN / AUTOMATION DETECTION ENGINE
   ========================================================== */
function detectVM(){
  var score=0;
  var flags=[];

  /* 1. WebGL renderer / vendor */
  try{
    var c=document.createElement('canvas');
    var gl=c.getContext('webgl')||c.getContext('experimental-webgl');
    if(gl){
      var dbg=gl.getExtension('WEBGL_debug_renderer_info');
      if(dbg){
        var vendor=gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)||'';
        var renderer=gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)||'';
        var vL=vendor.toLowerCase();
        var rL=renderer.toLowerCase();
        if(rL.indexOf('swiftshader')>=0||rL.indexOf('software')>=0){score+=30;flags.push('sw_renderer');}
        if(rL.indexOf('vmware')>=0||vL.indexOf('vmware')>=0){score+=40;flags.push('vmware_gl');}
        if(rL.indexOf('virtualbox')>=0||vL.indexOf('virtualbox')>=0){score+=40;flags.push('vbox_gl');}
        if(rL.indexOf('mesa')>=0&&rL.indexOf('llvmpipe')>=0){score+=25;flags.push('llvmpipe');}
      }
    }
  }catch(e){}

  /* 2. Screen resolution anomalies */
  var w=screen.width;
  var h=screen.height;
  var dpr=window.devicePixelRatio||1;
  var knownVMRes=[[1024,768],[800,600],[1280,800],[1152,864]];
  knownVMRes.forEach(function(r){if(w===r[0]&&h===r[1]){score+=15;flags.push('vm_res');}});
  if(w<1024||h<768){score+=10;flags.push('small_screen');}
  if(dpr===1&&(w>=1920||h>=1080)){score+=5;flags.push('low_dpr');}

  /* 3. Navigator anomalies */
  var ua=navigator.userAgent||'';
  var platform=navigator.platform||'';
  if(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2){score+=10;flags.push('low_cpu');}
  if(navigator.deviceMemory&&navigator.deviceMemory<=2){score+=10;flags.push('low_ram');}
  if(ua.indexOf('HeadlessChrome')>=0||ua.indexOf('PhantomJS')>=0||ua.indexOf('Selenium')>=0){score+=50;flags.push('headless');}

  /* 4. Canvas consistency */
  try{
    var cv=document.createElement('canvas');
    cv.width=200;cv.height=50;
    var ctx=cv.getContext('2d');
    ctx.textBaseline='top';
    ctx.font='14px Arial';
    ctx.fillText('Andrux 2.718',2,2);
    var data=cv.toDataURL('image/png');
    if(!data||data.length<100){score+=15;flags.push('canvas_broken');}
  }catch(e){score+=15;flags.push('canvas_error');}

  /* 5. Timezone vs language mismatch (VPN indicator) — relaxed threshold */
  var tz=new Date().getTimezoneOffset();
  var lang=navigator.language||'';
  if(lang.indexOf('zh')===0&&Math.abs(tz+480)>240){score+=5;flags.push('tz_mismatch');}

  /* 6. Plugin count — removed: modern Chrome has 0 plugins by default */

  SEC.vmScore=Math.min(score,100);
  SEC.vmFlags=flags;
  return score;
}

/* Track mouse jitter — real humans have micro-tremor */
function trackMouse(){
  var points=[];
  var lastX=0,lastY=0;
  var handler=function(e){
    var x=e.clientX,y=e.clientY;
    if(points.length>0){
      var dx=x-lastX,dy=y-lastY;
      var dist=Math.sqrt(dx*dx+dy*dy);
      if(dist>0){
        points.push({dx:dx,dy:dy,d:dist,t:Date.now()});
        if(points.length>50)points.shift();
      }
    }
    lastX=x;lastY=y;
  };
  document.addEventListener('mousemove',handler,{passive:true});
  /* Analyze after 8 seconds */
  setTimeout(function(){
    document.removeEventListener('mousemove',handler);
    if(points.length<10){return;} /* no movement — skip, don't penalize */
    var angles=[];
    for(var i=1;i<points.length;i++){
      angles.push(Math.atan2(points[i].dy,points[i].dx));
    }
    var variance=0;
    for(var j=1;j<angles.length;j++){
      variance+=Math.abs(angles[j]-angles[j-1]);
    }
    variance/=angles.length;
    /* Low variance = straight lines = bot/vm — only flag extreme cases */
    SEC.mouseJitter=variance;
    if(variance<0.02){SEC.vmFlags.push('bot_mouse');}
    SEC.vmScore=Math.min(SEC.vmScore,100);
  },8000);
}

/* Anti-debug traps — lightweight, no console pollution */
function antiDebug(){
  /* 1. Debugger detection only — no infinite loop to avoid freezing legit users */
  (function check(){
    var start=performance.now();
    debugger;
    var end=performance.now();
    if(end-start>100){
      SEC.vmFlags.push('debugger_open');
    }
    setTimeout(check,4000);
  })();

  /* 2. Performance baseline — VMs are slower */
  var t0=performance.now();
  for(var i=0;i<1000000;i++){}
  var t1=performance.now();
  SEC.perfBaseline=t1-t0;
  if(SEC.perfBaseline>80){SEC.vmFlags.push('slow_js');}

  /* 3. Detect devtools open via window size difference */
  var threshold=160;
  (function checkSize(){
    var w=window.outerWidth-window.innerWidth;
    var h=window.outerHeight-window.innerHeight;
    if(w>threshold||h>threshold){
      SEC.vmFlags.push('devtools_size');
    }
    setTimeout(checkSize,5000);
  })();
}

/* Honey trap: hidden bait element only — no DOM API hijacking */
function honeyTrap(){
  var bait=document.createElement('a');
  bait.href=SU+'/rest/v1/rpc/__internal_probe';
  bait.style.display='none';
  bait.id='__ax_bait';
  document.body.appendChild(bait);
}

/* Handle risk score — silent reporting only, no forced logout to avoid false positives */
function handleRisk(){
  var score=SEC.vmScore;
  if(score>=40){
    /* Report to backend for admin review only */
    getIP().then(function(ip){
      rpcCall('record_suspicious',{
        p_ip:ip||'',
        p_user_id:session?session.id:null,
        p_score:score,
        p_flags:SEC.vmFlags.join(','),
        p_fp:SEC.fpHash
      }).catch(function(){});
    });
  }
}

/* --- Input sanitizer: strip control chars only (PostgREST uses parameterized queries, no SQL injection surface) --- */
function sanitizeInput(val){
  var s=String(val||'');
  s=s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,'');
  return s.slice(0,1000);
}

/* --- URL validator: only allow safe protocols (https, roblox) to prevent XSS via url() or href --- */
function safeURL(url){
  var s=String(url||'').trim();
  if(/^https?:\/\/.+/i.test(s))return s;
  if(/^roblox:\/\//i.test(s))return s;
  return '';
}

/* --- Attribute escaper: escapes quotes for use in HTML attributes --- */
function escapeAttr(text){
  return String(text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* --- Rate limiter: check if request is allowed --- */
function rateCheck(){
  var now=Date.now();
  /* cooldown active? */
  if(now<SEC.reqCooldown){
    SEC.reqBlocked++;
    return false;
  }
  /* slide window */
  SEC.reqLog=SEC.reqLog.filter(function(t){return now-t<SEC.reqWindow;});
  if(SEC.reqLog.length>=SEC.reqMax){
    /* exponential backoff ban */
    var banMs=Math.min(2000*SEC.reqBackoff,60000);
    SEC.reqCooldown=now+banMs;
    SEC.reqBackoff=Math.min(SEC.reqBackoff*2,32);
    SEC.reqBlocked++;
    /* Removed forced logout — it was a self-DoS vector */
    return false;
  }
  SEC.reqLog.push(now);
  /* decay backoff every 30s */
  if(SEC.reqBackoff>1&&SEC.reqLog.length<8){SEC.reqBackoff=Math.max(1,SEC.reqBackoff-0.5);}
  return true;
}

/* --- Enhanced spam detection --- */
function spamCheck(text,uid){
  if(!uid)return '';
  var s=String(text||'').trim();
  if(!s)return '';
  /* Pattern spam: repeating chars like "aaaaa...." */
  if(SEC.spamPatterns.test(s))return t('val.spam_pattern');
  /* WPM-style: too many messages in window */
  var now=Date.now();
  var key='spam_'+uid;
  try{
    var log=JSON.parse(sessionStorage.getItem(key)||'[]');
    log=log.filter(function(t){return now-t<SEC.spamWindow;});
    log.push(now);
    sessionStorage.setItem(key,JSON.stringify(log));
    if(log.length>12){
      SEC.spamWarnings[uid]=(SEC.spamWarnings[uid]||0)+1;
      if(SEC.spamWarnings[uid]>=SEC.spamMaxWarn){
        return t('val.spam_muted');
      }
      return t('val.spam_high_freq');
    }
  }catch(e){}
  return '';
}

/* ===== State ===== */
var session=null;
var currentPage='';
var channel='general';
var messages=[];
var selectedMessage=null;
var quote=null;
var lastSendAt=0;
var sendTimes=[];
var recentTexts=[];
var poller=null;
var pollInterval=8000;
var pendingFile=null;
var gameTimer=null;
var watchTimer=null;

var channels={
general:{get title(){return t('comm.general_title');},get desc(){return t('comm.general_desc');}},
scripts:{get title(){return t('comm.channel_scripts');},get desc(){return t('comm.channel_scripts_desc');}},
require:{get title(){return t('comm.channel_require');},get desc(){return t('comm.channel_require_desc');}}
};

/* ===== Helpers ===== */
function $(id){return document.getElementById(id);}
function $q(sel){return document.querySelector(sel);}
function $qa(sel){return document.querySelectorAll(sel);}

function toast(t){var el=$('toast');if(!el)return;el.textContent=t;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(function(){el.classList.remove('show');},1800);}

function setNotice(el,text,type){if(!el)return;el.textContent=text;el.classList.remove('bad','ok');if(type)el.classList.add(type);}

function escapeHTML(text){var div=document.createElement('div');div.textContent=String(text||'');return div.innerHTML;}

function cleanName(name){return String(name||'').trim().replace(/\s+/g,'');}
function normalizedName(name){return cleanName(name).toLowerCase();}

function hasEmoji(text){return /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text);}

function decodeWord(list){return list.map(function(codes){return String.fromCharCode.apply(String,codes);});}

function blockedWords(){
var ascii=[[102,117,99,107],[115,104,105,116],[98,105,116,99,104],[97,115,115,104,111,108,101],[100,105,99,107],[99,117,110,116],[110,105,103,103,101,114],[115,108,117,116],[119,104,111,114,101],[98,97,115,116,97,114,100],[100,97,109,110]];
var cn=[[20667,36924],[20667,31508],[33609,27877,39532],[20182,22920],[22920,30340],[25805,20320],[21435,27515],[34850,36135],[22403,22334],[29399,19996,35199],[24223,29289],[36145]];
var names=[[37101,28009,28982],[24247,30355,26376],[36213,22869,21338]];
return decodeWord(ascii).concat(decodeWord(cn),decodeWord(names));
}
var BLOCKED=blockedWords();

function containsBlocked(text){var s=String(text||'').toLowerCase();return BLOCKED.some(function(w){return s.indexOf(w.toLowerCase())>=0;});}

function validateUser(name,pass){
var n=cleanName(name);
if(n.length<3||n.length>24)return t('val.username_len');
if(!/^[A-Za-z0-9_\u4e00-\u9fa5]+$/.test(n))return t('val.username_chars');
if(hasEmoji(n))return t('val.username_emoji');
if(containsBlocked(n))return t('val.username_blocked');
if(!pass||String(pass).length<6)return t('val.password_len');
if(String(pass).length>128)return t('val.password_too_long');
return '';
}

function validateMessage(text,hasFile){
var value=String(text||'').trim();
if(!value&&!hasFile)return t('val.msg_empty');
if(value.length>500)return t('val.msg_too_long');
if(hasEmoji(value))return t('val.msg_emoji');
if(containsBlocked(value))return t('val.msg_blocked');
var now=Date.now();
sendTimes=sendTimes.filter(function(t){return now-t<10000;});
if(sendTimes.length>=4)return t('val.msg_too_fast');
if(now-lastSendAt<1400)return t('val.msg_interval');
if(value){
var norm=value.toLowerCase().replace(/\s+/g,'');
var dup=recentTexts.filter(function(x){return x===norm;}).length;
if(dup>=1)return t('val.msg_dup');
}
return '';
}

function hashText(text){
return crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)).then(function(buf){
return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
});
}

function getAdminHash(){
return ADMIN_HASH_PARTS.map(function(c){return('0'+c.toString(16)).slice(-2);}).join('');
}

function saveSession(user){
session={id:user.c0,username:user.c1,login_at:new Date().toISOString(),fp:SEC.fpHash};
localStorage.setItem('andrux_session',JSON.stringify(session));
}

function loadSession(){
try{session=JSON.parse(localStorage.getItem('andrux_session')||'null');}catch(e){session=null;}
}

/* ===== Supabase API (obfuscated table/field names) ===== */
function api(table,query,options){
if(!rateCheck()){
toast(t('toast.rated'));
return Promise.reject(new Error('Rate limited'));
}
var url=SU+'/rest/v1/'+table+(query||'');
return fetch(url,Object.assign({
headers:{apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json',Prefer:'return=representation'}
},options||{})).then(function(res){
if(!res.ok)return res.text().then(function(txt){
var msg=t('toast.op_fail');
try{var j=JSON.parse(txt);
if(j.code==='23503'||(txt&&txt.indexOf('foreign_key')>=0)){msg=t('val.account_error');localStorage.removeItem('andrux_session');session=null;setTimeout(function(){location.href='../andrux-dashboard.html';},800);}
else if(j.code==='42501'){msg=t('toast.op_fail');}
}catch(e){}
throw new Error(msg);
});
if(res.status===204)return null;
/* HEAD 请求没有响应体，直接返回 response 对象，让调用方读取 headers */
var method=(options&&options.method)||'GET';
if(method.toUpperCase()==='HEAD')return res;
return res.json();
});
}

function rpcCall(fn,body){
return fetch(SU+'/rest/v1/rpc/'+fn,{method:'POST',
headers:{apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json'},
body:JSON.stringify(body)}).then(function(r){
if(!r.ok)return r.text().then(function(){throw new Error(t('toast.op_fail'));});
return r.status===204?null:r.json();
});
}

/* ===== IP check ===== */
function getIP(){
return fetch('https://api.ipify.org?format=json').then(function(r){return r.json();}).then(function(d){return d.ip;}).catch(function(){return '';});
}

function checkIPBan(){
return getIP().then(function(ip){
if(!ip)return false;
return fetch(SU+'/rest/v1/banned_ips?select=ip&ip=eq.'+encodeURIComponent(ip),{headers:{apikey:SK,Authorization:'Bearer '+SK}}).then(function(r){return r.json();}).then(function(rows){return rows&&rows.length>0;}).catch(function(){return false;});
});
}

/* ===== Session guard ===== */
function requireSession(){
if(!session){location.href='../andrux-dashboard.html';return false;}
return true;
}

/* ===== Auth page ===== */
function initAuth(){
var authShell=$('authShell');
if(!authShell)return;
loadSession();
if(session)location.href='./pages/dashboard.html';

/* Tab switching */
$qa('[data-auth-tab]').forEach(function(btn){
btn.addEventListener('click',function(){
$qa('[data-auth-tab]').forEach(function(b){b.classList.remove('active');});
btn.classList.add('active');
var login=btn.dataset.authTab==='login';
var lf=$('loginForm');var rf=$('registerForm');
if(lf)lf.classList.toggle('hidden',!login);
if(rf)rf.classList.toggle('hidden',login);
});
});

/* Register */
var regForm=$('registerForm');
if(regForm)regForm.addEventListener('submit',function(e){
e.preventDefault();
var name=cleanName(($('registerName')||{}).value);
var pass=($('registerPass')||{}).value||'';
var err=validateUser(name,pass);
if(err)return setNotice($('registerNotice'),err,'bad');
var norm=normalizedName(name);
checkIPBan().then(function(banned){
if(banned)return Promise.reject(new Error(t('val.ip_banned')));
return getIP().then(function(ip){
return rpcCall('is_ip_login_locked',{p_ip:ip}).catch(function(){return false;}).then(function(locked){
if(locked===true)throw new Error(t('val.login_locked'));
return rpcCall('check_reg_rate',{p_ip:ip}).catch(function(){return true;}).then(function(ok){
if(ok===false)throw new Error(t('val.reg_rate'));
return api(T_USERS,'?c2=eq.'+encodeURIComponent(norm)+'&select=c0');
});
});
});
}).then(function(rows){
if(rows.length)throw new Error(t('val.user_exists'));
return getIP().then(function(ip){
return hashText(norm+':'+pass).then(function(hash){
var payload={c1:name,c2:norm,c3:hash};
if(ip)payload.c8=ip;
return api(T_USERS,'',{method:'POST',body:JSON.stringify(payload)});
});
});
}).then(function(rows){
if(rows&&rows[0])saveSession(rows[0]);
setNotice($('registerNotice'),t('auth.register_ok'),'ok');
toast(t('toast.register_ok'));
getIP().then(function(ip){rpcCall('record_login_attempt',{p_ip:ip,p_username:norm,p_success:true}).catch(function(){});});
setTimeout(function(){location.href='./pages/dashboard.html';},300);
}).catch(function(err2){
var msg=err2.message||'';
if(msg.indexOf('duplicate')>=0)msg=t('val.user_exists');
getIP().then(function(ip){rpcCall('record_login_attempt',{p_ip:ip,p_username:norm,p_success:false}).catch(function(){});});
setNotice($('registerNotice'),msg,'bad');
});
});

/* Login */
var loginForm=$('loginForm');
if(loginForm)loginForm.addEventListener('submit',function(e){
e.preventDefault();
var name=cleanName(($('loginName')||{}).value);
var pass=($('loginPass')||{}).value||'';
var norm=normalizedName(name);
if(!name||!pass)return setNotice($('loginNotice'),t('val.enter_creds'),'bad');
checkIPBan().then(function(banned){
if(banned)return Promise.reject(new Error(t('val.ip_banned')));
return getIP().then(function(ip){
return rpcCall('is_ip_login_locked',{p_ip:ip}).catch(function(){return false;}).then(function(locked){
if(locked===true)throw new Error(t('val.login_locked'));
return api(T_USERS,'?c2=eq.'+encodeURIComponent(norm)+'&select=*');
});
});
}).then(function(rows){
if(!rows.length)throw new Error(t('val.login_fail'));
return hashText(norm+':'+pass).then(function(hash){
if(hash!==rows[0].c3)throw new Error(t('val.login_fail'));
saveSession(rows[0]);
setNotice($('loginNotice'),t('auth.login_ok'),'ok');
toast(t('toast.login_ok'));
getIP().then(function(ip){rpcCall('record_login_attempt',{p_ip:ip,p_username:norm,p_success:true}).catch(function(){});});
setTimeout(function(){location.href='./pages/dashboard.html';},300);
});
}).catch(function(err){
getIP().then(function(ip){rpcCall('record_login_attempt',{p_ip:ip,p_username:norm,p_success:false}).catch(function(){});});
setNotice($('loginNotice'),err.message,'bad');
});
});
}

/* ===== Navigation ===== */
function initNav(){
var sidebar=$('sidebar');
var mobileMenu=$('mobileMenu');
var logoutBtn=$('logoutBtn');
var mobileLogout=$('mobileLogout');

$qa('.nav-btn').forEach(function(btn){
btn.addEventListener('click',function(){
var href=btn.dataset.href;
if(href)location.href=href;
if(sidebar)sidebar.classList.remove('open');
});
});

if(mobileMenu)mobileMenu.addEventListener('click',function(){if(sidebar)sidebar.classList.toggle('open');});
if(logoutBtn)logoutBtn.addEventListener('click',doLogout);
if(mobileLogout)mobileLogout.addEventListener('click',doLogout);

/* Update username display */
var su=$('sideUsername');
if(su&&session)su.textContent=session.username;
}

function doLogout(){
localStorage.removeItem('andrux_session');
session=null;messages=[];
clearInterval(poller);
if(gameTimer){clearInterval(gameTimer);gameTimer=null;}
if(watchTimer){clearInterval(watchTimer);watchTimer=null;}
location.href='../andrux-dashboard.html';
}

/* ===== Dashboard ===== */
function initDashboard(){
if(!requireSession())return;
refreshStats();
var refreshBtn=$('refreshBtn');
if(refreshBtn)refreshBtn.addEventListener('click',refreshStats);
}

function refreshStats(){
Promise.all([
fetch(SU+'/rest/v1/'+T_USERS+'?select=c0&limit=0',{method:'HEAD',headers:{apikey:SK,Authorization:'Bearer '+SK,Prefer:'count=exact'}}).then(function(r){return parseInt((r.headers.get('content-range')||'*/0').split('/').pop(),10)||0;}).catch(function(){return 0;}),
fetch(SU+'/rest/v1/'+T_MSGS+'?select=c0&limit=0',{method:'HEAD',headers:{apikey:SK,Authorization:'Bearer '+SK,Prefer:'count=exact'}}).then(function(r){return parseInt((r.headers.get('content-range')||'*/0').split('/').pop(),10)||0;}).catch(function(){return 0;})
]).then(function(counts){
var mu=$('metricUsers');var mm=$('metricMessages');
if(mu)mu.textContent=counts[0]||0;
if(mm)mm.textContent=counts[1]||0;
}).catch(function(){
var mu=$('metricUsers');var mm=$('metricMessages');
if(mu)mu.textContent='-';if(mm)mm.textContent='-';
});
}

/* ===== Community ===== */
function initCommunity(){
if(!requireSession())return;
initChatChannels();
initChatSend();
initContextMenu();
initFileUpload();
loadMessages();
clearInterval(poller);
poller=setInterval(loadMessages,pollInterval);
var reloadBtn=$('reloadChat');
if(reloadBtn)reloadBtn.addEventListener('click',loadMessages);
var clearQuote=$('clearQuote');
if(clearQuote)clearQuote.addEventListener('click',function(){quote=null;renderQuote();});
}

function initChatChannels(){
$qa('.channel-btn').forEach(function(btn){
btn.addEventListener('click',function(){switchChannel(btn.dataset.channel);});
});
/* Load saved poll interval */
var saved=localStorage.getItem('andrux_poll_interval');
if(saved)pollInterval=parseInt(saved,10)||8000;
}

function switchChannel(ch){
channel=ch;
var info=channels[ch];
var ct=$('channelTitle');var cd=$('channelDesc');
if(ct)ct.textContent=info.title;
if(cd)cd.textContent=info.desc;
$qa('.channel-btn').forEach(function(btn){btn.classList.toggle('active',btn.dataset.channel===ch);});
quote=null;renderQuote();
updateFilePicker();
var log=$('chatLog');if(log)log.innerHTML='<div class="notice">'+t('comm.loading')+'</div>';
loadMessages();
}

function loadMessages(){
if(!session)return;
api(T_MSGS,'?select=*&c3=eq.'+encodeURIComponent(channel)+'&order=c11.asc&limit=120')
.then(function(rows){
var wasNearBottom=true;
var log=$('chatLog');
if(log)wasNearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<100;
messages=rows||[];
renderMessages();
if(log&&wasNearBottom)log.scrollTop=log.scrollHeight;
})
.catch(function(){setNotice($('chatNotice'),t('misc.read_error'),'bad');});
}

function renderMessages(){
var log=$('chatLog');if(!log)return;
if(!messages.length){log.innerHTML='<div class="notice">'+t('misc.no_msgs')+'</div>';return;}
var myId=session?session.id:null;
/* Load client-side deleted list */
var deletedIds=[];
if(myId){try{deletedIds=JSON.parse(localStorage.getItem('andrux_deleted_msgs_'+myId)||'[]');}catch(e){}}
log.innerHTML=messages.map(function(msg){
var mine=msg.c1===myId;
var time=msg.c11?new Date(msg.c11).toLocaleTimeString(window.I18N&&window.I18N.lang==='en'?'en-US':'zh-CN',{hour:'2-digit',minute:'2-digit'}):'';
var recalled=!!msg.c10;
var locallyDeleted=mine&&deletedIds.indexOf(msg.c0)>=0;
var qhtml=msg.c5&&!recalled&&!locallyDeleted?'<div class="quote selectable"><b style="display:block;font-size:11px;color:var(--accent);margin-bottom:4px;letter-spacing:.04em">REPLY</b>'+escapeHTML(String(msg.c5).slice(0,220))+'</div>':'';
var body=recalled?t('comm.msg_recalled'):locallyDeleted?'':escapeHTML(msg.c4);
var fileHtml='';
if(msg.c6&&!recalled&&!locallyDeleted){
var fname=escapeHTML(msg.c6);
var fsize=msg.c8?Math.round(msg.c8/1024)+'KB':'';
var dlHref='';
if(msg.c9){
var mimeMap={txt:'text/plain',lua:'text/plain',rbxm:'application/octet-stream',rbxl:'application/octet-stream'};
var mime=mimeMap[msg.c7]||'application/octet-stream';
dlHref="data:"+mime+";base64,"+msg.c9;
}
fileHtml='<div class="message-file"><div class="attachment"><div><strong>'+fname+'</strong>'+(fsize?'<span>'+fsize+'</span>':'')+'</div>'+(dlHref?'<a class="download-file selectable" href="'+escapeAttr(dlHref)+'" download="'+escapeAttr(msg.c6)+'">'+t('misc.download')+'</a>':'')+'</div></div>';
}
var msgCls='message selectable'+(mine?' mine ':'')+(recalled?' recalled':'')+(locallyDeleted?' self-deleted':'');
return '<article class="'+msgCls+'" data-id="'+escapeAttr(msg.c0)+'" data-deleted="'+(locallyDeleted?'1':'0')+'">'+
'<div class="message-head"><span class="msg-author" data-uid="'+escapeAttr(msg.c1)+'">'+escapeHTML(msg.c2)+'</span><span>'+time+'</span></div>'+
qhtml+'<div class="message-body">'+body+'</div>'+fileHtml+'</article>';
}).join('');
log.scrollTop=log.scrollHeight;
/* Bind author name click to view profile */
log.querySelectorAll('.msg-author').forEach(function(el){
el.style.cursor='pointer';
el.style.textDecoration='underline';
el.style.textUnderlineOffset='2px';
el.addEventListener('click',function(e){
e.stopPropagation();
var uid=el.getAttribute('data-uid');
if(uid)location.href='./profile.html?uid='+encodeURIComponent(uid);
});
});
}

function renderQuote(){
var qd=$('quoteDraft');var qt=$('quoteText');
if(!qd)return;
if(!quote){qd.classList.remove('active');if(qt)qt.textContent='';return;}
qd.classList.add('active');
if(qt)qt.textContent=t('comm.quote_content')+': '+quote.content.slice(0,80);
}

function initChatSend(){
var form=$('messageForm');
if(!form)return;
var sending=false;
form.addEventListener('submit',function(e){
e.preventDefault();
if(sending)return;
var submitBtn=form.querySelector('[type=submit]');
var input=$('messageInput');
var content=input?input.value.trim():'';
var err=validateMessage(content,!!pendingFile);
if(err)return setNotice($('chatNotice'),err,'bad');
var spamErr=spamCheck(content,session?session.id:null);
if(spamErr)return setNotice($('chatNotice'),spamErr,'bad');
sending=true;
if(submitBtn){submitBtn.disabled=true;submitBtn.textContent=t('comm.sending');submitBtn.style.opacity='0.5';}

/* Check global mute */
api(T_CONFIG,'?c0=eq.global_mute_until&select=c1').then(function(rows){
if(rows&&rows.length&&rows[0].c1){
var val=rows[0].c1;
if(val==='forever'||new Date(val)>new Date()){
throw new Error(t('val.global_mute_on'));
}
}
}).then(function(){
return checkIPBan().then(function(banned){
if(banned)throw new Error(t('val.ip_banned'));
});
}).then(function(){
/* Check personal mute */
return api(T_USERS,'?c0=eq.'+encodeURIComponent(session.id)+'&select=c4').then(function(rows){
if(rows&&rows.length&&rows[0].c4){
var muteUntil=new Date(rows[0].c4);
if(muteUntil>new Date()&&muteUntil.getFullYear()<9999){
throw new Error(t('val.you_muted'));
}
}
});
}).then(function(){
var payload={c1:session.id,c2:session.username,c3:channel,c4:content};
if(quote)payload.c5=quote.content.slice(0,220);

if(pendingFile){
payload.c6=pendingFile.name;
payload.c7=pendingFile.type;
payload.c8=pendingFile.size;
payload.c9=pendingFile.data;
}

return api(T_MSGS,'',{method:'POST',body:JSON.stringify(payload)});
}).then(function(){
lastSendAt=Date.now();
sendTimes.push(lastSendAt);
if(content)recentTexts.push(content.toLowerCase().replace(/\s+/g,''));
recentTexts=recentTexts.slice(-6);
if($('messageInput'))$('messageInput').value='';
quote=null;renderQuote();
clearPendingFile();
setNotice($('chatNotice'),'','ok');
loadMessages();refreshStats();
}).catch(function(err){
var msg=err.message||t('toast.op_fail');
setNotice($('chatNotice'),msg,'bad');
}).finally(function(){
sending=false;
if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=t('comm.send');submitBtn.style.opacity='';}
});
});
}

/* ===== Right-click context menu ===== */
function initContextMenu(){
var menu=$('contextMenu');
if(!menu)return;

document.addEventListener('click',function(e){if(!e.target.closest('.context-menu'))hideMenu();});

document.addEventListener('contextmenu',function(e){
e.preventDefault();
var msgEl=e.target.closest('.message');
if(!msgEl||currentPage!=='community')return;
if(msgEl.dataset.deleted==='1')return;
if(msgEl.classList.contains('recalled'))return;
var msg=messages.find(function(m){return String(m.c0)===String(msgEl.dataset.id);});
if(msg&&!msg.c10)showMenu(e.clientX,e.clientY,msg);
});

menu.addEventListener('click',function(e){
var action=(e.target.closest('[data-action]')||{}).dataset||{};
var act=action.action;if(!act)return;
var msg=selectedMessage;hideMenu();
if(act==='recall')recallMessage(msg);
if(act==='self-delete')selfDeleteMessage(msg);
if(act==='quote')quoteMessage(msg);
if(act==='copy')copyMessage(msg);
});
}

function showMenu(x,y,msg){
var menu=$('contextMenu');if(!menu)return;
selectedMessage=msg;
var age=msg.c11?Date.now()-new Date(msg.c11).getTime():0;
var recallBtn=menu.querySelector('[data-action="recall"]');
if(recallBtn){
if(age>60000){recallBtn.textContent=t('comm.delete');recallBtn.dataset.action='self-delete';}
else{recallBtn.textContent=t('comm.recall');recallBtn.dataset.action='recall';}
}
menu.style.left=Math.min(x,window.innerWidth-190)+'px';
menu.style.top=Math.min(y,window.innerHeight-170)+'px';
menu.style.display='block';
}
function hideMenu(){
var menu=$('contextMenu');if(!menu)return;
menu.style.display='none';selectedMessage=null;
}

function recallMessage(msg){
if(!msg)return;
if(msg.c1!==session.id)return;
if(msg.c10)return;
var age=msg.c11?Date.now()-new Date(msg.c11).getTime():0;
if(age>60000)return;
api(T_MSGS,'?c0=eq.'+encodeURIComponent(msg.c0),{
method:'PATCH',body:JSON.stringify({c10:true})
}).then(function(){toast(t('toast.recalled'));loadMessages();}).catch(function(){toast(t('toast.recall_fail'));});
}

/* Client-side only delete: sender hides message locally, others unaffected */
function selfDeleteMessage(msg){
if(!msg||!session)return;
if(msg.c1!==session.id)return;
var key='andrux_deleted_msgs_'+session.id;
try{
var list=JSON.parse(localStorage.getItem(key)||'[]');
if(list.indexOf(msg.c0)<0){list.push(msg.c0);
/* Keep only last 200 entries to prevent unbounded growth */
if(list.length>200)list=list.slice(-200);
localStorage.setItem(key,JSON.stringify(list));}
}catch(e){}
toast(t('toast.deleted'));
renderMessages();
}

function quoteMessage(msg){
if(!msg||msg.c10)return toast(t('toast.cannot_quote'));
quote={id:msg.c0,content:msg.c4||''};
renderQuote();var mi=$('messageInput');if(mi)mi.focus();
}

function copyMessage(msg){
if(!msg||msg.c10)return toast(t('toast.cannot_copy'));
var text=msg.c4||'';
if(navigator.clipboard&&navigator.clipboard.writeText){
navigator.clipboard.writeText(text).then(function(){toast(t('toast.copied'));}).catch(function(){fallbackCopy(text);});
}else{fallbackCopy(text);}
}

function fallbackCopy(text){
try{
var ta=document.createElement('textarea');
ta.value=text;ta.style.position='fixed';ta.style.left='-9999px';
document.body.appendChild(ta);ta.select();
var ok=document.execCommand('copy');
document.body.removeChild(ta);
toast(ok?t('toast.copied'):t('toast.copy_fail'));
}catch(e){toast(t('toast.copy_fail'));}
}

/* ===== File upload ===== */
function initFileUpload(){
var fileInput=$('fileInput');
if(!fileInput)return;
fileInput.addEventListener('change',function(){
var file=fileInput.files[0];
if(!file){clearPendingFile();return;}
var ext=(file.name.split('.').pop()||'').toLowerCase();
var maxSize=2*1024*1024;
if(file.size>maxSize){toast(t('toast.file_too_big'));fileInput.value='';return;}

var allowed={general:[],scripts:['txt','lua'],require:['txt','lua','rbxm','rbxl']};
var ok=(allowed[channel]||[]).indexOf(ext)>=0;
if(!ok){toast(t('toast.file_type_err'));fileInput.value='';return;}

var reader=new FileReader();
reader.onload=function(e){
var raw=e.target.result;
var b64=raw.indexOf(',')>=0?raw.split(',').pop():raw;
pendingFile={name:file.name,type:ext,size:file.size,data:b64};
var fi=$('fileInfo');if(fi)fi.textContent=file.name+' ('+Math.round(file.size/1024)+'KB)';
};
reader.readAsDataURL(file);
});
updateFilePicker();
}

function updateFilePicker(){
var label=$('fileLabel');
var input=$('fileInput');
var labelText=$('fileLabelText');
if(!label)return;
if(channel==='general'){
label.classList.add('disabled');
if(input)input.disabled=true;
if(labelText)labelText.textContent=t('comm.file_disabled');
}else{
label.classList.remove('disabled');
if(input)input.disabled=false;
var types=channel==='scripts'?'txt, lua':'txt, lua, rbxm, rbxl';
if(labelText)labelText.textContent=t('comm.file_supported')+types;
if(input)input.accept='.'+types.replace(/\s*,\s*/g,',.').replace(/\s/g,'');
}
}

function clearPendingFile(){
pendingFile=null;
var fi=$('fileInfo');if(fi)fi.textContent=t('comm.file_none');
var input=$('fileInput');if(input)input.value='';
}

/* ===== Admin ===== */
function initAdmin(){
if(!requireSession())return;
var lock=$('adminLock');
var panel=$('adminPanel');
var form=$('adminLoginForm');
if(!lock||!panel||!form)return;

/* Check if already unlocked this session */
if(sessionStorage.getItem('andrux_admin_ok')==='1'){
lock.classList.add('hidden');panel.classList.remove('hidden');loadAdminData();
}

form.addEventListener('submit',function(e){
e.preventDefault();
var pw=($('adminPassword')||{}).value||'';
if(hashText(pw.toLowerCase()).then){
hashText(pw.toLowerCase()).then(function(hash){
if(hash===getAdminHash()){
sessionStorage.setItem('andrux_admin_ok','1');
lock.classList.add('hidden');panel.classList.remove('hidden');
toast(t('toast.password_ok'));loadAdminData();
}else{setNotice($('adminNotice'),t('toast.password_err'),'bad');}
});
}
});

/* Global mute */
$qa('[data-global-mute]').forEach(function(btn){
btn.addEventListener('click',function(){
var val=btn.dataset.globalMute;
var minutesInput=$('globalMuteMinutes');
var minutes=minutesInput?parseInt(minutesInput.value,10):0;
var until='';
if(val==='off')until='';
else if(val==='forever')until='9999-12-31T23:59:59.000Z';
else if(val==='custom'&&minutes>0)until=new Date(Date.now()+minutes*60000).toISOString();
else if(val==='10')until=new Date(Date.now()+10*60000).toISOString();
else if(val==='60')until=new Date(Date.now()+60*60000).toISOString();

api(T_CONFIG,"?c0=eq.global_mute_until&select=c0",{}).then(function(rows){
if(rows&&rows.length){
return api(T_CONFIG,'?c0=eq.global_mute_until',{method:'PATCH',body:JSON.stringify({c1:until})});
}
}).then(function(){toast(val==='off'?t('toast.mute_off'):t('toast.mute_on'));refreshGlobalMuteStatus();}).catch(function(){toast(t('toast.op_fail'));});
});
});

var refreshGlobal=$('adminRefreshGlobal');
if(refreshGlobal)refreshGlobal.addEventListener('click',refreshGlobalMuteStatus);
refreshGlobalMuteStatus();

/* Channel selector for messages */
var chSelect=$('adminChannel');
if(chSelect)chSelect.addEventListener('change',loadAdminMessages);

/* Refresh buttons */
var refreshGames=$('adminRefreshGames');
if(refreshGames)refreshGames.addEventListener('click',loadAdminGames);
var showHidden=$('adminShowHiddenGames');
if(showHidden)showHidden.addEventListener('change',loadAdminGames);
var refreshUsers=$('adminRefreshUsers');
if(refreshUsers)refreshUsers.addEventListener('click',loadAdminUsers);
}

function refreshGlobalMuteStatus(){
var el=$('globalMuteStatus');if(!el)return;
api(T_CONFIG,'?c0=eq.global_mute_until&select=c1').then(function(rows){
if(!rows||!rows.length||!rows[0].c1){el.textContent=t('admin.mute_status_off');return;}
var val=rows[0].c1;
if(val==='forever')el.textContent=t('admin.mute_status_forever');
else{var d=new Date(val);if(d>new Date())el.textContent=t('admin.mute_status_until')+d.toLocaleString(window.I18N&&window.I18N.lang==='en'?'en-US':'zh-CN');
else el.textContent=t('admin.mute_status_expired');}
}).catch(function(){el.textContent=t('admin.mute_status_error');});
}

function loadAdminData(){loadAdminGames();loadAdminUsers();loadAdminMessages();}

function loadAdminGames(){
var container=$('adminGames');if(!container)return;
var showAll=$('adminShowHiddenGames');
var filter=showAll&&showAll.checked?'':'&hidden=eq.false';
api(T_GAMES,'?select=*&order=last_heartbeat.desc.nullslast&limit=50'+filter).then(function(rows){
if(!rows||!rows.length){container.innerHTML='<div class="notice">'+t('admin.no_games')+'</div>';return;}
container.innerHTML=rows.map(function(g){
var isHidden=!!g.hidden;
var statusCls=isHidden?'mini-btn danger':'mini-btn';
var statusText=isHidden?t('admin.restore_game'):t('admin.hide_game');
var hb=g.last_heartbeat?new Date(g.last_heartbeat).toLocaleString(window.I18N&&window.I18N.lang==='en'?'en-US':'zh-CN'):'';
return '<div class="admin-item" data-id="'+escapeAttr(g.id)+'">'+
'<div class="admin-item-top"><b>'+escapeHTML(g.game_name||'Unknown')+'<small style="color:var(--muted);font-weight:400;margin-left:8px">'+escapeHTML(g.place_id)+'</small></b><span>'+(hb||t('admin.no_heartbeat'))+'</span></div>'+(g.description?'<div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHTML(g.description).slice(0,100)+'</div>':'')+
'<div class="admin-actions">'+
'<button class="'+statusCls+'" data-action="toggle-game" data-gid="'+escapeAttr(g.id)+'" data-hidden="'+!isHidden+'">'+statusText+'</button>'+
'</div></div>';}).join('');}).catch(function(){container.innerHTML='<div class="notice bad">'+t('admin.load_fail')+'</div>';});}

function loadAdminUsers(){
var container=$('adminUsers');if(!container)return;
api(T_USERS,'?select=*&order=c6.desc').then(function(rows){
if(!rows||!rows.length){container.innerHTML='<div class="notice">'+t('admin.no_users')+'</div>';return;}
container.innerHTML=rows.map(function(u){
var muted=u.c4?t('admin.muted_status'):t('admin.normal_status');
var ip=u.c8||'';
return '<div class="admin-item" data-id="'+escapeAttr(u.c0)+'">'+
'<div class="admin-item-top"><b>'+escapeHTML(u.c1)+'</b><span>'+muted+'</span></div>'+
'<div class="admin-actions">'+
'<button class="mini-btn" data-action="view-profile" data-uid="'+escapeAttr(u.c0)+'">'+t('profile.view_profile')+'</button>'+
'<button class="mini-btn" data-action="delete-user" data-uid="'+escapeAttr(u.c0)+'">'+t('admin.delete')+'</button>'+
'<button class="mini-btn" data-action="mute-user" data-uid="'+escapeAttr(u.c0)+'">'+t('admin.mute')+'</button>'+
'<button class="mini-btn" data-action="unmute-user" data-uid="'+escapeAttr(u.c0)+'">'+t('admin.unmute')+'</button>'+
'<button class="mini-btn" data-action="clear-user-msgs" data-uid="'+escapeAttr(u.c0)+'">'+t('admin.clear_msgs')+'</button>'+
'</div></div>';
}).join('');
}).catch(function(){container.innerHTML='<div class="notice bad">'+t('admin.load_fail')+'</div>';});
}

function loadAdminMessages(){
var container=$('adminMessages');
var chSelect=$('adminChannel');
if(!container)return;
var ch=chSelect?chSelect.value:'general';
api(T_MSGS,'?c3=eq.'+encodeURIComponent(ch)+'&order=c11.desc&limit=60&select=*').then(function(rows){
if(!rows||!rows.length){container.innerHTML='<div class="notice">'+t('admin.no_msgs')+'</div>';return;}
container.innerHTML=rows.map(function(m){
var time=m.c11?new Date(m.c11).toLocaleString(window.I18N&&window.I18N.lang==='en'?'en-US':'zh-CN'):'';
return '<div class="admin-item" data-id="'+escapeAttr(m.c0)+'">'+
'<div class="admin-item-top"><b>'+escapeHTML(m.c2)+'</b><span>'+time+'</span></div>'+
'<div class="admin-item-msg">'+escapeHTML(String(m.c4||'').slice(0,100))+'</div>'+
'<div class="admin-actions">'+
'<button class="mini-btn" data-action="delete-msg" data-mid="'+escapeAttr(m.c0)+'">'+t('admin.delete')+'</button>'+
'<button class="mini-btn" data-action="delete-user-msgs" data-uid="'+escapeAttr(m.c1)+'">'+t('admin.clear_user_msgs')+'</button>'+
'</div></div>';
}).join('');
}).catch(function(){container.innerHTML='<div class="notice bad">'+t('admin.load_fail')+'</div>';});
}

/* Admin click delegation */
document.addEventListener('click',function(e){
var btn=e.target.closest('[data-action]');
if(!btn)return;
var action=btn.dataset.action;
var uid=btn.dataset.uid;
var mid=btn.dataset.mid;

if(action==='delete-user'&&uid){
if(!confirm(t('misc.confirm_delete_user')))return;
api(T_USERS,'?c0=eq.'+encodeURIComponent(uid),{method:'DELETE'}).then(function(){
toast(t('toast.deleted_user'));loadAdminUsers();
}).catch(function(){toast(t('toast.delete_fail'));});
}

if(action==='view-profile'&&uid){
location.href='./profile.html?uid='+encodeURIComponent(uid);
}

if(action==='mute-user'&&uid){
var mins=prompt(t('misc.mute_prompt'));
if(mins===null)return;
var m=parseInt(mins,10);
if(isNaN(m)||m<=0)return toast(t('misc.invalid_number'));
var until=m>=99999?'9999-12-31T23:59:59.000Z':new Date(Date.now()+m*60000).toISOString();
api(T_USERS,'?c0=eq.'+encodeURIComponent(uid),{method:'PATCH',body:JSON.stringify({c4:until})}).then(function(){
toast(t('toast.muted'));loadAdminUsers();
}).catch(function(){toast(t('toast.mute_fail'));});
}

if(action==='unmute-user'&&uid){
api(T_USERS,'?c0=eq.'+encodeURIComponent(uid),{method:'PATCH',body:JSON.stringify({c4:null})}).then(function(){
toast(t('toast.unmuted'));loadAdminUsers();
}).catch(function(){toast(t('toast.unmute_fail'));});
}

if(action==='clear-user-msgs'&&uid){
if(!confirm(t('misc.confirm_clear_msgs')))return;
api(T_MSGS,'?c1=eq.'+encodeURIComponent(uid),{method:'DELETE'}).then(function(){
toast(t('toast.cleared_msgs'));loadAdminMessages();
}).catch(function(){toast(t('toast.clear_fail'));});
}

if(action==='delete-msg'&&mid){
if(!confirm(t('misc.confirm_delete_msg')))return;
api(T_MSGS,'?c0=eq.'+encodeURIComponent(mid),{method:'DELETE'}).then(function(){
toast(t('toast.deleted_user'));loadAdminMessages();
}).catch(function(){toast(t('toast.delete_fail'));});
}

if(action==='toggle-game'){
var gid=btn.dataset.gid;
var hide=btn.dataset.hidden==='true';
if(!gid)return;
api(T_GAMES,'?id=eq.'+encodeURIComponent(gid),{method:'PATCH',body:JSON.stringify({hidden:hide})}).then(function(){
toast(hide?t('toast.game_hidden'):t('toast.game_restored'));loadAdminGames();
}).catch(function(){toast(t('toast.op_fail'));});
}

if(action==='delete-user-msgs'&&uid){
if(!confirm(t('misc.confirm_clear_msgs')))return;
api(T_MSGS,'?c1=eq.'+encodeURIComponent(uid),{method:'DELETE'}).then(function(){
toast(t('toast.cleared_msgs'));loadAdminMessages();
}).catch(function(){toast(t('toast.clear_fail'));});
}
});

/* ===== Settings ===== */
function initSettings(){
if(!requireSession())return;

/* Compact */
var compact=$('settingCompact');
if(compact){
compact.checked=localStorage.getItem('andrux_compact')==='1';
compact.addEventListener('change',function(){
localStorage.setItem('andrux_compact',compact.checked?'1':'0');
document.body.classList.toggle('compact',compact.checked);
});
if(compact.checked)document.body.classList.add('compact');
}

/* Reduce motion */
var rm=$('settingReduceMotion');
if(rm){
rm.checked=localStorage.getItem('andrux_reduce_motion')==='1';
rm.addEventListener('change',function(){
localStorage.setItem('andrux_reduce_motion',rm.checked?'1':'0');
document.body.classList.toggle('reduce-motion',rm.checked);
});
if(rm.checked)document.body.classList.add('reduce-motion');
}

/* Refresh interval */
var refresh=$('settingRefresh');
if(refresh){
refresh.value=localStorage.getItem('andrux_poll_interval')||'8000';
refresh.addEventListener('change',function(){
pollInterval=parseInt(refresh.value,10)||8000;
localStorage.setItem('andrux_poll_interval',String(pollInterval));
clearInterval(poller);
if(currentPage==='community')poller=setInterval(loadMessages,pollInterval);
toast(t('toast.refresh_updated'));
});
}

/* Switch account */
var switchBtn=$('switchAccountBtn');
if(switchBtn)switchBtn.addEventListener('click',function(){doLogout();});

/* Logout */
var settingsLogout=$('settingsLogoutBtn');
if(settingsLogout)settingsLogout.addEventListener('click',function(){doLogout();});

/* Clear local */
var clearBtn=$('clearLocalBtn');
if(clearBtn)clearBtn.addEventListener('click',function(){
if(!confirm(t('misc.confirm_clear_local')))return;
localStorage.removeItem('andrux_session');
localStorage.removeItem('andrux_compact');
localStorage.removeItem('andrux_reduce_motion');
localStorage.removeItem('andrux_poll_interval');
sessionStorage.removeItem('andrux_admin_ok');
sessionStorage.removeItem('andrux_human_ok');
toast(t('toast.cleared'));
});

/* Language switcher */
var langBtns=document.querySelectorAll('.lang-btn');
if(langBtns.length){
/* Highlight current language */
langBtns.forEach(function(btn){
if(btn.dataset.lang===(window.I18N?window.I18N.lang:'zh'))btn.classList.add('active');
btn.addEventListener('click',function(){
var lang=btn.dataset.lang;
if(window.I18N){
window.I18N.setLang(lang);
/* Re-highlight buttons */
langBtns.forEach(function(b){b.classList.toggle('active',b.dataset.lang===lang);});
toast(t('toast.lang_updated'));
}
});
});
}
}

/* ===== Game page ===== */
/* Server sends a heartbeat roughly every 30s; if none arrives within this window the game is offline. */
var HEARTBEAT_STALE_MS=40000;
function initGame(){
if(!requireSession())return;
loadGameStatus();
gameTimer=setInterval(loadGameStatus,5000);
}

function loadGameStatus(){
var box=$('gameStatusBox');if(!box)return;
api(T_GAMES,'?select=*&hidden=eq.false&order=last_heartbeat.desc&limit=50').then(function(rows){
if(!rows||!rows.length){box.innerHTML='<div class="notice">'+t('game.no_data')+'</div>';return;}
var now=Date.now();
box.innerHTML='<div class="games-grid">'+rows.map(function(g){
var isOnline=g.status==='online'&&(now-new Date(g.last_heartbeat).getTime())<HEARTBEAT_STALE_MS;
var cls=isOnline?'gc gc-has-bg':'gc gc-has-bg gc-offline';
var hasBg=g.cover_image_url&&g.cover_image_url.length>5;
var safeBg=safeURL(g.cover_image_url);
if(!hasBg||!safeBg)cls=cls.replace('gc-has-bg','gc-no-bg');
var bgStyle=(hasBg&&safeBg)?"background-image:url('"+safeBg.replace(/'/g,'')+"');background-size:cover;background-position:center;background-repeat:no-repeat;":'';
var rawJoin=g.join_url||('roblox://placeId='+g.place_id);
var joinHref=safeURL(rawJoin)||('roblox://placeId='+escapeAttr(g.place_id));
var joinDisabled=isOnline?'':'pointer-events:none;opacity:0.4;';
var statusHtml=isOnline?'<span class="gc-status gc-online">'+t('game.online')+'</span>':'<span class="gc-status gc-offline">'+t('game.offline')+'</span>';
return '<div class="'+cls+'">'+
'<div class="gc-bg" style="'+bgStyle+'"></div>'+
'<div class="gc-ov"></div>'+
'<div class="gc-body">'+
'<div class="gc-top-row">'+statusHtml+'</div>'+
'<h3 class="gc-title">'+escapeHTML(g.game_name||'Unknown')+'</h3>'+
'<p class="gc-desc">'+escapeHTML(g.description||'')+'</p>'+
'<div class="gc-foot">'+
'<div>'+
'<span class="gc-player-num">'+escapeHTML(String(g.player_count||0))+'</span>'+
'<span class="gc-player-label">'+t('game.players')+'</span>'+
'</div>'+
'<a class="gc-join" href="'+escapeAttr(joinHref)+'" target="_blank" rel="noopener" style="'+joinDisabled+'">'+t('game.join')+'</a>'+
'</div></div></div>';
}).join('')+'</div>';
}).catch(function(err){box.innerHTML='<div class="notice">'+t('game.load_error')+'</div>';});
}

/* ===== Executor ===== */
var execSelectedPlaceId=null;
var execGameTimer=null;
function startExecGameRefresh(){
if(execGameTimer)return;
execGameTimer=setInterval(loadExecGames,5000);
}
function initExecutor(){
if(!requireSession())return;
var lock=$('execLock');
var panel=$('execPanel');
var form=$('execLoginForm');
if(!lock||!panel||!form)return;

if(sessionStorage.getItem('andrux_admin_ok')==='1'){
lock.classList.add('hidden');panel.classList.remove('hidden');loadExecGames();startExecGameRefresh();
}

form.addEventListener('submit',function(e){
e.preventDefault();
var pw=($('execPassword')||{}).value||'';
hashText(pw.toLowerCase()).then(function(hash){
if(hash===getAdminHash()){
sessionStorage.setItem('andrux_admin_ok','1');
lock.classList.add('hidden');panel.classList.remove('hidden');
toast(t('toast.password_ok'));loadExecGames();startExecGameRefresh();
}else{setNotice($('execNotice'),t('toast.password_err'),'bad');}
});
});

var refreshBtn=$('execRefreshGames');
if(refreshBtn)refreshBtn.addEventListener('click',loadExecGames);

var editor=$('execScriptInput');
var charCount=$('execCharCount');
if(editor&&charCount){
editor.addEventListener('input',function(){charCount.textContent=editor.value.length+t('exec.char_unit');});
}

var clearBtn=$('execClearBtn');
if(clearBtn)clearBtn.addEventListener('click',function(){if(editor){editor.value='';if(charCount)charCount.textContent='0'+t('exec.char_unit');}});

var sendBtn=$('execSendBtn');
if(sendBtn)sendBtn.addEventListener('click',execSendScript);
}

function loadExecGames(){
var container=$('execGameList');if(!container)return;
api(T_GAMES,'?select=place_id,game_name,status,last_heartbeat,player_count&hidden=eq.false&order=game_name.asc&limit=100').then(function(rows){
if(!rows||!rows.length){container.innerHTML='<div class="notice">'+t('exec.no_games')+'</div>';return;}
var now=Date.now();
container.innerHTML=rows.map(function(g){
var isOnline=g.status==='online'&&(now-new Date(g.last_heartbeat).getTime())<HEARTBEAT_STALE_MS;
var cls=isOnline?'exec-game-item':'exec-game-item offline';
if(g.place_id===execSelectedPlaceId)cls+=' selected';
var statusHtml=isOnline?'<span class="exec-game-status online">'+t('game.online')+'</span>':'<span class="exec-game-status offline">'+t('game.offline')+'</span>';
return '<div class="'+cls+'" data-place-id="'+escapeHTML(g.place_id)+'">'+
'<div class="exec-game-info"><b>'+escapeHTML(g.game_name||'Unknown')+'</b>'+
'<small>Place '+escapeHTML(g.place_id)+' / '+(g.player_count||0)+t('exec.players_unit')+'</small></div>'+
statusHtml+'</div>';
}).join('');

container.querySelectorAll('.exec-game-item:not(.offline)').forEach(function(el){
el.addEventListener('click',function(){
container.querySelectorAll('.exec-game-item').forEach(function(i){i.classList.remove('selected');});
el.classList.add('selected');
execSelectedPlaceId=el.dataset.placeId;
});
});
}).catch(function(){container.innerHTML='<div class="notice bad">'+t('admin.load_fail')+'</div>';});
}

function execSendScript(){
var editor=$('execScriptInput');
var status=$('execStatus');
if(!editor||!status)return;
var script=editor.value.trim();
if(!script)return setNotice(status,t('val.enter_script'),'bad');
if(!execSelectedPlaceId)return setNotice(status,t('val.select_server'),'bad');

var sendBtn=$('execSendBtn');
if(sendBtn){sendBtn.disabled=true;sendBtn.textContent=t('exec.pushing');sendBtn.style.opacity='0.5';}

var payload={exec_queue:[script]};
api(T_GAMES,'?place_id=eq.'+encodeURIComponent(execSelectedPlaceId),{
method:'PATCH',body:JSON.stringify(payload)
}).then(function(){
try {
  var storedName = (window.localStorage && localStorage.getItem('andrux_bound_roblox_name')) || '';
  rpc('ax_log_exec', {
    p_place_id: execSelectedPlaceId,
    p_source: 'executor_lua',
    p_roblox_name: storedName
  }).catch(function(){});
  var cur = parseInt(localStorage.getItem('andrux_total_execs') || '0', 10);
  localStorage.setItem('andrux_total_execs', String(cur + 1));
  window.dispatchEvent(new Event('storage'));
} catch(e) {}
setNotice(status,t('misc.script_pushed')+execSelectedPlaceId+t('misc.push_wait'),'ok');
toast(t('toast.script_pushed'));
}).catch(function(err){
setNotice(status,t('misc.push_fail')+(err.message||t('misc.unknown_err')),'bad');
}).finally(function(){
if(sendBtn){sendBtn.disabled=false;sendBtn.textContent=t('exec.execute');sendBtn.style.opacity='';}
});
}

/* ===== Profile ===== */
var profileUserId=null;
var profileIsMine=false;
var profileEditing=false;
var profileSelectedColor='6f4d2d';
var PROFILE_COLORS=['6f4d2d','203a33','8a2d2d','2d6f52','9a6b1d','4a3a6f','3a5a8a','6f2d4a','2d4a6f','5a5a5a'];

function initProfile(){
if(!requireSession())return;
/* Determine target user: ?uid=xxx for viewing others, otherwise own profile */
var params=new URLSearchParams(window.location.search);
var targetUid=params.get('uid');
if(!targetUid&&session)targetUid=session.id;
if(!targetUid){loadProfile(session.id);return;}
loadProfile(targetUid);
}

function loadProfile(uid){
if(!uid)return;
profileUserId=uid;
profileIsMine=!!session&&uid===session.id;
var box=$('profileContent');if(!box)return;
box.innerHTML='<div class="card profile-card"><div class="profile-loading">'+t('comm.loading')+'</div></div>';

/* Try full query with profile fields; if it fails (fields not added yet), fall back to basic fields */
api(T_USERS,'?c0=eq.'+encodeURIComponent(uid)+'&select=c0,c1,c4,c6,c9,c10,c11,c12').then(function(rows){
if(rows&&rows.length){
finishProfileLoad(rows[0]);
}else{
/* Fallback: query with basic fields only (no c9-c12) */
return api(T_USERS,'?c0=eq.'+encodeURIComponent(uid)+'&select=c0,c1,c4,c6').then(function(rows2){
if(!rows2||!rows2.length){showProfileNotFound();return;}
finishProfileLoad(rows2[0]);
}).catch(function(){showProfileNotFound();});
}
}).catch(function(){
/* Full query failed — likely c9-c12 columns don't exist yet, try basic */
api(T_USERS,'?c0=eq.'+encodeURIComponent(uid)+'&select=c0,c1,c4,c6').then(function(rows){
if(!rows||!rows.length){showProfileNotFound();return;}
finishProfileLoad(rows[0]);
}).catch(function(){showProfileNotFound();});
});
}

function finishProfileLoad(u){
/* Load message count */
api(T_MSGS,'?c1=eq.'+encodeURIComponent(u.c0)+'&select=c0&limit=0',{method:'HEAD',headers:{apikey:SK,Authorization:'Bearer '+SK,Prefer:'count=exact'}}).then(function(r){
var count=0;try{count=parseInt((r.headers.get('content-range')||'*/0').split('/').pop(),10)||0;}catch(e){}
renderProfile(u,count);
}).catch(function(){renderProfile(u,0);});
}

function showProfileNotFound(){
var box=$('profileContent');if(!box)return;
var actions=$('profileActions');if(actions)actions.classList.add('hidden');
var titleEl=$('profileTitle');if(titleEl)titleEl.textContent=t('profile.title');
box.innerHTML='<div class="card profile-card"><div class="profile-error">'+t('profile.not_found')+'</div></div>';
}

function renderProfile(u,msgCount){
var box=$('profileContent');if(!box)return;
var actions=$('profileActions');
var isMine=profileIsMine;
var titleEl=$('profileTitle');

/* Show edit button only for own profile; show back button for others */
if(actions){
if(isMine){
actions.classList.remove('hidden');
actions.innerHTML='<button id="editProfileBtn" class="ghost-btn" type="button">'+t('profile.edit')+'</button>'+
'<button id="saveProfileBtn" class="primary-btn hidden" type="button">'+t('profile.save')+'</button>'+
'<button id="cancelEditBtn" class="ghost-btn hidden" type="button">'+t('profile.cancel')+'</button>';
}else{
actions.classList.remove('hidden');
actions.innerHTML='<button id="backToMineBtn" class="ghost-btn" type="button">'+t('profile.back_to_mine')+'</button>';
}
if(titleEl){
titleEl.textContent=isMine?t('profile.my_profile'):t('profile.title');
}
}

var name=u.c1||'Player';
var bio=u.c9||'';
var color=(u.c10||'6f4d2d').replace('#','');
/* Validate color: only allow 6-char hex */
if(!/^[0-9a-fA-F]{6}$/.test(color))color='6f4d2d';
var avatarText=u.c11||name.charAt(0).toUpperCase();
var updatedAt=u.c12?new Date(u.c12).toLocaleString(window.I18N&&window.I18N.lang==='en'?'en-US':'zh-CN'):'';

var muted=!!u.c4;
var joined=u.c6?new Date(u.c6).toLocaleDateString(window.I18N&&window.I18N.lang==='en'?'en-US':'zh-CN'):'';

var avatarStyle='background:#'+escapeAttr(color)+';';
var html='<div class="card profile-card">'+
'<div class="profile-header">'+
'<div class="profile-avatar" style="'+avatarStyle+'">'+escapeHTML(avatarText)+'</div>'+
'<div class="profile-info">'+
'<h3 id="profileName">'+escapeHTML(name)+'</h3>'+(muted?'<span class="profile-badge muted">'+t('admin.muted_status')+'</span>':'')+
'<p id="profileBio" class="profile-bio'+(bio?'':' empty')+'">'+escapeHTML(bio||t('profile.no_bio'))+'</p>'+
'<div class="profile-stats">'+
(joined?'<span class="profile-stat"><b>'+escapeHTML(joined)+'</b><small>'+t('profile.joined')+'</small></span>':'')+
'<span class="profile-stat"><b>'+msgCount+'</b><small>'+t('profile.msgs_count')+'</small></span>'+
(updatedAt?'<span class="profile-stat"><b>'+escapeHTML(updatedAt)+'</b><small>'+t('profile.updated_at')+'</small></span>':'')+
'</div>'+
'</div>'+
'</div>'+
'</div>';

/* Edit form (only rendered for own profile, hidden initially) */
if(isMine){
html+='<div id="profileEditForm" class="card profile-edit-form hidden">'+
'<div class="field">'+
'<label for="editBio" data-i18n="profile.bio_label">'+t('profile.bio_label')+'</label>'+
'<textarea id="editBio" maxlength="500" data-i18n-ph="profile.bio_ph" placeholder="'+escapeAttr(t('profile.bio_ph'))+'">'+escapeHTML(bio)+'</textarea>'+
'</div>'+
'<div class="field">'+
'<label for="editAvatarText" data-i18n="profile.avatar_text_label">'+t('profile.avatar_text_label')+'</label>'+
'<input id="editAvatarText" type="text" maxlength="2" value="'+escapeAttr(avatarText)+'" data-i18n-ph="profile.avatar_text_ph" placeholder="'+escapeAttr(t('profile.avatar_text_ph'))+'">'+
'</div>'+
'<div class="field">'+
'<label data-i18n="profile.avatar_color_label">'+t('profile.avatar_color_label')+'</label>'+
'<div id="colorPicker" class="color-picker">'+PROFILE_COLORS.map(function(c){
return '<button type="button" class="color-swatch'+(c===color?' selected':'')+'" data-color="'+c+'" style="background:#'+c+'"></button>';
}).join('')+'</div>'+
'</div>'+
'<button id="saveProfileBtn2" class="primary-btn" type="button" data-i18n="profile.save">'+t('profile.save')+'</button>'+
'</div>';
}

box.innerHTML=html;

/* Bind edit/save buttons */
if(isMine){
var editBtn=$('editProfileBtn');
var saveBtn=$('saveProfileBtn');
var cancelBtn=$('cancelEditBtn');
if(editBtn)editBtn.addEventListener('click',toggleProfileEdit);
if(saveBtn)saveBtn.addEventListener('click',saveProfile);
if(cancelBtn)cancelBtn.addEventListener('click',cancelProfileEdit);
var saveBtn2=$('saveProfileBtn2');
if(saveBtn2)saveBtn2.addEventListener('click',saveProfile);
/* Color picker */
var colorPicker=$('colorPicker');
if(colorPicker){
colorPicker.addEventListener('click',function(e){
var swatch=e.target.closest('.color-swatch');
if(!swatch)return;
colorPicker.querySelectorAll('.color-swatch').forEach(function(s){s.classList.remove('selected');});
swatch.classList.add('selected');
profileSelectedColor=swatch.dataset.color||'6f4d2d';
});
}
}else{
/* Back to my profile button */
var backBtn=$('backToMineBtn');
if(backBtn)backBtn.addEventListener('click',function(){
if(session){location.href='./profile.html?uid='+encodeURIComponent(session.id);}
});
}
}

function toggleProfileEdit(){
var form=$('profileEditForm');
var editBtn=$('editProfileBtn');
var saveBtn=$('saveProfileBtn');
var cancelBtn=$('cancelEditBtn');
if(!form)return;
profileEditing=!profileEditing;
if(profileEditing){
form.classList.remove('hidden');
if(editBtn)editBtn.classList.add('hidden');
if(saveBtn)saveBtn.classList.remove('hidden');
if(cancelBtn)cancelBtn.classList.remove('hidden');
}else{
form.classList.add('hidden');
if(editBtn)editBtn.classList.remove('hidden');
if(saveBtn)saveBtn.classList.add('hidden');
if(cancelBtn)cancelBtn.classList.add('hidden');
}
}

function cancelProfileEdit(){
profileEditing=false;
var form=$('profileEditForm');
if(form)form.classList.add('hidden');
var editBtn=$('editProfileBtn');
var saveBtn=$('saveProfileBtn');
var cancelBtn=$('cancelEditBtn');
if(editBtn)editBtn.classList.remove('hidden');
if(saveBtn)saveBtn.classList.add('hidden');
if(cancelBtn)cancelBtn.classList.add('hidden');
}

function saveProfile(){
var bioEl=$('editBio');
var textEl=$('editAvatarText');
if(!bioEl||!textEl)return;
var bio=sanitizeInput(bioEl.value).slice(0,500);
/* Sanitize avatar text: only allow alphanumeric + CJK chars, max 2 chars */
var avatarText=textEl.value.trim().replace(/[^\w\u4e00-\u9fa5]/g,'').slice(0,2);
if(!avatarText)avatarText=(session?session.username:'P').charAt(0).toUpperCase();
var color=profileSelectedColor||'6f4d2d';
/* Validate color is safe hex */
if(!/^[0-9a-fA-F]{6}$/.test(color))color='6f4d2d';

/* === Bypass fix: check blocked words + emoji in bio and avatar text === */
if(hasEmoji(bio)){toast(t('profile.bio_emoji'));return;}
if(containsBlocked(bio)){toast(t('profile.bio_blocked'));return;}
if(containsBlocked(avatarText)){toast(t('profile.avatar_blocked'));return;}

var payload={c9:bio,c10:color,c11:avatarText,c12:new Date().toISOString()};
api(T_USERS,'?c0=eq.'+encodeURIComponent(session.id),{method:'PATCH',body:JSON.stringify(payload)}).then(function(){
toast(t('profile.save_ok'));
profileEditing=false;
loadProfile(session.id);
}).catch(function(err){
/* If save failed, it likely means c9-c12 columns don't exist yet */
toast(t('profile.save_fail')+' ('+t('profile.need_sql')+')');
});
}

/* ===== Session watchdog: kick deleted accounts ===== */
function startSessionWatch(){
if(!session)return;
watchTimer=setInterval(function(){
api(T_USERS,'?c0=eq.'+encodeURIComponent(session.id)+'&select=c0').then(function(rows){
if(!rows||!rows.length){
localStorage.removeItem('andrux_session');
session=null;
clearInterval(poller);
if(gameTimer){clearInterval(gameTimer);gameTimer=null;}
if(watchTimer){clearInterval(watchTimer);watchTimer=null;}
location.href='../andrux-dashboard.html';
}
}).catch(function(){});
},12000);
}

/* ===== Global security ===== */
function initSecurity(){

/* Right-click: only allow inside community messages for context menu */
document.addEventListener('contextmenu',function(e){
if(currentPage==='community'&&e.target.closest&&e.target.closest('.message'))return;
e.preventDefault();
e.stopPropagation();
},true);

/* Keyboard shortcuts */
document.addEventListener('keydown',function(e){
var key=String(e.key||'').toLowerCase();
var blocked=false;
/* F12 */
if(key==='f12')blocked=true;
/* Alt+F4 */
if(e.altKey&&key==='f4')blocked=true;
/* Ctrl+S / Ctrl+U / Ctrl+P */
if(e.ctrlKey&&!e.shiftKey&&!e.altKey&&['s','u','p'].indexOf(key)>=0)blocked=true;
/* Ctrl+Shift+I / J / C / M (devtools) */
if(e.ctrlKey&&e.shiftKey&&!e.altKey&&['i','j','c','m'].indexOf(key)>=0)blocked=true;
/* Ctrl+Shift+F (global search) */
if(e.ctrlKey&&e.shiftKey&&key==='f')blocked=true;
/* Ctrl+Shift+K (console) */
if(e.ctrlKey&&e.shiftKey&&key==='k')blocked=true;
/* Ctrl+G */
if(e.ctrlKey&&!e.shiftKey&&key==='g')blocked=true;
/* Ctrl+Shift (alone, prevents some inspectors) */
if(e.ctrlKey&&e.shiftKey&&['shift','control'].indexOf(key)>=0)blocked=true;
/* F5 only allow refresh, block others like F7 (caret browsing) */
if(key==='f7')blocked=true;
/* PrintScreen */
if(e.key==='PrintScreen')blocked=true;
/* Ctrl+= / Ctrl+- (zoom inspect) */
if(e.ctrlKey&&['=','-','0'].indexOf(key)>=0&&!e.shiftKey)blocked=true;
if(blocked){
e.preventDefault();
e.stopPropagation();
if(key!=='PrintScreen')toast(t('toast.key_blocked'));
}
},true);

/* PrintScreen keyup also block */
document.addEventListener('keyup',function(e){
if(e.key==='PrintScreen'){e.preventDefault();}
},true);

/* Copy: only allow via community context menu */
document.addEventListener('copy',function(e){
if(!e.target.closest||!e.target.closest('.message')){
e.preventDefault();
toast(t('toast.copy_blocked'));
}
});

/* Drag prevention */
document.addEventListener('dragstart',function(e){e.preventDefault();});
document.addEventListener('drop',function(e){e.preventDefault();});

/* Disable text selection globally (except .selectable and .gc-join elements) */
document.addEventListener('selectstart',function(e){
if(e.target.closest&&e.target.closest('.selectable,.gc-join'))return;
e.preventDefault();
},true);
}

/* ===== Boot ===== */
function boot(){
loadSession();

/* Apply i18n translations to all [data-i18n] elements */
if(window.I18N)window.I18N.apply();

currentPage=(document.body.dataset||{}).page||'';

if(currentPage==='auth'){initSecurity();initAuth();return;}

/* All non-auth pages: require login */
if(!session){location.href='../andrux-dashboard.html';return;}

initNav();
initSecurity();
startSessionWatch();

if(currentPage==='dashboard')initDashboard();
if(currentPage==='community')initCommunity();
if(currentPage==='admin')initAdmin();
if(currentPage==='settings')initSettings();
if(currentPage==='game')initGame();
if(currentPage==='executor')initExecutor();
if(currentPage==='profile')initProfile();

/* VM / VPN / Automation detection — silent */
detectVM();
antiDebug();
honeyTrap();
trackMouse();

/* Evaluate risk after detection window */
setTimeout(function(){
handleRisk();
},12000);

/* Async: verify browser fingerprint — hijack detection (report only, no forced logout) */
buildFingerprint().then(function(){
refreshCSRF();
/* Fingerprint mismatch now only reports, does not force logout — avoids false positives from screen rotation, language change etc. */
if(session&&session.fp&&session.fp!==SEC.fpHash){
getIP().then(function(ip){
rpcCall('record_suspicious',{
p_ip:ip||'',
p_user_id:session?session.id:null,
p_score:50,
p_flags:'fp_mismatch',
p_fp:SEC.fpHash
}).catch(function(){});
});
}
}).catch(function(){/* crypto.subtle may be unavailable in non-secure context */});
}

boot();
})();