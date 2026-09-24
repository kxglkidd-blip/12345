/* Andrux Roblox Whitelist — account management only */
(function(){
'use strict';

var SU='https://nyourvnfzhxbofwmavgq.supabase.co';
var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b3Vydm5memh4Ym9md21hdmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTYwMTIsImV4cCI6MjEwMDY3MjAxMn0.YqztdjSz8kDAf9sHpqVeiMLjfwSbl4kvc8O5sGyJkvg';
var ROBLOX_API='https://users.roproxy.com/v1/usernames/users';

function $(id){return document.getElementById(id);}

function t(key){
  if(window.I18N&&typeof window.I18N.t==='function')return window.I18N.t(key);
  return key;
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
return fetch(SU+'/rest/v1/rpc/'+fn,{
method:'POST',
headers:{apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json'},
body:JSON.stringify(body)
}).then(function(r){
if(!r.ok)return r.text().then(function(t){
var msg='HTTP '+r.status;
try{var j=JSON.parse(t);if(j.message)msg=j.message;}catch(e){}
throw new Error(msg);
});
return r.json();
});
}

function resolveRobloxUserId(username){
return fetch(ROBLOX_API,{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({usernames:[username],excludeBannedUsers:false})
}).then(function(r){
if(!r.ok)throw new Error('HTTP '+r.status);
return r.json();
}).then(function(data){
if(data&&data.data&&data.data[0]&&data.data[0].id)return data.data[0].id;
return null;
}).catch(function(){return null;});
}

function getAvatarUrl(userId){
if(!userId)return null;
return'https://www.roblox.com/headshot-thumbnail/image?userId='+userId+'&width=150&height=150&format=png';
}

function avatarHtml(name,userId){
var url=getAvatarUrl(userId);
var initial=name.charAt(0).toUpperCase();
var fallback='<div class="wl-avatar-fallback">'+initial+'</div>';
if(url){
return'<img src="'+url+'" class="wl-avatar" alt="'+name+'" data-initial="'+initial+'" style="display:none"/>';
}
return fallback;
}

function setupAvatarImages(){
var imgs=document.querySelectorAll('#wlAccountArea .wl-avatar');
imgs.forEach(function(img){
if(img._wlBound)return;
img._wlBound=true;
function showFallback(){
var fb=document.createElement('div');
fb.className='wl-avatar-fallback';
fb.textContent=img.getAttribute('data-initial')||'?';
if(img.parentNode)img.parentNode.replaceChild(fb,img);
}
img.addEventListener('load',function(){
img.style.display='';
});
img.addEventListener('error',function(){
showFallback();
});
// If image is already cached and loaded
if(img.complete){
if(img.naturalWidth>0){
img.style.display='';
}else{
showFallback();
}
}
});
}

var bindings=[];
var _loading=false;

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
toast(t('rbx.unbinded')+robloxName);
loadBindings();
}else{toast(t('rbx.unbind_fail'));}
})
.catch(function(e){toast(t('rbx.unbind_fail')+': '+(e.message||e));});
}

var _wlInterval=false;
function init(){
var btn=$('wlBindBtn');
if(!btn)return;
var toggle=$('wlAddToggle');
if(!toggle)return;

toggle.onclick=showAddForm;
var cancel=$('wlCancelAdd');
if(cancel)cancel.onclick=hideAddForm;
btn.onclick=doBind;

// Re-translate static elements that are managed by this JS
var addToggle=$('wlAddToggle');
if(addToggle)addToggle.textContent=t('rbx.add_account');
var bindBtn=$('wlBindBtn');
if(bindBtn)bindBtn.textContent=t('rbx.bind_btn');
var cancelBtn=$('wlCancelAdd');
if(cancelBtn)cancelBtn.textContent=t('misc.cancel');
var bindInput=$('wlBindInput');
if(bindInput)bindInput.setAttribute('placeholder',t('rbx.bind_ph'));

if(!_wlInterval){
_wlInterval=true;
loadBindings();
setInterval(loadBindings,15000);
}
}

if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',init);
}else{init();}
setTimeout(init,1000);
setTimeout(init,3000);

var _obs=new MutationObserver(function(){
setTimeout(init,100);
});
_obs.observe(document.body,{childList:true,subtree:true});
})();
