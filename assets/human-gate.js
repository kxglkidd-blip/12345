/* Andrux Human Gate - Click verification only */
(function(){
'use strict';
var verified=false;
var SK='andrux_human_ok';

/* i18n helper */
function t(k){return(window.I18N&&window.I18N.t)?window.I18N.t(k):k;}

function $(id){return document.getElementById(id);}
function setText(id,txt){var el=$(id);if(el)el.textContent=txt;}
function hide(id){var el=$(id);if(el)el.classList.add('hidden');}
function show(id){var el=$(id);if(el)el.classList.remove('hidden');}

function pass(){
if(verified)return;
verified=true;
sessionStorage.setItem(SK,'1');
setText('humanGateState',t('auth.human_verified'));
setText('humanGateText',t('auth.human_pass'));
var gate=$('humanGate');
if(gate)gate.classList.add('ok');
}

function fail(msg){
verified=false;
sessionStorage.removeItem(SK);
setText('humanGateState',t('auth.human_unverified'));
setText('humanGateText',msg||t('auth.human_fail'));
}

function init(){
var clickBtn=$('humanClickBtn');
if(!clickBtn)return;
show('humanClickBtn');
clickBtn.addEventListener('click',function(){pass();});
}

function guard(e){
var trap=$('humanTrap');
if(trap&&trap.value){e.preventDefault();e.stopImmediatePropagation();fail(t('auth.human_required'));return;}
if(!verified&&sessionStorage.getItem(SK)!=='1'){
e.preventDefault();e.stopImmediatePropagation();fail(t('auth.human_required'));}
}

function boot(){
verified=sessionStorage.getItem(SK)==='1';
if(verified)pass();
else fail();
init();
var loginForm=$('loginForm');
	var regForm=$('registerForm');
	if(loginForm)loginForm.addEventListener('submit',guard,true);
	if(regForm)regForm.addEventListener('submit',guard,true);

/* Re-apply translations when language changes */
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

boot();
})();
