/* Community chat send — isolated, reads value on pointerdown before blur */
(function () {
  'use strict';

  var locked = '';
  var sending = false;

  function inputEl() {
    return document.getElementById('messageInput')
      || document.querySelector('#messageForm textarea')
      || document.querySelector('#messageForm input[name="message"]');
  }

  function lockFrom(el) {
    if (!el) return;
    try {
      locked = String(el.value != null ? el.value : '');
    } catch (e) {
      locked = '';
    }
  }

  function t(key, fallback) {
    try {
      if (window.I18N && window.I18N.t) return window.I18N.t(key) || fallback;
    } catch (e) {}
    return fallback;
  }

  function notice(msg, bad) {
    var el = document.getElementById('chatNotice');
    if (el) {
      el.style.display = '';
      el.textContent = msg || '';
      el.classList.remove('bad', 'ok');
      if (bad) el.classList.add('bad');
      else if (msg) el.classList.add('ok');
    }
    var toast = document.getElementById('toast');
    if (toast && msg) {
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(window.__ccToast);
      window.__ccToast = setTimeout(function () {
        toast.classList.remove('show');
      }, 2200);
    }
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem('andrux_session') || 'null');
    } catch (e) {
      return null;
    }
  }

  function getApi() {
    /* reuse page-app api if present */
    if (typeof window.api === 'function') return window.api;
    if (typeof api === 'function') return api;
    return null;
  }

  function send() {
    if (sending) return;
    var el = inputEl();
    /* Prefer locked (from pointerdown), then live value */
    var content = (locked || (el ? String(el.value || '') : '')).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    locked = '';

    if (!content) {
      notice(t('val.msg_empty', '消息不能为空。') + ' [len=0]', true);
      if (el) try { el.focus(); } catch (e) {}
      return;
    }

    var session = getSession();
    if (!session || !session.id) {
      notice(t('val.account_error', '请先登录'), true);
      return;
    }

    var apiFn = getApi();
    var T_MSGS = (typeof window.T_MSGS === 'string' && window.T_MSGS) || 'andrux_messages';
    var SU = window.SU;
    var SK = window.SK;

    sending = true;
    var btn = document.getElementById('sendBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = t('comm.sending', '发送中...');
      btn.style.opacity = '0.5';
    }

    var payload = {
      user_id: session.id,
      username: session.username,
      channel: 'general',
      content: content,
      c1: String(session.id),
      c2: session.username,
      c3: 'general',
      c4: content
    };

    function done(ok, errMsg) {
      sending = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = t('comm.send', '发送');
        btn.style.opacity = '';
      }
      if (ok) {
        if (el) el.value = '';
        locked = '';
        notice('', false);
        notice(t('toast.sent', '已发送'), false);
        if (typeof loadMessages === 'function') loadMessages();
        else if (typeof window.loadMessages === 'function') window.loadMessages();
      } else {
        notice(errMsg || t('toast.op_fail', '操作失败'), true);
      }
    }

    if (apiFn) {
      apiFn(T_MSGS, '', {
        method: 'POST',
        body: JSON.stringify(payload),
        skipRate: true,
        headers: { Prefer: 'return=minimal' }
      }).then(function () {
        done(true);
      }).catch(function (err) {
        done(false, (err && err.message) || t('toast.op_fail', '操作失败'));
      });
      return;
    }

    /* Fallback direct fetch if api() not exposed */
    if (!SU || !SK) {
      /* try read from page-app closures — not available; use meta tags or known globals */
      done(false, 'API not ready');
      return;
    }
    fetch(SU + '/rest/v1/' + T_MSGS, {
      method: 'POST',
      headers: {
        apikey: SK,
        Authorization: 'Bearer ' + SK,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error(t || 'fail'); });
      done(true);
    }).catch(function (err) {
      done(false, (err && err.message) || 'fail');
    });
  }

  function bind() {
    var el = inputEl();
    var btn = document.getElementById('sendBtn');
    var form = document.getElementById('messageForm');

    if (el && !el.dataset.ccBound) {
      el.dataset.ccBound = '1';
      ['input', 'keyup', 'change', 'compositionend', 'blur'].forEach(function (ev) {
        el.addEventListener(ev, function () { lockFrom(el); });
      });
    }

    if (btn && !btn.dataset.ccBound) {
      btn.dataset.ccBound = '1';
      btn.type = 'button';
      /* Lock value BEFORE focus leaves the input */
      btn.addEventListener('pointerdown', function () { lockFrom(inputEl()); }, true);
      btn.addEventListener('mousedown', function () { lockFrom(inputEl()); }, true);
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        send();
      }, true);
    }

    if (form && !form.dataset.ccBound) {
      form.dataset.ccBound = '1';
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        e.stopPropagation();
        lockFrom(inputEl());
        send();
      }, true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
  setTimeout(bind, 300);
  setTimeout(bind, 1000);

  /* Disable page-app's empty-prone handler by marking form as bound after we take over */
  window.__andruxCommunityChat = { send: send, bind: bind };
})();
