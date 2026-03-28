function renderOrders() {
  
  const statuses = ['new','processing','shipped','delivered'];
  const counts = {};
  statuses.forEach(s=>counts[s]=DB.orders.filter(o=>o.status===s).length);
  document.getElementById('ord-stat-new').textContent = counts.new||0;
  document.getElementById('ord-stat-proc').textContent = counts.processing||0;
  document.getElementById('ord-stat-ship').textContent = counts.shipped||0;
  document.getElementById('ord-stat-done').textContent = counts.delivered||0;
  document.getElementById('orders-badge').textContent = (counts.new||0)+(counts.processing||0);

  
  const cols = [
    {key:'new', label:'Новые', color:'var(--text-1)', icon:''},
    {key:'processing', label:'В обработке', color:'var(--accent)', icon:''},
    {key:'shipped', label:'В пути', color:'var(--accent-3)', icon:''},
    {key:'delivered', label:'Доставлено', color:'var(--accent-green)', icon:''},
  ];
  const kanban = document.getElementById('orders-kanban');
  kanban.innerHTML = cols.map(col=>{
    const orders = DB.orders.filter(o=>o.status===col.key);
    return `<div class="kanban-col">
      <div class="kanban-col-header" style="border-top:2px solid ${col.color}">
        <span>${col.label}</span>
        <span style="margin-left:auto;background:var(--bg-4);padding:2px 8px;border-radius:10px;font-size:11px">${orders.length}</span>
      </div>
      <div class="kanban-col-body">
        ${orders.map(o=>{
          const prod = DB.products.find(p=>p.id===o.productId);
          const prioColor = {normal:'var(--text-1)',high:'var(--accent)',urgent:'var(--accent-red)'}[o.priority];
          return `<div class="kanban-card" onclick="viewOrder(${o.id})">
            <div class="kanban-card-id">#${String(o.id).padStart(4,'0')} · <span style="color:${prioColor}">${o.priority==='urgent'?'Срочно':o.priority==='high'?'Высокий':'Обычный'}</span></div>
            <div class="kanban-card-title">${o.client}</div>
            <div style="font-size:12px;color:var(--text-1);margin-bottom:6px">${prod?`${prod.name}`:''} × ${o.qty}</div>
            <div class="kanban-card-meta">
              <span>${o.createdAt?.split(' ')[0]||''}</span>
              ${col.key!=='delivered'?`<button onclick="event.stopPropagation();advanceOrder(${o.id})" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:11px;font-family:var(--font-mono)">→ Далее</button>`:''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

function advanceOrder(id) {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  const order = DB.orders.find(o=>o.id===id);
  if(!order) return;
  const next = {new:'processing', processing:'shipped', shipped:'delivered'};
  const label = {processing:'В обработку', shipped:'Отправить', delivered:'Доставлен'}[next[order.status]]||'';
  if(!next[order.status]) return;
  order.status = next[order.status];
  addAudit(`Заказ #${id} — статус изменён на «${order.status}»`,'order');
  saveDB(); renderOrders();
  showToast(`Заказ #${id} переведён: ${order.status}`, 'success');
}

function viewOrder(id) {
  const o = DB.orders.find(x=>x.id===id);
  if(!o) return;
  const prod = DB.products.find(p=>p.id===o.productId);
  const statusBadge = {new:'badge-gray',processing:'badge-amber',shipped:'badge-blue',delivered:'badge-green'}[o.status];
  const statusLabel = {new:'Новый',processing:'В обработке',shipped:'В пути',delivered:'Доставлен'}[o.status];
  showToast(`Заказ #${id}: ${o.client} — ${statusLabel}`, 'info');
}

function saveOrder() {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  const client = document.getElementById('ord-client').value.trim();
  if(!client) { showToast('Введите клиента','error'); return; }
  const productId = +document.getElementById('ord-product').value;
  const qty = +document.getElementById('ord-qty').value||1;
  const prod = DB.products.find(p=>p.id===productId);
  if(prod && prod.qty<qty) { showToast('Недостаточно товара на складе','error'); return; }
  const order = {
    id: Date.now(), client, productId, qty,
    priority: document.getElementById('ord-priority').value,
    address: document.getElementById('ord-address').value,
    note: document.getElementById('ord-note').value,
    status: 'new', createdAt: new Date().toLocaleString('ru')
  };
  DB.orders.push(order);
  addAudit(`Создан заказ для «${client}»`,'order');
  addNotification(`Новый заказ от ${client}`, 'info');
  saveDB(); closeModal('modal-add-order');
  document.getElementById('ord-client').value='';
  renderOrders();
  showToast('Заказ создан','success');
}

