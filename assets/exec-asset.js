/* Andrux Executor — Lua script execution + game list
   Fixes:
   - Removed require mode, only Lua remains
   - Proper execution logging (every execution increments counter)
   - Target server selection from game list
   - Character count display
*/
(function(){
'use strict';

var SU='https://nyourvnfzhxbofwmavgq.supabase.co';
var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b3Vydm5memh4Ym9md21hdmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTYwMTIsImV4cCI6MjEwMDY3MjAxMn0.YqztdjSz8kDAf9sHpqVeiMLjfwSbl4kvc8O5sGyJkvg';
var TABLE='ax_gs';
var HDRS={apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json'};
var STALE_MS=5*60*1000;

function $(id){return document.getElementById(id);}

function toast(msg){
  var el=$('toast');if(!el)return;
  el.textContent=msg;el.classList.add('show');
  clearTimeout(toast._t);
  toast._t=setTimeout(function(){el.classList.remove('show');},2000);
}

function tt(k){return(window.I18N&&window.I18N.t)?window.I18N.t(k):k;}

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

/* ===== Execution log: insert into ax_exec_log + bump local counter ===== */
/* Called EVERY time a script is executed — no dedup, no flags */
function logExec(placeId,robloxName,source){
  try{
    var n=(parseInt(localStorage.getItem('andrux_total_execs')||'0',10)||0)+1;
    localStorage.setItem('andrux_total_execs',String(n));
    window.dispatchEvent(new CustomEvent('andrux_exec_logged',{detail:{total:n}}));
  }catch(e){}
  return fetch(SU+'/rest/v1/ax_exec_log',{
    method:'POST',
    headers:Object.assign({},HDRS,{Prefer:'return=minimal'}),
    body:JSON.stringify({place_id:String(placeId),roblox_name:robloxName||null,source:source||'lua'})
  }).catch(function(){});
}

/* ===== Game list for target selection ===== */
var _games=[];
var _selectedPlaceId=null;

function hideOffline(){
  try{return localStorage.getItem('andrux_hide_offline')==='1';}catch(e){return false;}
}

function isGameAlive(g){
  if(!g||g.status!=='online')return false;
  if(!g.last_heartbeat)return false;
  var hb=new Date(g.last_heartbeat).getTime();
  if(isNaN(hb))return false;
  return (Date.now()-hb)<=STALE_MS;
}

function loadGames(){
  var list=$('execGameList');
  if(!list)return;
  apiGet(TABLE+'?select=place_id,game_name,player_count,status,last_heartbeat,hidden&hidden=eq.false&order=last_heartbeat.desc')
  .then(function(rows){
    if(!rows||!rows.length){
      _games=[];
      list.innerHTML='<div style="text-align:center;padding:16px;color:var(--muted);font-size:13px">'+tt('exec.no_games')+'</div>';
      return;
    }
    var hideOff=hideOffline();
    _games=rows.filter(function(r){
      var alive=isGameAlive(r);
      if(hideOff&&!alive)return false;
      return true;
    });
    if(_games.length===0){
      list.innerHTML='<div style="text-align:center;padding:16px;color:var(--muted);font-size:13px">'+tt('exec.no_games')+'</div>';
      return;
    }
    list.innerHTML=_games.map(function(g){
      var alive=isGameAlive(g);
      var name=g.game_name||g.place_id;
      var pc=alive?(g.player_count||0):0;
      var sel=g.place_id===_selectedPlaceId;
      return '<div class="exec-game-item '+(alive?'online':'offline')+(sel?' selected':'')+'" data-place="'+g.place_id+'">'+
        '<div class="exec-game-info">'+
          '<b>'+name+'</b>'+
          '<small>'+(alive?(pc+' 名玩家'):'离线')+'</small>'+
        '</div>'+
        '<span class="exec-game-status '+(alive?'online':'offline')+'">'+(alive?'在线':'离线')+'</span>'+
      '</div>';
    }).join('');
    // Bind clicks
    list.querySelectorAll('.exec-game-item').forEach(function(item){
      item.addEventListener('click',function(){
        if(item.classList.contains('offline'))return;
        _selectedPlaceId=item.getAttribute('data-place');
        list.querySelectorAll('.exec-game-item').forEach(function(i){i.classList.remove('selected');});
        item.classList.add('selected');
        updateExecuteButton();
      });
    });
  })
  .catch(function(){
    list.innerHTML='<div style="text-align:center;padding:16px;color:var(--bad);font-size:13px">'+tt('admin.load_fail')+'</div>';
  });
}

function updateExecuteButton(){
  var btn=$('execSendBtn');
  var st=$('execStatus');
  if(!btn)return;
  var input=$('execScriptInput');
  var script=(input?input.value:'').trim();
  if(!_selectedPlaceId){
    btn.disabled=true;
  }else if(!script){
    btn.disabled=true;
  }else{
    btn.disabled=false;
  }
}

function updateCharCount(){
  var cc=$('execCharCount');
  var input=$('execScriptInput');
  if(!cc||!input)return;
  cc.textContent=input.value.length+tt('exec.char_unit');
}

/* ===== Execute Lua script ===== */
var _executing=false;

function executeLua(){
  if(_executing)return;
  var btn=$('execSendBtn');
  var st=$('execStatus');
  var input=$('execScriptInput');
  if(!btn||!input)return;

  var script=input.value;
  if(!script||!script.trim()){toast(tt('exec.empty_script')||'请输入脚本内容');return;}
  if(!_selectedPlaceId){toast(tt('exec.select_game_first')||'请先选择目标服务器');return;}

  var placeId=_selectedPlaceId;
  var game=_games.find(function(g){return g.place_id===placeId;});
  var gameName=game?(game.game_name||placeId):placeId;

  _executing=true;
  btn.disabled=true;
  btn.textContent=tt('exec.pushing')||'执行中...';
  if(st)st.textContent=(tt('exec.sending_to')||'正在推送到 ')+gameName+'...';

  apiGet(TABLE+'?select=exec_queue&place_id=eq.'+encodeURIComponent(placeId))
  .then(function(rows){
    var queue=[];
    if(rows&&rows[0]&&Array.isArray(rows[0].exec_queue)){
      queue=rows[0].exec_queue;
    }
    queue.push({type:'lua',script:script});
    return apiPatch(TABLE+'?place_id=eq.'+encodeURIComponent(placeId),{exec_queue:queue});
  })
  .then(function(){
    // Log execution EVERY time — no dedup, no flags
    logExec(placeId,null,'lua');
    toast((tt('exec.sent_to')||'已推送到 ')+gameName);
    if(st){st.textContent=(tt('exec.sent_success')||'已成功推送到 ')+gameName;st.className='notice ok';}
  })
  .catch(function(err){
    toast((tt('exec.send_fail')||'推送失败: ')+(err.message||err));
    if(st){st.textContent=(tt('exec.send_fail')||'推送失败: ')+(err.message||err);st.className='notice bad';}
  })
  .then(function(){
    _executing=false;
    btn.disabled=false;
    btn.textContent=tt('exec.execute')||'执行';
    updateExecuteButton();
  });
}

function clearEditor(){
  var input=$('execScriptInput');
  if(input){input.value='';updateCharCount();updateExecuteButton();}
  var st=$('execStatus');
  if(st){st.textContent=tt('exec.status_idle')||'选择一个在线服务器，输入脚本后执行。';st.className='notice';}
}

/* ===== Init ===== */
var _inited=false;
function init(){
  if(_inited)return;
  var btn=$('execSendBtn');
  if(!btn)return;
  var input=$('execScriptInput');
  if(!input)return;

  btn.addEventListener('click',executeLua);

  var clearBtn=$('execClearBtn');
  if(clearBtn)clearBtn.addEventListener('click',clearEditor);

  if(input){
    input.addEventListener('input',function(){
      updateCharCount();
      updateExecuteButton();
    });
    // Ctrl+Enter to execute
    input.addEventListener('keydown',function(e){
      if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();executeLua();}
    });
  }

  var refreshBtn=$('execRefreshGames');
  if(refreshBtn)refreshBtn.addEventListener('click',function(){loadGames();toast(tt('admin.refresh'));});

  updateCharCount();
  updateExecuteButton();
  loadGames();

  _inited=true;

  // Periodic game list refresh
  setInterval(loadGames,30000);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
}else{init();}
setTimeout(init,500);
setTimeout(init,2000);

var _obs=new MutationObserver(function(){
  if(_inited){_obs.disconnect();return;}
  setTimeout(init,100);
});
_obs.observe(document.body,{childList:true,subtree:true});

/* Refresh game list when hide-offline setting changes */
window.addEventListener('storage',function(e){
  if(e.key==='andrux_hide_offline'){loadGames();}
});
window.addEventListener('andrux_hide_offline_change',function(){loadGames();});

window.AxExec={reload:loadGames,execute:executeLua};
})();