/* ===== Andrux Dashboard v2 =====
   - Reads live game data from Supabase (fixes "暂无游戏" bug)
   - Reads whitelist bindings from Supabase (fixes "暂无更改记录" bug)
   - Stats: live games, total players, execution count
   - Random game launch
   - Roblox username binding
*/
(function(){
'use strict';

var SU='https://nyourvnfzhxbofwmavgq.supabase.co';
var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b3Vydm5memh4Ym9md21hdmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTYwMTIsImV4cCI6MjEwMDY3MjAxMn0.YqztdjSz8kDAf9sHpqVeiMLjfwSbl4kvc8O5sGyJkvg';
var ROBLOX_API='https://users.roproxy.com/v1/usernames/users';

function $(id){return document.getElementById(id);}

function t(key){
  if(window.I18N&&typeof window.I18N.t==='function'){
    var v=window.I18N.t(key);
    if(v&&v!==key)return v;
  }
  return key;
}

function toast(msg){
  var el=$('toast');
  if(!el)return;
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t=setTimeout(function(){el.classList.remove('show');},2500);
}

function getSession(){
  try{
    var s=JSON.parse(localStorage.getItem('andrux_session')||'{}');
    if(s&&s.username)return s.username;
  }catch(e){}
  return null;
}

function rpc(fn,body){
  return fetch(SU+'/rest/v1/rpc/'+fn,{
    method:'POST',
    headers:{apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  }).then(function(r){
    if(!r.ok)return r.text().then(function(txt){
      var msg='HTTP '+r.status;
      try{var j=JSON.parse(txt);if(j.message)msg=j.message;}catch(e){}
      throw new Error(msg);
    });
    return r.status===204?null:r.json();
  });
}

function apiGet(path){
  return fetch(SU+'/rest/v1/'+path,{
    headers:{apikey:SK,Authorization:'Bearer '+SK}
  }).then(function(r){
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.json();
  });
}

function fmtNum(n){
  if(n==null||isNaN(n))return '0';
  return Number(n).toLocaleString('en-US');
}

/* ===== State ===== */
var onlineGames=[];
var totalPlayers=0;
var execCount=0;
var _loading=false;

/* ===== Load games from Supabase (BUG FIX: was reading localStorage only) ===== */
/* Filter: status=online AND hidden=false AND heartbeat within 5 min (truly online) */
var STALE_MS=5*60*1000; /* 5 minutes without heartbeat = offline */
function isGameAlive(g){
  if(!g||g.status!=='online')return false;
  if(!g.last_heartbeat)return false;
  var hb=new Date(g.last_heartbeat).getTime();
  if(isNaN(hb))return false;
  return (Date.now()-hb)<=STALE_MS;
}
function loadGames(){
  return apiGet('game_status?select=*&status=eq.online&hidden=eq.false&order=last_heartbeat.desc')
  .then(function(rows){
    /* Frontend safety: even if DB says online, stale heartbeat counts as offline */
    var alive=(rows||[]).filter(isGameAlive);
    onlineGames=alive;
    totalPlayers=0;
    for(var i=0;i<onlineGames.length;i++){
      totalPlayers+=(onlineGames[i].player_count||0);
    }
    // Also cache to localStorage for other pages that still read from there
    try{
      var allGames=onlineGames.map(function(g){
        return{
          id:g.id,
          place_id:g.place_id,
          name:g.game_name||g.place_id,
          is_online:true,
          player_count:g.player_count||0,
          max_players:g.max_players||0,
          join_url:g.join_url,
          description:g.description||'',
          cover_image_url:g.cover_image_url||'',
          last_heartbeat:g.last_heartbeat
        };
      });
      localStorage.setItem('andrux_game_list',JSON.stringify(allGames));
    }catch(e){}
    renderMetrics();
    renderLaunchInfo();
  })
  .catch(function(err){
    console.warn('Dashboard: failed to load games',err);
    // Fallback: try localStorage (also filter by heartbeat)
    try{
      var raw=localStorage.getItem('andrux_game_list');
      if(raw){
        var cached=JSON.parse(raw)||[];
        onlineGames=cached.filter(function(g){
          if(!g.is_online)return false;
          if(g.last_heartbeat){
            var hb=new Date(g.last_heartbeat).getTime();
            if(!isNaN(hb)&&(Date.now()-hb)>STALE_MS)return false;
          }
          return true;
        });
        totalPlayers=0;
        for(var i=0;i<onlineGames.length;i++){totalPlayers+=(onlineGames[i].player_count||0);}
      }
    }catch(e){}
    renderMetrics();
    renderLaunchInfo();
  });
}

/* ===== Load execution count from Supabase (uses ax_exec_total RPC) ===== */
function loadExecCount(){
  return rpc('ax_exec_total',{})
  .then(function(res){
    if(typeof res==='number'){
      execCount=res;
    }else if(res&&typeof res==='object'&&res.total!=null){
      execCount=parseInt(res.total,10)||0;
    }else{
      execCount=0;
    }
    // Never show less than what this device has already executed
    try{
      var local=parseInt(localStorage.getItem('andrux_total_execs')||'0',10)||0;
      if(local>execCount)execCount=local;
      else localStorage.setItem('andrux_total_execs',String(execCount));
    }catch(e){}
    renderMetrics();
  })
  .catch(function(){
    // Fallback to localStorage
    try{
      execCount=parseInt(localStorage.getItem('andrux_total_execs')||'0',10)||0;
    }catch(e){execCount=0;}
    renderMetrics();
  });
}

/* ===== Load whitelist bindings from Supabase (BUG FIX: was reading localStorage only) ===== */
function loadWhitelistBindings(){
  var user=getSession();
  if(!user)return Promise.resolve([]);
  return rpc('ax_list_roblox',{p_username:user})
  .then(function(res){
    var bindings=(res&&res.ok)?(res.bindings||[]):[];
    // Cache to localStorage for compatibility
    try{
      var wlData=bindings.map(function(b){
        return{username:b.roblox_name,name:b.roblox_name,created_at:b.created_at||Date.now()};
      });
      localStorage.setItem('andrux_rbx_whitelist',JSON.stringify(wlData));
      // Also build history from bindings
      if(bindings.length>0){
        var history=bindings.map(function(b){
          return{type:'add',name:b.roblox_name,time:b.created_at||Date.now()};
        });
        localStorage.setItem('andrux_whitelist_history',JSON.stringify(history));
      }
    }catch(e){}
    return bindings;
  })
  .catch(function(){return [];});
}

/* ===== Render metrics ===== */
function renderMetrics(){
  var gEl=$('metricGames');
  var pEl=$('metricPlayers');
  var eEl=$('metricExecs');
  if(gEl)gEl.textContent=fmtNum(onlineGames.length);
  if(pEl)pEl.textContent=fmtNum(totalPlayers);
  if(eEl)eEl.textContent=fmtNum(execCount);
}

/* ===== Render launch area info ===== */
function renderLaunchInfo(){
  var info=$('launchOnlineInfo');
  var btn=$('dashLaunchBtn');
  if(!info)return;
  if(onlineGames.length===0){
    info.textContent='暂无在线游戏';
    if(btn)btn.disabled=true;
  }else{
    info.textContent='现在有'+totalPlayers+'名玩家在线';
    if(btn)btn.disabled=false;
  }
}

/* ===== Random game launch ===== */
function joinRandomGame(){
  if(onlineGames.length===0){
    toast('暂无在线游戏');
    return;
  }
  // Pick a random online game
  var idx=Math.floor(Math.random()*onlineGames.length);
  var game=onlineGames[idx];
  var url=game.join_url||('roblox://placeId='+game.place_id);
  toast('正在加入: '+(game.game_name||game.place_id));
  // Open the Roblox deep link
  try{
    if(window.andruxDesktop&&typeof window.andruxDesktop.openExternal==='function'){
      window.andruxDesktop.openExternal(url);
    }else{
      window.location.href=url;
    }
  }catch(e){
    try{window.open(url,'_blank');}catch(_){toast('无法唤起 Roblox');}
  }
}

/* ===== Roblox username binding ===== */
var _rbxBindings=[];
var _binding=false;

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

function isNameBound(name){
  if(!name)return false;
  var lower=name.toLowerCase();
  for(var i=0;i<_rbxBindings.length;i++){
    if((_rbxBindings[i].roblox_name||'').toLowerCase()===lower)return true;
  }
  return false;
}

function updateRbxStatus(){
  var input=$('dashRbxInput');
  var btn=$('dashRbxBtn');
  var status=$('dashRbxStatus');
  if(!input||!btn)return;
  var name=input.value.trim();
  if(!name){
    if(_rbxBindings.length>0){
      if(status){status.textContent='当前已绑定 '+_rbxBindings.length+' 个账号，前往白名单页管理';status.className='dash-rbx-status ok';}
    }else{
      if(status){status.textContent='';status.className='dash-rbx-status';}
    }
    btn.textContent='绑定账户';
    return;
  }
  if(isNameBound(name)){
    if(status){status.textContent='此用户名已绑定，前往白名单页解绑后可更换';status.className='dash-rbx-status ok';}
    btn.textContent='已绑定';
    btn.disabled=true;
  }else{
    if(status){status.textContent='';status.className='dash-rbx-status';}
    btn.textContent='绑定账户';
    btn.disabled=false;
  }
}

function bindRobloxUsername(){
  var user=getSession();
  var input=$('dashRbxInput');
  var btn=$('dashRbxBtn');
  var status=$('dashRbxStatus');
  if(!input||!btn||_binding)return;

  var name=input.value.trim();
  if(!name){
    if(status){status.textContent='请输入 Roblox 用户名';status.className='dash-rbx-status err';}
    return;
  }
  if(name.length>20){
    if(status){status.textContent='用户名过长（最多20字符）';status.className='dash-rbx-status err';}
    return;
  }
  if(!user){
    if(status){status.textContent='请先登录';status.className='dash-rbx-status err';}
    return;
  }
  if(isNameBound(name)){
    if(status){status.textContent='已绑定过此用户名，前往白名单页解绑';status.className='dash-rbx-status err';}
    btn.textContent='已绑定';
    btn.disabled=true;
    return;
  }

  _binding=true;
  btn.disabled=true;
  btn.textContent='绑定中...';
  if(status){status.textContent='正在验证用户名...';status.className='dash-rbx-status';}

  resolveRobloxUserId(name).then(function(uid){
    return rpc('ax_bind_roblox',{
      p_username:user,
      p_roblox_name:name,
      p_roblox_user_id:uid||null
    });
  }).then(function(res){
    if(res&&res.ok){
      if(status){status.textContent='绑定成功: '+name;status.className='dash-rbx-status ok';}
      toast('已绑定: '+name);
      input.value='';
      loadWhitelistBindings();
    }else{
      var err=res?res.error:'unknown';
      var msg='绑定失败';
      if(err==='limit_reached')msg='已绑定5个账号，请先解绑';
      else if(err==='already_bound'){msg='已绑定过此用户名';btn.textContent='已绑定';btn.disabled=true;}
      else msg='绑定失败: '+err;
      if(status){status.textContent=msg;status.className='dash-rbx-status err';}
    }
  }).catch(function(e){
    if(status){status.textContent='绑定失败: '+(e.message||e);status.className='dash-rbx-status err';}
  }).then(function(){
    _binding=false;
    if(btn.textContent!=='已绑定'){btn.disabled=false;btn.textContent='绑定账户';}
  });
}

/* ===== Load current bindings and update UI ===== */
function prefillBoundUser(){
  var input=$('dashRbxInput');
  if(!input)return;
  loadWhitelistBindings().then(function(bindings){
    _rbxBindings=bindings||[];
    if(_rbxBindings.length>0&&!input.value){
      input.value=_rbxBindings[0].roblox_name||'';
    }
    updateRbxStatus();
  });
}

/* ===== Full refresh ===== */
function refreshAll(){
  if(_loading)return;
  _loading=true;
  Promise.all([loadGames(),loadExecCount()])
  .then(function(){_loading=false;})
  .catch(function(){_loading=false;});
}

/* ===== i18n ===== */
function applyI18n(){
  var els=document.querySelectorAll('[data-i18n]');
  for(var i=0;i<els.length;i++){
    var key=els[i].getAttribute('data-i18n');
    var val=t(key);
    if(val&&val!==key){els[i].textContent=val;}
  }
}

/* ===== Init ===== */
function init(){
  if(!$('metricGames'))return; // Not on dashboard page

  applyI18n();

  // Bind buttons
  var launchBtn=$('dashLaunchBtn');
  if(launchBtn&&!launchBtn._bound){
    launchBtn._bound=true;
    launchBtn.addEventListener('click',joinRandomGame);
  }
  var rbxBtn=$('dashRbxBtn');
  if(rbxBtn&&!rbxBtn._bound){
    rbxBtn._bound=true;
    rbxBtn.addEventListener('click',bindRobloxUsername);
  }
  var rbxInput=$('dashRbxInput');
  if(rbxInput&&!rbxInput._bound){
    rbxInput._bound=true;
    rbxInput.addEventListener('keydown',function(e){
      if(e.key==='Enter'){e.preventDefault();bindRobloxUsername();}
    });
    rbxInput.addEventListener('input',function(){updateRbxStatus();});
  }

  // Load data
  prefillBoundUser();
  refreshAll();

  // Periodic refresh every 15 seconds
  if(!window._dashInterval){
    window._dashInterval=setInterval(refreshAll,15000);
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
}else{init();}
setTimeout(init,500);
setTimeout(init,2000);

// Same-tab live update when a script is pushed
window.addEventListener('andrux_exec_logged',function(e){
  var n=e&&e.detail&&e.detail.total;
  if(n&&n>execCount){execCount=n;renderMetrics();}
});

// React to storage changes from other tabs
window.addEventListener('storage',function(e){
  if(e.key==='andrux_game_list'||e.key==='andrux_total_execs'){
    refreshAll();
  }
  if(e.key==='andrux_lang'){
    setTimeout(function(){applyI18n();},50);
  }
});

// MutationObserver for late-loaded content
var _obs=new MutationObserver(function(){
  if($('metricGames')){init();_obs.disconnect();}
});
_obs.observe(document.body,{childList:true,subtree:true});

// Expose API
window.Dashboard={
  refresh:refreshAll,
  getOnlineGames:function(){return onlineGames;},
  getTotalPlayers:function(){return totalPlayers;}
};
})();
