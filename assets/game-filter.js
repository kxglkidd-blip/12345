/* Andrux Game Filter — hide offline games based on settings toggle */
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
      'set.hide_offline_desc':'开启后游戏页面只显示在线游戏，不在线的游戏会被隐藏。如果隐藏的游戏上线会自动显示，在线的游戏下线会自动隐藏。'
    },
    en:{
      'set.game_filter':'Games',
      'set.hide_offline':'Hide offline games',
      'set.hide_offline_desc':'When enabled, the game page only shows online games. Offline games are hidden. If a hidden game comes online, it appears automatically. If an online game goes offline, it is hidden.'
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
  eyebrow.textContent=tt('set.game_filter');
  var h3=document.createElement('h3');
  h3.textContent=tt('set.hide_offline');
  var p=document.createElement('p');
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
    refreshFilter();
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

/* ===== Game page: filter offline cards ===== */
function applyGameFilter(){
  if(!isHideOffline())return;
  var box=document.getElementById('gameStatusBox');
  if(!box)return;
  var offlineCards=box.querySelectorAll('.gc-offline');
  for(var i=0;i<offlineCards.length;i++){
    offlineCards[i].style.display='none';
  }
}

function restoreAllCards(){
  var box=document.getElementById('gameStatusBox');
  if(!box)return;
  var hidden=box.querySelectorAll('.gc-offline');
  for(var i=0;i<hidden.length;i++){
    hidden[i].style.display='';
  }
}

function refreshFilter(){
  if(isHideOffline()){
    applyGameFilter();
  }else{
    restoreAllCards();
  }
}

/* MutationObserver on game page */
var _filterTimer=null;
var _gameObs=new MutationObserver(function(){
  if(_filterTimer)clearTimeout(_filterTimer);
  _filterTimer=setTimeout(function(){
    fixSettingsToggle();
    refreshFilter();
  },100);
});

function startObserver(){
  var box=document.getElementById('gameStatusBox');
  if(box){
    _gameObs.observe(box,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  _gameObs.observe(document.body,{childList:true,subtree:true});
}

window.addEventListener('storage',function(e){
  if(e.key===STORAGE_KEY){
    fixSettingsToggle();
    refreshFilter();
  }
});

function init(){
  ensureSettingsCard();
  fixSettingsToggle();
  refreshFilter();
  startObserver();
}

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
})();
