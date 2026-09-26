/* ===== Dashboard: Whitelist changes, login activity, game status ===== */
(function(){
function $(id){return document.getElementById(id);}

function t(key){
  if(window.I18N&&typeof window.I18N.t==='function'){
    var v=window.I18N.t(key);
    if(v&&v!==key)return v;
  }
  return key;
}

function fmtTime(ts){
  if(!ts)return '';
  var d=new Date(ts);
  if(isNaN(d.getTime()))return '';
  var now=new Date();
  var diff=now-d;
  if(diff<60000)return t('dash.just_now')||'刚刚';
  if(diff<3600000)return Math.floor(diff/60000)+(t('dash.min_ago')||' 分钟前');
  if(diff<86400000)return Math.floor(diff/3600000)+(t('dash.hour_ago')||' 小时前');
  return d.toLocaleDateString()+' '+d.toTimeString().slice(0,5);
}

function hideOffline(){
  try{
    return localStorage.getItem('andrux_hide_offline')==='1';
  }catch(e){return false;}
}

/* ===== Game Status ===== */
function renderGameList(){
  var box=$('dashGameList');
  if(!box)return;
  var games=[];
  try{
    var raw=localStorage.getItem('andrux_game_list');
    if(raw)games=JSON.parse(raw)||[];
  }catch(e){}

  var hideOff=hideOffline();
  var filtered=games.filter(function(g){
    if(hideOff&&!g.is_online)return false;
    return true;
  });

  if(filtered.length===0){
    var label=hideOff ? (t('dash.no_online_games')||'无在线游戏') : (t('dash.no_games')||'暂无游戏');
    box.innerHTML='<div class="dash-empty">'+label+'</div>';
    return;
  }

  var html='';
  for(var i=0;i<filtered.length;i++){
    var g=filtered[i];
    var online=g.is_online;
    var count=online?(g.player_count||0):0;
    html+='<div class="dash-game-item">'
      +'<div class="dash-game-dot '+(online?'online':'')+'"></div>'
      +'<div class="dash-game-name" title="'+(g.name||g.place_id||'Game')+'">'+(g.name||g.place_id||'Game')+'</div>'
      +'<div class="dash-game-count">'+count+(t('dash.players')||' 人')+'</div>'
      +'</div>';
  }
  box.innerHTML=html;
}

/* ===== Whitelist Changes ===== */
function renderWhitelist(){
  var box=$('dashWhitelistList');
  if(!box)return;
  var history=[];
  try{
    var raw=localStorage.getItem('andrux_whitelist_history');
    if(raw)history=JSON.parse(raw)||[];
  }catch(e){}

  // Also try to combine with current whitelist for initial view
  if(history.length===0){
    try{
      var wlRaw=localStorage.getItem('andrux_rbx_whitelist');
      if(wlRaw){
        var wl=JSON.parse(wlRaw)||[];
        for(var j=0;j<Math.min(wl.length,5);j++){
          history.push({type:'add',name:wl[j].username||wl[j].name||'Player',time:wl[j].created_at||Date.now()});
        }
      }
    }catch(e2){}
  }

  if(history.length===0){
    box.innerHTML='<div class="dash-empty">'+(t('dash.no_whitelist_changes')||'暂无更改记录')+'</div>';
    return;
  }

  history.sort(function(a,b){return (b.time||0)-(a.time||0);});
  var html='';
  var max=Math.min(history.length,10);
  for(var i=0;i<max;i++){
    var item=history[i];
    var isAdd=item.type==='add';
    var icon=isAdd?'+':'−';
    var cls=isAdd?'add':'remove';
    var label=isAdd?(t('dash.whitelist_added')||'已添加到白名单'):(t('dash.whitelist_removed')||'已从白名单移除');
    html+='<div class="dash-item">'
      +'<div class="dash-item-icon '+cls+'">'+icon+'</div>'
      +'<div class="dash-item-body"><b>'+(item.name||'Player')+'</b><span>'+label+'</span></div>'
      +'<div class="dash-item-time">'+fmtTime(item.time)+'</div>'
      +'</div>';
  }
  box.innerHTML=html;
}

/* ===== Login Activity ===== */
function renderLoginActivity(){
  var box=$('dashLoginList');
  if(!box)return;
  var activity=[];
  try{
    var raw=localStorage.getItem('andrux_login_activity');
    if(raw)activity=JSON.parse(raw)||[];
  }catch(e){}

  if(activity.length===0){
    // Show current login as a placeholder
    var username='Player';
    try{
      var u=localStorage.getItem('andrux_username');
      if(u)username=u;
    }catch(e2){}
    box.innerHTML='<div class="dash-item">'
      +'<div class="dash-item-icon login">→</div>'
      +'<div class="dash-item-body"><b>'+username+'</b><span>'+(t('dash.current_session')||'当前会话')+'</span></div>'
      +'<div class="dash-item-time">'+(t('dash.online')||'在线')+'</div>'
      +'</div>';
    return;
  }

  activity.sort(function(a,b){return (b.time||0)-(a.time||0);});
  var html='';
  var max=Math.min(activity.length,10);
  for(var i=0;i<max;i++){
    var item=activity[i];
    var isLogin=item.type==='login';
    var icon=isLogin?'→':'←';
    var cls=isLogin?'login':'logout';
    var label=isLogin?(t('dash.logged_in')||'登录'):(t('dash.logged_out')||'登出');
    html+='<div class="dash-item">'
      +'<div class="dash-item-icon '+cls+'">'+icon+'</div>'
      +'<div class="dash-item-body"><b>'+(item.name||item.username||'Player')+'</b><span>'+label+'</span></div>'
      +'<div class="dash-item-time">'+fmtTime(item.time)+'</div>'
      +'</div>';
  }
  box.innerHTML=html;
}

function refreshAll(){
  renderGameList();
  renderWhitelist();
  renderLoginActivity();
}

// Apply i18n to static content in this page
function applyI18n(){
  var els=document.querySelectorAll('[data-i18n]');
  for(var i=0;i<els.length;i++){
    var key=els[i].getAttribute('data-i18n');
    var val=t(key);
    if(val&&val!==key){els[i].textContent=val;}
  }
  var phEls=document.querySelectorAll('[data-i18n-ph]');
  for(var j=0;j<phEls.length;j++){
    var pkey=phEls[j].getAttribute('data-i18n-ph');
    var pval=t(pkey);
    if(pval&&pval!==pkey){phEls[j].setAttribute('placeholder',pval);}
  }
}

function init(){
  if(!$('dashWhitelistList'))return;
  applyI18n();
  refreshAll();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
}else{init();}
setTimeout(init,500);
setTimeout(init,2000);

// Re-render on storage changes (game list updates, setting changes, etc.)
window.addEventListener('storage',function(e){
  if(e.key==='andrux_game_list'||e.key==='andrux_hide_offline'||e.key==='andrux_rbx_whitelist'||e.key==='andrux_whitelist_history'||e.key==='andrux_login_activity'){
    refreshAll();
  }
  if(e.key==='andrux_lang'){
    setTimeout(function(){applyI18n();refreshAll();},50);
  }
});

// MutationObserver for late-loaded content
var _obs=new MutationObserver(function(){
  if($('dashWhitelistList')){init();_obs.disconnect();}
});
_obs.observe(document.body,{childList:true,subtree:true});

// Periodic refresh (every 15s) for game status
setInterval(refreshAll,15000);

// Expose for external use
window.Dashboard={refresh:refreshAll};
})();
