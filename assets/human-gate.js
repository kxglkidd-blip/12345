/* Andrux Human Gate — multi-challenge (no Turnstile) */
(function(){
'use strict';
var SK='andrux_human_ok';
var verified=false;
var mode=null;
var holdTimer=null;
var holdProgress=0;
var mathA=0, mathB=0, mathOp='+';
var slideDone=false;
var seqTarget=[];
var seqGot=[];
var pickAnswer='';

function t(k){return(window.I18N&&window.I18N.t)?window.I18N.t(k):k;}
function $(id){return document.getElementById(id);}
function setText(id,txt){var el=$(id);if(el)el.textContent=txt;}
function hideAllModes(){
  ['humanHoldBtn','humanMathBox','humanSlideBox','humanClickBtn','humanSeqBox','humanPickBox'].forEach(function(id){
    var el=$(id); if(el) el.classList.add('hidden');
  });
}
function show(id){var el=$(id); if(el) el.classList.remove('hidden');}

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

function pass(){
  verified=true;
  /* 带时间戳，避免被简单写成 '1' 长期复用；登录页仍每次 boot 清除 */
  try{ sessionStorage.setItem(SK, 'ok:'+String(Date.now())); }catch(e){}
  setText('humanGateState', t('auth.human_verified')||'已验证');
  setText('humanGateText', t('auth.human_pass')||'人机验证已通过');
  var gate=$('humanGate');
  if(gate) gate.classList.add('ok');
  setAuthButtonsEnabled(true);
  hideAllModes();
}

function fail(msg){
  verified=false;
  try{ sessionStorage.removeItem(SK); }catch(e){}
  setText('humanGateState', t('auth.human_unverified')||'未验证');
  setText('humanGateText', msg||t('auth.human_click_text')||'请完成人机验证');
  var gate=$('humanGate');
  if(gate) gate.classList.remove('ok');
  setAuthButtonsEnabled(false);
}

function randInt(a,b){ return a+Math.floor(Math.random()*(b-a+1)); }
function shuffle(arr){
  var a=arr.slice();
  for(var i=a.length-1;i>0;i--){
    var j=Math.floor(Math.random()*(i+1));
    var t=a[i]; a[i]=a[j]; a[j]=t;
  }
  return a;
}

/* ---- modes ---- */
function startHold(){
  mode='hold';
  holdProgress=0;
  show('humanHoldBtn');
  setText('humanGateText', t('auth.human_hold_text')||'按住按钮约 1.5 秒');
  var label=$('humanHoldLabel');
  if(label) label.textContent=t('auth.human_hold_btn')||'按住验证';
  var bar=$('humanHoldBar');
  if(bar) bar.style.width='0%';
}

function startMath(){
  mode='math';
  mathOp=Math.random()<0.5?'+':'-';
  if(mathOp==='+'){
    mathA=randInt(3,18); mathB=randInt(2,14);
  }else{
    mathA=randInt(8,24); mathB=randInt(1,mathA-1);
  }
  show('humanMathBox');
  setText('humanMathQuestion', mathA+' '+mathOp+' '+mathB+' = ?');
  setText('humanGateText', t('auth.human_math_text')||'请算出正确答案');
  var ans=$('humanMathAnswer');
  if(ans){
    ans.value='';
    ans.placeholder=t('auth.human_math_ph')||'输入答案';
    setTimeout(function(){ try{ans.focus();}catch(e){} }, 50);
  }
  var mb=$('humanMathBtn');
  if(mb) mb.textContent=t('auth.human_math_btn')||'确认';
}

function startSlide(){
  mode='slide';
  slideDone=false;
  show('humanSlideBox');
  setText('humanGateText', t('auth.human_slide_text')||'把滑块拖到最右边');
  var sq=$('humanSlideQuestion');
  if(sq) sq.textContent=t('auth.human_slide_text')||'把滑块拖到最右边';
  var fill=$('humanSliderFill');
  var thumb=$('humanSliderThumb');
  if(fill) fill.style.width='0%';
  if(thumb){ thumb.style.left='0%'; thumb.textContent=t('auth.human_slide_thumb')||'拖动'; }
  var tip=$('humanSliderText');
  if(tip) tip.textContent=t('auth.human_slide_tip')||'拖到最右完成验证';
}

function startSeq(){
  mode='seq';
  seqTarget=shuffle([1,2,3,4]).slice(0,3);
  seqGot=[];
  show('humanSeqBox');
  setText('humanGateText', (t('auth.human_seq_text')||'按顺序点击')+' '+seqTarget.join(' → '));
  var box=$('humanSeqBox');
  if(!box) return;
  box.innerHTML='<div class="human-seq-hint" id="humanSeqHint"></div><div class="human-seq-btns" id="humanSeqBtns"></div>';
  setText('humanSeqHint', (t('auth.human_seq_order')||'顺序')+': '+seqTarget.join(' → '));
  var btns=$('humanSeqBtns');
  shuffle([1,2,3,4]).forEach(function(n){
    var b=document.createElement('button');
    b.type='button';
    b.className='human-seq-btn';
    b.textContent=String(n);
    b.dataset.n=String(n);
    b.addEventListener('click', function(){
      if(verified||mode!=='seq') return;
      seqGot.push(n);
      b.classList.add('is-picked');
      b.disabled=true;
      if(seqGot.length===seqTarget.length){
        var ok=seqGot.every(function(v,i){ return v===seqTarget[i]; });
        if(ok) pass();
        else {
          fail(t('auth.human_fail')||'验证失败，请重试');
          setTimeout(startRandomMode, 500);
        }
      }
    });
    btns.appendChild(b);
  });
}

function isEn(){ return !!(window.I18N && window.I18N.lang==='en'); }
function startPick(){
  mode='pick';
  show('humanPickBox');
  var animals=isEn()?['Cat','Dog','Bird','Fish','Rabbit','Bear']:['猫','狗','鸟','鱼','兔','熊'];
  var colors=isEn()?['Red','Blue','Green','Yellow']:['红','蓝','绿','黄'];
  var useAnimal=Math.random()<0.5;
  var pool=useAnimal?animals:colors;
  pickAnswer=pool[randInt(0,pool.length-1)];
  var options=shuffle(pool).slice(0,4);
  if(options.indexOf(pickAnswer)<0) options[0]=pickAnswer;
  options=shuffle(options);
  var q=(t('auth.human_pick_text')||'请点击')+' 「'+pickAnswer+'」';
  setText('humanGateText', q);
  var box=$('humanPickBox');
  if(!box) return;
  box.innerHTML='';
  options.forEach(function(label){
    var b=document.createElement('button');
    b.type='button';
    b.className='human-pick-btn';
    b.textContent=label;
    b.addEventListener('click', function(){
      if(verified||mode!=='pick') return;
      if(label===pickAnswer) pass();
      else {
        fail(t('auth.human_fail')||'验证失败，请重试');
        setTimeout(startRandomMode, 500);
      }
    });
    box.appendChild(b);
  });
}

var MODES=['hold','math','slide','seq','pick'];
function startRandomMode(){
  if(verified) return;
  hideAllModes();
  holdProgress=0;
  if(holdTimer){ clearInterval(holdTimer); holdTimer=null; }
  var m=MODES[randInt(0,MODES.length-1)];
  if(m==='hold') startHold();
  else if(m==='math') startMath();
  else if(m==='slide') startSlide();
  else if(m==='seq') startSeq();
  else startPick();
}

/* ---- bind interactions ---- */
function bindHold(){
  var btn=$('humanHoldBtn');
  if(!btn) return;
  var NEED=1500;
  function start(e){
    if(verified||mode!=='hold') return;
    if(e && e.preventDefault) e.preventDefault();
    holdProgress=0;
    var bar=$('humanHoldBar');
    if(holdTimer) clearInterval(holdTimer);
    holdTimer=setInterval(function(){
      holdProgress+=50;
      if(bar) bar.style.width=Math.min(100, (holdProgress/NEED)*100)+'%';
      if(holdProgress>=NEED){
        clearInterval(holdTimer); holdTimer=null;
        pass();
      }
    }, 50);
  }
  function end(e){
    if(e && e.preventDefault) e.preventDefault();
    if(holdTimer){ clearInterval(holdTimer); holdTimer=null; }
    if(!verified && mode==='hold'){
      holdProgress=0;
      var bar=$('humanHoldBar');
      if(bar) bar.style.width='0%';
    }
  }
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
  btn.addEventListener('touchstart', start, {passive:false});
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
}

function bindMath(){
  var btn=$('humanMathBtn');
  var input=$('humanMathAnswer');
  function check(){
    if(verified||mode!=='math') return;
    var v=parseInt((input&&input.value)||'', 10);
    var expect=mathOp==='+'?(mathA+mathB):(mathA-mathB);
    if(v===expect) pass();
    else {
      fail(t('auth.human_fail')||'答案错误');
      setTimeout(startRandomMode, 500);
    }
  }
  if(btn) btn.addEventListener('click', check);
  if(input) input.addEventListener('keydown', function(e){
    if(e.key==='Enter'){ e.preventDefault(); check(); }
  });
}

function bindSlide(){
  var track=$('humanSlider');
  var thumb=$('humanSliderThumb');
  var fill=$('humanSliderFill');
  if(!track||!thumb) return;
  var dragging=false;
  function pctFromEvent(e){
    var rect=track.getBoundingClientRect();
    var x=0;
    if(e.touches&&e.touches[0]) x=e.touches[0].clientX;
    else if(e.changedTouches&&e.changedTouches[0]) x=e.changedTouches[0].clientX;
    else x=e.clientX;
    var p=(x-rect.left)/rect.width;
    return Math.max(0, Math.min(1, p));
  }
  function move(e){
    if(!dragging||verified||mode!=='slide') return;
    if(e.cancelable) e.preventDefault();
    var p=pctFromEvent(e);
    if(fill) fill.style.width=(p*100)+'%';
    thumb.style.left=(p*100)+'%';
    if(p>=0.92){
      dragging=false;
      if(fill) fill.style.width='100%';
      thumb.style.left='100%';
      pass();
    }
  }
  function up(e){
    if(!dragging) return;
    dragging=false;
    if(verified) return;
    var p=pctFromEvent(e);
    if(p<0.92){
      if(fill) fill.style.width='0%';
      thumb.style.left='0%';
    }
  }
  function down(e){
    if(verified||mode!=='slide') return;
    dragging=true;
    move(e);
  }
  thumb.addEventListener('mousedown', down);
  track.addEventListener('mousedown', down);
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
  thumb.addEventListener('touchstart', down, {passive:false});
  track.addEventListener('touchstart', down, {passive:false});
  document.addEventListener('touchmove', move, {passive:false});
  document.addEventListener('touchend', up);
}

function guard(e){
  var trap=$('humanTrap');
  if(trap&&trap.value){
    e.preventDefault();
    e.stopImmediatePropagation();
    fail(t('auth.human_required')||'请先完成人机验证');
    return;
  }
  if(!verified && !isHumanOk()){
    e.preventDefault();
    e.stopImmediatePropagation();
    fail(t('auth.human_required')||'请先完成人机验证');
  }
}
function isHumanOk(){
  if(verified) return true;
  try{
    var v=sessionStorage.getItem(SK)||'';
    if(v.indexOf('ok:')!==0) return false;
    var ts=parseInt(v.slice(3),10);
    if(!ts||isNaN(ts)) return false;
    if(Date.now()-ts>15*60*1000) return false; /* 15 分钟有效 */
    return true;
  }catch(e){ return false; }
}
window.axIsHumanOk=isHumanOk;


function boot(){
  try{ sessionStorage.removeItem(SK); }catch(e){}
  verified=false;
  setAuthButtonsEnabled(false);
  fail(t('auth.human_click_text')||'请完成人机验证');

  bindHold();
  bindMath();
  bindSlide();
  startRandomMode();

  var loginForm=$('loginForm');
  var regForm=$('registerForm');
  if(loginForm) loginForm.addEventListener('submit', guard, true);
  if(regForm) regForm.addEventListener('submit', guard, true);

  var refreshBtn=$('humanRefreshBtn');
  if(refreshBtn){
    refreshBtn.addEventListener('click', function(){
      if(verified) return;
      startRandomMode();
    });
  }

  if(window.I18N){
    var origApply=window.I18N.apply;
    window.I18N.apply=function(){
      origApply.call(window.I18N);
      if(verified){
        setText('humanGateState', t('auth.human_verified')||'已验证');
        setText('humanGateText', t('auth.human_pass')||'人机验证已通过');
      } else {
        /* 语言切换后刷新当前挑战文案 */
        try{
          if(mode==='hold') startHold();
          else if(mode==='math') startMath();
          else if(mode==='slide') startSlide();
          else if(mode==='seq') startSeq();
          else if(mode==='pick') startPick();
          else startRandomMode();
        }catch(e){}
      }
      var rb=$('humanRefreshBtn');
      if(rb) rb.title=t('auth.human_refresh')||'换一种验证';
    };
  }
  window.addEventListener('andrux_lang_change', function(){
    if(verified) return;
    try{
      if(mode==='hold') startHold();
      else if(mode==='math') startMath();
      else if(mode==='slide') startSlide();
      else if(mode==='seq') startSeq();
      else if(mode==='pick') startPick();
    }catch(e){}
  });
}

window.axResetHumanGate=function(){
  verified=false;
  try{ sessionStorage.removeItem(SK); }catch(e){}
  setAuthButtonsEnabled(false);
  startRandomMode();
};

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', boot);
}else{
  boot();
}
})();
