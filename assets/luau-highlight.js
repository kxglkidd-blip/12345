/* Andrux Luau syntax highlighter — visual only, does not affect execution */
(function () {
  'use strict';

  var KEYWORDS = {
    and:1, break:1, continue:1, do:1, else:1, elseif:1, end:1, export:1,
    false:1, for:1, function:1, if:1, in:1, local:1, nil:1, not:1, or:1,
    repeat:1, return:1, then:1, true:1, type:1, until:1, while:1
  };

  /* Common Roblox / Luau globals (Studio-ish) */
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

      /* long comment --[[ ... ]] */
      if (c === '-' && src.charAt(i + 1) === '-' && src.charAt(i + 2) === '[') {
        var j = i + 2;
        var eq = 0;
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

      /* line comment -- */
      if (c === '-' && src.charAt(i + 1) === '-') {
        var endLine = src.indexOf('\n', i);
        if (endLine < 0) endLine = n;
        out += '<span class="lh-comment">' + escapeHtml(src.slice(i, endLine)) + '</span>';
        i = endLine;
        continue;
      }

      /* long string [[...]] or [=[...]=] */
      if (c === '[') {
        var j2 = i + 1;
        var eq2 = 0;
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

      /* strings "..." or '...' */
      if (c === '"' || c === "'") {
        var q = c;
        var k = i + 1;
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

      /* numbers */
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

      /* identifiers / keywords / builtins */
      if (/[A-Za-z_]/.test(c)) {
        var idEnd = i + 1;
        while (/[A-Za-z0-9_]/.test(src.charAt(idEnd))) idEnd++;
        var word = src.slice(i, idEnd);
        if (KEYWORDS[word]) {
          out += '<span class="lh-keyword">' + escapeHtml(word) + '</span>';
        } else if (BUILTINS[word]) {
          out += '<span class="lh-builtin">' + escapeHtml(word) + '</span>';
        } else {
          /* function name if followed by ( */
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

      /* operators */
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

    function sync() {
      var val = textarea.value;
      var html = highlight(val);
      /* trailing newline needs a space so pre height matches */
      if (val.slice(-1) === '\n') html += ' ';
      code.innerHTML = html || ' ';
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
    }

    textarea.addEventListener('input', sync);
    textarea.addEventListener('scroll', function () {
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
    });
    /* also on paste / programmatic clear */
    textarea.addEventListener('change', sync);

    var obs = new MutationObserver(function () { sync(); });
    obs.observe(textarea, { attributes: true, attributeFilter: ['value'] });

    /* intercept value setter when scripts clear the editor */
    try {
      var desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      if (desc && desc.set) {
        Object.defineProperty(textarea, 'value', {
          get: function () { return desc.get.call(this); },
          set: function (v) {
            desc.set.call(this, v);
            sync();
          },
          configurable: true
        });
      }
    } catch (e) {}

    sync();
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

  /* exec panel may unlock later */
  var bodyObs = new MutationObserver(function () {
    var ta = document.getElementById('execScriptInput');
    if (ta && ta.dataset.luauHl !== '1') mount(ta);
  });
  if (document.body) bodyObs.observe(document.body, { childList: true, subtree: true });

  window.AndruxLuauHL = { highlight: highlight, mount: mount };
})();
