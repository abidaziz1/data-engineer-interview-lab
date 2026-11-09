/* Shared helpers: safe text, tiny markdown, syntax highlighting, storage. No dependencies. */
(function () {
  var LAB = (window.LAB = window.LAB || {});

  LAB.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* Inline markup: **bold**, `code`, ==mark==, newline -> <br> */
  LAB.md = function (s) {
    return LAB.esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/==(.+?)==/g, '<mark>$1</mark>')
      .replace(/\n/g, '<br>');
  };

  /* Block markup: blank line = new paragraph, lines starting with "- " = bullets */
  LAB.mdBlock = function (s) {
    return String(s == null ? '' : s)
      .split(/\n{2,}/)
      .map(function (p) {
        var lines = p.split('\n');
        if (lines.every(function (l) { return /^- /.test(l); })) {
          return '<ul>' + lines.map(function (l) { return '<li>' + LAB.md(l.slice(2)) + '</li>'; }).join('') + '</ul>';
        }
        return '<p>' + LAB.md(p) + '</p>';
      })
      .join('');
  };

  LAB.store = {
    get: function (k, d) {
      try {
        var v = localStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
    },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  LAB.$ = function (sel, root) { return (root || document).querySelector(sel); };
  LAB.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* Deterministic shuffle so "put in order" games look the same on every visit. */
  LAB.shuffle = function (arr, seedStr) {
    var seed = 0, i;
    for (i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
    var a = arr.map(function (v, idx) { return [v, idx]; });
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    for (i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    /* never return the already-correct order */
    var same = a.every(function (p, idx) { return p[1] === idx; });
    if (same && a.length > 1) { var x = a[0]; a[0] = a[a.length - 1]; a[a.length - 1] = x; }
    return a; /* [[value, originalIndex], ...] */
  };

  /* ---------- Syntax highlighting ---------- */
  var SQL_KW = 'select|from|where|join|left|right|inner|outer|full|cross|on|as|and|or|not|in|is|null|with|case|when|then|else|end|group|by|order|having|limit|offset|union|all|distinct|over|partition|rows|range|between|preceding|following|current|row|unbounded|qualify|create|or|replace|table|view|schema|database|warehouse|role|user|grant|revoke|alter|drop|insert|into|values|update|set|delete|merge|using|matched|truncate|use|show|describe|copy|stage|pipe|stream|task|clone|undrop|transient|temporary|if|exists|cluster|masking|policy|returns|usage|select|future|tables|schemas|to|resume|suspend|execute|lateral|flatten|input|outer|ilike|like|asc|desc|true|false|interval|date|timestamp|varchar|number|string|variant|boolean|integer|int|float|primary|key|foreign|references|constraint|default|comment|file_format|format|type|auto_ingest|integration|storage|url|schedule|after|when|at|before|offset|statement|retention|data_retention_time_in_days|min|max|sum|avg|count|exclude|of|any';
  var PY_KW = 'def|class|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|import|from|as|with|try|except|finally|raise|yield|lambda|pass|break|continue|global|nonlocal|assert|del|async|await';
  var PY_BI = 'print|len|range|list|dict|set|tuple|str|int|float|bool|open|sorted|enumerate|zip|map|filter|sum|min|max|any|all|isinstance|next|iter|super|type|round|abs|bytes';
  var YAML_KW = 'true|false|null|yes|no';
  var BASH_KW = 'if|then|else|fi|for|do|done|while|case|esac|export|cd|echo|set';
  var DOCKER_KW = 'FROM|RUN|CMD|COPY|ADD|ENTRYPOINT|WORKDIR|ENV|ARG|EXPOSE|USER|VOLUME|LABEL|HEALTHCHECK';
  var GROOVY_KW = 'pipeline|agent|any|stages|stage|steps|sh|environment|post|always|failure|success|when|branch|script|def|withCredentials|credentials|options|timeout|retry|parallel|node|echo|input|usernamePassword|string';

  function R(cls, src) { return [cls, src]; }
  var LANGS = {
    sql: [
      R('cm', '--[^\\n]*|/\\*[\\s\\S]*?\\*/'),
      R('st', "'(?:[^'\\n]|'')*'"),
      R('id', '"[^"\\n]*"'),
      R('nu', '\\b\\d+(?:\\.\\d+)?\\b'),
      R('kw', '\\b(?:' + SQL_KW + ')\\b'),
      R('fn', '[A-Za-z_][A-Za-z0-9_$]*(?=\\s*\\()'),
      R('vr', '[:$@][A-Za-z0-9_]+|\\$[0-9]+|METADATA\\$[A-Z]+')
    ],
    python: [
      R('cm', '#[^\\n]*'),
      R('st', '[fFbBrR]{0,2}(?:"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\')'),
      R('dc', '@[A-Za-z_][A-Za-z0-9_.]*'),
      R('nu', '\\b\\d+(?:\\.\\d+)?\\b'),
      R('kw', '\\b(?:' + PY_KW + ')\\b'),
      R('bi', '\\b(?:' + PY_BI + ')\\b'),
      R('fn', '[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()')
    ],
    yaml: [
      R('cm', '#[^\\n]*'),
      R('st', '"(?:[^"\\n])*"|\'(?:[^\'\\n])*\''),
      R('ky', '^[ \\t]*(?:-[ \\t]+)?[A-Za-z_][A-Za-z0-9_.\\-+]*(?=:)'),
      R('nu', '\\b\\d+(?:\\.\\d+)?\\b'),
      R('kw', '\\b(?:' + YAML_KW + ')\\b')
    ],
    bash: [
      R('cm', '(?:^|\\s)#[^\\n]*'),
      R('st', '"(?:[^"\\n])*"|\'(?:[^\'\\n])*\''),
      R('fl', '(?:^|\\s)--?[A-Za-z][A-Za-z0-9\\-_]*'),
      R('vr', '\\$\\{?[A-Za-z_][A-Za-z0-9_]*\\}?'),
      R('kw', '\\b(?:' + BASH_KW + ')\\b'),
      R('fn', '^(?:[ \\t]*)(?:dbt|docker|git|airflow|pip|python|snowsql|npm|make|terraform|liquibase|sqlfluff|curl|aws)\\b')
    ],
    json: [
      R('ky', '"[^"\\n]*"(?=\\s*:)'),
      R('st', '"(?:[^"\\\\\\n]|\\\\.)*"'),
      R('nu', '-?\\b\\d+(?:\\.\\d+)?\\b'),
      R('kw', '\\b(?:true|false|null)\\b')
    ],
    docker: [
      R('cm', '#[^\\n]*'),
      R('st', '"(?:[^"\\n])*"|\'(?:[^\'\\n])*\''),
      R('kw', '^(?:' + DOCKER_KW + ')\\b'),
      R('vr', '\\$\\{?[A-Za-z_][A-Za-z0-9_]*\\}?')
    ],
    groovy: [
      R('cm', '//[^\\n]*'),
      R('st', '"(?:[^"\\n])*"|\'(?:[^\'\\n])*\''),
      R('kw', '\\b(?:' + GROOVY_KW + ')\\b'),
      R('nu', '\\b\\d+\\b')
    ],
    text: []
  };
  LANGS.jinja = LANGS.sql; /* dbt models: SQL + Jinja */
  LANGS.yml = LANGS.yaml;
  LANGS.sh = LANGS.bash;
  LANGS.dockerfile = LANGS.docker;
  LANGS.py = LANGS.python;

  var JINJA = /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g;
  var compiled = {};
  function getRe(lang) {
    if (!compiled[lang]) {
      var rules = LANGS[lang] || [];
      compiled[lang] = rules.length
        ? new RegExp(rules.map(function (r) { return '(' + r[1] + ')'; }).join('|'), 'gm')
        : null;
    }
    return compiled[lang];
  }

  /* Returns an array of HTML strings, one per source line. */
  LAB.hl = function (code, lang) {
    lang = lang || 'text';
    var lines = [''];
    function push(cls, text) {
      var parts = text.split('\n');
      for (var i = 0; i < parts.length; i++) {
        if (i > 0) lines.push('');
        if (parts[i] === '') continue;
        var h = LAB.esc(parts[i]);
        lines[lines.length - 1] += cls ? '<span class="t-' + cls + '">' + h + '</span>' : h;
      }
    }
    function plain(text) {
      var re = getRe(lang);
      if (!re) { push(null, text); return; }
      re.lastIndex = 0;
      var last = 0, m;
      while ((m = re.exec(text))) {
        if (m[0] === '') { re.lastIndex++; continue; }
        if (m.index > last) push(null, text.slice(last, m.index));
        var rules = LANGS[lang], cls = null;
        for (var g = 1; g <= rules.length; g++) { if (m[g] !== undefined) { cls = rules[g - 1][0]; break; } }
        push(cls, m[0]);
        last = m.index + m[0].length;
      }
      if (last < text.length) push(null, text.slice(last));
    }
    var useJinja = lang === 'jinja' || lang === 'sql' || lang === 'yaml' || lang === 'yml';
    if (useJinja) {
      var pos = 0, mm;
      JINJA.lastIndex = 0;
      while ((mm = JINJA.exec(code))) {
        if (mm.index > pos) plain(code.slice(pos, mm.index));
        push('jj', mm[0]);
        pos = mm.index + mm[0].length;
      }
      if (pos < code.length) plain(code.slice(pos));
    } else {
      plain(code);
    }
    return lines;
  };
})();
