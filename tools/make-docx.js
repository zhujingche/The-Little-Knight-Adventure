// tools/make-docx.js — 零依赖生成真正的 .docx(Word) 文档
// 用法: node tools/make-docx.js <input.md> <output.docx>
// 支持: '# ' 标题1, '## ' 标题2, '### ' 标题3, '- ' 项目符号, '  ' 缩进段落,
//       '```' 代码块, '[图:xxx]' 截图占位(加粗方框样式), 其余为普通段落
const fs = require('fs');
const path = require('path');

// ---------- CRC32 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ---------- 极简 ZIP(STORED 无压缩) ----------
function makeZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0x0800, 6);      // UTF-8 名称
    local.writeUInt16LE(0, 8);           // method: stored
    local.writeUInt16LE(0, 10);          // time
    local.writeUInt16LE(0x21, 12);       // date(1980-01-01)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, data);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(0, 12); cen.writeUInt16LE(0x21, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30); cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34); cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

// ---------- XML 转义 ----------
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// ---------- PNG 尺寸 / 图片段落 ----------
function pngSize(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  return { w: 800, h: 600 };
}
const EMU_PER_PX = 9525;      // 96 DPI
const MAX_W_EMU = 5600000;    // 页面正文可用宽度(A4 去页边距)
function imagePara(rid, id, px) {
  let cx = px.w * EMU_PER_PX, cy = px.h * EMU_PER_PX;
  const k = Math.min(1, MAX_W_EMU / cx);
  cx = Math.round(cx * k); cy = Math.round(cy * k);
  const drawing = '<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"'
    + ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">'
    + '<wp:extent cx="' + cx + '" cy="' + cy + '"/>'
    + '<wp:docPr id="' + id + '" name="Picture ' + id + '"/>'
    + '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
    + '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + '<pic:nvPicPr><pic:cNvPr id="' + id + '" name="image' + id + '.png"/><pic:cNvPicPr/></pic:nvPicPr>'
    + '<pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="' + rid + '"/>'
    + '<a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
    + '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>'
    + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
    + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>';
  return '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr>'
    + '<w:r>' + drawing + '</w:r></w:p>';
}

// ---------- 段落 ----------
function para(text, opt = {}) {
  const sz = opt.size || 21;         // 半磅: 21 = 10.5pt
  const font = opt.mono ? 'Consolas' : 'Calibri';
  const eastAsia = opt.mono ? '黑体' : '宋体';
  const rpr = '<w:rPr>'
    + (opt.bold ? '<w:b/>' : '')
    + (opt.color ? '<w:color w:val="' + opt.color + '"/>' : '')
    + '<w:rFonts w:ascii="' + font + '" w:hAnsi="' + font + '" w:eastAsia="' + eastAsia + '"/>'
    + '<w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/>'
    + '</w:rPr>';
  const ppr = '<w:pPr>'
    + '<w:spacing w:before="' + (opt.before || 60) + '" w:after="' + (opt.after || 60) + '" w:line="300" w:lineRule="auto"/>'
    + (opt.indent ? '<w:ind w:left="' + opt.indent + '"/>' : '')
    + (opt.center ? '<w:jc w:val="center"/>' : '')
    + (opt.shade ? '<w:shd w:val="clear" w:color="auto" w:fill="' + opt.shade + '"/>' : '')
    + '</w:pPr>';
  return '<w:p>' + ppr + '<w:r>' + rpr + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r></w:p>';
}

// ---------- 表格 ----------
function tableXml(rows) {
  const cols = Math.max(...rows.map(r => r.length));
  const total = 9026;
  const w = Math.floor(total / cols);
  const borders = '<w:tblBorders>'
    + '<w:top w:val="single" w:sz="6" w:color="808080"/><w:left w:val="single" w:sz="6" w:color="808080"/>'
    + '<w:bottom w:val="single" w:sz="6" w:color="808080"/><w:right w:val="single" w:sz="6" w:color="808080"/>'
    + '<w:insideH w:val="single" w:sz="6" w:color="808080"/><w:insideV w:val="single" w:sz="6" w:color="808080"/>'
    + '</w:tblBorders>';
  const trs = rows.map((cells, r) => {
    const tcs = [];
    for (let c = 0; c < cols; c++) {
      const txt = String(cells[c] === undefined ? '' : cells[c]).replace(/\*\*/g, '');
      tcs.push('<w:tc><w:tcPr><w:tcW w:w="' + w + '" w:type="dxa"/>'
        + (r === 0 ? '<w:shd w:val="clear" w:color="auto" w:fill="EDE7DA"/>' : '')
        + '</w:tcPr><w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr><w:r><w:rPr>'
        + '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="宋体"/>' + (r === 0 ? '<w:b/>' : '')
        + '<w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr><w:t xml:space="preserve">' + esc(txt) + '</w:t></w:r></w:p></w:tc>');
    }
    return '<w:tr>' + tcs.join('') + '</w:tr>';
  }).join('');
  return '<w:tbl><w:tblPr><w:tblW w:w="' + total + '" w:type="dxa"/>' + borders + '</w:tblPr>' + trs + '</w:tbl>'
    + para(' ', { size: 12, before: 0, after: 0 });
}
const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isTableSep = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
const splitRow = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());

function mdToBody(md, ctx) {
  const out = [];
  const lines = md.split(/\r?\n/);
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, '');
    if (/^```/.test(line)) { inCode = !inCode; continue; }
    if (inCode) { out.push(para(line || ' ', { mono: true, size: 19, indent: 340, before: 0, after: 0 })); continue; }
    if (!line.trim()) { out.push(para(' ', { size: 12, before: 0, after: 0 })); continue; }
    // 表格: 连续的 | ... | 行(第二行为分隔行)
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const rows = [splitRow(line)];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) { rows.push(splitRow(lines[i])); i++; }
      i--;
      out.push(tableXml(rows));
      continue;
    }
    let m;
    if ((m = line.match(/^!\[(.*?)\]\((.+?)\)\s*$/))) {
      // 真实图片: ![说明](相对或绝对路径) → 嵌入 docx
      const rel = m[2].trim();
      const abs = /^[A-Za-z]:[\\/]/.test(rel) ? rel : path.resolve(ctx.base, rel);
      try {
        const buf = fs.readFileSync(abs);
        const px = pngSize(buf);
        const id = ctx.imgs.length + 1;
        ctx.imgs.push({ name: 'image' + id + '.png', buf });
        out.push(imagePara('rIdImg' + id, id, px));
        if (m[1]) out.push(para('图：' + m[1], { center: true, size: 18, before: 0, after: 140 }));
      } catch (e) {
        out.push(para('【图片缺失：' + rel + '】', { bold: true, color: 'B0261B', shade: 'F2F2F2', indent: 120 }));
      }
    }
    else if ((m = line.match(/^###\s+(.*)$/))) out.push(para(m[1].replace(/\*\*/g, ''), { bold: true, size: 24, before: 120 }));
    else if ((m = line.match(/^##\s+(.*)$/))) out.push(para(m[1].replace(/\*\*/g, ''), { bold: true, size: 28, before: 180 }));
    else if ((m = line.match(/^#\s+(.*)$/))) out.push(para(m[1].replace(/\*\*/g, ''), { bold: true, size: 34, center: true, before: 120, after: 200 }));
    else if ((m = line.match(/^\[图[:：](.*)\]$/))) out.push(para('【此处插入截图：' + m[1] + '】', { bold: true, color: 'B0261B', shade: 'F2F2F2', indent: 120 }));
    else if ((m = line.match(/^-\s+(.*)$/))) out.push(para('• ' + m[1].replace(/\*\*/g, ''), { indent: 300, before: 20, after: 20 }));
    else if ((m = line.match(/^(\d+[.)])\s+(.*)$/))) out.push(para(m[1] + ' ' + m[2].replace(/\*\*/g, ''), { indent: 300, before: 20, after: 20 }));
    else if (/^\s{2,}/.test(raw)) out.push(para(line.trim().replace(/\*\*/g, ''), { indent: 300, before: 20, after: 20 }));
    else out.push(para(line.replace(/\*\*/g, '')));
  }
  return out.join('');
}

function buildDocx(md, base) {
  const ctx = { imgs: [], base: base || process.cwd() };
  const body = mdToBody(md, ctx);
  const document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + '<w:body>' + body
    + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
    + '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'
    + '</w:body></w:document>';
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + (ctx.imgs.length ? '<Default Extension="png" ContentType="image/png"/>' : '')
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '</Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + '</Relationships>';
  const entries = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: document },
  ];
  if (ctx.imgs.length) {
    const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + ctx.imgs.map((im, i) => '<Relationship Id="rIdImg' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + im.name + '"/>').join('')
      + '</Relationships>';
    entries.push({ name: 'word/_rels/document.xml.rels', data: docRels });
    for (const im of ctx.imgs) entries.push({ name: 'word/media/' + im.name, data: im.buf });
  }
  return { zip: makeZip(entries), imgs: ctx.imgs.length };
}

const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) { console.error('用法: node tools/make-docx.js <in.md> <out.docx>'); process.exit(1); }
const md = fs.readFileSync(inFile, 'utf8');
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
const built = buildDocx(md, path.dirname(path.resolve(inFile)));
fs.writeFileSync(outFile, built.zip);
console.log('已生成 ' + outFile + ' (' + fs.statSync(outFile).size + ' 字节, 嵌入图片 ' + built.imgs + ' 张)');
