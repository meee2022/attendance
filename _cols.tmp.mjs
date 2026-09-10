import * as XLSX from 'xlsx';
import fs from 'node:fs';
const wb = XLSX.read(fs.readFileSync(process.argv[2]), { type: 'buffer' });
const ws = wb.Sheets[process.argv[3]];
const range = XLSX.utils.decode_range(ws['!ref']);
const maxRow = Math.min(range.e.r, Number(process.argv[4] ?? 12));
for (let r = range.s.r; r <= maxRow; r++) {
  const out = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws[addr];
    if (!cell) continue;
    const val = cell.f ? `=${cell.f}` : String(cell.w ?? cell.v ?? '').trim();
    if (val) out.push(`${addr}:${val}`);
  }
  if (out.length) console.log(out.join('  |  '));
}
