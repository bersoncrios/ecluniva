import type { Member, Society } from './models';
import { displayDate, EXPORT_HEADERS, exportRows, todayISO } from './domain';

export async function exportRoster(format: 'pdf'|'xlsx', society: Society, members: Member[], filters: string): Promise<void> {
  if (members.length === 0) throw new Error('Nenhum membro para exportar.');
  const filename = `rol-${society.type.toLowerCase()}-${todayISO()}`;
  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const data = [
      ['Societas — rol de membros'],
      ['Igreja', society.churchName], ['Sociedade', `${society.type} · ${society.name}`],
      ['Gerado em', displayDate(todayISO())], ['Filtros', filters], ['Quantidade', String(members.length)],
      [], EXPORT_HEADERS, ...exportRows(members)
    ];
    const sheet = XLSX.utils.aoa_to_sheet(data);
    // Every user value is a string cell. No cell is emitted as a formula.
    for (const [key, value] of Object.entries(sheet)) {
      if (key.startsWith('!')) continue;
      const cell = value as { t: string; v: unknown; f?: string; z?: string };
      cell.t = 's'; cell.v = String(cell.v ?? ''); delete cell.f; cell.z = '@';
    }
    sheet['!cols'] = EXPORT_HEADERS.map((_,i) => ({wch: i === 0 || i === 5 || i === 8 ? 30:18}));
    sheet['!autofilter'] = {ref:`A8:N${8 + members.length}`};
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Rol de membros');
    XLSX.writeFile(workbook, filename + '.xlsx', {compression:true});
    return;
  }
  const [{jsPDF}, {default: html2canvas}] = await Promise.all([import('jspdf'),import('html2canvas')]);
  const pdf = new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
  const host = document.createElement('div');
  Object.assign(host.style, {position:'absolute',left:'-20000px',top:'0',width:'1385px',background:'#fff',color:'#172d25',fontFamily:'Arial, sans-serif',fontSize:'17px',lineHeight:'1.45'});
  host.setAttribute('aria-hidden','true');
  document.body.append(host);
  const headers = EXPORT_HEADERS.slice(0,7);
  let pageCount = 0;
  let page: HTMLDivElement;
  let body: HTMLTableSectionElement;
  function makePage(): void {
    host.replaceChildren();
    page = document.createElement('div');
    page.style.width = '1385px';
    const title = document.createElement('h1');
    title.textContent = `${society.type} · ${society.name}`;
    Object.assign(title.style,{fontSize:'28px',margin:'0 0 8px',color:'#145443'});
    const subtitle = document.createElement('p');
    subtitle.textContent = society.churchName;
    Object.assign(subtitle.style,{fontSize:'20px',margin:'0 0 10px'});
    const context = document.createElement('p');
    context.textContent = `Rol de membros · ${displayDate(todayISO())} · ${members.length} registros · ${filters}`;
    context.style.margin = '0 0 16px';
    const table = document.createElement('table');
    Object.assign(table.style,{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'});
    const colgroup = document.createElement('colgroup');
    for (const width of [24,10,10,14,12,22,8]) {
      const col = document.createElement('col'); col.style.width=width+'%'; colgroup.append(col);
    }
    const head = table.createTHead().insertRow();
    for (const label of headers) {
      const th = document.createElement('th'); th.textContent=label;
      Object.assign(th.style,{textAlign:'left',background:'#eaf3ee',padding:'10px 8px',borderBottom:'2px solid #145443',fontSize:'16px'}); head.append(th);
    }
    body = table.createTBody(); table.prepend(colgroup);
    page.append(title,subtitle,context,table); host.append(page);
  }
  function rowFor(member: Member): HTMLTableRowElement {
    const row = document.createElement('tr');
    for (const value of exportRows([member])[0].slice(0,7)) {
      const cell = document.createElement('td'); cell.textContent=value || '—';
      Object.assign(cell.style,{padding:'9px 8px',borderBottom:'1px solid #dce4de',verticalAlign:'top',overflowWrap:'anywhere',fontSize:'16px'}); row.append(cell);
    }
    return row;
  }
  async function capture(): Promise<void> {
    if (pageCount > 0) pdf.addPage();
    const canvas = await html2canvas(page, {scale:1.25,backgroundColor:'#ffffff',logging:false,windowWidth:1485,scrollX:0,scrollY:0});
    const height = canvas.height * 277 / canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 9, 277, height, undefined, 'FAST');
    pageCount++;
  }
  try {
    makePage();
    for (const member of members) {
      const row = rowFor(member); body!.append(row);
      if (page!.getBoundingClientRect().height > 930) {
        row.remove();
        if (!body!.children.length) throw new Error('Registro excede o tamanho da página.');
        await capture(); makePage(); body!.append(row);
      }
    }
    if (body!.children.length) await capture();
    for (let index=1;index<=pageCount;index++) {
      pdf.setPage(index); pdf.setFontSize(8); pdf.setTextColor('#52645b');
      pdf.text(`Societas · ${index} / ${pageCount}`,287,203,{align:'right'});
    }
    pdf.save(filename + '.pdf');
  } finally { host.remove(); }
}
