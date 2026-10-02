/* Andrux Game Filter — hide offline games across all pages */
(function(){
'use strict';

var STORAGE_KEY='andrux_hide_offline';

function tt(k){
  if(window.I18N&&typeof window.I18N.t==='function'){
    var v=window.I18N.t(k);
    if(v&&v!==k)return v;
  }
  var fallback={
    zh:{
      'set.game_filter':'游戏',
      'set.hide_offline':'不显示不在线游戏',
      'set.hide_offline_desc':'开启后所有页面只显示在线游戏，不在线的游戏会被隐藏。如果隐藏的游戏上线会自动显示，在线的游戏下线会自动隐藏。'
    },
    en:{
      'set.game_filter':'Games',
      'set.hide_offline':'Hide offline games',
      'set.hide_offline_desc':'When enabled, all pages only show online games. Offline games are hidden. If a hidden game comes online, it appears automatically. If an online game goes offline, it is hidden.'
    }
  };
  var lang='zh';
  try{lang=localStorage.getItem('andrux_lang')||'zh';}catch(e){}
  return(fallback[lang]&&fallback[lang][k])||fallback.zh[k]||k;
}

function isHideOffline(){
  try{return localStorage.getItem(STORAGE_KEY)==='1';}catch(e){return false;}
}

function setHideOffline(val){
  try{localStorage.setItem(STORAGE_KEY,val?'1':'0');}catch(e){}
}

/* Broadcast to other scripts on the same page */
function broadcastChange(){
  try{
    var evt=new CustomEvent('andrux_hide_offline_change',{detail:{hide:isHideOffline()}});
    window.dispatchEvent(evt);
  }catch(e){}
}

/* ===== Settings page: create and manage toggle ===== */
function ensureSettingsCard(){
  var existing=document.getElementById('settingHideOffline');
  if(existing)return existing;

  var settingsGrid=document.querySelector('.settings-grid');
  if(!settingsGrid)return null;

  var card=document.createElement('div');
  card.className='card setting-card';
  card.id='hideOfflineCard';

  var left=document.createElement('div');
  var eyebrow=document.createElement('span');
  eyebrow.className='eyebrow';
  eyebrow.setAttribute('data-i18n','set.game_filter');
  eyebrow.textContent=tt('set.game_filter');
  var h3=document.createElement('h3');
  h3.setAttribute('data-i18n','set.hide_offline');
  h3.textContent=tt('set.hide_offline');
  var p=document.createElement('p');
  p.setAttribute('data-i18n','set.hide_offline_desc');
  p.textContent=tt('set.hide_offline_desc');
  left.appendChild(eyebrow);
  left.appendChild(h3);
  left.appendChild(p);

  var label=document.createElement('label');
  label.className='switch';
  var input=document.createElement('input');
  input.type='checkbox';
  input.id='settingHideOffline';
  var span=document.createElement('span');
  label.appendChild(input);
  label.appendChild(span);

  card.appendChild(left);
  card.appendChild(label);

  var langCard=settingsGrid.querySelector('.lang-card');
  if(langCard){
    settingsGrid.insertBefore(card,langCard);
  }else{
    settingsGrid.appendChild(card);
  }

  input.checked=isHideOffline();
  input.addEventListener('change',function(){
    setHideOffline(input.checked);
    refreshAllFilters();
    broadcastChange();
  });

  return input;
}

function fixSettingsToggle(){
  var cb=document.getElementById('settingHideOffline');
  if(!cb){
    cb=ensureSettingsCard();
    if(!cb)return;
  }
  var expected=isHideOffline();
  if(cb.checked!==expected){
    cb.checked=expected;
  }
}

/* ===== Network-level filter: ask the API for online games only =====
   Works no matter which script renders the list (page-app, scripthub, exec-asset). */
function installFetchFilter(){
  if(window.__axFetchPatched)return;
  window.__axFetchPatched=true;
  var orig=window.fetch;
  if(typeof orig!=='function')return;
  window.fetch=function(input,init){
    try{
      if(typeof input==='string'&&isHideOffline()){
        var method=(init&&init.method)?String(init.method).toUpperCase():'GET';
        if(method==='GET'
          &&input.indexOf('/rest/v1/ax_gs')>=0
          &&input.indexOf('select=')>=0
          &&input.indexOf('exec_queue')<0
          &&input.indexOf('status=')<0){
          input=input+(input.indexOf('?')>=0?'&':'?')+'status=eq.online';
        }
      }
    }catch(e){}
    return orig.call(this,input,init);
  };
}

/* ===== Filter: card-based game lists (game page, executor Lua mode) ===== */
function filterCardContainer(containerId,selector){
  var box=document.getElementById(containerId);
  if(!box)return;
  var hide=isHideOffline();
  var items=box.querySelectorAll(selector);
  for(var i=0;i<items.length;i++){
    items[i].style.display=hide?'none':'';
  }
}

function refreshCardFilters(){
  filterCardContainer('gameStatusBox','.gc-offline');
  filterCardContainer('execGameList','.exec-game-item.offline');
}

/* Ask page scripts to re-render their server lists */
function reloadLists(){
  try{if(window.AxScriptHub&&window.AxScriptHub.reload)window.AxScriptHub.reload();}catch(e){}
  try{if(window.AxExecAsset&&window.AxExecAsset.reload)window.AxExecAsset.reload();}catch(e){}
}

/* ===== Full refresh ===== */
function refreshAllFilters(){
  fixSettingsToggle();
  refreshCardFilters();
  reloadLists();
  broadcastChange();
}

/* MutationObserver — watch for any game list content changes */
var _filterTimer=null;
var _gameObs=new MutationObserver(function(){
  if(_filterTimer)clearTimeout(_filterTimer);
  _filterTimer=setTimeout(function(){
    fixSettingsToggle();
    refreshCardFilters();
  },100);
});

function startObserver(){
  _gameObs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}

/* Listen for storage changes (cross-tab) */
window.addEventListener('storage',function(e){
  if(e.key===STORAGE_KEY){
    refreshAllFilters();
  }
});

/* Also listen for same-page toggle via custom event from other scripts */
window.addEventListener('andrux_hide_offline_change',function(){
  refreshCardFilters();
  fixSettingsToggle();
});

function init(){
  installFetchFilter();
  ensureSettingsCard();
  fixSettingsToggle();
  refreshCardFilters();
  startObserver();
}

installFetchFilter();

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
}else{
  init();
}
setTimeout(init,300);
setTimeout(init,800);
setTimeout(init,1500);
setTimeout(init,3000);
setTimeout(init,5000);

/* Expose API */
window.GameFilter={
  isHidden:isHideOffline,
  refresh:refreshAllFilters
};
})();

/* Re-translate hide-offline card when language switches */
function refreshHideOfflineI18n(){
    var card=document.getElementById('hideOfflineCard');
    if(!card)return;
    var eb=card.querySelector('.eyebrow');
    var h=card.querySelector('h3');
    var p=card.querySelector('p');
    if(eb)eb.textContent=tt('set.game_filter');
    if(h)h.textContent=tt('set.hide_offline');
    if(p)p.textContent=tt('set.hide_offline_desc');
  }
window.addEventListener('andrux_lang_change', refreshHideOfflineI18n);
window.addEventListener('storage', function(e){
  if(e.key==='andrux_lang'){ refreshHideOfflineI18n(); }
});

