/* Andrux Script Hub — Require / Script 卡片库（支持详情查看与权限删除） */
(function(){
'use strict';

var SU='https://nyourvnfzhxbofwmavgq.supabase.co';
var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55b3Vydm5memh4Ym9md21hdmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwOTYwMTIsImV4cCI6MjEwMDY3MjAxMn0.YqztdjSz8kDAf9sHpqVeiMLjfwSbl4kvc8O5sGyJkvg';
var HDRS={apikey:SK,Authorization:'Bearer '+SK,'Content-Type':'application/json'};
var TABLE='ax_hub_scripts';
var LS_KEY='andrux_hub_cards';

function $(id){return document.getElementById(id);}
function tt(k){if(window.I18N&&typeof window.I18N.t==='function'){var v=window.I18N.t(k);if(v&&v!==k)return v;}return k;}

function toast(msg){
  var el=$('toast');if(!el)return;
  el.textContent=msg;el.classList.add('show');
  clearTimeout(toast._t);
  toast._t=setTimeout(function(){el.classList.remove('show');},2500);
}

/* 获取当前登录用户名与管理员权限 */
function getCurrentUser(){
  try{
    var su=$('sideUsername');
    if(su&&su.textContent&&su.textContent!=='Player'&&su.textContent!=='加载中...')return su.textContent.trim();
    var s=localStorage.getItem('andrux_session')||localStorage.getItem('andrux_user');
    if(s){
      try{var obj=JSON.parse(s);if(obj&&obj.username)return obj.username;}catch(e){}
    }
  }catch(e){}
  return localStorage.getItem('andrux_username')||'Player';
}

function checkIsAdmin(){
  var user=getCurrentUser().toLowerCase();
  if(user==='admin'||user==='kxglkidd'||user==='owner'||user==='root')return true;
  try{
    if(localStorage.getItem('andrux_is_admin')==='true')return true;
    if(localStorage.getItem('andrux_role')==='admin')return true;
    var s=localStorage.getItem('andrux_session');
    if(s){
      var obj=JSON.parse(s);
      if(obj&&(obj.is_admin||obj.role==='admin'))return true;
    }
  }catch(e){}
  return false;
}

/* 预置卡片 */
var DEFAULT_CARDS=[
  {id:'preset-1',type:'require',title:'Infinite Yield 命令模块',desc:'经典管理命令面板，全服广播执行。',content:'require(0vXAJuY5ZLTAZigO1rIm)',bg:'',author:'Official'},
  {id:'preset-2',type:'script',title:'天空传送脚本',desc:'将你传送到地图上空 100 格处悬浮。',content:'local c=game.Players.LocalPlayer.Character\nif c and c:FindFirstChild("HumanoidRootPart") then\nc.HumanoidRootPart.CFrame=c.HumanoidRootPart.CFrame+Vector3.new(0,100,0)\nend',bg:'',author:'Official'},
  {id:'preset-3',type:'script',title:'彩虹加速脚本',desc:'角色移动速度加倍，安全提速。',content:'local c=game.Players.LocalPlayer.Character\nlocal h=c and c:FindFirstChildOfClass("Humanoid")\nif h then h.WalkSpeed=32 end',bg:'',author:'Official'}
];

function lsGet(){try{return JSON.parse(localStorage.getItem(LS_KEY)||'[]');}catch(e){return [];}}
function lsSet(a){try{localStorage.setItem(LS_KEY,JSON.stringify(a));}catch(e){}}

var cards=[];
var dbReady=false;

function loadCards(){
  return fetch(SU+'/rest/v1/'+TABLE+'?select=*&order=created_at.desc',{headers:HDRS})
    .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(rows){
      dbReady=true;
      cards=(rows||[]).map(function(r){
        return{id:r.id,type:r.type,title:r.title,desc:r.description||'',content:r.content,bg:r.bg_url||'',author:r.author||'Community',created_at:r.created_at};
      });
      if(!cards.length){cards=DEFAULT_CARDS.slice();}
      render();
    })
    .catch(function(){
      dbReady=false;
      cards=lsGet();
      if(!cards.length){cards=DEFAULT_CARDS.slice();lsSet(cards);}
      render();
    });
}

function saveCard(card){
  card.author = getCurrentUser();
  if(dbReady){
    var postHeaders = Object.assign({}, HDRS, {
      'Prefer': 'return=representation'
    });
    return fetch(SU + '/rest/v1/' + TABLE, {
      method: 'POST',
      headers: postHeaders,
      body: JSON.stringify({
        type: card.type,
        title: card.title,
        description: card.desc,
        content: card.content,
        bg_url: card.bg,
        author: card.author
      })
    }).then(function(r){
      if(!r.ok){
        return r.text().then(function(t){
          throw new Error('HTTP ' + r.status + ': ' + t);
        });
      }
      return r.text().then(function(text){
        if (!text || !text.trim()) return [];
        try { return JSON.parse(text); } catch(e) { return []; }
      });
    }).then(function(rows){
      var newId = (rows && rows[0] && rows[0].id) ? rows[0].id : ('db-' + Date.now());
      card.id = newId;
      cards.unshift(card);
      render();
      return newId;
    });
  }
  var a = lsGet();
  card.id = 'local-' + Date.now();
  a.unshift(card);
  lsSet(a);
  cards.unshift(card);
  render();
  return Promise.resolve(card.id);
}

function deleteCard(card){
  var me=getCurrentUser();
  var isAdmin=checkIsAdmin();
  if(!isAdmin&&card.author&&card.author!==me&&card.author!=='Player'&&String(card.id).indexOf('local-')!==0){
    toast(tt('sh.delete_own_only'));
    return Promise.reject(new Error('no permission'));
  }
  if(dbReady&&String(card.id).indexOf('preset-')!==0&&String(card.id).indexOf('local-')!==0){
    return fetch(SU+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(card.id),{method:'DELETE',headers:HDRS});
  }
  var a=lsGet().filter(function(c){return c.id!==card.id;});
  lsSet(a);return Promise.resolve();
}

/* 只有作者本人（或管理员）可以更改卡片，别人的卡片一律不可改 */
function canEditCard(c){
  if(!c)return false;
  if(String(c.id).indexOf('preset-')===0)return false;
  if(checkIsAdmin())return true;
  var me=getCurrentUser();
  if(!me||me==='Player')return false;
  return !!c.author&&c.author===me;
}

/* 更新卡片：数据库卡片走 PATCH，本地卡片写回 localStorage */
function updateCard(card,data){
  if(!canEditCard(card)){
    toast(tt('sh.edit_own_only'));
    return Promise.reject(new Error('no permission'));
  }
  function apply(){
    card.type=data.type;card.title=data.title;card.desc=data.desc;
    card.content=data.content;card.bg=data.bg;
  }
  var isLocal=String(card.id).indexOf('local-')===0;
  var isPreset=String(card.id).indexOf('preset-')===0;
  if(dbReady&&!isLocal&&!isPreset){
    return fetch(SU+'/rest/v1/'+TABLE+'?id=eq.'+encodeURIComponent(card.id),{
      method:'PATCH',
      headers:Object.assign({},HDRS,{'Prefer':'return=minimal'}),
      body:JSON.stringify({
        type:data.type,
        title:data.title,
        description:data.desc,
        content:data.content,
        bg_url:data.bg
      })
    }).then(function(r){
      if(!r.ok)return r.text().then(function(t){throw new Error('HTTP '+r.status+': '+t);});
      apply();
    });
  }
  apply();
  var a=lsGet();
  for(var i=0;i<a.length;i++){if(a[i].id===card.id)a[i]=card;}
  lsSet(a);
  return Promise.resolve();
}

/* ===== 目标服务器（从 ax_gs 读取，与执行器一致，修复“暂无在线服务器”） ===== */
var currentPlaceId=null;
function loadServers(){
  var sel=$('shServerSelect');if(!sel)return;
  fetch(SU+'/rest/v1/ax_gs?select=place_id,game_name,player_count,status,last_heartbeat&hidden=eq.false&order=game_name.asc',{headers:HDRS})
    .then(function(r){return r.ok?r.json():[];})
    .then(function(rows){
      sel.innerHTML='';
      if(!rows||!rows.length){
        sel.innerHTML='<option value="">'+tt('sh.no_games')+'</option>';
        currentPlaceId=null;
        return;
      }
      var now=Date.now();
      var online=[];
      var offline=[];
      rows.forEach(function(row){
        var pid=String(row.place_id||'');
        if(!pid)return;
        var isOnline=row.status==='online';
        if(row.last_heartbeat){
          try{
            var hb=new Date(row.last_heartbeat).getTime();
            if(isFinite(hb)&&(now-hb)>60000) isOnline=false;
          }catch(e){}
        }
        var item={pid:pid,name:row.game_name||(tt('sh.game_prefix')+pid),pc:row.player_count||0,online:isOnline};
        if(isOnline) online.push(item); else offline.push(item);
      });
      var list=online.concat(offline);
      if(!list.length){
        sel.innerHTML='<option value="">'+tt('sh.no_online')+'</option>';
        return;
      }
      list.forEach(function(item){
        var opt=document.createElement('option');
        opt.value=item.pid;
        opt.textContent=item.name+' — '+(item.online?(item.pc+tt('sh.players_unit')):tt('sh.offline'));
        if(!item.online) opt.disabled=true;
        sel.appendChild(opt);
      });
      if(online.length){
        sel.value=online[0].pid;
        currentPlaceId=online[0].pid;
      }else{
        /* 只有离线：不可选，清空目标 */
        currentPlaceId=null;
        if(offline.length){
          var ph=document.createElement('option');
          ph.value='';
          ph.textContent=tt('sh.no_online');
          sel.insertBefore(ph, sel.firstChild);
          sel.value='';
        }
      }
      sel.onchange=function(){
        var v=sel.value;
        currentPlaceId=v||null;
      };
    })
    .catch(function(){
      currentPlaceId=null;
      sel.innerHTML='<option value="">'+tt('sh.load_fail')+'</option>';
    });
}

/* ===== 白名单：Require 只对白名单 Roblox 玩家执行 ===== */
function fetchWhitelistNames(){
  var user=getCurrentUser();
  if(!user||user==='Player') return Promise.resolve([]);
  return fetch(SU+'/rest/v1/rpc/ax_list_roblox',{
    method:'POST',
    headers:HDRS,
    body:JSON.stringify({p_username:user})
  })
  .then(function(r){return r.ok?r.json():null;})
  .then(function(res){
    if(res&&res.ok&&Array.isArray(res.bindings)){
      return res.bindings.map(function(b){return b.roblox_name;}).filter(Boolean);
    }
    try{
      var local=JSON.parse(localStorage.getItem('andrux_rbx_whitelist')||'[]');
      if(Array.isArray(local)&&local.length){
        return local.map(function(b){return b.username||b.name||b.roblox_name;}).filter(Boolean);
      }
    }catch(e){}
    return [];
  })
  .catch(function(){
    try{
      var local=JSON.parse(localStorage.getItem('andrux_rbx_whitelist')||'[]');
      if(Array.isArray(local)&&local.length){
        return local.map(function(b){return b.username||b.name||b.roblox_name;}).filter(Boolean);
      }
    }catch(e){}
    return [];
  });
}

/* ===== 执行 ===== */
function logExec(placeId,source){
  try{
    var n=(parseInt(localStorage.getItem('andrux_total_execs')||'0',10)||0)+1;
    localStorage.setItem('andrux_total_execs',String(n));
    window.dispatchEvent(new CustomEvent('andrux_exec_logged',{detail:{total:n}}));
  }catch(e){}
  fetch(SU+'/rest/v1/ax_exec_log',{
    method:'POST',
    headers:Object.assign({},HDRS,{Prefer:'return=minimal'}),
    body:JSON.stringify({place_id:String(placeId),source:source})
  }).catch(function(){});
}

function pushToQueue(payloads, opts){
  opts = opts || {};
  if(!currentPlaceId){
    toast(tt('sh.need_server'));return Promise.reject(new Error('no server'));
  }
  if(!Array.isArray(payloads)) payloads=[payloads];
  if(!payloads.length) return Promise.reject(new Error('empty'));
  var placeUrl=SU+'/rest/v1/ax_gs?place_id=eq.'+encodeURIComponent(currentPlaceId);
  return fetch(placeUrl+'?select=exec_queue',{headers:HDRS})
    .then(function(r){return r.json();})
    .then(function(rows){
      var q=(rows&&rows[0]&&rows[0].exec_queue)||[];
      if(!Array.isArray(q))q=[];
      payloads.forEach(function(p){q.push(p);});
      return fetch(placeUrl,{
        method:'PATCH',
        headers:Object.assign({},HDRS,{Prefer:'return=minimal'}),
        body:JSON.stringify({exec_queue:q})
      });
    })
    .then(function(r){
      if(!r.ok)return r.text().then(function(t){throw new Error('HTTP '+r.status+': '+t);});
      logExec(currentPlaceId,'scripthub');
      if(!opts.silent) toast(tt('sh.exec_ok'));
    });
}

function executeCard(c){
  var content=(c.content||'').trim();
  if(!content){toast(tt('sh.empty_content'));return;}

  if(c.type==='require'){
    // Require 只对白名单玩家执行，无需在脚本中心填写用户名
    var m=content.match(/(\d{4,})/);
    var assetId=m?m[1]:null;
    var suffix='';
    var sm=content.match(/\)\s*([.:])\s*([A-Za-z_][\w]*)/);
    if(sm) suffix=sm[1]+sm[2];

    if(!assetId){
      pushToQueue(content).catch(function(){toast(tt('sh.push_fail_conn'));});
      return;
    }

    // 推送单条 for_whitelist 指令，由 Roblox 服务端只对「在线且在白名单」的玩家执行
    // 同时仍校验本地白名单，避免未绑定用户误触
    fetchWhitelistNames().then(function(names){
      if(!names||!names.length){
        toast(tt('sh.need_whitelist'));
        return;
      }
      var payload={
        type:'asset',
        asset_id:String(assetId),
        suffix:suffix,
        username:'',
        for_whitelist:true,
        whitelist_only:true
      };
      return pushToQueue(payload,{silent:true}).then(function(){
        toast(tt('sh.require_pushed'));
      });
    }).catch(function(){toast(tt('sh.push_fail_conn'));});
    return;
  }

  // 普通 Lua 脚本
  pushToQueue(content).catch(function(){toast(tt('sh.push_fail_conn'));});
}

/* ===== 卡片详情弹窗 ===== */
var activeDetailCard=null;
var editingCard=null;
function showCardDetail(c,bgStyle){
  activeDetailCard=c;
  var m=$('shDetailModal');if(!m)return;
  /* 只有自己的卡片才显示「更改脚本」，别人的卡片该按钮隐藏 */
  var editBtn=$('detailEditBtn');
  if(editBtn)editBtn.style.display=canEditCard(c)?'':'none';
  var t=$('detailTitle');if(t)t.textContent=c.title||tt('sh.detail_title');
  var cover=$('detailCover');
  if(cover){
    cover.style.backgroundImage='none';
    if(c.bg){
      cover.style.backgroundImage="url(\""+String(c.bg).replace(/"/g,'')+"\")";
      cover.style.backgroundSize='cover';
      cover.style.backgroundPosition='center';
    }else if(bgStyle&&bgStyle.indexOf('linear')>=0){
      cover.style.background=bgStyle.replace(/^background:\s*/,'')||bgStyle;
    }else if(bgStyle&&bgStyle.indexOf('background:')===0){
      cover.style.cssText=bgStyle+';border-radius:16px;';
    }else{
      cover.style.background='linear-gradient(135deg,#203a33 0%,#11141c 55%,#6f4d2d 100%)';
    }
  }
  var badge=$('detailBadge');
  if(badge){
    badge.className='sh-card-badge '+(c.type==='require'?'sh-badge-require':'sh-badge-script');
    badge.textContent=c.type==='require'?tt('sh.badge_require'):tt('sh.badge_script');
  }
  var author=$('detailAuthor');
  if(author)author.textContent=tt('sh.author')+(c.author||tt('sh.community_player'));
  var desc=$('detailDesc');
  if(desc)desc.textContent=c.desc||tt('sh.no_desc');
  var code=$('detailContent');
  if(code)code.textContent=c.content||'';
  m.classList.add('open');
}

function closeDetailModal(){
  var m=$('shDetailModal');if(m)m.classList.remove('open');
}

/* ===== 渲染 ===== */
function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

var BG_GRADIENTS=[
  'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
  'linear-gradient(135deg,#f093fb 0%,#f5576c 100%)',
  'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)',
  'linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)',
  'linear-gradient(135deg,#fa709a 0%,#fee140 100%)',
  'linear-gradient(135deg,#30cfd0 0%,#330867 100%)'
];

function render(){
  var grid=$('shGrid');if(!grid)return;
  grid.classList.add('ax-stagger');
  var kw=($('shSearchInput')&&$('shSearchInput').value||'').toLowerCase();
  grid.innerHTML='';
  var me=getCurrentUser();
  var isAdmin=checkIsAdmin();

  var list=cards.filter(function(c){return !kw||(c.title||'').toLowerCase().indexOf(kw)>-1||(c.desc||'').toLowerCase().indexOf(kw)>-1;});
  if(!list.length){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:40px 0">'+tt('sh.no_match')+'</div>';
    return;
  }
  list.forEach(function(c,idx){
    var el=document.createElement('div');
    el.className='sh-card';
    var badge=c.type==='require'?'<span class="sh-card-badge sh-badge-require">Require</span>':'<span class="sh-card-badge sh-badge-script">Script</span>';
    var bgStyle=c.bg?"background-image:url('"+escapeHtml(c.bg)+"')":'background:'+BG_GRADIENTS[idx%BG_GRADIENTS.length];
    
    // 删除权限：仅作者或管理员可删除
    var canDelete=isAdmin||(c.author&&c.author===me)||(String(c.id).indexOf('local-')===0);
    var delBtnHtml=canDelete?'<button class="sh-del-btn" title="'+tt('sh.delete_card')+'">🗑</button>':'';

    el.innerHTML=
      '<div class="sh-card-cover" style="'+bgStyle+'">'+badge+'</div>'+
      '<div class="sh-card-body">'+
        '<div class="sh-card-info">'+
          '<h4>'+escapeHtml(c.title)+'</h4>'+
          '<p>'+escapeHtml(c.desc||tt('sh.no_intro'))+'</p>'+
          '<div class="sh-card-meta">'+tt('sh.author_prefix')+escapeHtml(c.author||tt('sh.community'))+'</div>'+
        '</div>'+
        '<div class="sh-card-actions">'+
          '<button class="sh-exec-btn">'+tt('sh.exec')+'</button>'+
          delBtnHtml+
        '</div>'+
      '</div>';

    // 点击卡片本体打开详细内容
    el.onclick=function(e){
      if(e.target.closest('.sh-exec-btn')||e.target.closest('.sh-del-btn'))return;
      showCardDetail(c,bgStyle);
    };

    el.querySelector('.sh-exec-btn').onclick=function(e){
      e.stopPropagation();
      executeCard(c);
    };

    var delBtn=el.querySelector('.sh-del-btn');
    if(delBtn){
      delBtn.onclick=function(e){
        e.stopPropagation();
        if(!confirm(tt('sh.confirm_delete')+c.title+tt('sh.confirm_delete_end')))return;
        deleteCard(c).then(function(){toast(tt('sh.card_deleted'));loadCards();}).catch(function(err){if(err&&err.message!=='no permission')toast(tt('sh.push_fail_conn'));});
      };
    }

    grid.appendChild(el);
  });
}

/* ===== 初始化交互 ===== */
function updateContentFieldByType(){
  var typeSel=$('cardType');
  var lbl=$('cardContentLabel');
  var ta=$('cardContent');
  if(!typeSel)return;
  var isReq=typeSel.value==='require';
  if(lbl){lbl.textContent=isReq?tt('sh.content_label_require'):tt('sh.content_label_script');lbl.setAttribute('data-i18n',isReq?'sh.content_label_require':'sh.content_label_script');}
  if(ta){ta.placeholder=isReq?tt('sh.content_ph_require'):tt('sh.content_ph_script');ta.setAttribute('data-i18n-ph',isReq?'sh.content_ph_require':'sh.content_ph_script');}
}
function openModal(card){
  editingCard=card||null;
  var m=$('shModal');if(!m)return;
  var title=$('modalTitle');
  var saveBtn=m.querySelector('.sh-modal-btn-save');
  if(editingCard){
    /* 编辑模式：标题/按钮切换为「更改」，并把原卡片内容填回表单 */
    if(title){title.textContent=tt('sh.modal_edit_title');title.setAttribute('data-i18n','sh.modal_edit_title');}
    if(saveBtn){saveBtn.textContent=tt('sh.save_changes');saveBtn.setAttribute('data-i18n','sh.save_changes');}
    if($('cardType'))$('cardType').value=editingCard.type==='require'?'require':'script';
    if($('cardTitle'))$('cardTitle').value=editingCard.title||'';
    if($('cardDesc'))$('cardDesc').value=editingCard.desc||'';
    if($('cardContent'))$('cardContent').value=editingCard.content||'';
    if($('cardBg'))$('cardBg').value=editingCard.bg||'';
  }else{
    if($('shAddForm'))$('shAddForm').reset();
    if(title){title.textContent=tt('sh.modal_add_title');title.setAttribute('data-i18n','sh.modal_add_title');}
    if(saveBtn){saveBtn.textContent=tt('sh.save_card');saveBtn.setAttribute('data-i18n','sh.save_card');}
  }
  m.classList.add('open');
  updateContentFieldByType();
}
function closeModal(){var m=$('shModal');if(m)m.classList.remove('open');editingCard=null;}

function initUI(){
  var btn=$('shOpenAddModal');if(btn)btn.onclick=function(){openModal();};
  var close=$('shCloseModal');if(close)close.onclick=closeModal;
  var cancel=$('shCancelBtn');if(cancel)cancel.onclick=closeModal;
  var mask=$('shModal');
  if(mask)mask.addEventListener('click',function(e){if(e.target===mask)closeModal();});

  // 详情弹窗
  var closeD=$('shCloseDetailModal');if(closeD)closeD.onclick=closeDetailModal;
  var closeD2=$('detailCloseBtn');if(closeD2)closeD2.onclick=closeDetailModal;
  var dMask=$('shDetailModal');
  if(dMask)dMask.addEventListener('click',function(e){if(e.target===dMask)closeDetailModal();});

  var copyBtn=$('detailCopyBtn');
  if(copyBtn)copyBtn.onclick=function(){
    var code=$('detailContent');
    if(code&&navigator.clipboard){
      navigator.clipboard.writeText(code.textContent||'').then(function(){toast(tt('sh.copied'));});
    }
  };

  var dExecBtn=$('detailExecBtn');
  if(dExecBtn)dExecBtn.onclick=function(){
    if(activeDetailCard){executeCard(activeDetailCard);closeDetailModal();}
  };

  /* 详情里点「更改脚本」→ 打开编辑表单（仅自己的卡片可见） */
  var dEditBtn=$('detailEditBtn');
  if(dEditBtn)dEditBtn.onclick=function(){
    if(!activeDetailCard)return;
    if(!canEditCard(activeDetailCard)){toast(tt('sh.edit_own_only'));return;}
    var c=activeDetailCard;
    closeDetailModal();
    openModal(c);
  };

  var typeSel=$('cardType');
  if(typeSel){
    typeSel.onchange=updateContentFieldByType;
    updateContentFieldByType();
  }

  var form=$('shAddForm');
  if(form)form.onsubmit=function(e){
    e.preventDefault();
    var type=$('cardType').value;
    var title=$('cardTitle').value.trim();
    var content=$('cardContent').value.trim();
    var desc=$('cardDesc').value.trim();
    var bg=$('cardBg').value.trim();
    if(!title||!content){toast(tt('sh.need_title_content'));return;}
    var data={type:type,title:title,desc:desc,content:content,bg:bg};

    /* 编辑模式：更新已有卡片；新增模式：发布新卡片 */
    var editing=editingCard;
    if(editing){
      updateCard(editing,data)
        .then(function(){
          editingCard=null;
          closeModal();
          $('shAddForm').reset();
          updateContentFieldByType();
          toast(tt('sh.card_updated'));
          loadCards();
        })
        .catch(function(err){if(!err||err.message!=='no permission')toast(tt('sh.update_fail')+((err&&err.message)||''));});
      return;
    }

    saveCard(data)
      .then(function(){
        closeModal();
        $('shAddForm').reset();
        updateContentFieldByType();
        toast(tt('sh.card_published'));
        loadCards();
      })
      .catch(function(err){toast(tt('sh.save_fail')+err.message);});
  };

  var search=$('shSearchInput');
  if(search)search.oninput=render;
}

function init(){
  initUI();
  loadServers();
  loadCards();
  setInterval(loadServers,30000);
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}
else{init();}

window.AndruxHub={reload:loadCards,execute:executeCard};
window.addEventListener('andrux_lang_change',function(){
  try{
    updateContentFieldByType();
    loadServers();
    render();
  }catch(e){}
});

})();