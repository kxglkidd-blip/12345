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
/* Roblox's own host sends no CORS header, so it is only reachable from the desktop build
   (main-process proxy). A plain browser has to use a CORS-enabled mirror; roproxy's user
   service is down, so ff-roproxy and rotunnel carry the lookup. */
var ROBLOX_ID_APIS=[
'https://users.roblox.com/v1/usernames/users',
'https://users.ff-roproxy.com/v1/usernames/users',
'https://users.rotunnel.com/v1/usernames/users'
];
var ROBLOX_SEARCH_APIS=[
'https://users.ff-roproxy.com/v1/users/search',
'https://users.rotunnel.com/v1/users/search'
];

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

/* 带超时的 fetch：超时则 abort 并 reject，绝不让流程挂起 */
function fetchT(url,opts,ms){
  ms=ms||8000;opts=opts||{};
  var ctrl=null;try{ctrl=new AbortController();opts.signal=ctrl.signal;}catch(e){}
  var timer;
  var timeout=new Promise(function(_,rej){timer=setTimeout(function(){rej(new Error('请求超时，请检查网络后重试'));try{ctrl&&ctrl.abort();}catch(e){}},ms);});
  return Promise.race([fetch(url,opts),timeout]).then(function(r){clearTimeout(timer);return r;},function(e){clearTimeout(timer);if(e&&(e.name==='AbortError'||/abort/i.test(e.message||'')))throw new Error('请求超时，请检查网络后重试');if(e&&e.name==='TypeError')throw new Error('网络连接失败，请检查网络后重试');throw e;});
}

function rpc(fn,body){
  return fetchT(SU+'/rest/v1/rpc/'+fn,{
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
/* Filter: status=online AND hidden=false AND heartbeat within 60s (must match the game page) */
var STALE_MS=60000; /* 60s without heartbeat = offline (heartbeat interval ~30s) */
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
/* Roblox 官方接口没有 CORS 头，渲染进程（file:// 源）直连会被浏览器拦下，桌面版走主进程代理；
   纯网页版只能改用带 CORS 的搜索接口。 */
function rbxJson(url,opts,ms){
  ms=ms||8000;
  var d=window.andruxDesktop;
  if(d&&typeof d.robloxJson==='function'){
    var o=opts||{};
    o.timeout=ms;
    return d.robloxJson(url,o);
  }
  return fetchT(url,opts,ms).then(function(r){
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.json();
  });
}

function resolveRobloxUserId(username){
  /* 失败/限流/超时一律返回 null，不阻塞绑定 */
  function postAt(i){
    if(i>=ROBLOX_ID_APIS.length)return Promise.reject(new Error('not found'));
    return rbxJson(ROBLOX_ID_APIS[i],{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({usernames:[username],excludeBannedUsers:false})
    },8000).then(function(data){
      if(data&&data.data&&data.data[0]&&data.data[0].id)return data.data[0].id;
      throw new Error('not found');
    }).catch(function(){return postAt(i+1);});
  }
  /* 搜索是模糊匹配，必须要求用户名完全一致，避免绑错人 */
  function searchAt(i){
    if(i>=ROBLOX_SEARCH_APIS.length)return Promise.reject(new Error('not found'));
    return rbxJson(ROBLOX_SEARCH_APIS[i]+'?keyword='+encodeURIComponent(username)+'&limit=10',{
      headers:{Accept:'application/json'}
    },8000).then(function(data){
      var list=(data&&data.data)||[];
      var key=String(username).toLowerCase();
      for(var k=0;k<list.length;k++){
        if(String(list[k].name||'').toLowerCase()===key)return list[k].id;
      }
      throw new Error('not found');
    }).catch(function(){return searchAt(i+1);});
  }
  var direct=!!(window.andruxDesktop&&typeof window.andruxDesktop.robloxJson==='function');
  /* 浏览器版跳过官方主机：它不发 CORS 头，那个请求必然失败 */
  return postAt(direct?0:1).catch(function(){return searchAt(0);}).catch(function(){return null;});
}

/* 绑定前查重：只检查“输入的 Roblox 用户名”是否已存在于白名单 ax_rb（c3 = 小写用户名）
   查询失败时不误拦，交给 ax_bind_roblox 服务端再校验 already_bound */
function checkAlreadyBound(user,name){
  var lower=name.trim().toLowerCase();
  var h={apikey:SK,Authorization:'Bearer '+SK};
  function q(path){
    return fetchT(SU+'/rest/v1/ax_rb?'+path,{headers:h,cache:'no-store'},5000)
      .then(function(r){return r.ok?r.json():[];})
      .then(function(j){return Array.isArray(j)&&j.length>0;})
      .catch(function(){return false;});
  }
  return Promise.all([
    q('select=c0&c3=eq.'+encodeURIComponent(lower)+'&limit=1'),
    q('select=c0&c2=ilike.'+encodeURIComponent(lower.replace(/[%_*]/g,''))+'&limit=1')
  ]).then(function(r){return r[0]||r[1];}).catch(function(){return false;});
}
/* 每个用户最多 5 个绑定 */
function countMyBindings(user){
  return rpc('ax_list_roblox',{p_username:user}).then(function(res){
    return (res&&res.ok)?(res.bindings||[]).length:0;
  }).catch(function(){return 0;});
}

function bindRobloxUsername(){
  var user=getSession();
  var input=$('dashRbxInput');
  var btn=$('dashRbxBtn');
  var status=$('dashRbxStatus');
  if(!input||!btn)return;

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

  var origLabel=btn.getAttribute('data-orig-label')||btn.textContent||'绑定账户';
  btn.setAttribute('data-orig-label',origLabel);
  btn.disabled=true;
  btn.textContent='绑定中...';
  if(status){status.textContent='正在验证用户名...';status.className='dash-rbx-status';}

  /* 兜底：20 秒内无论如何恢复按钮 */
  var guard=setTimeout(function(){
    btn.disabled=false;btn.textContent=origLabel;
    if(status&&/正在(验证|绑定)/.test(status.textContent)){status.textContent='绑定超时，请稍后重试';status.className='dash-rbx-status err';}
  },20000);
  var DUP_MSG='该 Roblox 账号已在白名单中绑定过，请先前往白名单页面解绑后再重新绑定';
  Promise.all([checkAlreadyBound(user,name),countMyBindings(user)]).then(function(r){
    if(r[0]){var e=new Error(DUP_MSG);e.dup=true;throw e;}
    if(r[1]>=5){var e2=new Error('已绑定5个账号，请先前往白名单页面解绑');e2.dup=true;throw e2;}
    return resolveRobloxUserId(name);
  }).then(function(uid){
    if(status){status.textContent='正在绑定...';status.className='dash-rbx-status';}
    return rpc('ax_bind_roblox',{
      p_username:user,
      p_roblox_name:name,
      p_roblox_user_id:uid||null
    });
  }).then(function(res){
    if(res&&res.ok){
      if(status){status.textContent='已绑定: '+name;status.className='dash-rbx-status ok';}
      toast('已绑定: '+name);
      input.value='';
      try{loadWhitelistBindings();}catch(_){}
    }else{
      var err=res?res.error:'unknown';
      var msg='绑定失败';
      if(err==='limit_reached')msg='已绑定5个账号，请先解绑';
      else if(err==='already_bound')msg='该 Roblox 账号已在白名单中绑定过，请先前往白名单页面解绑后再重新绑定';
      else msg='绑定失败: '+err;
      if(status){status.textContent=msg;status.className='dash-rbx-status err';}
    }
  }).catch(function(e){
    if(e&&e.dup){if(status){status.textContent=e.message;status.className='dash-rbx-status err';}try{alert(e.message);}catch(_){}return;}
    var m=(e&&e.message)?e.message:String(e||'未知错误');
    if(status){status.textContent='绑定失败: '+m;status.className='dash-rbx-status err';}
  }).then(function(){
    clearTimeout(guard);
    btn.disabled=false;
    btn.textContent=origLabel;
  });
}

/* ===== Pre-fill current bound username ===== */
function prefillBoundUser(){
  var input=$('dashRbxInput');
  if(!input)return;
  loadWhitelistBindings().then(function(bindings){
    if(bindings&&bindings.length>0&&!input.value){
      input.value=bindings[0].roblox_name||'';
    }
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
  if(n!=null){execCount=Math.max(execCount,parseInt(n,10)||0);renderMetrics();}
});

// React to storage changes from other tabs
window.addEventListener('storage',function(e){
  if(e.key==='andrux_game_list')refreshAll();
  if(e.key==='andrux_total_execs'){
    execCount=Math.max(execCount,parseInt(e.newValue||'0',10)||0);
    renderMetrics();
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
