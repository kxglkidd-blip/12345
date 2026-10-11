/* Andrux Human Gate - Click verification only */
(function(){
'use strict';
var verified=false;
var SK='andrux_human_ok';

function t(k){return(window.I18N&&window.I18N.t)?window.I18N.t(k):k;}
function $(id){return document.getElementById(id);}
function setText(id,txt){var el=$(id);if(el)el.textContent=txt;}
function hide(id){var el=$(id);if(el)el.classList.add('hidden');}
function show(id){var el=$(id);if(el)el.classList.remove('hidden');}

function authSubmitButtons(){
  var list=[];
  var loginForm=$('loginForm');
  var regForm=$('registerForm');
  if(loginForm){
    loginForm.querySelectorAll('button[type="submit"]').forEach(function(b){list.push(b);});
  }
  if(regForm){
    regForm.querySelectorAll('button[type="submit"]').forEach(function(b){list.push(b);});
  }
  /* fallback by text/i18n if type missing */
  document.querySelectorAll('#loginForm .primary-btn, #registerForm .primary-btn').forEach(function(b){
    if(list.indexOf(b)<0) list.push(b);
  });
  return list;
}

function setAuthButtonsEnabled(on){
  authSubmitButtons().forEach(function(btn){
    btn.disabled=!on;
    btn.classList.toggle('is-disabled',!on);
    btn.setAttribute('aria-disabled', on?'false':'true');
    if(on){
      btn.style.opacity='';
      btn.style.pointerEvents='';
      btn.style.filter='';
      btn.style.cursor='';
    }else{
      btn.style.opacity='0.45';
      btn.style.pointerEvents='none';
      btn.style.filter='grayscale(0.35)';
      btn.style.cursor='not-allowed';
    }
  });
}

function pass(){
  if(verified){
    setAuthButtonsEnabled(true);
    return;
  }
  verified=true;
  sessionStorage.setItem(SK,'1');
  setText('humanGateState',t('auth.human_verified'));
  setText('humanGateText',t('auth.human_pass'));
  var gate=$('humanGate');
  if(gate)gate.classList.add('ok');
  setAuthButtonsEnabled(true);
}

function fail(msg){
  verified=false;
  sessionStorage.removeItem(SK);
  setText('humanGateState',t('auth.human_unverified'));
  setText('humanGateText',msg||t('auth.human_fail')||t('auth.human_click_text'));
  var gate=$('humanGate');
  if(gate)gate.classList.remove('ok');
  setAuthButtonsEnabled(false);
}

function init(){
  var clickBtn=$('humanClickBtn');
  if(!clickBtn)return;
  show('humanClickBtn');
  clickBtn.addEventListener('click',function(){pass();});
}

function guard(e){
  var trap=$('humanTrap');
  if(trap&&trap.value){
    e.preventDefault();
    e.stopImmediatePropagation();
    fail(t('auth.human_required'));
    return;
  }
  if(!verified&&sessionStorage.getItem(SK)!=='1'){
    e.preventDefault();
    e.stopImmediatePropagation();
    fail(t('auth.human_required'));
  }
}

function boot(){
  verified=sessionStorage.getItem(SK)==='1';
  if(verified){
    pass();
  }else{
    fail();
  }
  init();
  var loginForm=$('loginForm');
  var regForm=$('registerForm');
  if(loginForm)loginForm.addEventListener('submit',guard,true);
  if(regForm)regForm.addEventListener('submit',guard,true);

  if(window.I18N){
    var origApply=window.I18N.apply;
    window.I18N.apply=function(){
      origApply.call(window.I18N);
      if(verified){
        setText('humanGateState',t('auth.human_verified'));
        setText('humanGateText',t('auth.human_pass'));
      }else{
        setText('humanGateState',t('auth.human_unverified'));
        setText('humanGateText',t('auth.human_click_text'));
      }
    };
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',boot);
}else{
  boot();
}
})();
