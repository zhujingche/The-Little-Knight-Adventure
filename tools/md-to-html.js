// tools/md-to-html.js — 零依赖把报告 .md 渲染成「单文件 HTML」(图片以 base64 内嵌)
// 用法: node tools/md-to-html.js <input.md> <output.html> [标题]
// 支持: # ## ### 标题, - 列表, 1. 编号, ```代码块, ![说明](图片路径), **加粗**, `行内代码`
const fs = require('fs');
const path = require('path');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>');

function imgDataUri(p) {
  const buf = fs.readFileSync(p);
  const ext = /\.jpe?g$/i.test(p) ? 'jpeg' : 'png';
  return 'data:image/' + ext + ';base64,' + buf.toString('base64');
}

function render(md, base) {
  const out = [];
  const lines = md.split(/\r?\n/);
  let inCode = false, codeBuf = [], inList = false, inOl = false;
  const closeLists = () => {
    if (inList) { out.push('</ul>'); inList = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    const line = raw.replace(/\s+$/, '');
    if (/^```/.test(line)) {
      if (inCode) { out.push('<pre><code>' + esc(codeBuf.join('\n')) + '</code></pre>'); codeBuf = []; }
      else closeLists();
      inCode = !inCode;
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }
    let m;
    if (!line.trim()) { closeLists(); continue; }
    // 表格: 连续的 | ... | 行(第二行为分隔行)
    if (/^\s*\|.*\|\s*$/.test(line) && li + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[li + 1])) {
      closeLists();
      const cell = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
      const head = cell(line);
      const rows = [];
      li += 2;
      while (li < lines.length && /^\s*\|.*\|\s*$/.test(lines[li])) { rows.push(cell(lines[li])); li++; }
      li--;
      out.push('<table><thead><tr>' + head.map(h => '<th>' + inline(h) + '</th>').join('') + '</tr></thead><tbody>'
        + rows.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('')
        + '</tbody></table>');
      continue;
    }
    if ((m = line.match(/^!\[(.*?)\]\((.+?)\)\s*$/))) {
      closeLists();
      const rel = m[2].trim();
      const abs = /^[A-Za-z]:[\\/]/.test(rel) ? rel : path.resolve(base, rel);
      try {
        out.push('<figure><img src="' + imgDataUri(abs) + '" alt="' + esc(m[1]) + '">'
          + (m[1] ? '<figcaption>' + inline(m[1]) + '</figcaption>' : '') + '</figure>');
      } catch (e) {
        out.push('<p class="missing">【图片缺失：' + esc(rel) + '】</p>');
      }
      continue;
    }
    if ((m = line.match(/^\[图[:：](.*)\]$/))) {
      closeLists();
      out.push('<p class="todo">【待补截图：' + inline(m[1]) + '】</p>');
      continue;
    }
    if ((m = line.match(/^###\s+(.*)$/))) { closeLists(); out.push('<h3>' + inline(m[1]) + '</h3>'); continue; }
    if ((m = line.match(/^##\s+(.*)$/))) { closeLists(); out.push('<h2>' + inline(m[1]) + '</h2>'); continue; }
    if ((m = line.match(/^#\s+(.*)$/))) { closeLists(); out.push('<h1>' + inline(m[1]) + '</h1>'); continue; }
    if ((m = line.match(/^-\s+(.*)$/))) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + inline(m[1]) + '</li>');
      continue;
    }
    if ((m = line.match(/^(\d+[.)])\s+(.*)$/))) {
      if (inList) { out.push('</ul>'); inList = false; }
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push('<li>' + inline(m[2]) + '</li>');
      continue;
    }
    closeLists();
    out.push(/^\s{2,}/.test(raw) ? '<p class="ind">' + inline(line.trim()) + '</p>' : '<p>' + inline(line) + '</p>');
  }
  if (inCode && codeBuf.length) out.push('<pre><code>' + esc(codeBuf.join('\n')) + '</code></pre>');
  closeLists();
  return out.join('\n');
}

const [, , inFile, outFile, title] = process.argv;
if (!inFile || !outFile) { console.error('用法: node tools/md-to-html.js <in.md> <out.html> [标题]'); process.exit(1); }
const md = fs.readFileSync(inFile, 'utf8');
const body = render(md, path.dirname(path.resolve(inFile)));
const html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n'
  + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
  + '<title>' + esc(title || path.basename(inFile, '.md')) + '</title>\n<style>\n'
  + 'body{max-width:860px;margin:0 auto;padding:28px 20px 80px;background:#fbfaf7;color:#222;'
  + 'font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif;line-height:1.75;font-size:15px}\n'
  + 'h1{font-size:26px;text-align:center;border-bottom:3px double #b9a06a;padding-bottom:14px}\n'
  + 'h2{font-size:20px;margin-top:32px;border-left:5px solid #b9a06a;padding-left:10px}\n'
  + 'h3{font-size:17px;margin-top:24px;color:#4a3d22}\n'
  + 'pre{background:#1e2430;color:#dfe8f2;padding:12px 14px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.5}\n'
  + 'code{font-family:Consolas,monospace}\n'
  + 'p code,li code{background:#efe9dc;padding:1px 5px;border-radius:4px;font-size:13px}\n'
  + 'figure{margin:18px 0;text-align:center}\n'
  + 'figure img{max-width:100%;border:1px solid #cbc3b2;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.12)}\n'
  + 'figcaption{font-size:13px;color:#6b6152;margin-top:6px}\n'
  + '.todo{background:#fdecea;border-left:5px solid #c0392b;color:#a12b1e;padding:8px 12px;border-radius:4px;font-weight:600}\n'
  + '.missing{background:#fdecea;color:#a12b1e;padding:8px 12px}\n'
  + '.ind{margin-left:26px}\nul,ol{padding-left:26px}\nli{margin:4px 0}\n'
  + 'table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px}\n'
  + 'th,td{border:1px solid #b9b0a0;padding:6px 9px;text-align:left;vertical-align:top}\n'
  + 'th{background:#ede7da;font-weight:700}\ntbody tr:nth-child(even){background:#f4f1ea}\n'
  + '</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
fs.writeFileSync(outFile, html);
console.log('已生成 ' + outFile + ' (' + Math.round(fs.statSync(outFile).size / 1024) + ' KB)');
