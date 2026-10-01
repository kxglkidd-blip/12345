/* Andrux Patches - Admin IP ban/unban, player list IP lock/unlock */
(function(){
'use strict';
var _d=function(s){return atob(s);};
var SU=_d('aHR0cHM6Ly9ueW91cnZuZnpoeGJvZndtYXZncS5zdXBhYmFzZS5j'+'bw==');
var SK=_d('ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5'+'LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW01NWIzVnlkbTVtZW1oNFltOW1kMjFoZG1keElpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzT0RVd09UWXdNVElzSW1WNGNDSTZNakV3TURZM01qQXhNbjAuWXF6dGRqU3o4a0RBZjlzSHBxVmVpTUxqZndTYmw0a3ZjOE81c0d5Smt2Zw==');

function $(id){return document.getElementById(id);}
function rpcCall(fn,body){return fetch(SU+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){if(!r.ok)return r.text().then(function(t){throw new Error(t||('RPC failed: '+r.status));});return r.status===204?null:r.json();});
}
function toast(msg){var el=$('toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(function(){el.classList.remove('show');},1800);}
function tt(k){return(window.I18N&&window.I18N.t)?window.I18N.t(k):k;}

/* ===== Manual IP ban/unban panel ===== */
function bindAdminIP(){
var banInput=$('manualBanIp');
var banBtn=$('manualBanBtn');
var unbanBtn=$('manualUnbanBtn');
var list=$('bannedIpList');
if(!banBtn||!list)return;
if(banBtn.dataset.bound)return;
banBtn.dataset.bound='1';

function loadBanned(){
fetch(SU+'/rest/v1/banned_ips?select=*&order=created_at.desc',{headers:{apikey:SK,Authorization:'Bearer '+SK}}).then(function(r){return r.json();}).then(function(rows){
if(!rows||!rows.length){list.innerHTML='<div class="notice" style="text-align:center">'+tt('admin.no_banned_ips')+'</div>';return;}
list.innerHTML=rows.map(function(r){
var ip=r.ip||'?';
var by=r.banned_by||'';
return '<div class="admin-item"><div class="admin-item-top"><b>'+ip+'</b><span>'+(by?'By '+by:'')+'</span></div><div class="admin-actions"><button class="mini-btn" data-unban-ip="'+ip+'">'+tt('admin.ip_unban_btn')+'</button></div></div>';
}).join('');
list.querySelectorAll('[data-unban-ip]').forEach(function(b){
b.addEventListener('click',function(){
var ip=b.getAttribute('data-unban-ip');
if(!ip)return;
rpcCall('ax_unban_ip',{p_ip:ip}).then(function(){toast(tt('toast.ip_unbanned')+ip);loadBanned();}).catch(function(e){toast(tt('toast.ip_unban_fail')+e.message);});
});
});
}).catch(function(){list.innerHTML='<div class="notice bad">'+tt('admin.load_fail')+'</div>';});
}

banBtn.addEventListener('click',function(){
var ip=banInput?banInput.value.trim():'';
if(!ip){toast(tt('admin.ip_input_ph'));return;}
var sessStr=localStorage.getItem('andrux_session')||'';
var sess=null;
try{sess=JSON.parse(sessStr);}catch(e){}
var by=sess?sess.username:'';
rpcCall('ax_ban_ip',{p_ip:ip,p_by:by}).then(function(){toast(tt('toast.ip_banned')+ip);if(banInput)banInput.value='';loadBanned();}).catch(function(e){toast(tt('toast.ip_ban_fail')+e.message);});
});

if(unbanBtn){
unbanBtn.addEventListener('click',function(){
var ip=banInput?banInput.value.trim():'';
if(!ip){toast(tt('admin.ip_unban_input'));return;}
rpcCall('ax_unban_ip',{p_ip:ip}).then(function(){toast(tt('toast.ip_unbanned')+ip);if(banInput)banInput.value='';loadBanned();}).catch(function(e){toast(tt('toast.ip_unban_fail')+e.message);});
});
}

var refreshBtn=$('refreshBannedIps');
if(refreshBtn)refreshBtn.addEventListener('click',loadBanned);
loadBanned();
}

/* Debounced admin IP binding */
var _adminBound=false;
function tryBindAdminIP(){
if(_adminBound)return;
if($('manualBanBtn')&&$('bannedIpList')){
_adminBound=true;
bindAdminIP();
if(amObs)amObs.disconnect();
}
}
var _amTimer=null;
var amObs=new MutationObserver(function(){
if(_amTimer)clearTimeout(_amTimer);
_amTimer=setTimeout(tryBindAdminIP,200);
});
amObs.observe(document.body,{childList:true,subtree:true});
setTimeout(tryBindAdminIP,500);
setTimeout(tryBindAdminIP,2000);

/* ===== Player list IP lock/unlock injection ===== */
var ipCache={};
var ipTable='ax_u7';
var _ipLoaded=false;

function loadIPs(cb){
fetch(SU+'/rest/v1/'+ipTable+'?select=c0,c8',{headers:{apikey:SK,Authorization:'Bearer '+SK}}).then(function(r){return r.json();}).then(function(rows){
ipCache={};
if(rows)rows.forEach(function(r){if(r.c8)ipCache[r.c0]=r.c8;});
_ipLoaded=true;
if(cb)cb();
}).catch(function(){});
}

function injectIPButtons(){
var container=$('adminUsers');
if(!container)return;
var items=container.children;
if(!items||!items.length)return;
if(!_ipLoaded)loadIPs();
for(var i=0;i<items.length;i++){
var item=items[i];
if(item.nodeType!==1)continue;
if(item.dataset.ipInjected)continue;
var nameEl=item.querySelector('b');
if(!nameEl)continue;
var uid=item.getAttribute('data-id')||null;
if(!uid){
var dEl=item.querySelector('[data-uid],[data-user-id],[data-name]');
if(dEl)uid=dEl.getAttribute('data-uid')||dEl.getAttribute('data-user-id')||dEl.getAttribute('data-name');
}
if(!uid)continue;
item.dataset.ipInjected='1';
var ip=ipCache[uid]||'';
var ipDisplay=ip||tt('admin.no_ip');
var actionsEl=null;
var btnContainers=item.querySelectorAll('div');
for(var j=btnContainers.length-1;j>=0;j--){
if(btnContainers[j].querySelector('button')){actionsEl=btnContainers[j];break;}
}
if(!actionsEl)actionsEl=item;
var wrapper=document.createElement('div');
wrapper.style.cssText='display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;';
var lockBtn=document.createElement('button');
lockBtn.className='mini-btn danger';
lockBtn.setAttribute('data-ip',ip);
lockBtn.setAttribute('data-lock-uid',uid);
lockBtn.textContent=tt('admin.lock_ip')+'('+ipDisplay+')';
var unbtn=document.createElement('button');
unbtn.className='mini-btn';
unbtn.setAttribute('data-ip',ip);
unbtn.setAttribute('data-unlock-uid',uid);
unbtn.textContent=tt('admin.unlock_ip')+'('+ipDisplay+')';
wrapper.appendChild(lockBtn);
wrapper.appendChild(unbtn);
actionsEl.appendChild(wrapper);
}
}

/* Debounced IP button injection */
var _injTimer=null;
var injectObs=new MutationObserver(function(){
if(_injTimer)clearTimeout(_injTimer);
_injTimer=setTimeout(injectIPButtons,200);
});
injectObs.observe(document.body,{childList:true,subtree:true});

document.addEventListener('click',function(e){
var lockBtn=e.target.closest('[data-lock-uid]');
var unlockBtn=e.target.closest('[data-unlock-uid]');
if(lockBtn){
e.preventDefault();e.stopPropagation();
var ip=lockBtn.getAttribute('data-ip');
if(!ip||!ip.trim()){toast(tt('admin.no_ip_lock'));return;}
var sessStr=localStorage.getItem('andrux_session')||'';
var sess=null;
try{sess=JSON.parse(sessStr);}catch(ex){}
var by=sess?sess.username:'';
if(!confirm(tt('admin.confirm_lock_ip')+' '+ip+' ?'))return;
rpcCall('ax_ban_ip',{p_ip:ip,p_by:by}).then(function(){toast(tt('toast.ip_locked')+ip);}).catch(function(err){toast(tt('toast.ip_lock_fail')+err.message);});
return;
}
if(unlockBtn){
e.preventDefault();e.stopPropagation();
var ip=unlockBtn.getAttribute('data-ip');
if(!ip||!ip.trim()){toast(tt('admin.no_ip_unlock'));return;}
if(!confirm(tt('admin.confirm_unlock_ip')+' '+ip+' ?'))return;
rpcCall('ax_unban_ip',{p_ip:ip}).then(function(){toast(tt('toast.ip_unlocked')+ip);}).catch(function(err){toast(tt('toast.ip_unlock_fail')+err.message);});
return;
}
});

/* ===== Player rename feature ===== */
/* ax_u7 columns: c0=UUID, c1=username, c2=normalized_username(lowercase), c3=password_hash */
/* ax_m9 columns: c0=msg_id, c1=user_id(UUID), c2=username(cached) */
var renameStore=[];
try{renameStore=JSON.parse(localStorage.getItem('andrux_renames')||'[]');}catch(e){renameStore=[];}
function saveRenames(){try{localStorage.setItem('andrux_renames',JSON.stringify(renameStore));}catch(e){}}

function patchTable(table,filter,body){
return fetch(SU+'/rest/v1/'+table+'?'+filter,{method:'PATCH',headers:{apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(body)}).then(function(r){
if(!r.ok)return r.text().then(function(t){
var msg=t||('PATCH failed: '+r.status);
try{var j=JSON.parse(t);if(j&&j.message)msg=j.message;}catch(e){}
if(msg.indexOf('username_check')!==-1||msg.indexOf('normalized')!==-1||msg.indexOf('chars_valid')!==-1||msg.indexOf('no_repeat')!==-1){
if(msg.indexOf('no_repeat')!==-1){
msg=tt('val.username_repeat');
}else{
msg=tt('val.username_chars');
}
}else if(msg.indexOf('unique')!==-1||msg.indexOf('duplicate')!==-1){
msg=tt('admin.rename_exists');
}
throw new Error(msg);
});
return r.status===204?null:r.json();
});
}

/* Check if normalized name already exists (excluding current user) */
function checkNameExists(name,excludeUuid){
var normalized=name.toLowerCase();
var filter='c2=eq.'+encodeURIComponent(normalized)+'&c0=neq.'+encodeURIComponent(excludeUuid);
return fetch(SU+'/rest/v1/ax_u7?select=c0&'+filter,{headers:{apikey:SK,Authorization:'Bearer '+SK}}).then(function(r){return r.json();}).then(function(rows){
return !!(rows&&rows.length>0);
}).catch(function(){return false;});
}

/* Update sidebar + session for the renamed user (matches by id OR username) */
function applySessionRename(uuid,oldName,newName){
var isCurrentUser=false;
try{
var sess=JSON.parse(localStorage.getItem('andrux_session')||'{}');
if(sess.id===uuid||sess.username===oldName){
sess.username=newName;
localStorage.setItem('andrux_session',JSON.stringify(sess));
isCurrentUser=true;
}
}catch(e){}
if(!isCurrentUser)return;
/* Update sidebar at multiple intervals to catch async re-renders by page-app.js */
function upd(){
var su=$('sideUsername');
if(su)su.textContent=newName;
document.querySelectorAll('[data-display-username]').forEach(function(el){
el.textContent=newName;
});
/* Also update mobile bar if present */
var mb=document.querySelector('.mobile-bar strong');
if(mb&&mb.textContent!==newName){
/* Only update if it looks like it's showing the username, not "Andrux" */
if(mb.textContent===oldName)mb.textContent=newName;
}
}
upd();
setTimeout(upd,100);
setTimeout(upd,300);
setTimeout(upd,800);
setTimeout(upd,1500);
}

/* Rename: patch c1(username)+c2(normalized_username) in ax_u7 + c2(cached) in ax_m9 */
function doRename(uuid,oldName,newName){
return checkNameExists(newName,uuid).then(function(exists){
if(exists)throw new Error(tt('admin.rename_exists'));
/* Update both c1 (username) and c2 (normalized_username = lowercased) */
return patchTable('ax_u7','c0=eq.'+encodeURIComponent(uuid),{c1:newName,c2:newName.toLowerCase()});
}).then(function(){
/* Update all messages by this user — c1 in ax_m9 = user UUID, c2 = cached username */
return patchTable('ax_m9','c1=eq.'+encodeURIComponent(uuid),{c2:newName}).catch(function(){});
}).then(function(){
renameStore.push({uuid:uuid,oldName:oldName,newName:newName,time:Date.now()});
saveRenames();
applySessionRename(uuid,oldName,newName);
return newName;
});
}

/* Restore: patch c1+c2 back to oldName + c2 in messages */
function doRestore(uuid,oldName){
return patchTable('ax_u7','c0=eq.'+encodeURIComponent(uuid),{c1:oldName,c2:oldName.toLowerCase()}).then(function(){
return patchTable('ax_m9','c1=eq.'+encodeURIComponent(uuid),{c2:oldName}).catch(function(){});
}).then(function(){
for(var i=0;i<renameStore.length;i++){
if(renameStore[i].uuid===uuid){renameStore.splice(i,1);break;}
}
saveRenames();
applySessionRename(uuid,oldName,oldName);
return oldName;
});
}

function wasRenamed(uuid){
for(var i=0;i<renameStore.length;i++){
if(renameStore[i].uuid===uuid)return renameStore[i];
}
return null;
}

function injectRenameButton(item,uid,nameEl){
if(item.dataset.renameInjected)return;
item.dataset.renameInjected='1';
var actionsEl=null;
var btnContainers=item.querySelectorAll('div');
for(var j=btnContainers.length-1;j>=0;j--){
if(btnContainers[j].querySelector('button')){actionsEl=btnContainers[j];break;}
}
if(!actionsEl)actionsEl=item;
var wrapper=document.createElement('div');
wrapper.style.cssText='display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;';
var renameBtn=document.createElement('button');
renameBtn.className='mini-btn';
renameBtn.setAttribute('data-rename-uid',uid);
renameBtn.textContent=tt('admin.rename');
wrapper.appendChild(renameBtn);
/* Check if this user was renamed — show restore button */
var info=wasRenamed(uid);
if(info){
var restoreBtn=document.createElement('button');
restoreBtn.className='mini-btn';
restoreBtn.setAttribute('data-restore-uid',uid);
restoreBtn.setAttribute('data-restore-oldname',info.oldName);
restoreBtn.textContent=tt('admin.rename_restore')+'('+info.oldName+')';
wrapper.appendChild(restoreBtn);
}
actionsEl.appendChild(wrapper);
}

document.addEventListener('click',function(e){
var renameBtn=e.target.closest('[data-rename-uid]');
var restoreBtn=e.target.closest('[data-restore-uid]');
if(renameBtn){
e.preventDefault();e.stopPropagation();
var uid=renameBtn.getAttribute('data-rename-uid');
var item=renameBtn.closest('[data-id]')||renameBtn.closest('.admin-item');
if(!item)return;
var nameEl=item.querySelector('b');
if(!nameEl)return;
var currentName=nameEl.textContent;
/* Replace name display with inline input */
var inputWrap=document.createElement('div');
inputWrap.style.cssText='display:flex;gap:4px;align-items:center;margin-top:4px;';
var input=document.createElement('input');
input.type='text';
input.value=currentName;
input.maxLength=24;
input.className='admin-mini-input';
input.style.cssText='flex:1;min-width:120px;';
input.placeholder=tt('admin.rename_ph');
var confirmBtn=document.createElement('button');
confirmBtn.className='mini-btn';
confirmBtn.textContent=tt('admin.rename_confirm');
var cancelBtn=document.createElement('button');
cancelBtn.className='mini-btn';
cancelBtn.textContent=tt('admin.rename_cancel');
inputWrap.appendChild(input);
inputWrap.appendChild(confirmBtn);
inputWrap.appendChild(cancelBtn);
/* Hide original name and buttons */
nameEl.style.display='none';
var oldWrapper=renameBtn.parentNode;
oldWrapper.style.display='none';
item.insertBefore(inputWrap,item.firstChild);
input.focus();
input.select();
function cleanup(){
inputWrap.remove();
nameEl.style.display='';
oldWrapper.style.display='';
}
cancelBtn.addEventListener('click',cleanup);
confirmBtn.addEventListener('click',function(){
var newName=input.value.trim();
if(!newName){toast(tt('admin.rename_empty'));return;}
if(newName===currentName){toast(tt('admin.rename_same'));return;}
confirmBtn.disabled=true;
confirmBtn.textContent='...';
doRename(uid,currentName,newName).then(function(){
toast(tt('admin.rename_success')+currentName+' \u2192 '+newName);
nameEl.textContent=newName;
cleanup();
/* Refresh the list after a delay */
setTimeout(function(){if($('adminRefreshUsers'))$('adminRefreshUsers').click();},500);
}).catch(function(err){
toast(tt('admin.rename_fail')+(err.message||''));
confirmBtn.disabled=false;
confirmBtn.textContent=tt('admin.rename_confirm');
});
});
input.addEventListener('keydown',function(ev){
if(ev.key==='Enter'){ev.preventDefault();confirmBtn.click();}
if(ev.key==='Escape'){ev.preventDefault();cleanup();}
});
return;
}
if(restoreBtn){
e.preventDefault();e.stopPropagation();
var rUid=restoreBtn.getAttribute('data-restore-uid');
var oldName=restoreBtn.getAttribute('data-restore-oldname');
if(!rUid||!oldName)return;
restoreBtn.disabled=true;
restoreBtn.textContent='...';
doRestore(rUid,oldName).then(function(){
toast(tt('admin.restore_success')+oldName);
setTimeout(function(){if($('adminRefreshUsers'))$('adminRefreshUsers').click();},500);
}).catch(function(err){
toast(tt('admin.restore_fail')+(err.message||''));
restoreBtn.disabled=false;
restoreBtn.textContent=tt('admin.rename_restore');
});
return;
}
});

/* ===== Custom title (头衔) feature ===== */
/* ax_u7 columns: c0=UUID, c1=username, c7=title */
var titleCache={}; /* uuid -> title */
var titleByName={}; /* username(lowercase) -> title */
var _titleLoaded=false;
var _titleRetryCount=0;

function loadTitles(cb){
fetch(SU+'/rest/v1/ax_u7?select=c0,c1,c7',{headers:{apikey:SK,Authorization:'Bearer '+SK}}).then(function(r){
if(!r.ok)throw new Error('HTTP '+r.status);
return r.json();
}).then(function(rows){
titleCache={};
titleByName={};
if(rows&&rows.length){
rows.forEach(function(r){
var t=r.c7||'';
if(t){
titleCache[r.c0]=t;
if(r.c1)titleByName[r.c1.toLowerCase()]=t;
}
});
}
_titleLoaded=true;
_titleRetryCount=0;
if(cb)cb();
}).catch(function(e){
_titleRetryCount++;
if(_titleRetryCount<5){
setTimeout(function(){loadTitles(cb);},2000*_titleRetryCount);
}
});
}

/* Set title via PATCH */
function doSetTitle(uuid,title){
var body={c7:title};
return patchTable('ax_u7','c0=eq.'+encodeURIComponent(uuid),body).then(function(){
if(title){
titleCache[uuid]=title;
}else{
delete titleCache[uuid];
}
/* Update name cache */
loadTitles();
return title;
});
}

/* Inject title button in admin user list */
function injectTitleButton(item,uid,nameEl){
if(item.dataset.titleInjected)return;
item.dataset.titleInjected='1';
var actionsEl=null;
var btnContainers=item.querySelectorAll('div');
for(var j=btnContainers.length-1;j>=0;j--){
if(btnContainers[j].querySelector('button')){actionsEl=btnContainers[j];break;}
}
if(!actionsEl)actionsEl=item;
/* Find or create wrapper */
var wrapper=actionsEl.lastElementChild;
if(!wrapper||!wrapper.style||wrapper.style.cssText.indexOf('flex-wrap')===-1){
wrapper=document.createElement('div');
wrapper.style.cssText='display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;';
actionsEl.appendChild(wrapper);
}
var titleBtn=document.createElement('button');
titleBtn.className='mini-btn';
titleBtn.setAttribute('data-title-uid',uid);
var curTitle=titleCache[uid]||'';
titleBtn.textContent=tt('admin.title_btn')+(curTitle?':'+curTitle:'');
wrapper.appendChild(titleBtn);
}

/* Title set/clear handler */
document.addEventListener('click',function(e){
var titleBtn=e.target.closest('[data-title-uid]');
if(!titleBtn)return;
e.preventDefault();e.stopPropagation();
var uid=titleBtn.getAttribute('data-title-uid');
var item=titleBtn.closest('[data-id]')||titleBtn.closest('.admin-item');
if(!item)return;
var nameEl=item.querySelector('b');
var currentName=nameEl?nameEl.textContent:'';
var currentTitle=titleCache[uid]||'';
/* Build inline input */
var inputWrap=document.createElement('div');
inputWrap.style.cssText='display:flex;gap:4px;align-items:center;margin-top:4px;';
var input=document.createElement('input');
input.type='text';
input.value=currentTitle;
input.maxLength=12;
input.className='admin-mini-input';
input.style.cssText='flex:1;min-width:100px;';
input.placeholder=tt('admin.title_ph');
var okBtn=document.createElement('button');
okBtn.className='mini-btn';
okBtn.textContent=tt('admin.title_confirm');
var clrBtn=document.createElement('button');
clrBtn.className='mini-btn danger';
clrBtn.textContent=tt('admin.title_clear');
var cancelBtn=document.createElement('button');
cancelBtn.className='mini-btn';
cancelBtn.textContent=tt('admin.rename_cancel');
inputWrap.appendChild(input);
inputWrap.appendChild(okBtn);
inputWrap.appendChild(clrBtn);
inputWrap.appendChild(cancelBtn);
titleBtn.style.display='none';
item.insertBefore(inputWrap,item.firstChild);
input.focus();
input.select();
function cleanup(){
inputWrap.remove();
titleBtn.style.display='';
}
cancelBtn.addEventListener('click',cleanup);
clrBtn.addEventListener('click',function(){
clrBtn.disabled=true;
clrBtn.textContent='...';
doSetTitle(uid,'').then(function(){
toast(tt('admin.title_cleared')+currentName);
cleanup();
setTimeout(function(){if($('adminRefreshUsers'))$('adminRefreshUsers').click();},500);
}).catch(function(err){
toast(tt('admin.title_fail')+(err.message||''));
clrBtn.disabled=false;
clrBtn.textContent=tt('admin.title_clear');
});
});
okBtn.addEventListener('click',function(){
var newTitle=input.value.trim();
if(newTitle===currentTitle){cleanup();return;}
if(newTitle.length>12){toast(tt('admin.title_too_long'));return;}
okBtn.disabled=true;
okBtn.textContent='...';
doSetTitle(uid,newTitle).then(function(){
toast(tt('admin.title_success')+currentName+': '+newTitle);
cleanup();
setTimeout(function(){if($('adminRefreshUsers'))$('adminRefreshUsers').click();},500);
}).catch(function(err){
toast(tt('admin.title_fail')+(err.message||''));
okBtn.disabled=false;
okBtn.textContent=tt('admin.title_confirm');
});
});
input.addEventListener('keydown',function(ev){
if(ev.key==='Enter'){ev.preventDefault();okBtn.click();}
if(ev.key==='Escape'){ev.preventDefault();cleanup();}
});
});

/* ===== Community message title injection ===== */
function makeBadge(title){
var badge=document.createElement('span');
badge.className='title-badge';
badge.textContent=title;
badge.style.cssText='display:inline-block;font-size:10px;font-weight:600;padding:1px 5px;margin-right:4px;border-radius:3px;background:linear-gradient(135deg,#6f4d2d,#9a7b4f);color:#fff;vertical-align:middle;letter-spacing:0.5px;white-space:nowrap;';
return badge;
}

function injectMessageTitles(){
var chatLog=$('chatLog');
if(!chatLog)return;
if(!_titleLoaded)return;
/* Find all <b> elements inside chatLog that are usernames */
var bEls=chatLog.querySelectorAll('b');
for(var i=0;i<bEls.length;i++){
var b=bEls[i];
/* Skip if badge already exists right before this <b> */
if(b.previousElementSibling&&b.previousElementSibling.classList&&b.previousElementSibling.classList.contains('title-badge'))continue;
var name=b.textContent.trim();
if(!name||name.length<1||name.length>24)continue;
var title=titleByName[name.toLowerCase()];
if(!title)continue;
b.parentNode.insertBefore(makeBadge(title),b);
}
}

/* Inject title on profile page + sidebar (all pages) */
function injectProfileTitle(){
/* 1. Sidebar username (<b id="sideUsername">) */
var su=$('sideUsername');
if(su){
var sName=su.textContent.replace(/\s+/g,' ').trim();
/* textContent includes badge text if present, so strip it */
var oldSB=su.querySelector('.title-badge');
if(oldSB){
sName=su.firstChild.textContent.replace(/\s+/g,' ').trim();
}
var sTitle=titleByName[sName.toLowerCase()];
if(sTitle){
if(oldSB&&oldSB.textContent===sTitle){
/* Already correct, do nothing */
}else{
if(oldSB)oldSB.remove();
var sb=makeBadge(sTitle);
sb.style.marginRight='0';
sb.style.marginLeft='4px';
su.appendChild(sb);
}
}else{
if(oldSB)oldSB.remove();
}
}
/* 2. Profile page name (<h3 id="profileName">) */
var pn=$('profileName');
if(pn){
var pName=pn.textContent.replace(/\s+/g,' ').trim();
var oldPB=pn.querySelector('.title-badge');
if(oldPB){
pName=pn.firstChild.textContent.replace(/\s+/g,' ').trim();
}
var pTitle=titleByName[pName.toLowerCase()];
if(pTitle){
if(oldPB&&oldPB.textContent===pTitle){
/* Already correct, do nothing */
}else{
if(oldPB)oldPB.remove();
var pb=makeBadge(pTitle);
pb.style.fontSize='13px';
pb.style.padding='2px 8px';
pb.style.marginLeft='6px';
pn.appendChild(pb);
}
}else{
if(oldPB)oldPB.remove();
}
}
}

/* Watch for DOM changes to inject titles */
var _titleObs=new MutationObserver(function(){
if(_titleTimer)clearTimeout(_titleTimer);
_titleTimer=setTimeout(function(){
injectMessageTitles();
injectProfileTitle();
},200);
});
var _titleTimer=null;
_titleObs.observe(document.body,{childList:true,subtree:true});

/* Inject rename + title buttons alongside IP buttons */
var _origInject=injectIPButtons;
injectIPButtons=function(){
_origInject.apply(this,arguments);
var container=$('adminUsers');
if(!container)return;
var items=container.children;
for(var i=0;i<items.length;i++){
var item=items[i];
if(item.nodeType!==1)continue;
var nameEl=item.querySelector('b');
if(!nameEl)continue;
var uid=item.getAttribute('data-id');
if(!uid){
var dEl=item.querySelector('[data-uid],[data-user-id],[data-name]');
if(dEl)uid=dEl.getAttribute('data-uid')||dEl.getAttribute('data-user-id')||dEl.getAttribute('data-name');
}
if(!uid)continue;
injectRenameButton(item,uid,nameEl);
injectTitleButton(item,uid,nameEl);
}
};

setTimeout(function(){loadIPs(function(){injectIPButtons();});},800);
setTimeout(function(){loadTitles(function(){injectMessageTitles();injectProfileTitle();});},1000);
setTimeout(injectIPButtons,2500);
setTimeout(injectIPButtons,5000);
setTimeout(function(){loadTitles(function(){injectMessageTitles();injectProfileTitle();});},4000);

/* ===== Game Page Fixes: broken cover images + offline player count zero ===== */
(function(){
'use strict';

function fixGameCard(card){
  if(!card||card._gxFixed)return;
  card._gxFixed=true;

  /* 1. Broken cover image -> fall back to no-bg mode */
  var bg=card.querySelector('.gc-bg');
  if(bg){
    var bgUrl=bg.style.backgroundImage||'';
    if(bgUrl&&bgUrl!=='none'){
      var m=bgUrl.match(/url\(["']?([^"')]+)["']?\)/);
      if(m&&m[1]){
        var img=new Image();
        img.onerror=function(){
          card.classList.remove('gc-has-bg');
          card.classList.add('gc-no-bg');
          if(bg)bg.style.backgroundImage='';
        };
        img.src=m[1];
      }
    }
  }

  /* 2. Offline games -> force player count to 0 */
  if(card.classList.contains('gc-offline')||card.classList.contains('offline')){
    var pn=card.querySelector('.gc-player-num');
    if(pn)pn.textContent='0';
  }
}

function scanAndFix(){
  var cards=document.querySelectorAll('.gc');
  for(var i=0;i<cards.length;i++){fixGameCard(cards[i]);}
}

var _gxObs=new MutationObserver(function(){
  clearTimeout(_gxObs._t);
  _gxObs._t=setTimeout(scanAndFix,150);
});
_gxObs.observe(document.body,{childList:true,subtree:true});

setTimeout(scanAndFix,500);
setTimeout(scanAndFix,1500);
setTimeout(scanAndFix,3000);
setInterval(scanAndFix,10000);
})();



})();
