import zDict from "./zdict.js";
import pictures from "./data-pictures.js";

let d = document.getElementById('learn-chars');

if (!d) {
  const s = document.currentScript;
  if (!s) throw '抱歉，本程序不支持您的古董浏览器，请尝试使用 Chrome/Firefox/Edge 等现代浏览器';
  d = document.createElement('div');
  d.id = "learn-chars";
  s.after(d);
}

// 学习字库、总字库、挑战字库
var chars = [], freqs = zDict.freqs.split(''), cChars = [];

// 安插基本元素，用来存放拼音、汉字等信息
if (d.childElementCount === 0) d.innerHTML = '<div id="learn-toolbar"></div>' +
  '<div class="char-block">' +
  '<div class="pinyin" contenteditable></div>' +
  '<div class="char-box kai">' +
  '<span class="char"></span><span class="num"></span></div>' +
  '</div>' +
  '<div class="choices"></div>' +
  '<div class="meaning"></div>' +
  '<p class="source kai right"></p>' +
  '<div id="learn-settings"><p class="seal-line seal-top">密封线内不要答题</p>' +
  '<textarea id="learn-candidates"></textarea>' +
  '<p><span><span>字符范围：从第</span> <input type="number" value="1" min="1"> ' +
  '<span>字开始向后选取</span> <input type="number" value="20" min="0" step="10"> ' +
  '<span>字；韵母（可选）：<input type="text" class="yunmu"></span></span> ' +
  '<button type="button" id="learn-set">确定</button></p>' +
  '<p class="seal-line seal-bottom">密封线内不要答题</p>';

function sampleOne(x) {
  return x[Math.floor(Math.random() * x.length)];
}

function noAccent(x) {
  return x.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
// 比较原始拼音是否相同，如果不同，去掉音调之后再比较
function checkPinyin(x1, x2) {
  x1 = x1.toLowerCase();
  return x2.split(' - ').indexOf(x1) > -1 || noAccent(x2).split(' - ').indexOf(x1) > -1;
}

var tb = d.querySelector('#learn-toolbar'), cb = d.querySelector('.char-block'),
    py = cb.querySelector('.pinyin'), zi = cb.querySelector('.char'),
    mn = d.querySelector('.meaning'), sc = d.querySelector('.source'),
    ls = d.querySelector('#learn-settings'), lc = ls.querySelector('#learn-candidates');

// 几种使用模式的单选框
tb.innerHTML || ['学习', '复习', '测验', '挑战'].forEach(function(el, i) {
  tb.innerHTML += '<input name="mode" type="radio" id="mode-'+ i +
  '" ' + (i === 0 ? 'checked' : '') +
  '/><label for="mode-' + i + '" class="label">' + el + '</label> ';
});
var mode = 0;

// 测验、挑战模式下的答题方式：0 打字、1 选拼音、2 看图选
var answer = 0, NCHOICE = 4, picChars = Object.keys(pictures);
var ab = d.querySelector('#learn-answer');
if (!ab) {
  ab = document.createElement('div');
  ab.id = 'learn-answer';
  tb.after(ab);
}
ab.innerHTML || (ab.innerHTML = '<span class="answer-title">答题方式</span><span class="segmented">' +
  ['打字', '选拼音', '看图选'].map(function(el, i) {
    return '<input name="answer" type="radio" id="answer-' + i + '" ' + (i === 0 ? 'checked' : '') +
      '/><label for="answer-' + i + '">' + el + '</label>';
  }).join('') + '</span>');
var ch = d.querySelector('.choices');
if (!ch) {
  ch = document.createElement('div');
  ch.className = 'choices';
  cb.after(ch);
}

// 浏览器的本地存储
var S = {
  "get": function(k) { return localStorage.getItem(k); },
  "set": function(k, d) { try { localStorage.setItem(k, d); } catch (e) {} },
  "remove": function(k) { localStorage.removeItem(k); }
};

// 加载字库；如果以前有保存过字库，就用以前存的，否则用汉字频度表
var key1 = 'candidate-chars';
lc.value = S.get(key1);
if (!lc.value) lc.value = zDict.freqs;

// 保存学过的字，供复习用
var key2 = 'learned-chars', p = [-1, 0, -1];
function saveChar(x, key) {
  var data = S.get(key);
  if (!data) { data = ''; } else if (data.match(x)) return;
  data += x;
  S.set(key, data);
}
function learnedChars(key) {
  var x = S.get(key);
  return x ? x.split('') : [];
}

function setChars() {
  p = [-1, 0, -1];
  chars = lc.value.split('');
  if (lc.value !== '' && lc.value !== zDict.freqs) {
    var v = [];
    chars.forEach(function(x) {
      v.indexOf(x) === -1 && zDict.freqs.indexOf(x) >= 0 && v.push(x);
    });
    chars = [];
    freqs.forEach(function(x) {
      v.indexOf(x) >= 0 && chars.push(x);
    });
    lc.value = chars.join('');
    S.set(key1, lc.value);
  } else {
    S.remove(key1);
  }
  if (chars.length === 0) chars = freqs;
  var ym = ls.querySelector('input.yunmu').value;
  if (ym) chars = chars.filter(function(char) {
    var info = zDict.chars[char];
    return (noAccent(Object.keys(info).join(',')) + ',').match(ym + ',');
  });
  var n = [], ns = ls.querySelectorAll('input[type="number"]'), n0 = ns[0], n1 = ns[1];
  n[0] = +n0.value; n[1] = +n1.value;
  if (n[0] < 1 || n[0] > chars.length) n0.value = n[0] = 1;
  if (n[1] < 0) n1.value = n[1] = 0;
  // 特例：如果设定总共使用 0 个字符，那么选择所有字符
  if (n[1] > 0) chars = chars.slice(n[0] - 1, n[0] - 1 + n[1]);
  resetChallenge();
  S.remove(key2);
  d.querySelectorAll('.review').forEach(removeEl); // 重新生成复习字块
  mode === 1 && renderReview();
}
setChars();

// 按顺序显示一字及其相关信息
function renderChar(char) {
  py.innerText = zi.innerText = mn.innerText = zi.nextElementSibling.innerText = '';
  ch.innerHTML = '';
  if (mode != 3) sc.innerText = '';
  py[mode >= 2 && answer > 0 ? 'removeAttribute' : 'setAttribute']('contenteditable', true);
  cb.classList.remove('correct', 'wrong');
  var num;  // 挑战模式下的字符编号
  if (!char) {
    switch (mode) {
      case 0:
        // 学习模式：顺序显示一字
        if (p[0] >= chars.length - 1) p[0] = -1;
        char = chars[++p[0]];
        saveChar(char, key2);
        break;

      case 1:
        // 复习模式：显示学习过的字
        var lChars = learnedChars(key2);
        if (lChars.length === 0) {
          py.innerHTML = '<p style="font-size: .5em;">学习记录都没得，复习个锤子哦</p>';
          return;
        }
        // 从全集中寻找下一个历史记录中的字
        while (lChars.indexOf(char) === -1) {
          if (p[1] >= chars.length - 1) p[1] = -1;
          char = chars[++p[1]];
        }
        break;

      case 2:
        // 测验模式：依次测试全集拼音
        var qChars = quizPool(chars);
        if (qChars.length === 0) return noPicChars();
        if (p[2] >= qChars.length - 1) {
          p[2] = -1;
          return alert('测验结束！');
        }
        char = qChars[++p[2]];
        break;

      case 3:
        // 挑战模式：随机抽取一字测验
        var qChars = quizPool(cChars);
        if (qChars.length === 0) return cChars.length ? noPicChars() : notice('范围内的字都挑战完了！');
        char = sampleOne(qChars);
        cChars.splice(cChars.indexOf(char), 1);
        break;
    }
  }
  if (mode === 1) highlightReview();
  var info = renderPinyin(char, zi, py, ' - ');
  if (!info) return;
  renderMeaning(info);
  sc.innerHTML = '资料来源：汉典（<a href="https://www.zdic.net/hans/' + char + '" target="_blank">查看详情</a>）';
}
function renderPinyin(char, zi, py, sep) {
  zi.innerText = char;
  zi.nextElementSibling.innerText = freqs.indexOf(char) + 1;
  var info = zDict.chars[char], pys = Object.keys(info);
  if (mode >= 2) {
    py.dataset.pinyin = pys.join(' - '); // 将正确拼音保存在数据中
    if (answer > 0) return renderChoices(char);
    py.focus();
    // 如果拼音框在视窗外，则自动将它滚到视窗内
    var rect = py.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) py.scrollIntoView();
    return;
  }
  py.innerText = pys.join(sep);
  return info;
}
function renderMeaning(info) {
  let me = '';
  for (let k in info) {
    me += `<p class="py">${k}</p><ol><li>${info[k].join('</li><li>')}</li></ol>`;
  };
  mn.innerHTML = me;
}

// 看图选模式下只考有图的字
function quizPool(x) {
  return answer === 2 ? x.filter(function(c) { return pictures[c]; }) : x;
}
function notice(msg) {
  py.innerHTML = '<p style="font-size: .5em;">' + msg + '</p>';
}
function noPicChars() {
  notice('当前字库里没有可以看图的字了，请换个字库或答题方式');
}

function pinyinOf(char) {
  return Object.keys(zDict.chars[char]).join(' - ');
}
function shuffle(x) {
  for (var i = x.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)), t = x[i];
    x[i] = x[j]; x[j] = t;
  }
  return x;
}

// 生成选择题：一个正确答案加几个不重复的干扰项
function renderChoices(char) {
  var label = answer === 1 ? pinyinOf : function(c) { return pictures[c]; },
      right = label(char), opts = [right];
  // 干扰项优先从设定的字符范围中选取，不够时再从全集中补足
  [chars, answer === 1 ? freqs : picChars].forEach(function(pool) {
    if (opts.length >= NCHOICE) return;
    shuffle(quizPool(pool).slice()).forEach(function(c) {
      var o = label(c);
      opts.length < NCHOICE && opts.indexOf(o) === -1 && opts.push(o);
    });
  });
  shuffle(opts).forEach(function(o) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice' + (answer === 2 ? ' pic' : '');
    b.innerText = o;
    b.addEventListener('click', function(e) {
      if (ch.classList.contains('done')) return;
      ch.classList.add('done');
      var ok = o === right;
      b.classList.add(ok ? 'correct' : 'wrong');
      ch.querySelectorAll('.choice').forEach(function(el) {
        el.innerText === right && el.classList.add('correct');
      });
      gradeAnswer(ok, ok ? '' : answer === 1 ? o : '');
      speak(char);
      var nx = document.createElement('button');
      nx.type = 'button';
      nx.className = 'next';
      nx.innerText = '下一个 ▶';
      nx.addEventListener('click', function(e) { renderChar(); });
      ch.appendChild(nx);
    });
    ch.appendChild(b);
  });
  ch.classList.remove('done');
}

// 读出字音（浏览器自带的语音合成）
function speak(char) {
  if (!window.speechSynthesis) return;
  var u = new SpeechSynthesisUtterance(char);
  u.lang = 'zh-CN';
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// 初始随机显示一个字
renderChar(sampleOne(freqs));

// 戳一下换一字
zi.parentElement.addEventListener('click', function(e) {
  renderChar();
});

function removeEl(el) { el && el.remove(); }

// 高亮学习过的字
function highlightReview() {
  var el = d.querySelector('.current'); el && el.classList.remove('current');
  d.querySelectorAll('.review')[p[1]].querySelector('.char-box').classList.add('current');
}

// 更换模式
function modeChange(e) {
  mode = +this.id.replace('mode-', '');
  d.classList[mode === 1 ? 'add' : 'remove']('review-pane');
  d.classList[mode >= 2 ? 'add' : 'remove']('quiz-pane');
  d.classList.remove('review-all');
  renderChar();
}
// 复习模式下把字集中的每个字都渲染出来，但默认是隐藏的
function renderReview() {
  var rs = d.querySelectorAll('.review'), lChars = learnedChars(key2);
  rs.forEach(function(el, i) {
    i < lChars.length && el.classList.add('review-show');
  });
  if (rs.length >= chars.length) return;
  var all = d.classList.contains('review-all');
  chars.forEach(function(char, i) {
    // 已经生成的字就表再生成了；若不显示所有的字，那么只生成学过的字
    if (i < rs.length || (!all && i >= lChars.length)) return;
    var nb = cb.cloneNode(true), zi = nb.querySelector('.char');
    renderPinyin(char, zi, nb.querySelector('.pinyin'), '\n');
    zi.parentElement.addEventListener('click', function(e) {
      p[1] = i;
      renderChar(char);
    });
    nb.classList.add('review', all ? 'review' : 'review-show');
    d.insertBefore(nb, cb);
  });
}
d.querySelectorAll('input[name="mode"]').forEach(function(el, i) {
  el.addEventListener('change', modeChange);
  i === 1 && el.addEventListener('click', function(e) {
    // 点击复习单选框，显示或隐藏还没学过的字
    mode === i && d.classList.toggle('review-all');
    renderReview();
  });
  i >= 2 && el.addEventListener('keyup', function(e) {
    e.key === 'Enter' && renderChar();
  });
});

// 测验
var nc = 0, nw = 0;  // 挑战模式下的已挑战字数、错字个数
py.addEventListener('blur', function(e) {
  // 非测试模式、选择题、或者已经结束测验的情况下提前退出
  if (mode < 2 || answer > 0 || (mode === 2 && p[2] === -1)) return;
  var v = this.innerText, ans = this.dataset.pinyin;
  if (checkPinyin(v.trim(), ans)) {
    gradeAnswer(true);
  } else {
    gradeAnswer(false, v.trim(), mode === 2 && /^\s+$/.test(v));
    py.removeAttribute('contenteditable');
  };
  d.querySelector('input[id="mode-' + mode + '"]').focus();
});

// 判分：显示正确拼音；挑战模式下更新识字量估计
function gradeAnswer(ok, given, quiet) {
  var ans = py.dataset.pinyin;
  py.innerText = ok || !given ? ans : given + ' -> ' + ans;
  if (ok || !quiet) cb.classList.add(ok ? 'correct' : 'wrong');
  if (mode !== 3) return;
  nc++;
  ok || nw++;
  renderMeaning(zDict.chars[zi.innerText]);
  if (answer === 2) {
    sc.innerHTML = '已挑战 ' + nc + ' 字，答对 ' + (nc - nw) + ' 字';
    return;
  }
  if (nc < 2) return;
  // 选拼音时有猜对的可能，按随机猜测的概率校正答对比例
  var N = chars.length, g = answer === 1 ? 1 / NCHOICE : 0, q = 1 - nw/nc;
  var m = Math.max(0, (q - g) / (1 - g)),
      s = 1.96 * Math.sqrt(N * (N - nc) / (nc - 1) * q * (1 - q)) / (1 - g);
  var M = N * m, M1 = M - s, M2 = M + s;
  if (M1 < 0) M1 = 0;
  if (M2 > N) M2 = N;
  M = Math.round(M); M1 = Math.round(M1); M2 = Math.round(M2);
  sc.innerHTML = '已挑战 ' + nc + ' 字（错 ' + nw + ' 字）<br/>' +
    (N === freqs.length ? '您的识字量估计为 ' : '所选 ' + N + ' 字中，您认识的字估计为 ')
    + M + '，其 95% 近似置信区间为【' + M1 + '，' + M2 + '】';
}

function resetChallenge() {
  cChars = chars.slice();
  nc = nw = 0;
  sc.innerText = '';
}

// 切换答题方式：重新开始测验和挑战
d.querySelectorAll('input[name="answer"]').forEach(function(el) {
  el.addEventListener('change', function(e) {
    answer = +this.id.replace('answer-', '');
    p[2] = -1;
    resetChallenge();
    mode >= 2 && renderChar();
  });
});
// 除了离开输入框，也可以用回车键提交答案
['keypress', 'keyup'].map(function(evt) {
  py.addEventListener(evt, function(e) {
    e.key === 'Enter' && (e.preventDefault(), evt === 'keyup' && this.blur());
  });
});

// 重设字库
ls.querySelector('#learn-set').addEventListener('click', function(e) {
  S.remove(key2);
  setChars();
  renderChar();
});
