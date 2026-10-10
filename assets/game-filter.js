/* Andrux Game Filter — offline / empty games hidden; stale rows purged */
(function(){
'use strict';

var STALE_MS = 45 * 1000;

function isOnlineGame(g){
  if(!g) return false;
  if(g.hidden === true) return false;
  if(g.status && g.status !== 'online') return false;
  if(!g.last_heartbeat) return false;
  var hb = new Date(g.last_heartbeat).getTime();
  if(isNaN(hb)) return false;
  if((Date.now() - hb) > STALE_MS) return false;
  var pc = Number(g.player_count);
  if(isNaN(pc) || pc <= 0) return false;
  return true;
}

function isHideOffline(){ return true; }
function setHideOffline(){ /* removed */ }

window.AndruxGameFilter = {
  isHideOffline: isHideOffline,
  setHideOffline: setHideOffline,
  isOnlineGame: isOnlineGame,
  STALE_MS: STALE_MS
};

window.addEventListener('DOMContentLoaded', function(){
  var card = document.getElementById('hideOfflineCard');
  if(card && card.parentNode) card.parentNode.removeChild(card);
  var legacy = document.getElementById('settingHideOffline');
  if(legacy){
    var p = legacy.closest('.setting-card, .card');
    if(p && p.parentNode) p.parentNode.removeChild(p);
  }
});
})();
