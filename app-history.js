function renderHistory() {
  const typeFilter = document.getElementById('hist-type')?.value||'';
  const ops = [...DB.supplies].reverse().map(s=>({...s, optype:'supply'}));
  const orders = [...DB.orders].map(o=>({...o, optype:'order', type:'order'}));
  let all = [...ops, ...orders].sort((a,b)=>new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt));
  if(typeFilter) all = all.filter(x=>x.type===typeFilter||(typeFilter==='order'&&x.optype==='order'));
  const container = document.getElementById('history-container');
  if(all.length===0) {
    container.innerHTML=`<div class="empty-state"><p>История пуста</p></div>`;
    return;
  }
  container.innerHTML = all.map(item=>{
    if(item.optype==='supply') {
      const prod = DB.products.find(p=>p.id===item.productId);
      const user = DB.users.find(u=>u.id===item.userId);
      const colors = {in:'var(--accent-green)',out:'var(--accent-red)',inv:'var(--accent-3)'};
      const labels = {in:'↓ ПРИХОД',out:'↑ СПИСАНИЕ',inv:'⚖️ ИНВЕНТ.'};
      return `<div class="log-entry">
        <span class="log-time">${item.date||'—'}</span>
        <span class="log-user">${user?.name||'—'}</span>
        <span class="log-action">${prod?`${prod.name}`:''} × <b>${item.qty}</b> ${prod?.unit||''} ${item.note?`— ${item.note}`:''}</span>
        <span class="log-type badge" style="color:${colors[item.type]};background:transparent;border-color:${colors[item.type]}">${labels[item.type]}</span>
      </div>`;
    } else {
      const prod = DB.products.find(p=>p.id===item.productId);
      return `<div class="log-entry">
        <span class="log-time">${item.createdAt||'—'}</span>
        <span class="log-user">${item.client||'—'}</span>
        <span class="log-action">Заказ #${item.id}: ${prod?`${prod.name}`:''} × ${item.qty}</span>
        <span class="log-type badge badge-blue">ЗАКАЗ</span>
      </div>`;
    }
  }).join('');
}

function exportHistory() {
  const rows = [['Дата','Тип','Товар','Кол-во','Примечание']];
  DB.supplies.forEach(s=>{
    const p=DB.products.find(x=>x.id===s.productId);
    rows.push([s.date,s.type,p?.name||'',s.qty,s.note||'']);
  });
  const csv = rows.map(r=>r.join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='history_export.csv'; a.click();
  showToast('Файл экспортирован','success');
}

