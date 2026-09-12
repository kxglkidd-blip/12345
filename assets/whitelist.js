/* Andrux Roblox Whitelist — bind/unbind + avatar + push to pending queue */
(function(){
'use strict';

var SU='https://nyourvnfzhxbofwmavgq.supabase.co';
var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b3Vydm5memh4Ym9md21hdmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTYwMTIsImV4cCI6MjEwMDY3MjAxMn0.YqztdjSz8kDAf9sHpqVeiMLjfwSbl4kvc8O5sGyJkvg';
var ROBLOX_API='https://users.roproxy.com/v1/usernames/users';

function $(id){return document.getElementById(id);}

function getSession(){
try{
var s=JSON.parse(localStorage.getItem('andrux_session')||'{}');
if(s&&s.username)return s.username;
}catch(e){}
return null;
}

function toast(msg){
var el=$('toast');if(!el)return;
el.textContent=msg;el.classList.add('show');
clearTimeout(toast._t);
toast._t=setTimeout(function(){el.classList.remove('show');},2000);
}

function rpc(fn,body){
return fetch(SU+'/rest/v1/rpc/'+fn,{
method:'POST',
headers:{apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json'},
body:JSON.stringify(body)
}).then(function(r){
if(!r.ok)return r.text().then(function(t){throw new Error(t||('HTTP '+r.status));});
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
if(data&&data.data&&data.data[0]&&data.data[0].id){
return data.data[0].id;
}
return null;
}).catch(function(){return null;});
}

function getAvatarUrl(userId){
if(!userId)return null;
return'https://www.roblox.com/headshot-thumbnail/image?userId='+userId+'&width=150&height=150&format=png';
}

function avatarHtml(name,userId){
var url=getAvatarUrl(userId);
if(url){
return'<img src="'+url+'" width="40" height="40" alt="'+name+'" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;background:var(--rule)" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"/>'+
'<div style="width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;display:none;align-items:center;justify-content:center;font-size:16px;font-weight:600;flex-shrink:0">'+name.charAt(0).toUpperCase()+'</div>';
}
return'<div style="width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;flex-shrink:0">'+name.charAt(0).toUpperCase()+'</div>';
}

var bindings=[];

function loadBindings(){
var user=getSession();
if(!user)return;
rpc('ax_list_roblox',{p_username:user})
.then(function(res){
if(!res||!res.ok)return;
bindings=res.bindings||[];
renderAccounts();
resolveMissingAvatars();
})
.catch(function(){});
}

function resolveMissingAvatars(){
var missing=bindings.filter(function(b){return !b.roblox_user_id;});
if(missing.length===0)return;
missing.forEach(function(b){
resolveRobloxUserId(b.roblox_name).then(function(uid){
if(uid){
updateUserId(b.roblox_name,uid);
}
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
var sel=$('wlRobloxSelect');
var count=$('wlBindCount');
var toggle=$('wlAddToggle');

if(count)count.textContent=bindings.length+'/5';
if(toggle)toggle.style.display=bindings.length>=5?'none':'';

if(sel){
if(bindings.length===0){
sel.innerHTML='<option value="">请先绑定 Roblox 用户名</option>';
}else{
sel.innerHTML=bindings.map(function(b){
return'<option value="'+b.roblox_name+'">'+b.roblox_name+(b.pending_count>0?' ('+b.pending_count+' 待执行)':'')+'</option>';
}).join('');
}
}

if(!area)return;

if(bindings.length===0){
area.innerHTML='<div style="text-align:center;padding:16px 0">'+
'<div style="font-size:15px;font-weight:600;color:var(--ink);margin-bottom:6px">还没有绑定账号</div>'+
'<div style="font-size:13px;color:var(--muted)">在下方添加你的第一个 Roblox 账号</div>'+
'</div>';
return;
}

area.innerHTML=bindings.map(function(b){
var badge=b.pending_count>0?' <span style="font-size:11px;color:var(--accent2)">['+b.pending_count+' 待执行]</span>':'';
return'<div class="wl-account-item" style="display:flex;align-items:center;gap:12px">'+
avatarHtml(b.roblox_name,b.roblox_user_id)+
'<div style="flex:1;min-width:0"><b style="font-size:14px">'+b.roblox_name+'</b>'+badge+'</div>'+
'<button class="mini-btn" data-unbind="'+b.roblox_name+'" style="padding:4px 12px;font-size:12px;border-radius:10px;flex-shrink:0">解绑</button>'+
'</div>';
}).join('');

area.querySelectorAll('[data-unbind]').forEach(function(btn){
btn.addEventListener('click',function(){
doUnbind(btn.getAttribute('data-unbind'));
});
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
return rpc('ax_bind_roblox',{p_username:user,p_roblox_name:name,p_roblox_user_id:userId||null})
.then(function(res){
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

function parseAsset(input){
input=(input||'').trim();
var m=input.match(/^(\d+)([\.:]?[A-Za-z_]\w*)?$/);
if(!m)return null;
return{asset_id:m[1],suffix:m[2]||''};
}

function doPush(){
var user=getSession();
if(!user){toast('请先登录');return;}
var sel=$('wlRobloxSelect');
var inp=$('wlAssetInput');
var st=$('wlStatus');
var btn=$('wlPushBtn');
if(!sel||!inp)return;

var robloxName=sel.value;
if(!robloxName){toast('请选择 Roblox 玩家');return;}

var parsed=parseAsset(inp.value);
if(!parsed){toast('资产 ID 格式错误');return;}

var entry={type:'asset',asset_id:parsed.asset_id,suffix:parsed.suffix,username:robloxName};

btn.disabled=true;btn.textContent='推送中...';
if(st)st.textContent='正在推送到 '+robloxName+' 的队列...';

rpc('ax_push_roblox',{p_username:user,p_roblox_name:robloxName,p_entry:entry})
.then(function(res){
if(res&&res.ok){
toast('已推送到 '+robloxName);
if(st)st.textContent='已推送 → '+robloxName+'。玩家进入服务器后自动执行。';
inp.value='';
loadBindings();
}else{
var err=res?res.error:'unknown';
if(err==='not_bound')toast('该 Roblox 用户名未绑定');
else toast('推送失败: '+err);
if(st)st.textContent='推送失败';
}
})
.catch(function(e){toast('推送失败: '+(e.message||e));if(st)st.textContent='推送失败';})
.then(function(){btn.disabled=false;btn.textContent='推送执行';});
}

var _bound=false;
function init(){
if(_bound)return;
var btn=$('wlBindBtn');
if(!btn)return;
_bound=true;

$('wlAddToggle').addEventListener('click',showAddForm);
$('wlCancelAdd').addEventListener('click',hideAddForm);
btn.addEventListener('click',doBind);

var clr=$('wlClearBtn');
if(clr)clr.addEventListener('click',function(){
var i=$('wlAssetInput'),s=$('wlStatus');
if(i)i.value='';
if(s)s.textContent='已清空';
});

var push=$('wlPushBtn');
if(push)push.addEventListener('click',doPush);

loadBindings();
setInterval(loadBindings,15000);
}

if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',init);
}else{init();}
setTimeout(init,1000);
setTimeout(init,3000);

var _obs=new MutationObserver(function(){
if(!_bound)setTimeout(init,100);
});
_obs.observe(document.body,{childList:true,subtree:true});
})();
