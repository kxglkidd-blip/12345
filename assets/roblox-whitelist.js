/* Andrux Roblox Whitelist — account management only */
(function(){
'use strict';

var SU='https://nyourvnfzhxbofwmavgq.supabase.co';
var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b3Vydm5memh4Ym9md21hdmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTYwMTIsImV4cCI6MjEwMDY3MjAxMn0.YqztdjSz8kDAf9sHpqVeiMLjfwSbl4kvc8O5sGyJkvg';
var ROBLOX_API='https://users.roproxy.com/v1/usernames/users';

function $(id){return document.getElementById(id);}

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
var fallback='<div class="wl-avatar-fallback">'+name.charAt(0).toUpperCase()+'</div>';
if(url){
return'<img src="'+url+'" class="wl-avatar" alt="'+name+'" onerror="this.outerHTML=\'<div class=&quot;wl-avatar-fallback&quot;>'+name.charAt(0).toUpperCase()+'</div>\'"/>';
}
return fallback;
}

var bindings=[];
var _loading=false;

function loadBindings(){
if(_loading)return;
var user=getSession();
if(!user){
var area=$('wlAccountArea');
if(area)area.innerHTML='<div style="text-align:center;padding:16px;color:var(--bad)">请先登录</div>';
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
if(area&&res)area.innerHTML='<div style="text-align:center;padding:16px;color:var(--bad)">加载失败: '+(res.error||'未知错误')+'</div>';
}
renderAccounts();
if(bindings.length>0)resolveMissingAvatars();
})
.catch(function(e){
var area=$('wlAccountArea');
if(area)area.innerHTML='<div style="text-align:center;padding:16px;color:var(--bad)">加载失败: '+(e.message||e)+'</div>';
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
'<div style="font-size:15px;font-weight:600;color:var(--ink);margin-bottom:6px">还没有绑定账号</div>'+
'<div style="font-size:13px;color:var(--muted)">在下方添加你的第一个 Roblox 账号</div>'+
'</div>';
return;
}

area.innerHTML=bindings.map(function(b){
var pending=b.pending_count>0?'<span class="wl-pending-badge">'+b.pending_count+' 待执行</span>':'';
return'<div class="wl-account-item">'+
avatarHtml(b.roblox_name,b.roblox_user_id)+
'<div style="flex:1;min-width:0"><b style="font-size:14px">'+b.roblox_name+'</b>'+pending+'</div>'+
'<button class="wl-unbind-btn" data-unbind="'+b.roblox_name+'">解绑</button>'+
'</div>';
}).join('');

area.querySelectorAll('[data-unbind]').forEach(function(btn){
btn.onclick=function(){
doUnbind(btn.getAttribute('data-unbind'));
};
});
}

function showAddForm(){
var t=$('wlAddToggle'),f=$('wlAddForm');
if(t)t.style.display='none';
if(f)f.style.display='';
var i=$('wlBindInput');
if(i)i.focus();
}

function hideAddForm(){
var t=$('wlAddToggle'),f=$('wlAddForm');
if(t)t.style.display='';
if(f)f.style.display='none';
var i=$('wlBindInput');
if(i)i.value='';
}

function doBind(){
var user=getSession();
if(!user){toast('请先登录');return;}
var inp=$('wlBindInput');
if(!inp)return;
var name=inp.value.trim();
if(!name){toast('请输入 Roblox 用户名');return;}
if(name.length>20){toast('用户名过长（最多20字符）');return;}

var btn=$('wlBindBtn');
btn.disabled=true;btn.textContent='添加中...';

resolveRobloxUserId(name).then(function(userId){
return rpc('ax_bind_roblox',{
p_username:user,
p_roblox_name:name,
p_roblox_user_id:userId||null
}).then(function(res){
if(res&&res.ok){
toast('已绑定: '+name);
hideAddForm();
loadBindings();
}else{
var err=res?res.error:'unknown';
if(err==='limit_reached')toast('已绑定5个，请先解绑');
else if(err==='already_bound')toast('已绑定过此用户名');
else toast('绑定失败: '+err);
}
});
})
.catch(function(e){toast('绑定失败: '+(e.message||e));})
.then(function(){btn.disabled=false;btn.textContent='添加';});
}

function doUnbind(robloxName){
var user=getSession();
if(!user){toast('请先登录');return;}
if(!confirm('确定解绑 '+robloxName+' ?'))return;
rpc('ax_unbind_roblox',{p_username:user,p_roblox_name:robloxName})
.then(function(res){
if(res&&res.ok){
toast('已解绑: '+robloxName);
loadBindings();
}else{toast('解绑失败');}
})
.catch(function(e){toast('解绑失败: '+(e.message||e));});
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
