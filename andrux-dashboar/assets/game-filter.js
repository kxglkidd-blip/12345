/* Andrux Game Filter — hide offline games based on settings toggle */
(function(){
'use strict';

var STORAGE_KEY='andrux_hide_offline';

function isHideOffline(){
try{return localStorage.getItem(STORAGE_KEY)==='1';}catch(e){return false;}
}

function setHideOffline(val){
try{localStorage.setItem(STORAGE_KEY,val?'1':'0');}catch(e){}
}

/* ===== Settings page: bind toggle ===== */
function bindSettingsToggle(){
var cb=document.getElementById('settingHideOffline');
if(!cb)return;
if(cb.dataset.bound)return;
cb.dataset.bound='1';
cb.checked=isHideOffline();
cb.addEventListener('change',function(){
setHideOffline(cb.checked);
});
}

/* ===== Game page: filter offline cards ===== */
function applyGameFilter(){
if(!isHideOffline())return;
var box=document.getElementById('gameStatusBox');
if(!box)return;
var offlineCards=box.querySelectorAll('.gc-offline');
offlineCards.forEach(function(card){
card.style.display='none';
});
}

function restoreAllCards(){
var box=document.getElementById('gameStatusBox');
if(!box)return;
var hidden=box.querySelectorAll('.gc-offline');
hidden.forEach(function(card){
card.style.display='';
});
}

function refreshFilter(){
if(isHideOffline()){
applyGameFilter();
}else{
restoreAllCards();
}
}

/* MutationObserver on game page to catch dynamic re-renders */
var _filterTimer=null;
var _obs=new MutationObserver(function(){
if(_filterTimer)clearTimeout(_filterTimer);
_filterTimer=setTimeout(refreshFilter,100);
});

function startObserver(){
var box=document.getElementById('gameStatusBox');
if(box){
_obs.observe(box,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
}
}

/* Also listen for localStorage changes (cross-tab) */
window.addEventListener('storage',function(e){
if(e.key===STORAGE_KEY){
refreshFilter();
}
});

/* Init */
function init(){
bindSettingsToggle();
refreshFilter();
startObserver();
}

if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',init);
}else{
init();
}
setTimeout(init,500);
setTimeout(init,2000);
setTimeout(init,5000);

/* Re-observe when body changes (SPA navigation) */
var _navObs=new MutationObserver(function(){
setTimeout(function(){
bindSettingsToggle();
refreshFilter();
startObserver();
},200);
});
_navObs.observe(document.body,{childList:true,subtree:true});
})();
