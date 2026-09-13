/* Andrux Polyfill v3 — prompt() replacement + fetch interceptor */
/* Must load BEFORE page-app.js */
(function(){
'use strict';

/* Skip if already loaded by i18n.js */
if(window.__polyfillOK) return;

/* Debug flag to verify polyfill loaded */
window.__polyfillOK = true;

/* ===== 1. Override window.prompt =====
   The obfuscated page-app.js calls prompt() for custom mute duration.
   The admin page already has <input id="globalMuteMinutes"> for this purpose.
   This polyfill reads from that input instead of showing a blocking dialog. */
var _origPrompt = window.prompt;
window.prompt = function(msg){
/* If the globalMuteMinutes input exists, use it */
var muteInput = document.getElementById('globalMuteMinutes');
if(muteInput){
var val = muteInput.value.trim();
if(!val){
/* Show toast telling user to enter minutes first */
var toastEl = document.getElementById('toast');
if(toastEl){
toastEl.textContent = (window.I18N && window.I18N.t) ? window.I18N.t('misc.mute_prompt') : (msg || '\u8bf7\u8f93\u5165');
toastEl.classList.add('show');
clearTimeout(window._ppTimer);
window._ppTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 2000);
}
return null;
}
/* Clear the input after reading */
muteInput.value = '';
return val;
}
/* Fallback: try original prompt if available */
if(_origPrompt){ try{ return _origPrompt(msg); }catch(e){ return null; } }
return null;
};

/* ===== 2. Intercept fetch for api.ipify.org + Supabase pings =====
   - api.ipify.org frequently fails (ERR_CONNECTION_RESET)
   - Supabase HEAD requests with limit=0 are "table existence" pings
     that get ERR_ABORTED when the page navigates between routes
   Use Object.defineProperty to prevent page-app.js from undoing the override */

/* Capture native fetch BEFORE any override — used by _axF */
var _nativeFetch = window.fetch.bind(window);

/* Define _axF — direct patch replacement for bare 'fetch' in page-app.js.
   Only intercept api.ipify.org; let all Supabase requests pass through normally. */
window._axF = function(input, init){
var url = '';
if (typeof input === 'string') { url = input; }
else if (input) {
if (input.url) url = input.url;
else if (input.href) url = input.href;
else { try { url = String(input); } catch(e) { url = ''; } }
}
if(url && url.indexOf('api.ipify.org') !== -1){
return Promise.resolve(new Response(JSON.stringify({ip:''}), {status:200, headers:{'Content-Type':'application/json'}}));
}
return _nativeFetch(input, init);
};

var _origFetch = window.fetch;

var _interceptedFetch = function(input, init){
/* URL extraction handles: string, Request(.url), URL(.href), other objects */
var url = '';
if (typeof input === 'string') { url = input; }
else if (input) {
if (input.url) url = input.url;
else if (input.href) url = input.href;
else { try { url = String(input); } catch(e) { url = ''; } }
}

/* Block api.ipify.org — return empty IP response */
if(url && url.indexOf('api.ipify.org') !== -1){
return Promise.resolve(new Response(JSON.stringify({ip:''}), {
status: 200,
headers: {'Content-Type': 'application/json'}
}));
}

return _origFetch.apply(this, arguments);
};

/* Lock down fetch using defineProperty */
try {
Object.defineProperty(window, 'fetch', {
value: _interceptedFetch,
writable: true,
configurable: true
});
} catch(e) {
/* Fallback: direct assignment if defineProperty fails */
window.fetch = _interceptedFetch;
}

/* Suppress console errors for aborted Supabase pings (browser-level network errors) */
var _origConsoleError = console.error;
console.error = function(){
try {
var a = Array.prototype.slice.call(arguments);
var m = (a.join(' ') || '') + '';
if (m.indexOf('ERR_ABORTED') !== -1 && m.indexOf('supabase.co') !== -1) return;
if (m.indexOf('ERR_ABORTED') !== -1 && m.indexOf('limit=0') !== -1) return;
} catch(e) {}
return _origConsoleError.apply(console, arguments);
};

/* ===== 2b. Intercept XMLHttpRequest — only intercept api.ipify.org ===== */
var _origXHROpen = XMLHttpRequest.prototype.open;
var _origXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url){
this.__axUrl = url || '';
this.__axMethod = (method || 'GET').toUpperCase();
return _origXHROpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function(body){
var url = this.__axUrl || '';
var mockResp = null;

/* Block api.ipify.org */
if(url.indexOf('api.ipify.org') !== -1){
mockResp = JSON.stringify({ip:''});
}

if(mockResp !== null){
var self = this;
/* Simulate successful 200 response asynchronously */
setTimeout(function(){
try{
Object.defineProperty(self,'readyState',{value:4,configurable:true});
Object.defineProperty(self,'status',{value:200,configurable:true});
Object.defineProperty(self,'statusText',{value:'OK',configurable:true});
Object.defineProperty(self,'responseText',{value:mockResp,configurable:true});
Object.defineProperty(self,'response',{value:mockResp,configurable:true});
Object.defineProperty(self,'responseURL',{value:url,configurable:true});
}catch(e){}
if(typeof self.onreadystatechange==='function'){
try{self.onreadystatechange(new Event('readystatechange'));}catch(e){}
}
try{self.dispatchEvent(new Event('readystatechange'));}catch(e){}
try{self.dispatchEvent(new Event('load'));}catch(e){}
try{self.dispatchEvent(new Event('loadend'));}catch(e){}
},0);
return;
}

return _origXHRSend.apply(this, arguments);
};

/* ===== 3. Silence aborted fetch errors =====
   When the page redirects (e.g., session expired -> login page),
   pending Supabase requests get ERR_ABORTED. This is normal but
   clutters the console. Suppress unhandled rejections from aborts. */
window.addEventListener('unhandledrejection', function(e){
if(e && e.reason){
var msg = (e.reason.message || '') + (e.reason.name || '');
if(msg.indexOf('AbortError') !== -1 || msg.indexOf('aborted') !== -1 || msg.indexOf('ERR_ABORTED') !== -1){
e.preventDefault();
}
}
});
})();
