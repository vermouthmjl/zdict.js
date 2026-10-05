// 没有合适 emoji 的字，用内嵌 SVG 画出来
// 用橙色标出要看的东西，灰色的作参照；成对的字（大/小、多/少等）用同一画面、互换颜色
const C = '#ff8c1a', G = '#c8c8c8', K = '#333';

function svg(body) {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}
function dot(x, y, r, fill) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
}
function rect(x, y, w, h, fill, rx = 3) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
}
function poly(points, fill) {
  return `<polygon points="${points.join(',')}" fill="${fill}"/>`;
}
function line(x1, y1, x2, y2, stroke, w) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
}
function path(d, fill, stroke = 'none', w = 0) {
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function box(x, y, s) {
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="none" stroke="${K}" stroke-width="5"/>`;
}
function arrow(x1, x2, y) {
  return line(x1, y, x2 - 10, y, C, 8) + poly([x2, y, x2 - 14, y - 11, x2 - 14, y + 11], C);
}
// 左边一群散乱的点，右边两个点；多、少两字用颜色区分看哪一边
function crowd(c1, c2) {
  return [[12, 16], [31, 11], [52, 17], [22, 33], [42, 30], [60, 38], [9, 50], [28, 49],
    [47, 53], [15, 68], [35, 66], [54, 72], [64, 57], [24, 85], [44, 84], [9, 86]]
    .map(p => dot(p[0], p[1], 7, c1)).join('') + dot(86, 40, 7, c2) + dot(86, 62, 7, c2);
}

// 金属条（金、银、铜）：x 为左下角，y 为底边
const METALS = {
  gold: ['#e8a800', '#ffd84a', '#a87800', '#fff3b0', '#f5b800'],
  silver: ['#a9b0b8', '#e3e7ec', '#6e757d', '#ffffff', '#9aa6b2'],
  copper: ['#c26a2e', '#eb9d63', '#7a3e14', '#ffd2b0', '#d9732f']
};
function metalBar(x, y, m) {
  const s = ` stroke="${m[2]}" stroke-width="2" stroke-linejoin="round"/>`;
  return `<polygon points="${[x, y, x + 42, y, x + 38, y - 14, x + 4, y - 14]}" fill="${m[0]}"${s}` +
    `<polygon points="${[x + 4, y - 14, x + 38, y - 14, x + 33, y - 22, x + 9, y - 22]}" fill="${m[1]}"${s}` +
    line(x + 10, y - 5, x + 18, y - 5, m[3], 3);
}
function metal(name) {
  const m = METALS[name];
  return svg(metalBar(6, 86, m) + metalBar(52, 86, m) + metalBar(29, 64, m) +
    poly([82, 14, 85, 24, 95, 27, 85, 30, 82, 40, 79, 30, 69, 27, 79, 24], m[4]));
}

// 一家人：脚踩在 y=94，h 为身高；女孩/女人穿裙子、扎辫子
function person(cx, h, girl, fill) {
  const r = h * 0.14, hy = 94 - h + r, top = hy + r + 2, bh = h * 0.42, lt = top + bh, w = h * 0.36;
  let s = girl ? line(cx - r * 0.8, hy, cx - r * 1.7, hy + r * 1.1, fill, r * 0.5) +
    line(cx + r * 0.8, hy, cx + r * 1.7, hy + r * 1.1, fill, r * 0.5) : '';
  s += dot(cx, hy, r, fill);
  s += girl ? poly([cx, top, cx - w * 0.75, lt + 2, cx + w * 0.75, lt + 2], fill) : rect(cx - w / 2, top, w, bh, fill, 2);
  return s + rect(cx - w * 0.38, lt, w * 0.28, 94 - lt, fill, 1) + rect(cx + w * 0.1, lt, w * 0.28, 94 - lt, fill, 1);
}
function parents(dad, mom) {
  return svg(person(22, 84, false, dad) + person(80, 78, true, mom) + person(51, 44, false, G));
}
function siblings(girl, big, small) {
  return svg(person(32, 82, girl, big) + person(74, 52, girl, small));
}

// 人体：灰色的人，要看的部位涂成橙色
function body(part) {
  const f = p => p === part || part === 'all' ? C : G;
  return svg(
    rect(19, 33, 10, 34, f('limbs'), 5) + rect(71, 33, 10, 34, f('limbs'), 5) +
    rect(35, 72, 12, 24, f('limbs'), 3) + rect(53, 72, 12, 24, f('limbs'), 3) +
    rect(31, 32, 38, 20, f('chest'), 5) + rect(33, 52, 34, 12, f('belly'), 0) +
    rect(33, 64, 34, 8, f('waist'), 2) + rect(45, 25, 10, 9, f('neck'), 2) +
    dot(30, 37, 7, f('shoulder')) + dot(70, 37, 7, f('shoulder')) + dot(50, 15, 11, f('head')));
}

// 胖瘦：左边胖人，右边瘦人
function fatThin(fat, thin) {
  return svg(
    dot(30, 20, 10, fat) + `<ellipse cx="30" cy="56" rx="24" ry="24" fill="${fat}"/>` +
    rect(19, 74, 9, 20, fat, 2) + rect(32, 74, 9, 20, fat, 2) +
    dot(78, 20, 8, thin) + `<ellipse cx="78" cy="54" rx="8" ry="24" fill="${thin}"/>` +
    rect(73, 72, 4, 22, thin, 1) + rect(79, 72, 4, 22, thin, 1));
}

// 杯子：满杯水或空杯
function cup(full) {
  return svg((full ? path('M27,20 L73,20 L67.5,87 L32.5,87 Z', '#4aa3df') + path('M27,20 L73,20', 'none', '#8fd0ff', 3) : '') +
    path('M24,12 L76,12 L69,92 L31,92 Z', 'none', K, 5));
}

// 门：开着或关着
function door(open) {
  const wood = '#b5733b';
  return svg(open
    ? rect(25, 10, 50, 84, '#fff2b3', 0) + poly([25, 10, 44, 18, 44, 86, 25, 94], wood) + dot(39, 54, 3, K) +
      `<rect x="25" y="10" width="50" height="84" fill="none" stroke="${K}" stroke-width="5"/>`
    : rect(25, 10, 50, 84, wood, 0) + dot(66, 54, 3.5, K) +
      `<rect x="25" y="10" width="50" height="84" fill="none" stroke="${K}" stroke-width="5"/>` +
      line(50, 10, 50, 94, '#9a5f2e', 2));
}

// 天地：上面是天，下面是地
function skyGround(sky, ground) {
  return svg(rect(4, 4, 92, 60, sky ? '#6cc0f0' : '#ececec', 0) + rect(4, 64, 92, 32, ground ? '#7cb342' : G, 0) +
    (sky ? dot(32, 30, 9, '#fff') + dot(44, 26, 12, '#fff') + dot(56, 31, 9, '#fff') + rect(32, 30, 24, 10, '#fff', 0) : '') +
    (ground ? line(14, 76, 20, 70, '#558b2f', 3) + line(46, 84, 52, 78, '#558b2f', 3) + line(78, 74, 84, 68, '#558b2f', 3) : ''));
}

// 一摞积木：顶上或底下那块是橙色
function stack(hi) {
  return svg([0, 1, 2, 3].map(i => rect(30, 72 - i * 21, 40, 19, i === hi ? C : G, 3)).join(''));
}

// 跷跷板：左边低（重），右边高（轻）
function seesaw(heavy, light) {
  return svg(poly([50, 58, 38, 92, 62, 92], '#999') +
    `<g transform="rotate(-20 50 55)">` + rect(6, 53, 88, 6, K, 2) +
    rect(12, 23, 30, 30, heavy, 3) + rect(70, 41, 12, 12, light, 2) + '</g>');
}

// 这、那：灰色小人指着近处或远处的球
function point(near) {
  return svg(line(0, 92, 100, 92, G, 3) + person(16, 70, false, G) +
    (near ? line(21, 46, 36, 64, G, 5) : line(21, 46, 44, 40, G, 5)) +
    dot(46, 78, 13, near ? C : G) + dot(85, 50, 9, near ? G : C));
}

export default {
"金": metal('gold'),
"银": metal('silver'),
"铜": metal('copper'),

"中": svg(dot(18, 50, 13, G) + dot(50, 50, 13, C) + dot(82, 50, 13, G)),
"大": svg(dot(38, 58, 32, C) + dot(85, 80, 10, G)),
"小": svg(dot(38, 58, 32, G) + dot(85, 80, 10, C)),
"多": svg(crowd(C, G)),
"少": svg(crowd(G, C)),
"高": svg(rect(22, 8, 24, 84, C) + rect(58, 62, 24, 30, G)),
"低": svg(rect(22, 8, 24, 84, G) + rect(58, 62, 24, 30, C)),
"长": svg(rect(8, 28, 84, 16, C) + rect(8, 60, 30, 16, G)),
"短": svg(rect(8, 28, 84, 16, G) + rect(8, 60, 30, 16, C)),
"粗": svg(rect(18, 10, 34, 82, C, 4) + rect(70, 10, 7, 82, G, 3)),
"细": svg(rect(18, 10, 34, 82, G, 4) + rect(70, 10, 7, 82, C, 3)),
"直": svg(line(12, 30, 88, 30, C, 9) + path('M12,70 Q31,50 50,70 T88,70', 'none', G, 9)),
"弯": svg(line(12, 30, 88, 30, G, 9) + path('M12,70 Q31,50 50,70 T88,70', 'none', C, 9)),
"出": svg(box(8, 30, 42) + arrow(29, 94, 51)),
"入": svg(box(50, 30, 42) + arrow(6, 75, 51)),
"内": svg(box(20, 20, 60) + dot(50, 50, 11, C)),
"外": svg(box(8, 36, 56) + dot(82, 18, 11, C)),
"顶": stack(3),
"底": stack(0),
"重": seesaw(C, G),
"轻": seesaw(G, C),
"满": cup(true),
"空": cup(false),
"开": door(true),
"关": door(false),
"半": svg(`<circle cx="50" cy="50" r="36" fill="none" stroke="${K}" stroke-width="4"/>` +
  path('M50,14 A36,36 0 0,0 50,86 Z', C)),
"圆": svg(dot(50, 50, 36, C)),
"方": svg(rect(16, 16, 68, 68, C, 0)),
"圈": svg(`<circle cx="50" cy="50" r="32" fill="none" stroke="${C}" stroke-width="12"/>`),
"粉": svg(rect(14, 14, 72, 72, '#ff9ec7', 8)),
"灰": svg(rect(14, 14, 72, 72, '#9a9a9a', 8)),

"天": skyGround(true, false),
"地": skyGround(false, true),
"土": svg(path('M4,86 Q50,14 96,86 Z', '#a0612d') + dot(38, 66, 4, '#6b3e1a') +
  dot(58, 56, 4, '#6b3e1a') + dot(66, 74, 4, '#6b3e1a') + line(0, 88, 100, 88, K, 4)),
"田": svg(rect(8, 8, 84, 84, '#c8a165', 4) + rect(13, 13, 35, 35, '#8bc34a', 2) + rect(52, 13, 35, 35, '#8bc34a', 2) +
  rect(13, 52, 35, 35, '#8bc34a', 2) + rect(52, 52, 35, 35, '#8bc34a', 2)),
"根": svg(rect(0, 50, 100, 50, '#f0e0cc', 0) + line(0, 50, 100, 50, '#a0612d', 3) +
  line(50, 50, 50, 14, G, 5) + path('M50,30 Q32,16 26,30 Q38,38 50,30 Z', G) + path('M50,22 Q68,8 74,22 Q62,30 50,22 Z', G) +
  path('M50,50 L50,72 M50,58 Q36,64 28,80 M50,58 Q64,66 72,82 M50,68 Q44,80 40,92 M50,68 Q58,80 62,92', 'none', C, 4)),
"尾": svg(`<ellipse cx="48" cy="60" rx="26" ry="14" fill="${G}"/>` + dot(76, 46, 12, G) +
  poly([68, 38, 70, 24, 78, 35], G) + poly([78, 35, 86, 24, 86, 40], G) +
  rect(30, 68, 7, 22, G, 2) + rect(58, 68, 7, 22, G, 2) +
  path('M24,56 Q6,52 10,30 Q12,20 20,18', 'none', C, 8)),
"翅": svg(`<ellipse cx="46" cy="62" rx="28" ry="16" fill="${G}"/>` + dot(76, 46, 11, G) +
  poly([86, 44, 97, 48, 86, 51], '#999') + poly([20, 58, 4, 50, 8, 70], G) +
  path('M36,58 Q28,14 72,22 Q66,48 36,58 Z', C)),
"桌": svg(rect(8, 36, 84, 10, '#b5733b', 2) + rect(15, 46, 8, 46, '#9a5f2e', 1) + rect(77, 46, 8, 46, '#9a5f2e', 1)),

"爸": parents(C, G),
"妈": parents(G, C),
"哥": siblings(false, C, G),
"弟": siblings(false, G, C),
"姐": siblings(true, C, G),
"妹": siblings(true, G, C),
"胖": fatThin(C, G),
"瘦": fatThin(G, C),

"头": body('head'),
"脖": body('neck'),
"肩": body('shoulder'),
"胸": body('chest'),
"肚": body('belly'),
"腰": body('waist'),
"身": body('all'),

"这": point(true),
"那": point(false)
};
