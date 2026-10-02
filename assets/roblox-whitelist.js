/* Andrux Roblox Whitelist — account management only */
(function(){
'use strict';

var SU='https://nyourvnfzhxbofwmavgq.supabase.co';
var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b3Vydm5memh4Ym9md21hdmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTYwMTIsImV4cCI6MjEwMDY3MjAxMn0.YqztdjSz8kDAf9sHpqVeiMLjfwSbl4kvc8O5sGyJkvg';
/* Roblox's own endpoints send no CORS headers, so they only work in the desktop build,
   where the request is routed through the main process. In a plain browser the lookup has
   to go through a CORS-enabled mirror: roproxy's user service is down, so ff-roproxy and
   rotunnel carry the username lookup, and roproxy still serves the thumbnails route. */
var USER_ID_APIS=[
'https://users.roblox.com/v1/usernames/users',
'https://users.ff-roproxy.com/v1/usernames/users',
'https://users.rotunnel.com/v1/usernames/users'
];
var USER_SEARCH_APIS=[
'https://users.ff-roproxy.com/v1/users/search',
'https://users.rotunnel.com/v1/users/search'
];
var THUMB_DIRECT=[
'https://thumbnails.roblox.com/v1/users/avatar-headshot'
];
var THUMB_CORS=[
'https://thumbnails.roproxy.com/v1/users/avatar-headshot',
'https://thumbnails.ff-roproxy.com/v1/users/avatar-headshot',
'https://thumbnails.rotunnel.com/v1/users/avatar-headshot'
];

function $(id){return document.getElementById(id);}

function t(key){
  if(window.I18N&&typeof window.I18N.t==='function'){
    var v=window.I18N.t(key);
    if(v&&v!==key)return v;
  }
  return key;
}

/* ===== Self-contained i18n application ===== */
function applyI18n(){
  // Static data-i18n elements
  var els=document.querySelectorAll('[data-i18n]');
  for(var i=0;i<els.length;i++){
    var key=els[i].getAttribute('data-i18n');
    var val=t(key);
    if(val&&val!==key){els[i].textContent=val;}
  }
  // data-i18n-ph placeholders
  var phEls=document.querySelectorAll('[data-i18n-ph]');
  for(var j=0;j<phEls.length;j++){
    var pkey=phEls[j].getAttribute('data-i18n-ph');
    var pval=t(pkey);
    if(pval&&pval!==pkey){phEls[j].setAttribute('placeholder',pval);}
  }
}

function getSession(){
try{
var raw=localStorage.getItem('andrux_session');
if(!raw)return null;
var s=JSON.parse(raw);
if(s&&s.username)return s.username;
}catch(e){}
return null;
}

function toast(msg){
var el=$('toast');if(!el)return;
el.textContent=msg;el.classList.add('show');
clearTimeout(toast._t);
toast._t=setTimeout(function(){el.classList.remove('show');},2500);
}

function rpc(fn,body){
var timer;
var timeout=new Promise(function(_,rej){timer=setTimeout(function(){rej(new Error('请求超时'));},8000);});
return Promise.race([fetch(SU+'/rest/v1/rpc/'+fn,{
method:'POST',
headers:{apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json'},
body:JSON.stringify(body)
}),timeout]).then(function(r){clearTimeout(timer);
if(!r.ok)return r.text().then(function(t){
var msg='HTTP '+r.status;
try{var j=JSON.parse(t);if(j.message)msg=j.message;}catch(e){}
throw new Error(msg);
});
return r.json();
});
}

/* Username -> id and id -> headshot both walk a small endpoint list; each call has a hard
   timeout and one retry, and results are cached in memory + localStorage. */
function withTimeout(promise,ms){
return new Promise(function(res,rej){
var timer=setTimeout(function(){rej(new Error('timeout'));},ms);
promise.then(function(v){clearTimeout(timer);res(v);},function(e){clearTimeout(timer);rej(e);});
});
}

function withRetry(fn,times){
return fn().catch(function(e){
if(times<=1)throw e;
return new Promise(function(res){setTimeout(res,900);}).then(function(){return withRetry(fn,times-1);});
});
}

function rbxJson(url,opts,ms){
ms=ms||15000;
var d=window.andruxDesktop;
if(d&&typeof d.robloxJson==='function'){
var o=opts||{};
o.timeout=ms;
return withTimeout(d.robloxJson(url,o),ms);
}
return withTimeout(fetch(url,opts),ms).then(function(r){
if(!r.ok)throw new Error('HTTP '+r.status);
return r.json();
});
}

function loadCache(key){
try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(e){return{};}
}
function saveCache(key,obj){
try{localStorage.setItem(key,JSON.stringify(obj));}catch(e){}
}

/* v4 keys: earlier caches could hold a url from the retired headshot endpoint (a permanent
   broken image) or a username bound to the wrong id, so the old stores are abandoned. */
var _uidCache=loadCache('andrux_rbx_uid_cache_v4');
var _avatarCache=loadCache('andrux_rbx_avatar_cache_v4');

/* Only the desktop build can reach Roblox directly (through the main process); a plain
   browser renderer has no CORS exemption and must use the CORS-enabled search endpoint. */
function hasDesktopProxy(){
return !!(window.andruxDesktop&&typeof window.andruxDesktop.robloxJson==='function');
}

/* Search returns fuzzy matches, so require an exact name match to avoid binding a stranger. */
function searchRobloxUserId(username){
var key=String(username).toLowerCase();
function attempt(i){
return rbxJson(USER_SEARCH_APIS[i]+'?keyword='+encodeURIComponent(username)+'&limit=10',{
headers:{Accept:'application/json'}
},8000).then(function(data){
var list=(data&&data.data)||[];
for(var k=0;k<list.length;k++){
if(String(list[k].name||'').toLowerCase()===key)return list[k].id;
}
throw new Error('not found');
}).catch(function(e){
if(i+1<USER_SEARCH_APIS.length)return attempt(i+1);
throw e;
});
}
return attempt(0);
}

function resolveRobloxUserId(username){
if(!username)return Promise.resolve(null);
var key=String(username).toLowerCase();
if(_uidCache[key])return Promise.resolve(_uidCache[key]);
/* POST usernames/users is an exact lookup, so it is tried before the fuzzy search. A plain
   browser starts at index 1 because Roblox's own host sends no CORS header there and that
   call can only ever fail. */
function postAt(i){
if(i>=USER_ID_APIS.length)return Promise.reject(new Error('not found'));
return rbxJson(USER_ID_APIS[i],{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({usernames:[username],excludeBannedUsers:false})
},8000).then(function(data){
var id=data&&data.data&&data.data[0]&&data.data[0].id;
if(id)return id;
throw new Error('not found');
}).catch(function(){return postAt(i+1);});
}
return postAt(hasDesktopProxy()?0:1).catch(function(){return searchRobloxUserId(username);}).then(function(id){
if(!id)throw new Error('not found');
_uidCache[key]=id;saveCache('andrux_rbx_uid_cache_v4',_uidCache);
return id;
}).catch(function(){return null;});
}

/* The legacy www.roblox.com/headshot-thumbnail endpoint no longer serves images; the
   thumbnails API answers with the real CDN url (tr.rbxcdn.com) instead. */
function fetchAvatarUrl(userId){
if(!userId)return Promise.resolve(null);
var key=String(userId);
if(_avatarCache[key])return Promise.resolve(_avatarCache[key]);
var apis=hasDesktopProxy()?THUMB_DIRECT.concat(THUMB_CORS):THUMB_CORS.concat(THUMB_DIRECT);
function attempt(i){
return rbxJson(apis[i]+'?userIds='+encodeURIComponent(key)+'&size=150x150&format=Png&isCircular=true',{
headers:{Accept:'application/json'}
}).then(function(data){
var item=data&&data.data&&data.data[0];
if(item&&item.imageUrl)return item.imageUrl;
throw new Error('pending');
}).catch(function(e){
if(i+1<apis.length)return attempt(i+1);
throw e;
});
}
return withRetry(function(){return attempt(0);},2).then(function(url){
_avatarCache[key]=url;saveCache('andrux_rbx_avatar_cache_v4',_avatarCache);
return url;
}).catch(function(){return null;});
}

/* The initial renders right away and stays as the visible layer until the real headshot
   loads, so the row never collapses to an empty slot while the request is in flight. */
function avatarHtml(name,userId){
var initial=(name||'?').charAt(0).toUpperCase();
return'<div class="wl-avatar-fallback">'+initial+'</div>'+
'<img class="wl-avatar" alt="'+name+'" data-roblox-name="'+name+'" data-user-id="'+(userId||'')+'" style="display:none"/>';
}

function dropAvatarImg(img){
if(img.parentNode)img.parentNode.removeChild(img);
}
function avatarTries(img){return Number(img.getAttribute('data-tries')||'0');}
function retryAvatar(img){
var tries=avatarTries(img);
/* A transient thumbnail failure must not leave the row stuck on its initial forever:
   retry with backoff, then keep the initial as the fallback. */
if(tries>=3){dropAvatarImg(img);return;}
img.setAttribute('data-tries',String(tries+1));
setTimeout(function(){loadAvatar(img);},700*(tries+1));
}
function forgetAvatar(uid){
if(uid&&_avatarCache[uid]){delete _avatarCache[uid];saveCache('andrux_rbx_avatar_cache_v4',_avatarCache);}
}

/* One attempt: prefer the id stored in the DB, but fall back to resolving it from the
   username so the avatar still shows when the stored id is missing. */
function loadAvatar(img){
if(!img.parentNode)return;
var tries=avatarTries(img);
var uid=img.getAttribute('data-user-id')||'';
var name=img.getAttribute('data-roblox-name')||'';
var getId=uid?Promise.resolve(uid):resolveRobloxUserId(name);
getId.then(function(id){
if(!id)throw new Error('no id');
/* On a retry the cached thumbnail may be the dead one that just failed, so force a re-fetch. */
if(tries>0)forgetAvatar(String(id));
return fetchAvatarUrl(id);
}).then(function(url){
if(!url)throw new Error('no url');
if(img.parentNode)img.src=url;
}).catch(retryAvatar.bind(null,img));
}

function setupAvatarImages(){
var imgs=document.querySelectorAll('#wlAccountArea .wl-avatar');
imgs.forEach(function(img){
if(img._wlBound)return;
img._wlBound=true;
img.addEventListener('load',function(){
img.style.display='';
var fb=img.parentNode?img.parentNode.querySelector('.wl-avatar-fallback'):null;
if(fb)fb.style.display='none';
});
/* The url that just failed is dead, so drop it before the next attempt re-fetches. */
img.addEventListener('error',function(){forgetAvatar(img.getAttribute('data-user-id')||'');retryAvatar(img);});
loadAvatar(img);
});
}

var bindings=[];
var _loading=false;
var _lastSig=null;
function curLang(){try{return localStorage.getItem('andrux_lang')||'';}catch(e){return '';}}

function loadBindings(){
if(_loading)return;
var user=getSession();
if(!user){
var area=$('wlAccountArea');
if(area)area.innerHTML='<div style="text-align:center;padding:16px;color:var(--bad)">'+t('rbx.please_login')+'</div>';
return;
}
_loading=true;
rpc('ax_list_roblox',{p_username:user})
.then(function(res){
if(res&&res.ok){
bindings=res.bindings||[];
}else{
bindings=[];
var area=$('wlAccountArea');
if(area&&res)area.innerHTML='<div style="text-align:center;padding:16px;color:var(--bad)">'+t('rbx.load_fail')+': '+(res.error||'unknown')+'</div>';
}
renderAccounts();
if(bindings.length>0)resolveMissingAvatars();
})
.catch(function(e){
var area=$('wlAccountArea');
if(area)area.innerHTML='<div style="text-align:center;padding:16px;color:var(--bad)">'+t('rbx.load_fail')+': '+(e.message||e)+'</div>';
})
.then(function(){_loading=false;});
}

function resolveMissingAvatars(){
var missing=bindings.filter(function(b){return !b.roblox_user_id;});
if(missing.length===0)return;
missing.forEach(function(b){
resolveRobloxUserId(b.roblox_name).then(function(uid){
if(uid)updateUserId(b.roblox_name,uid);
});
});
}

function updateUserId(robloxName,userId){
var user=getSession();
if(!user)return;
fetch(SU+'/rest/v1/ax_rb?c3=eq.'+encodeURIComponent(robloxName.toLowerCase()),{
method:'PATCH',
headers:{apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json',Prefer:'return=minimal'},
body:JSON.stringify({c6:userId})
}).then(function(){
loadBindings();
}).catch(function(){});
}

function renderAccounts(){
var area=$('wlAccountArea');
var count=$('wlBindCount');
var toggle=$('wlAddToggle');

if(count)count.textContent=bindings.length+'/5';
if(toggle)toggle.style.display=bindings.length>=5?'none':'';

if(!area)return;

/* Only touch the DOM when data or language actually changed */
var sig=curLang()+'|'+JSON.stringify(bindings.map(function(b){return[b.roblox_name,b.roblox_user_id,b.pending_count];}));
if(sig===_lastSig&&area.children.length)return;
_lastSig=sig;

if(bindings.length===0){
area.innerHTML='<div style="text-align:center;padding:20px 0">'+
'<div style="font-size:15px;font-weight:600;color:var(--ink);margin-bottom:6px">'+t('rbx.no_accounts_title')+'</div>'+
'<div style="font-size:13px;color:var(--muted)">'+t('rbx.no_accounts_desc')+'</div>'+
'</div>';
return;
}

area.innerHTML=bindings.map(function(b){
var pending=b.pending_count>0?'<span class="wl-pending-badge">'+b.pending_count+t('rbx.pending_exec')+'</span>':'';
return'<div class="wl-account-item">'+
avatarHtml(b.roblox_name,b.roblox_user_id)+
'<div style="flex:1;min-width:0"><b style="font-size:14px">'+b.roblox_name+'</b>'+pending+'</div>'+
'<button class="wl-unbind-btn" data-unbind="'+b.roblox_name+'">'+t('rbx.unbind')+'</button>'+
'</div>';
}).join('');

area.querySelectorAll('[data-unbind]').forEach(function(btn){
btn.onclick=function(){
doUnbind(btn.getAttribute('data-unbind'));
};
});

setupAvatarImages();
}

function showAddForm(){
var tg=$('wlAddToggle'),f=$('wlAddForm');
if(tg)tg.style.display='none';
if(f)f.style.display='';
var i=$('wlBindInput');
if(i)i.focus();
}

function hideAddForm(){
var tg=$('wlAddToggle'),f=$('wlAddForm');
if(tg)tg.style.display='';
if(f)f.style.display='none';
var i=$('wlBindInput');
if(i)i.value='';
}

function doBind(){
var user=getSession();
if(!user){toast(t('rbx.please_login'));return;}
var inp=$('wlBindInput');
if(!inp)return;
var name=inp.value.trim();
if(!name){toast(t('rbx.empty_name'));return;}
if(name.length>20){toast(t('rbx.name_too_long'));return;}

var btn=$('wlBindBtn');
btn.disabled=true;btn.textContent=t('rbx.binding');

resolveRobloxUserId(name).then(function(userId){
return rpc('ax_bind_roblox',{
p_username:user,
p_roblox_name:name,
p_roblox_user_id:userId||null
}).then(function(res){
if(res&&res.ok){
toast(t('rbx.binded')+name);
hideAddForm();
loadBindings();
}else{
var err=res?res.error:'unknown';
if(err==='limit_reached')toast(t('rbx.limit_reached'));
else if(err==='already_bound')toast(t('rbx.already_bound'));
else toast(t('rbx.bind_fail_prefix')+err);
}
});
})
.catch(function(e){toast(t('rbx.bind_fail_prefix')+(e.message||e));})
.then(function(){btn.disabled=false;btn.textContent=t('rbx.bind_btn');});
}

function doUnbind(robloxName){
var user=getSession();
if(!user){toast(t('rbx.please_login'));return;}
if(!confirm(t('rbx.unbind_confirm')+robloxName+' ?'))return;
rpc('ax_unbind_roblox',{p_username:user,p_roblox_name:robloxName})
.then(function(res){
if(res&&res.ok){
_lastSig=null;
try{var lc=String(robloxName).toLowerCase();var cache=JSON.parse(localStorage.getItem('andrux_rbx_whitelist')||'[]');
localStorage.setItem('andrux_rbx_whitelist',JSON.stringify(cache.filter(function(x){return String(x.username||x.name||'').toLowerCase()!==lc;})));}catch(e){}
bindings=bindings.filter(function(b){return String(b.roblox_name).toLowerCase()!==String(robloxName).toLowerCase();});
toast(t('rbx.unbinded')+robloxName);
loadBindings();
}else{toast(t('rbx.unbind_fail'));}
})
.catch(function(e){toast(t('rbx.unbind_fail')+': '+(e.message||e));});
}

var _wlInterval=false;
var _inited=false;
function init(force){
if(_inited&&!force)return;
var btn=$('wlBindBtn');
if(!btn)return;
var toggle=$('wlAddToggle');
if(!toggle)return;

toggle.onclick=showAddForm;
var cancel=$('wlCancelAdd');
if(cancel)cancel.onclick=hideAddForm;
btn.onclick=doBind;

// Apply i18n to all static and dynamic elements
applyI18n();

// Re-translate static elements that are managed by this JS
var addToggle=$('wlAddToggle');
if(addToggle)addToggle.textContent=t('rbx.add_account');
var bindBtn=$('wlBindBtn');
if(bindBtn)bindBtn.textContent=t('rbx.bind_btn');
var cancelBtn=$('wlCancelAdd');
if(cancelBtn)cancelBtn.textContent=t('misc.cancel');
var bindInput=$('wlBindInput');
if(bindInput)bindInput.setAttribute('placeholder',t('rbx.bind_ph'));

_inited=true;
// Re-render accounts only if language changed (signature check inside)
if(bindings.length>0)renderAccounts();

if(!_wlInterval){
_wlInterval=true;
loadBindings();
setInterval(loadBindings,15000);
}
}

function boot(){init(false);}
if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',boot);
}else{boot();}
/* Fallback retries only until the page elements exist */
setTimeout(boot,500);
setTimeout(boot,2000);

// Re-apply text only when the language changes (no MutationObserver loop)
function onLang(){setTimeout(function(){init(true);},50);}
window.addEventListener('storage',function(e){
if(e.key==='andrux_lang')onLang();
});
window.addEventListener('andrux_lang_change',onLang);
document.addEventListener('i18n:changed',onLang);
})();
