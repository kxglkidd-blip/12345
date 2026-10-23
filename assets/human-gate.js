/* Andrux Human Gate — Cloudflare Turnstile */
(function(){
'use strict';
var SITEKEY='0x4AAAAAAFi4aZW5Ad3TCDp7';
var SK='andrux_human_ok';
var verified=false;
var widgetId=null;
var tokenCache='';

function t(k){return(window.I18N&&window.I18N.t)?window.I18N.t(k):k;}
function $(id){return document.getElementById(id);}
function setText(id,txt){var el=$(id);if(el)el.textContent=txt;}

function authSubmitButtons(){
  var list=[];
  ['loginForm','registerForm'].forEach(function(fid){
    var form=$(fid);
    if(!form) return;
    form.querySelectorAll('button[type="submit"], .primary-btn').forEach(function(b){
      if(list.indexOf(b)<0) list.push(b);
    });
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

function pass(token){
  verified=true;
  tokenCache=token||tokenCache||'';
  try{ sessionStorage.setItem(SK,'1'); }catch(e){}
  setText('humanGateState', t('auth.human_verified')||'已验证');
  setText('humanGateText', t('auth.human_pass')||'人机验证已通过');
  var gate=$('humanGate');
  if(gate) gate.classList.add('ok');
  setAuthButtonsEnabled(true);
}

function fail(msg){
  verified=false;
  tokenCache='';
  try{ sessionStorage.removeItem(SK); }catch(e){}
  setText('humanGateState', t('auth.human_unverified')||'未验证');
  setText('humanGateText', msg||t('auth.turnstile_need')||'请完成下方人机验证');
  var gate=$('humanGate');
  if(gate) gate.classList.remove('ok');
  setAuthButtonsEnabled(false);
}

function getToken(){
  if(tokenCache) return tokenCache;
  try{
    if(window.turnstile && widgetId!=null){
      var r=window.turnstile.getResponse(widgetId);
      if(r) return r;
    }
  }catch(e){}
  var input=document.querySelector('[name="cf-turnstile-response"]');
  return input&&input.value?input.value:'';
}

function resetWidget(){
  tokenCache='';
  verified=false;
  try{ sessionStorage.removeItem(SK); }catch(e){}
  setAuthButtonsEnabled(false);
  setText('humanGateState', t('auth.human_unverified')||'未验证');
  setText('humanGateText', t('auth.turnstile_need')||'请完成下方人机验证');
  var gate=$('humanGate');
  if(gate) gate.classList.remove('ok');
  try{
    if(window.turnstile && widgetId!=null) window.turnstile.reset(widgetId);
  }catch(e){}
}

function renderWidget(){
  var box=$('cfTurnstileBox');
  if(!box) return;
  if(!window.turnstile || typeof window.turnstile.render!=='function'){
    setText('humanGateText', t('auth.turnstile_loading')||'正在加载人机验证…');
    return;
  }
  try{
    if(widgetId!=null){
      try{ window.turnstile.remove(widgetId); }catch(e){}
      widgetId=null;
    }
    box.innerHTML='';
    widgetId=window.turnstile.render(box, {
      sitekey: SITEKEY,
      theme: 'light',
      language: (window.I18N&&window.I18N.lang==='en')?'en':'zh-cn',
      callback: function(token){
        pass(token);
      },
      'error-callback': function(){
        fail(t('auth.turnstile_error')||'人机验证失败，请重试');
        try{ if(widgetId!=null) window.turnstile.reset(widgetId); }catch(e){}
      },
      'expired-callback': function(){
        fail(t('auth.turnstile_expired')||'验证已过期，请重新完成');
      },
      'timeout-callback': function(){
        fail(t('auth.turnstile_timeout')||'验证超时，请重试');
      }
    });
  }catch(err){
    fail(t('auth.turnstile_error')||'人机验证加载失败');
  }
}

function loadScript(cb){
  if(window.turnstile){ cb(); return; }
  var existing=document.querySelector('script[data-ax-turnstile]');
  if(existing){
    existing.addEventListener('load', function(){ cb(); });
    return;
  }
  var s=document.createElement('script');
  s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async=true;
  s.defer=true;
  s.setAttribute('data-ax-turnstile','1');
  s.onload=function(){ cb(); };
  s.onerror=function(){
    fail(t('auth.turnstile_error')||'无法加载 Cloudflare 验证组件');
  };
  document.head.appendChild(s);
}

function guard(e){
  var trap=$('humanTrap');
  if(trap&&trap.value){
    e.preventDefault();
    e.stopImmediatePropagation();
    fail(t('auth.human_required'));
    return;
  }
  var token=getToken();
  if(!token){
    e.preventDefault();
    e.stopImmediatePropagation();
    fail(t('auth.turnstile_need')||'请先完成人机验证');
    return;
  }
  /* 挂到表单上供后续逻辑读取 */
  try{ e.target.__cfTurnstileToken=token; }catch(err){}
  window.__cfTurnstileToken=token;
}

function boot(){
  /* 旧会话不沿用：每次进登录页都要重新验证 */
  try{ sessionStorage.removeItem(SK); }catch(e){}
  fail(t('auth.turnstile_need')||'请完成下方人机验证');

  loadScript(function(){
    if(window.turnstile && window.turnstile.ready){
      window.turnstile.ready(renderWidget);
    }else{
      renderWidget();
    }
  });

  var loginForm=$('loginForm');
  var regForm=$('registerForm');
  if(loginForm) loginForm.addEventListener('submit', guard, true);
  if(regForm) regForm.addEventListener('submit', guard, true);

  /* 提交失败后重置 widget，避免一次性 token 复用 */
  window.axResetTurnstile=resetWidget;

  if(window.I18N){
    var origApply=window.I18N.apply;
    window.I18N.apply=function(){
      origApply.call(window.I18N);
      if(verified){
        setText('humanGateState', t('auth.human_verified')||'已验证');
        setText('humanGateText', t('auth.human_pass')||'人机验证已通过');
      }else{
        setText('humanGateState', t('auth.human_unverified')||'未验证');
        setText('humanGateText', t('auth.turnstile_need')||'请完成下方人机验证');
      }
    };
  }
}

window.axGetTurnstileToken=getToken;

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', boot);
}else{
  boot();
}
})();
