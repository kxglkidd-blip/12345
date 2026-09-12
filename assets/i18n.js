/* ============================================================
   Andrux Polyfill (embedded in i18n.js for guaranteed early load)
   ============================================================ */
(function(){
'use strict';
window.__polyfillOK = true;

/* Override prompt() — use globalMuteMinutes input instead of blocking dialog */
var _origPrompt = window.prompt;
window.prompt = function(msg){
var mi = document.getElementById('globalMuteMinutes');
if(mi){
var v = mi.value.trim();
if(!v){
var t = document.getElementById('toast');
if(t){t.textContent=(window.I18N&&window.I18N.t)?window.I18N.t('misc.mute_prompt'):(msg||'\u8bf7\u8f93\u5165');t.classList.add('show');clearTimeout(window._ppT);window._ppT=setTimeout(function(){t.classList.remove('show');},2000);}
return null;
}
mi.value='';
return v;
}
if(_origPrompt){try{return _origPrompt(msg);}catch(e){return null;}}
return null;
};

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

/* Override fetch — only intercept api.ipify.org */
var _origFetch = window.fetch;
var _if = function(input, init){
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
return _origFetch.apply(this, arguments);
};
try{Object.defineProperty(window,'fetch',{value:_if,writable:true,configurable:true});}catch(e){window.fetch=_if;}

/* Suppress console errors for aborted Supabase pings (browser-level network errors) */
var _origCE = console.error;
console.error = function(){
try {
var a = Array.prototype.slice.call(arguments);
var m = (a.join(' ') || '') + '';
if (m.indexOf('ERR_ABORTED') !== -1 && m.indexOf('supabase.co') !== -1) return;
if (m.indexOf('ERR_ABORTED') !== -1 && m.indexOf('limit=0') !== -1) return;
} catch(e) {}
return _origCE.apply(console, arguments);
};

/* Override XMLHttpRequest — only intercept api.ipify.org */
var _xo = XMLHttpRequest.prototype.open;
var _xs = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function(m,u){this.__axU=u||'';this.__axM=(m||'GET').toUpperCase();return _xo.apply(this,arguments);};
XMLHttpRequest.prototype.send = function(b){
var u=this.__axU||'', r=null;
if(u.indexOf('api.ipify.org')!==-1){r=JSON.stringify({ip:''});}
if(r!==null){
var s=this;
setTimeout(function(){
try{Object.defineProperty(s,'readyState',{value:4,configurable:true});Object.defineProperty(s,'status',{value:200,configurable:true});Object.defineProperty(s,'statusText',{value:'OK',configurable:true});Object.defineProperty(s,'responseText',{value:r,configurable:true});Object.defineProperty(s,'response',{value:r,configurable:true});Object.defineProperty(s,'responseURL',{value:u,configurable:true});}catch(e){}
if(typeof s.onreadystatechange==='function'){try{s.onreadystatechange(new Event('readystatechange'));}catch(e){}}
try{s.dispatchEvent(new Event('readystatechange'));}catch(e){}
try{s.dispatchEvent(new Event('load'));}catch(e){}
try{s.dispatchEvent(new Event('loadend'));}catch(e){}
},0);
return;
}
return _xs.apply(this,arguments);
};

/* Silence aborted fetch errors */
window.addEventListener('unhandledrejection', function(e){
if(e&&e.reason){
var m=(e.reason.message||'')+(e.reason.name||'');
if(m.indexOf('AbortError')!==-1||m.indexOf('aborted')!==-1||m.indexOf('ERR_ABORTED')!==-1){e.preventDefault();}
}
});
})();

/* ============================================================
   Andrux i18n Engine — Chinese / English
   ============================================================ */
window.I18N = {
  lang: localStorage.getItem('andrux_lang') || 'zh',

  dict: {
    zh: {
      /* ===== Sidebar / Nav ===== */
      'nav.menu': '菜单',
      'nav.player_center': '玩家中心',
      'nav.logged_in': '已登录，社区权限已开启',
      'nav.logout': '退出登录',
      'nav.exit': '退出',
      'nav.dashboard': '仪表盘',
      'nav.game': '游戏',
      'nav.executor': '执行器',
      'nav.community': '社区',
      'nav.admin': '管理员',
      'nav.profile': '主页',
      'nav.settings': '设置',

      /* ===== Dashboard ===== */
      'dash.eyebrow': '控制台',
      'dash.title': 'Andrux 仪表盘',
      'dash.desc': '这里是登录后的主页面，用来展示玩家状态、社区安全策略和当前系统保护。页面只在登录或注册后开放。',
      'dash.online_users': '在线用户',
      'dash.community_msgs': '社区消息',
      'dash.chat_channels': '聊天分区',
      'dash.recall_window': '秒内可撤回',
      'dash.sys_status': '系统状态',
      'dash.access_open': '访问已开启',
      'dash.access_desc': '你已进入 Andrux 玩家中心，可以查看仪表盘并进入社区页面。未登录用户只会看到登录和注册入口。',

      /* ===== Community ===== */
      'comm.eyebrow': '社区',
      'comm.title': '玩家聊天区',
      'comm.desc': '右键只在社区消息上生效，可撤回、引用、复制。脚本区支持 txt、lua，Require 区支持 txt、lua、rbxm、rbxl，文件发送同样限制刷屏。',
      'comm.channel_general': '普通聊天区',
      'comm.channel_general_desc': '日常交流，限制刷屏',
      'comm.channel_scripts': '脚本区',
      'comm.channel_scripts_desc': '支持 txt、lua，禁止频繁发送',
      'comm.channel_require': 'Require 区',
      'comm.channel_require_desc': '支持 txt、lua、rbxm、rbxl',
      'comm.general_title': '普通聊天区',
      'comm.general_desc': '请保持聊天干净，禁止关键词内容和重复刷屏。',
      'comm.reload': '重新加载',
      'comm.quote_content': '引用内容',
      'comm.cancel_quote': '取消引用',
      'comm.input_placeholder': '输入消息，最多 500 字',
      'comm.send': '发送',
      'comm.sending': '发送中...',
      'comm.file_disabled': '当前分区不支持文件',
      'comm.file_none': '未选择文件',
      'comm.file_supported': '支持 ',
      'comm.file_remove': '删除文件',
      'comm.notice': '提示：同一账号短时间内连续发送会被拦截。',
      'comm.recall': '撤回',
      'comm.quote': '引用',
      'comm.copy': '复制',
      'comm.delete': '删除',
      'comm.msg_recalled': '消息已撤回',
      'comm.loading': '加载中...',

      /* ===== Game ===== */
      'game.eyebrow': 'Game',
      'game.title': '游戏状态',
      'game.desc': '当前 Roblox 游戏的实时状态，自动刷新。',
      'game.no_data': '暂无游戏上报数据',
      'game.online': '在线',
      'game.offline': '离线',
      'game.join': '加入游戏',
      'game.players': '在线玩家',
      'game.load_error': '无法读取游戏状态，请确认已执行 SQL。',

      /* ===== Admin ===== */
      'admin.eyebrow': 'Admin',
      'admin.title': 'Restricted',
      'admin.enter_password': '请输入密码',
      'admin.password_label': '请输入密码',
      'admin.enter': '进入',
      'admin.global_mute': '全员禁言',
      'admin.mute_status_off': '当前未开启全员禁言。',
      'admin.mute_status_forever': '全员永久禁言中。',
      'admin.mute_status_until': '全员禁言至 ',
      'admin.mute_status_expired': '全员禁言已过期。',
      'admin.mute_status_error': '无法读取状态。',
      'admin.refresh': '刷新',
      'admin.mute_10': '全员10分钟',
      'admin.mute_60': '全员1小时',
      'admin.mute_forever': '永久全员',
      'admin.mute_custom': '自定义全员',
      'admin.mute_off': '关闭全员禁言',
      'admin.mute_minutes_ph': '分钟',
      'admin.ip_ban': 'IP 封禁管理',
      'admin.ip_input_ph': '输入 IP 地址',
      'admin.ip_ban_btn': '封锁IP',
      'admin.ip_unban_btn': '解封IP',
      'admin.game_mgmt': '游戏管理',
      'admin.show_hidden': '显示已隐藏',
      'admin.hide_game': '隐藏游戏',
      'admin.restore_game': '恢复显示',
      'admin.player_mgmt': '玩家管理',
      'admin.community_mgmt': '社区管理',
      'admin.delete': '删除',
      'admin.mute': '禁言',
      'admin.unmute': '解禁',
      'admin.clear_msgs': '清空消息',
      'admin.no_games': '暂无游戏。',
      'admin.no_users': '暂无用户。',
      'admin.no_msgs': '暂无消息。',
      'admin.load_fail': '加载失败',
      'admin.no_heartbeat': '无心跳',
      'admin.muted_status': '禁言中',
      'admin.normal_status': '正常',
      'admin.clear_user_msgs': '清空该用户消息',
      'admin.no_banned_ips': '暂无已封禁 IP。',
      'admin.ip_unban_input': '请输入要解封的 IP',
      'admin.no_ip': '无IP记录',
      'admin.no_ip_lock': '该用户无IP记录，无法锁IP',
      'admin.no_ip_unlock': '该用户无IP记录，无法解IP',
      'admin.lock_ip': '锁IP',
      'admin.unlock_ip': '解IP',
      'admin.confirm_lock_ip': '确定要锁IP',
      'admin.confirm_unlock_ip': '确定要解IP',
      'admin.rename': '改名',
      'admin.rename_confirm': '确认改名',
      'admin.rename_cancel': '取消',
      'admin.rename_restore': '恢复原名',
      'admin.rename_ph': '输入新用户名',
      'admin.rename_confirm_msg': '确定要将',
      'admin.rename_to': '改为',
      'admin.rename_empty': '新用户名不能为空',
      'admin.rename_same': '新用户名与当前相同',
      'admin.rename_success': '改名成功：',
      'admin.rename_fail': '改名失败：',
      'admin.rename_exists': '该用户名已存在',
      'admin.restore_success': '已恢复原名：',
      'admin.restore_fail': '恢复失败：',
      'admin.title_btn': '头衔',
      'admin.title_ph': '输入自定义头衔',
      'admin.title_confirm': '确认',
      'admin.title_clear': '清除',
      'admin.title_success': '头衔已设置 ',
      'admin.title_cleared': '头衔已清除 ',
      'admin.title_fail': '头衔设置失败：',
      'admin.title_too_long': '头衔不能超过12个字符',

      /* ===== Executor ===== */
      'exec.eyebrow': 'Executor',
      'exec.title': '脚本执行器',
      'exec.desc': '向在线 Roblox 服务器推送 Lua 脚本，脚本将在下一次心跳时被执行并清空队列。',
      'exec.password_label': '请输入管理员密码',
      'exec.enter': '进入',
      'exec.target': '目标服务器',
      'exec.script_editor': '脚本编辑器',
      'exec.char_count': '0 字符',
      'exec.placeholder': '在此输入 Lua 脚本...',
      'exec.push': '推送执行',
      'exec.pushing': '推送中...',
      'exec.clear': '清空编辑器',
      'exec.status_idle': '选择一个在线服务器，输入脚本后推送。',
      'exec.mode_hint': '支持两种模式：1) 直接输入 Lua 代码（需开启 LoadStringEnabled） 2) 输入 Roblox ModuleScript 的 Asset ID（纯数字，无需 LoadStringEnabled）',
      'exec.no_games': '暂无游戏。',
      'exec.players_unit': ' 人',
      'exec.char_unit': ' 字符',

      /* ===== Settings ===== */
      'set.eyebrow': '设置',
      'set.title': '偏好设置',
      'set.desc': '这些设置会保存在当前浏览器里，刷新页面后仍然生效。',
      'set.appearance': '外观',
      'set.density': '界面密度',
      'set.density_desc': '紧凑模式会减少卡片间距，让电脑端显示更多内容。',
      'set.animation': '动画',
      'set.reduce_motion': '减少动画',
      'set.reduce_motion_desc': '开启后会保留基本反馈，但页面切换和卡片浮动会更克制。',
      'set.community': '社区',
      'set.chat_refresh': '聊天刷新',
      'set.chat_refresh_desc': '选择聊天自动刷新速度，慢速更省请求，快速更及时。',
      'set.refresh_slow': '慢速',
      'set.refresh_standard': '标准',
      'set.refresh_fast': '快速',
      'set.account': '账户',
      'set.switch_account': '切换账户',
      'set.switch_account_desc': '返回登录页，方便换另一个用户名登录。设置会保留。',
      'set.logout_account': '退出账户',
      'set.logout_desc': '退出当前账户，并清空当前会话。',
      'set.local': '本地',
      'set.clear_local': '清空本地状态',
      'set.clear_local_desc': '清除引用、待发送文件、管理员解锁状态和本地偏好。',
      'set.clear': '清空',
      'set.language': '语言',
      'set.language_desc': '切换界面语言，所有文字和提示会立即生效。',

      /* ===== Toast / Dynamic messages ===== */
      'toast.key_blocked': '该快捷键已被页面拦截。',
      'toast.copy_blocked': '复制只允许通过社区消息右键菜单。',
      'toast.rated': '请求过于频繁，请稍后。',
      'toast.recalled': '已撤回。',
      'toast.recall_fail': '操作失败。',
      'toast.deleted': '已删除（仅自己不可见）',
      'toast.copied': '已复制。',
      'toast.copy_fail': '复制失败。',
      'toast.cannot_quote': '该消息不能引用。',
      'toast.cannot_copy': '该消息不能复制。',
      'toast.file_too_big': '文件不能超过 2MB。',
      'toast.file_type_err': '当前分区不支持该文件类型。',
      'toast.register_ok': '注册成功',
      'toast.login_ok': '登录成功',
      'toast.password_ok': '验证通过',
      'toast.password_err': '密码错误',
      'toast.mute_on': '已设置全员禁言',
      'toast.mute_off': '已关闭全员禁言',
      'toast.op_fail': '操作失败',
      'toast.deleted_user': '已删除',
      'toast.delete_fail': '删除失败',
      'toast.muted': '已禁言',
      'toast.mute_fail': '禁言失败',
      'toast.unmuted': '已解禁',
      'toast.unmute_fail': '解禁失败',
      'toast.cleared_msgs': '已清空',
      'toast.clear_fail': '清空失败',
      'toast.game_hidden': '已隐藏游戏',
      'toast.game_restored': '已恢复显示',
      'toast.script_pushed': '脚本已推送',
      'toast.cleared': '已清空',
      'toast.refresh_updated': '已更新刷新间隔',
      'toast.lang_updated': '语言已切换',
      'toast.ip_banned': '已封锁 ',
      'toast.ip_ban_fail': '封锁失败：',
      'toast.ip_unbanned': '已解封 ',
      'toast.ip_unban_fail': '解封失败：',
      'toast.ip_locked': '已锁IP ',
      'toast.ip_lock_fail': '锁IP失败：',
      'toast.ip_unlocked': '已解IP ',
      'toast.ip_unlock_fail': '解IP失败：',

      /* ===== Validation messages ===== */
      'val.username_len': '用户名需要 3 到 24 位。',
      'val.username_chars': '用户名只能包含中文、英文、数字和下划线。',
      'val.username_emoji': '用户名不能包含表情符号。',
      'val.username_blocked': '用户名包含禁止内容。',
      'val.username_repeat': '用户名不能包含连续重复4次以上的字符。',
      'val.password_len': '密码至少 6 位。',
      'val.password_too_long': '密码不能超过 128 位。',
      'val.msg_empty': '消息不能为空。',
      'val.msg_too_long': '消息不能超过 500 字。',
      'val.msg_emoji': '消息不能包含表情符号。',
      'val.msg_blocked': '消息包含禁止内容。',
      'val.msg_too_fast': '发送太快，请稍后再发。',
      'val.msg_interval': '发送间隔太短，请稍后再发。',
      'val.msg_dup': '请不要重复发送相同内容。',
      'val.spam_pattern': '检测到刷屏模式，消息已被拦截。',
      'val.spam_high_freq': '检测到异常高频发送，请稍后再试。',
      'val.spam_muted': '你已被自动禁言，请联系管理员。',
      'val.ip_banned': '你的 IP 已被封禁。',
      'val.login_locked': '登录尝试过于频繁，请1小时后再试。',
      'val.reg_rate': '该IP注册过于频繁，请稍后再试。',
      'val.user_exists': '用户名已存在。',
      'val.login_fail': '用户名或密码错误。',
      'val.account_error': '账户异常，请重新登录。',
      'val.global_mute_on': '当前全员禁言中。',
      'val.you_muted': '你已被禁言。',
      'val.enter_creds': '请输入用户名和密码。',
      'val.enter_password': '请输入密码',
      'val.enter_script': '请输入脚本内容。',
      'val.select_server': '请先选择一个在线服务器。',

      /* ===== Auth ===== */
      'auth.player_center': '玩家中心',
      'auth.desc1': 'Andrux 提供实时仪表盘、社区聊天与游戏状态面板。',
      'auth.desc2': '所有操作均受到安全引擎保护，无需额外配置。',
      'auth.stat_security': '安全引擎',
      'auth.stat_security_desc': '多层防护，保护账号与社区',
      'auth.stat_speed': '快速响应',
      'auth.stat_speed_desc': 'Supabase 后端，毫秒级延迟',
      'auth.stat_control': '完全可控',
      'auth.stat_control_desc': '管理员可随时管理玩家与内容',
      'auth.login_tab': '登录',
      'auth.register_tab': '注册',
      'auth.username': '用户名',
      'auth.password': '密码',
      'auth.login_btn': '登录',
      'auth.register_btn': '注册',
      'auth.hint_login': '还没账号？点注册即可创建。',
      'auth.hint_register': '已有账号？点登录直接进入。',
      'auth.login_ok': '登录成功。',
      'auth.register_ok': '注册成功。',
      'auth.title_tag': 'Andrux 登录',
      'auth.headline': '玩家控制台，干净而有秩序。',
      'auth.intro': '登录或注册后才能进入仪表盘与社区。社区内置频率限制、重复内容限制、关键词内容拦截、消息撤回和专用右键菜单。',
      'auth.story1': '社区分区：普通聊天区、脚本区、Require 区',
      'auth.story2': '自己的消息在一分钟内可撤回，过时不可撤回',
      'auth.story3': '界面不使用表情符号，风格更像真实产品',
      'auth.human_title': '安全检查',
      'auth.human_click_text': '点击按钮完成验证',
      'auth.human_unverified': '未验证',
      'auth.human_verified': '已验证',
      'auth.human_pass': '验证通过，可以继续登录或注册',
      'auth.human_fail': '验证失败，请刷新页面',
      'auth.human_required': '请先完成人机验证',
      'auth.human_click_btn': '点击验证',
      'auth.username_ph': '输入用户名',
      'auth.password_ph': '输入密码',
      'auth.enter_andrux': '进入 Andrux',
      'auth.login_hint': '不需要邮箱，也不需要验证码。用户名和密码会通过浏览器哈希后写入 Supabase。',
      'auth.login_notice': '请先登录，未登录无法查看仪表盘和社区。',
      'auth.register_name_ph': '3 到 24 位',
      'auth.register_pass_ph': '至少 6 位',
      'auth.create_account': '创建账号',
      'auth.register_hint': '用户名不能包含关键词、指定姓名、空格或表情符号。',
      'auth.register_notice': '注册成功后会自动进入仪表盘。',

      /* ===== Profile ===== */
      'profile.eyebrow': 'Profile',
      'profile.title': '个人主页',
      'profile.edit': '编辑主页',
      'profile.save': '保存',
      'profile.cancel': '取消',
      'profile.bio_label': '个人简介',
      'profile.bio_ph': '介绍一下自己...',
      'profile.avatar_text_label': '头像文字（1-2个字符）',
      'profile.avatar_text_ph': '如首字母',
      'profile.avatar_color_label': '头像颜色',
      'profile.no_bio': '这个人很神秘，什么都没写。',
      'profile.updated_at': '更新于',
      'profile.not_found': '用户不存在或已注销。',
      'profile.load_error': '加载主页失败。',
      'profile.save_ok': '主页已更新。',
      'profile.save_fail': '保存失败。',
      'profile.need_sql': '请先执行 profile_setup.sql 添加主页字段',
      'profile.bio_blocked': '个人简介包含禁止内容。',
      'profile.avatar_blocked': '头像文字包含禁止内容。',
      'profile.bio_emoji': '个人简介不能包含表情符号。',
      'profile.my_profile': '我的主页',
      'profile.view_profile': '查看主页',
      'profile.back_to_mine': '返回我的主页',
      'profile.joined': '注册时间',
      'profile.msgs_count': '消息数',

      /* ===== Misc ===== */
      'misc.notice': '提示',
      'misc.download': '下载',
      'misc.reply': 'REPLY',
      'misc.no_msgs': '当前分区还没有消息，发送第一条干净的内容。',
      'misc.read_error': '无法读取消息，请确认已执行 SQL 建表并开启策略。',
      'misc.script_pushed': '已推送到 ',
      'misc.push_wait': '，等待服务器心跳执行（约30秒）。',
      'misc.push_fail': '推送失败：',
      'misc.unknown_err': '未知错误',
      'misc.confirm_delete_user': '确定删除该用户？',
      'misc.confirm_clear_msgs': '确定清空该用户所有消息？',
      'misc.confirm_delete_msg': '确定删除该消息？',
      'misc.confirm_clear_local': '确定清空所有本地状态？',
      'misc.mute_prompt': '禁言分钟数（永久输入 99999）：',
      'misc.invalid_number': '请输入有效数字'
    },

    en: {
      /* ===== Sidebar / Nav ===== */
      'nav.menu': 'Menu',
      'nav.player_center': 'Player Hub',
      'nav.logged_in': 'Logged in, community access enabled',
      'nav.logout': 'Log Out',
      'nav.exit': 'Exit',
      'nav.dashboard': 'Dashboard',
      'nav.game': 'Game',
      'nav.executor': 'Executor',
      'nav.community': 'Community',
      'nav.admin': 'Admin',
      'nav.profile': 'Profile',
      'nav.settings': 'Settings',

      /* ===== Dashboard ===== */
      'dash.eyebrow': 'Console',
      'dash.title': 'Andrux Dashboard',
      'dash.desc': 'This is the main page after login, showing player status, community security policies and system protection. Only accessible after login or registration.',
      'dash.online_users': 'Online Users',
      'dash.community_msgs': 'Community Messages',
      'dash.chat_channels': 'Chat Channels',
      'dash.recall_window': 's Recall Window',
      'dash.sys_status': 'System Status',
      'dash.access_open': 'Access Enabled',
      'dash.access_desc': 'You are now in the Andrux Player Hub. You can view the dashboard and access the community page. Unauthenticated users only see login and registration.',

      /* ===== Community ===== */
      'comm.eyebrow': 'Community',
      'comm.title': 'Player Chat',
      'comm.desc': 'Right-click only works on community messages for recall, quote, and copy. Scripts channel supports txt, lua. Require channel supports txt, lua, rbxm, rbxl. File uploads are also rate-limited.',
      'comm.channel_general': 'General',
      'comm.channel_general_desc': 'Daily chat, anti-spam',
      'comm.channel_scripts': 'Scripts',
      'comm.channel_scripts_desc': 'txt, lua supported, no spam',
      'comm.channel_require': 'Require',
      'comm.channel_require_desc': 'txt, lua, rbxm, rbxl',
      'comm.general_title': 'General Chat',
      'comm.general_desc': 'Keep chat clean, no keywords or spam.',
      'comm.reload': 'Reload',
      'comm.quote_content': 'Quote',
      'comm.cancel_quote': 'Cancel Quote',
      'comm.input_placeholder': 'Type a message, up to 500 chars',
      'comm.send': 'Send',
      'comm.sending': 'Sending...',
      'comm.file_disabled': 'Files not supported in this channel',
      'comm.file_none': 'No file selected',
      'comm.file_supported': 'Supported: ',
      'comm.file_remove': 'Remove File',
      'comm.notice': 'Tip: Repeated sending within a short time will be blocked.',
      'comm.recall': 'Recall',
      'comm.quote': 'Quote',
      'comm.copy': 'Copy',
      'comm.delete': 'Delete',
      'comm.msg_recalled': 'Message recalled',
      'comm.loading': 'Loading...',

      /* ===== Game ===== */
      'game.eyebrow': 'Game',
      'game.title': 'Game Status',
      'game.desc': 'Real-time status of Roblox games, auto-refreshing.',
      'game.no_data': 'No game data reported yet',
      'game.online': 'Online',
      'game.offline': 'Offline',
      'game.join': 'Join Game',
      'game.players': 'Players Online',
      'game.load_error': 'Cannot read game status. Make sure SQL is executed.',

      /* ===== Admin ===== */
      'admin.eyebrow': 'Admin',
      'admin.title': 'Restricted',
      'admin.enter_password': 'Enter password',
      'admin.password_label': 'Enter password',
      'admin.enter': 'Enter',
      'admin.global_mute': 'Global Mute',
      'admin.mute_status_off': 'Global mute is currently off.',
      'admin.mute_status_forever': 'Global mute is permanent.',
      'admin.mute_status_until': 'Global mute until ',
      'admin.mute_status_expired': 'Global mute has expired.',
      'admin.mute_status_error': 'Cannot read status.',
      'admin.refresh': 'Refresh',
      'admin.mute_10': 'Mute 10 min',
      'admin.mute_60': 'Mute 1 hour',
      'admin.mute_forever': 'Mute forever',
      'admin.mute_custom': 'Custom mute',
      'admin.mute_off': 'Disable mute',
      'admin.mute_minutes_ph': 'minutes',
      'admin.ip_ban': 'IP Ban Management',
      'admin.ip_input_ph': 'Enter IP address',
      'admin.ip_ban_btn': 'Ban IP',
      'admin.ip_unban_btn': 'Unban IP',
      'admin.game_mgmt': 'Game Management',
      'admin.show_hidden': 'Show hidden',
      'admin.hide_game': 'Hide Game',
      'admin.restore_game': 'Restore',
      'admin.player_mgmt': 'Player Management',
      'admin.community_mgmt': 'Community Management',
      'admin.delete': 'Delete',
      'admin.mute': 'Mute',
      'admin.unmute': 'Unmute',
      'admin.clear_msgs': 'Clear Msgs',
      'admin.no_games': 'No games.',
      'admin.no_users': 'No users.',
      'admin.no_msgs': 'No messages.',
      'admin.load_fail': 'Load failed',
      'admin.no_heartbeat': 'No heartbeat',
      'admin.muted_status': 'Muted',
      'admin.normal_status': 'Normal',
      'admin.clear_user_msgs': 'Clear User Msgs',
      'admin.no_banned_ips': 'No banned IPs.',
      'admin.ip_unban_input': 'Enter IP to unban',
      'admin.no_ip': 'No IP',
      'admin.no_ip_lock': 'No IP record, cannot lock IP',
      'admin.no_ip_unlock': 'No IP record, cannot unlock IP',
      'admin.lock_ip': 'Lock IP',
      'admin.unlock_ip': 'Unlock IP',
      'admin.confirm_lock_ip': 'Lock IP',
      'admin.confirm_unlock_ip': 'Unlock IP',
      'admin.rename': 'Rename',
      'admin.rename_confirm': 'Confirm',
      'admin.rename_cancel': 'Cancel',
      'admin.rename_restore': 'Restore',
      'admin.rename_ph': 'Enter new username',
      'admin.rename_confirm_msg': 'Rename',
      'admin.rename_to': 'to',
      'admin.rename_empty': 'New username cannot be empty',
      'admin.rename_same': 'New username is the same as current',
      'admin.rename_success': 'Renamed: ',
      'admin.rename_fail': 'Rename failed: ',
      'admin.rename_exists': 'Username already exists',
      'admin.restore_success': 'Restored: ',
      'admin.restore_fail': 'Restore failed: ',
      'admin.title_btn': 'Title',
      'admin.title_ph': 'Enter custom title',
      'admin.title_confirm': 'OK',
      'admin.title_clear': 'Clear',
      'admin.title_success': 'Title set ',
      'admin.title_cleared': 'Title cleared ',
      'admin.title_fail': 'Title failed: ',
      'admin.title_too_long': 'Title cannot exceed 12 characters',

      /* ===== Executor ===== */
      'exec.eyebrow': 'Executor',
      'exec.title': 'Script Executor',
      'exec.desc': 'Push Lua scripts to online Roblox servers. Scripts execute on next heartbeat and clear the queue.',
      'exec.password_label': 'Enter admin password',
      'exec.enter': 'Enter',
      'exec.target': 'Target Server',
      'exec.script_editor': 'Script Editor',
      'exec.char_count': '0 chars',
      'exec.placeholder': 'Type Lua script here...',
      'exec.push': 'Push & Execute',
      'exec.pushing': 'Pushing...',
      'exec.clear': 'Clear Editor',
      'exec.status_idle': 'Select an online server, type a script, then push.',
      'exec.mode_hint': 'Two modes: 1) Enter Lua code directly (requires LoadStringEnabled) 2) Enter a Roblox ModuleScript Asset ID (number only, no LoadStringEnabled needed)',
      'exec.no_games': 'No games.',
      'exec.players_unit': ' players',
      'exec.char_unit': ' chars',

      /* ===== Settings ===== */
      'set.eyebrow': 'Settings',
      'set.title': 'Preferences',
      'set.desc': 'These settings are saved in your browser and persist after refresh.',
      'set.appearance': 'Appearance',
      'set.density': 'UI Density',
      'set.density_desc': 'Compact mode reduces card spacing for more content on desktop.',
      'set.animation': 'Animation',
      'set.reduce_motion': 'Reduce Motion',
      'set.reduce_motion_desc': 'Keeps basic feedback but makes transitions more subtle.',
      'set.community': 'Community',
      'set.chat_refresh': 'Chat Refresh',
      'set.chat_refresh_desc': 'Choose auto-refresh speed. Slow saves requests, fast is more responsive.',
      'set.refresh_slow': 'Slow',
      'set.refresh_standard': 'Standard',
      'set.refresh_fast': 'Fast',
      'set.account': 'Account',
      'set.switch_account': 'Switch Account',
      'set.switch_account_desc': 'Return to login page to use another account. Settings persist.',
      'set.logout_account': 'Log Out',
      'set.logout_desc': 'Log out of current account and clear the session.',
      'set.local': 'Local',
      'set.clear_local': 'Clear Local State',
      'set.clear_local_desc': 'Clear quotes, pending files, admin unlock status and local preferences.',
      'set.clear': 'Clear',
      'set.language': 'Language',
      'set.language_desc': 'Switch interface language. All text and prompts update instantly.',

      /* ===== Toast / Dynamic messages ===== */
      'toast.key_blocked': 'This shortcut is blocked by the page.',
      'toast.copy_blocked': 'Copy is only allowed via community message right-click menu.',
      'toast.rated': 'Too many requests, please wait.',
      'toast.recalled': 'Recalled.',
      'toast.recall_fail': 'Operation failed.',
      'toast.deleted': 'Deleted (hidden from you only)',
      'toast.copied': 'Copied.',
      'toast.copy_fail': 'Copy failed.',
      'toast.cannot_quote': 'This message cannot be quoted.',
      'toast.cannot_copy': 'This message cannot be copied.',
      'toast.file_too_big': 'File cannot exceed 2MB.',
      'toast.file_type_err': 'This file type is not supported in this channel.',
      'toast.register_ok': 'Registration successful',
      'toast.login_ok': 'Login successful',
      'toast.password_ok': 'Verified',
      'toast.password_err': 'Wrong password',
      'toast.mute_on': 'Global mute enabled',
      'toast.mute_off': 'Global mute disabled',
      'toast.op_fail': 'Operation failed',
      'toast.deleted_user': 'Deleted',
      'toast.delete_fail': 'Delete failed',
      'toast.muted': 'Muted',
      'toast.mute_fail': 'Mute failed',
      'toast.unmuted': 'Unmuted',
      'toast.unmute_fail': 'Unmute failed',
      'toast.cleared_msgs': 'Cleared',
      'toast.clear_fail': 'Clear failed',
      'toast.game_hidden': 'Game hidden',
      'toast.game_restored': 'Game restored',
      'toast.script_pushed': 'Script pushed',
      'toast.cleared': 'Cleared',
      'toast.refresh_updated': 'Refresh interval updated',
      'toast.lang_updated': 'Language switched',
      'toast.ip_banned': 'Banned ',
      'toast.ip_ban_fail': 'Ban failed: ',
      'toast.ip_unbanned': 'Unbanned ',
      'toast.ip_unban_fail': 'Unban failed: ',
      'toast.ip_locked': 'IP locked ',
      'toast.ip_lock_fail': 'Lock failed: ',
      'toast.ip_unlocked': 'IP unlocked ',
      'toast.ip_unlock_fail': 'Unlock failed: ',

      /* ===== Validation messages ===== */
      'val.username_len': 'Username must be 3 to 24 characters.',
      'val.username_chars': 'Username can only contain Chinese, English, numbers and underscores.',
      'val.username_emoji': 'Username cannot contain emoji.',
      'val.username_blocked': 'Username contains prohibited content.',
      'val.username_repeat': 'Username cannot contain a character repeated more than 4 times consecutively.',
      'val.password_len': 'Password must be at least 6 characters.',
      'val.password_too_long': 'Password cannot exceed 128 characters.',
      'val.msg_empty': 'Message cannot be empty.',
      'val.msg_too_long': 'Message cannot exceed 500 characters.',
      'val.msg_emoji': 'Message cannot contain emoji.',
      'val.msg_blocked': 'Message contains prohibited content.',
      'val.msg_too_fast': 'Sending too fast, please wait.',
      'val.msg_interval': 'Interval too short, please wait.',
      'val.msg_dup': 'Please do not send duplicate content.',
      'val.spam_pattern': 'Spam pattern detected, message blocked.',
      'val.spam_high_freq': 'Abnormal frequency detected, please slow down.',
      'val.spam_muted': 'You have been auto-muted. Contact admin.',
      'val.ip_banned': 'Your IP is banned.',
      'val.login_locked': 'Too many login attempts, try again in 1 hour.',
      'val.reg_rate': 'Too many registrations from this IP, please wait.',
      'val.user_exists': 'Username already exists.',
      'val.login_fail': 'Invalid username or password.',
      'val.account_error': 'Account error, please log in again.',
      'val.global_mute_on': 'Global mute is active.',
      'val.you_muted': 'You are muted.',
      'val.enter_creds': 'Please enter username and password.',
      'val.enter_password': 'Enter password',
      'val.enter_script': 'Please enter script content.',
      'val.select_server': 'Please select an online server first.',

      /* ===== Auth ===== */
      'auth.player_center': 'Player Hub',
      'auth.desc1': 'Andrux provides real-time dashboard, community chat and game status panels.',
      'auth.desc2': 'All operations are protected by the security engine, no extra setup needed.',
      'auth.stat_security': 'Security Engine',
      'auth.stat_security_desc': 'Multi-layer protection for accounts and community',
      'auth.stat_speed': 'Fast Response',
      'auth.stat_speed_desc': 'Supabase backend, millisecond latency',
      'auth.stat_control': 'Full Control',
      'auth.stat_control_desc': 'Admins can manage players and content anytime',
      'auth.login_tab': 'Login',
      'auth.register_tab': 'Register',
      'auth.username': 'Username',
      'auth.password': 'Password',
      'auth.login_btn': 'Log In',
      'auth.register_btn': 'Register',
      'auth.hint_login': "Don't have an account? Register to create one.",
      'auth.hint_register': 'Already have an account? Log in directly.',
      'auth.login_ok': 'Login successful.',
      'auth.register_ok': 'Registration successful.',
      'auth.title_tag': 'Andrux Login',
      'auth.headline': 'Player console, clean and orderly.',
      'auth.intro': 'Login or register to access the dashboard and community. The community includes rate limiting, duplicate content filtering, keyword blocking, message recall and a dedicated right-click menu.',
      'auth.story1': '3 channels: General, Scripts, Require',
      'auth.story2': 'Recall your messages within 60s, after that it is permanent',
      'auth.story3': 'No emoji in the UI, feels like a real product',
      'auth.human_title': 'Security Check',
      'auth.human_click_text': 'Click the button to verify',
      'auth.human_unverified': 'Not Verified',
      'auth.human_verified': 'Verified',
      'auth.human_pass': 'Verification passed, you can continue',
      'auth.human_fail': 'Verification failed, please refresh the page',
      'auth.human_required': 'Please complete verification first',
      'auth.human_click_btn': 'Click to Verify',
      'auth.username_ph': 'Enter username',
      'auth.password_ph': 'Enter password',
      'auth.enter_andrux': 'Enter Andrux',
      'auth.login_hint': 'No email or verification code needed. Username and password are hashed in the browser before writing to Supabase.',
      'auth.login_notice': 'Please log in first. Unauthenticated users cannot view the dashboard or community.',
      'auth.register_name_ph': '3 to 24 chars',
      'auth.register_pass_ph': 'At least 6 chars',
      'auth.create_account': 'Create Account',
      'auth.register_hint': 'Username cannot contain keywords, specific names, spaces or emoji.',
      'auth.register_notice': 'After registration, you will be taken to the dashboard automatically.',

      /* ===== Profile ===== */
      'profile.eyebrow': 'Profile',
      'profile.title': 'Personal Profile',
      'profile.edit': 'Edit Profile',
      'profile.save': 'Save',
      'profile.cancel': 'Cancel',
      'profile.bio_label': 'Bio',
      'profile.bio_ph': 'Tell something about yourself...',
      'profile.avatar_text_label': 'Avatar Text (1-2 chars)',
      'profile.avatar_text_ph': 'e.g. initials',
      'profile.avatar_color_label': 'Avatar Color',
      'profile.no_bio': 'This person is mysterious and wrote nothing.',
      'profile.updated_at': 'Updated',
      'profile.not_found': 'User does not exist or has been deleted.',
      'profile.load_error': 'Failed to load profile.',
      'profile.save_ok': 'Profile updated.',
      'profile.save_fail': 'Save failed.',
      'profile.need_sql': 'Please run profile_setup.sql to add profile columns',
      'profile.bio_blocked': 'Bio contains prohibited content.',
      'profile.avatar_blocked': 'Avatar text contains prohibited content.',
      'profile.bio_emoji': 'Bio cannot contain emoji.',
      'profile.my_profile': 'My Profile',
      'profile.view_profile': 'View Profile',
      'profile.back_to_mine': 'Back to My Profile',
      'profile.joined': 'Joined',
      'profile.msgs_count': 'Messages',

      /* ===== Misc ===== */
      'misc.notice': 'Notice',
      'misc.download': 'Download',
      'misc.reply': 'REPLY',
      'misc.no_msgs': 'No messages in this channel yet. Send the first clean message.',
      'misc.read_error': 'Cannot read messages. Make sure SQL tables and policies are set up.',
      'misc.script_pushed': 'Pushed to ',
      'misc.push_wait': ', waiting for server heartbeat (~30s).',
      'misc.push_fail': 'Push failed: ',
      'misc.unknown_err': 'Unknown error',
      'misc.confirm_delete_user': 'Delete this user?',
      'misc.confirm_clear_msgs': 'Clear all messages from this user?',
      'misc.confirm_delete_msg': 'Delete this message?',
      'misc.confirm_clear_local': 'Clear all local state?',
      'misc.mute_prompt': 'Mute minutes (enter 99999 for permanent):',
      'misc.invalid_number': 'Please enter a valid number'
    }
  },

  /* Get translated string */
  t: function(key) {
    var d = this.dict[this.lang] || this.dict.zh;
    return d[key] || this.dict.zh[key] || key;
  },

  /* Set language and save */
  setLang: function(lang) {
    this.lang = lang;
    localStorage.setItem('andrux_lang', lang);
    this.apply();
  },

  /* Apply translations to all [data-i18n] elements */
  apply: function() {
    document.documentElement.lang = this.lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      var text = window.I18N.t(key);
      el.textContent = text;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-ph');
      el.setAttribute('placeholder', window.I18N.t(key));
    });
  }
};
