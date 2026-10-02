/* Andrux Luau syntax highlight + insert/delete animations — visual only */
(function () {
  'use strict';

  var KEYWORDS = {
    and:1, break:1, continue:1, do:1, else:1, elseif:1, end:1, export:1,
    false:1, for:1, function:1, if:1, in:1, local:1, nil:1, not:1, or:1,
    repeat:1, return:1, then:1, true:1, type:1, until:1, while:1
  };

  var BUILTINS = {
    print:1, warn:1, error:1, assert:1, type:1, typeof:1, pairs:1, ipairs:1,
    next:1, select:1, unpack:1, tostring:1, tonumber:1, pcall:1, xpcall:1,
    require:1, spawn:1, delay:1, wait:1, tick:1, time:1, workspace:1,
    game:1, script:1, plugin:1, shared:1, _G:1, _VERSION:1,
    Vector3:1, Vector2:1, CFrame:1, Color3:1, BrickColor:1, UDim:1, UDim2:1,
    Ray:1, Region3:1, Enum:1, Instance:1, task:1, table:1, string:1, math:1,
    bit32:1, utf8:1, os:1, debug:1, buffer:1, coroutine:1, rawget:1, rawset:1,
    rawequal:1, rawlen:1, setmetatable:1, getmetatable:1, newproxy:1,
    loadstring:1, getfenv:1, setfenv:1, Players:1, RunService:1, HttpService:1,
    TweenService:1, UserInputService:1, ReplicatedStorage:1, ServerStorage:1,
    ServerScriptService:1, StarterGui:1, StarterPack:1, StarterPlayer:1,
    Lighting:1, SoundService:1, Chat:1, Teams:1, PathfindingService:1
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function highlight(src) {
    if (!src) return '';
    var out = '';
    var i = 0;
    var n = src.length;

    while (i < n) {
      var c = src.charAt(i);

      if (c === '-' && src.charAt(i + 1) === '-' && src.charAt(i + 2) === '[') {
        var j = i + 2, eq = 0;
        if (src.charAt(j) === '[') {
          j++;
          while (src.charAt(j) === '=') { eq++; j++; }
          if (src.charAt(j) === '[') {
            j++;
            var close = ']' + Array(eq + 1).join('=') + ']';
            var end = src.indexOf(close, j);
            if (end < 0) end = n; else end += close.length;
            out += '<span class="lh-comment">' + escapeHtml(src.slice(i, end)) + '</span>';
            i = end;
            continue;
          }
        }
      }

      if (c === '-' && src.charAt(i + 1) === '-') {
        var endLine = src.indexOf('\n', i);
        if (endLine < 0) endLine = n;
        out += '<span class="lh-comment">' + escapeHtml(src.slice(i, endLine)) + '</span>';
        i = endLine;
        continue;
      }

      if (c === '[') {
        var j2 = i + 1, eq2 = 0;
        while (src.charAt(j2) === '=') { eq2++; j2++; }
        if (src.charAt(j2) === '[') {
          j2++;
          var close2 = ']' + Array(eq2 + 1).join('=') + ']';
          var end2 = src.indexOf(close2, j2);
          if (end2 < 0) end2 = n; else end2 += close2.length;
          out += '<span class="lh-string">' + escapeHtml(src.slice(i, end2)) + '</span>';
          i = end2;
          continue;
        }
      }

      if (c === '"' || c === "'") {
        var q = c, k = i + 1;
        while (k < n) {
          var ch = src.charAt(k);
          if (ch === '\\') { k += 2; continue; }
          if (ch === q) { k++; break; }
          if (ch === '\n') break;
          k++;
        }
        out += '<span class="lh-string">' + escapeHtml(src.slice(i, k)) + '</span>';
        i = k;
        continue;
      }

      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src.charAt(i + 1)))) {
        var m = i;
        if (c === '0' && (src.charAt(i + 1) === 'x' || src.charAt(i + 1) === 'X')) {
          m += 2;
          while (/[0-9a-fA-F_]/.test(src.charAt(m))) m++;
        } else if (c === '0' && (src.charAt(i + 1) === 'b' || src.charAt(i + 1) === 'B')) {
          m += 2;
          while (/[01_]/.test(src.charAt(m))) m++;
        } else {
          while (/[0-9_]/.test(src.charAt(m))) m++;
          if (src.charAt(m) === '.') {
            m++;
            while (/[0-9_]/.test(src.charAt(m))) m++;
          }
          if (src.charAt(m) === 'e' || src.charAt(m) === 'E') {
            m++;
            if (src.charAt(m) === '+' || src.charAt(m) === '-') m++;
            while (/[0-9_]/.test(src.charAt(m))) m++;
          }
        }
        out += '<span class="lh-number">' + escapeHtml(src.slice(i, m)) + '</span>';
        i = m;
        continue;
      }

      if (/[A-Za-z_]/.test(c)) {
        var idEnd = i + 1;
        while (/[A-Za-z0-9_]/.test(src.charAt(idEnd))) idEnd++;
        var word = src.slice(i, idEnd);
        if (KEYWORDS[word]) {
          out += '<span class="lh-keyword">' + escapeHtml(word) + '</span>';
        } else if (BUILTINS[word]) {
          out += '<span class="lh-builtin">' + escapeHtml(word) + '</span>';
        } else {
          var peek = idEnd;
          while (src.charAt(peek) === ' ' || src.charAt(peek) === '\t') peek++;
          if (src.charAt(peek) === '(') {
            out += '<span class="lh-func">' + escapeHtml(word) + '</span>';
          } else {
            out += escapeHtml(word);
          }
        }
        i = idEnd;
        continue;
      }

      if ('+-*/%^#=~<>(){}[],.;:'.indexOf(c) >= 0) {
        var opEnd = i + 1;
        var two = src.slice(i, i + 2);
        if (two === '==' || two === '~=' || two === '<=' || two === '>=' || two === '..' || two === '//' || two === '+=') {
          opEnd = i + 2;
        }
        if (src.slice(i, i + 3) === '...') opEnd = i + 3;
        out += '<span class="lh-op">' + escapeHtml(src.slice(i, opEnd)) + '</span>';
        i = opEnd;
        continue;
      }

      out += escapeHtml(c);
      i++;
    }
    return out;
  }

  function playAnim(wrap, kind) {
    if (!wrap) return;
    wrap.classList.remove('luau-anim-insert', 'luau-anim-delete');
    /* force reflow so animation can re-trigger */
    void wrap.offsetWidth;
    wrap.classList.add(kind === 'insert' ? 'luau-anim-insert' : 'luau-anim-delete');
    var done = function () {
      wrap.classList.remove('luau-anim-insert', 'luau-anim-delete');
      wrap.removeEventListener('animationend', done);
    };
    wrap.addEventListener('animationend', done);
  }

  function spawnRipple(wrap, textarea, kind) {
    try {
      var style = window.getComputedStyle(textarea);
      var padL = parseFloat(style.paddingLeft) || 18;
      var padT = parseFloat(style.paddingTop) || 16;
      var fontSize = parseFloat(style.fontSize) || 13;
      var lineHeight = parseFloat(style.lineHeight) || fontSize * 1.55;
      var val = textarea.value;
      var pos = textarea.selectionStart || 0;
      var before = val.slice(0, pos);
      var lines = before.split('\n');
      var row = lines.length - 1;
      var col = lines[lines.length - 1].length;
      /* approximate char width for monospace */
      var charW = fontSize * 0.6;
      var x = padL + col * charW - textarea.scrollLeft;
      var y = padT + row * lineHeight - textarea.scrollTop + lineHeight * 0.5;

      var ripple = document.createElement('span');
      ripple.className = 'luau-ripple ' + (kind === 'insert' ? 'insert' : 'delete');
      ripple.style.left = Math.max(8, Math.min(x, wrap.clientWidth - 8)) + 'px';
      ripple.style.top = Math.max(8, Math.min(y, wrap.clientHeight - 8)) + 'px';
      wrap.appendChild(ripple);
      setTimeout(function () {
        if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
      }, 450);
    } catch (e) {}
  }

  function mount(textarea) {
    if (!textarea || textarea.dataset.luauHl === '1') return;
    textarea.dataset.luauHl = '1';

    var wrap = document.createElement('div');
    wrap.className = 'luau-hl-wrap';
    textarea.parentNode.insertBefore(wrap, textarea);
    wrap.appendChild(textarea);

    var pre = document.createElement('pre');
    pre.className = 'luau-hl-pre';
    pre.setAttribute('aria-hidden', 'true');
    var code = document.createElement('code');
    code.className = 'luau-hl-code';
    pre.appendChild(code);
    wrap.insertBefore(pre, textarea);

    textarea.classList.add('luau-hl-textarea');

    var lastLen = textarea.value.length;
    var animLock = false;

    function sync(fromUser) {
      var val = textarea.value;
      var html = highlight(val);
      if (val.slice(-1) === '\n') html += ' ';
      code.innerHTML = html || ' ';
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;

      if (fromUser) {
        var len = val.length;
        var delta = len - lastLen;
        lastLen = len;
        if (delta !== 0) {
          var now = Date.now();
          if (!wrap._lastAnimAt || now - wrap._lastAnimAt > 100) {
            wrap._lastAnimAt = now;
            var kind = delta > 0 ? 'insert' : 'delete';
            playAnim(wrap, kind);
            spawnRipple(wrap, textarea, kind);
          }
        }
      } else {
        lastLen = val.length;
      }
    }

    textarea.addEventListener('input', function () { sync(true); });
    textarea.addEventListener('scroll', function () {
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
    });
    textarea.addEventListener('change', function () { sync(false); });

    try {
      var desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      if (desc && desc.set) {
        Object.defineProperty(textarea, 'value', {
          get: function () { return desc.get.call(this); },
          set: function (v) {
            var prev = desc.get.call(this);
            desc.set.call(this, v);
            var kind = (v || '').length >= (prev || '').length ? 'insert' : 'delete';
            if ((v || '') !== (prev || '')) {
              playAnim(wrap, kind);
            }
            lastLen = (v || '').length;
            sync(false);
          },
          configurable: true
        });
      }
    } catch (e) {}

    sync(false);
  }

  function init() {
    var ta = document.getElementById('execScriptInput');
    if (ta) mount(ta);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  setTimeout(init, 500);
  setTimeout(init, 1500);

  var bodyObs = new MutationObserver(function () {
    var ta = document.getElementById('execScriptInput');
    if (ta && ta.dataset.luauHl !== '1') mount(ta);
  });
  if (document.body) bodyObs.observe(document.body, { childList: true, subtree: true });

  window.AndruxLuauHL = { highlight: highlight, mount: mount };
})();
