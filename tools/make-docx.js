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

function mdToBody(md) {
  const out = [];
  const lines = md.split(/\r?\n/);
  let inCode = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^```/.test(line)) { inCode = !inCode; continue; }
    if (inCode) { out.push(para(line || ' ', { mono: true, size: 19, indent: 340, before: 0, after: 0 })); continue; }
    if (!line.trim()) { out.push(para(' ', { size: 12, before: 0, after: 0 })); continue; }
    let m;
    if ((m = line.match(/^###\s+(.*)$/))) out.push(para(m[1], { bold: true, size: 24, before: 120 }));
    else if ((m = line.match(/^##\s+(.*)$/))) out.push(para(m[1], { bold: true, size: 28, before: 180 }));
    else if ((m = line.match(/^#\s+(.*)$/))) out.push(para(m[1], { bold: true, size: 34, center: true, before: 120, after: 200 }));
    else if ((m = line.match(/^\[图[:：](.*)\]$/))) out.push(para('【此处插入截图：' + m[1] + '】', { bold: true, color: 'B0261B', shade: 'F2F2F2', indent: 120 }));
    else if ((m = line.match(/^-\s+(.*)$/))) out.push(para('• ' + m[1], { indent: 300, before: 20, after: 20 }));
    else if ((m = line.match(/^(\d+[.)])\s+(.*)$/))) out.push(para(m[1] + ' ' + m[2], { indent: 300, before: 20, after: 20 }));
    else if (/^\s{2,}/.test(raw)) out.push(para(line.trim(), { indent: 300, before: 20, after: 20 }));
    else out.push(para(line));
  }
  return out.join('');
}

function buildDocx(md) {
  const body = mdToBody(md);
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
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '</Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + '</Relationships>';
  return makeZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels },
    { name: 'word/document.xml', data: document },
  ]);
}

const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) { console.error('用法: node tools/make-docx.js <in.md> <out.docx>'); process.exit(1); }
const md = fs.readFileSync(inFile, 'utf8');
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
fs.writeFileSync(outFile, buildDocx(md));
console.log('已生成 ' + outFile + ' (' + fs.statSync(outFile).size + ' 字节)');
