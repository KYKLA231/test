function openSupplyModal(type) {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  document.getElementById('supply-type').value = type;
  const titles = {in:'↓ Приход товара', out:'↑ Списание товара', inv:'⚖️ Инвентаризация'};
  document.getElementById('supply-modal-title').textContent = titles[type];
  const btnColors = {in:'btn-success', out:'btn-danger', inv:'btn-secondary'};
  const btn = document.getElementById('supply-btn');
  btn.className = `btn ${btnColors[type]}`;
  
  const fill = function () {
    const sel = document.getElementById('supply-product');
    sel.innerHTML = DB.products.map(p=>`<option value="${p.id}">${p.name} (${p.qty} ${p.unit})</option>`).join('');
    const supSel = document.getElementById('supply-supplier');
    supSel.innerHTML = `<option value="">Не указан</option>`+DB.suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  };
  if (typeof canUseServerProducts === 'function' && canUseServerProducts()) {
    Promise.all([loadProductsFromServer(false), loadSuppliersFromServer(false), loadSuppliesFromServer(false)]).finally(fill);
  } else {
    fill();
  }
  openModal('modal-supply');
}

function saveSupply() {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  const type = document.getElementById('supply-type').value;
  const productId = +document.getElementById('supply-product').value;
  const qty = +document.getElementById('supply-qty').value;
  const supplierId = document.getElementById('supply-supplier').value||null;
  const note = document.getElementById('supply-note').value.trim();
  if(!productId||qty<=0) { showToast('Укажите товар и количество','error'); return; }
  if (typeof canUseServerProducts === 'function' && canUseServerProducts() && typeof getAdminToken === 'function') {
    (async () => {
      try {
        const token = await getAdminToken();
        const resp = await fetch(skladApiBase() + '/api/admin/supplies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            type,
            product_id: productId,
            qty,
            supplier_id: supplierId ? +supplierId : null,
            note
          })
        });
        const j = await resp.json().catch(() => null);
        if (!resp.ok || !j || !j.ok) {
          showToast((j && j.error) ? j.error : 'Ошибка операции', 'error');
          return;
        }
        closeModal('modal-supply');
        document.getElementById('supply-note').value='';
        if (typeof __productsServerSync !== 'undefined') __productsServerSync.loaded = false;
        if (typeof __suppliesServerSync !== 'undefined') __suppliesServerSync.loaded = false;
        await Promise.all([loadProductsFromServer(true), loadSuppliesFromServer(true)]);
        renderSupplies();
        showToast('Операция проведена', 'success');
      } catch (e) {
        showToast('Ошибка операции', 'error');
      }
    })();
    return;
  }
  const prod = DB.products.find(p=>p.id===productId);
  if(!prod) return;
  if(type==='out' && prod.qty<qty) { showToast(`Недостаточно товара. Доступно: ${prod.qty}`, 'error'); return; }
  if(type==='in') prod.qty += qty;
  else if(type==='out') prod.qty -= qty;
  else if(type==='inv') prod.qty = qty;
  const op = { id:Date.now(), type, productId, qty, supplierId:supplierId?+supplierId:null,
    userId:currentUser.id, note, date:new Date().toLocaleString('ru') };
  DB.supplies.push(op);
  addAudit(`${type==='in'?'Приход':type==='out'?'Списание':'Инвентаризация'}: «${prod.name}» × ${qty}`, 'supply');
  saveDB(); closeModal('modal-supply');
  document.getElementById('supply-note').value='';
  showToast(`Операция проведена. Остаток: ${prod.qty} ${prod.unit}`, 'success');
  renderSupplies();
}

function renderSupplies() {
  const draw = function () {
  updateSupplySelects();
  filterSupplies();
  document.getElementById('sup-total-in').textContent = DB.supplies.filter(s=>s.type==='in').reduce((a,s)=>a+s.qty,0);
  document.getElementById('sup-total-out').textContent = DB.supplies.filter(s=>s.type==='out').reduce((a,s)=>a+s.qty,0);
  document.getElementById('sup-ops-count').textContent = DB.supplies.length;
  
  const supList = document.getElementById('suppliers-list');
  supList.innerHTML = DB.suppliers.slice(0,4).map(s=>`
    <div class="supplier-card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:600;font-size:13px">${s.name}</div>
          <div style="font-size:11px;color:var(--text-2);font-family:var(--font-mono)">${s.contact} · ${s.phone}</div>
        </div>
        <div style="font-size:11px;color:var(--text-2);font-family:var(--font-mono)">${DB.supplies.filter(sp=>sp.supplierId===s.id).length} пост.</div>
      </div>
    </div>`).join('');
  };
  if (typeof canUseServerProducts === 'function' && canUseServerProducts()) {
    Promise.all([loadProductsFromServer(false), loadSuppliersFromServer(false), loadSuppliesFromServer(false)]).finally(draw);
    return;
  }
  draw();
}

function filterSupplies() {
  const type = document.getElementById('sup-type-filter')?.value||'';
  let supplies = [...DB.supplies].reverse();
  if(type) supplies = supplies.filter(s=>s.type===type);
  const tbody = document.getElementById('supplies-tbody');
  if(!tbody) return;
  tbody.innerHTML = supplies.map(s=>{
    const prod = DB.products.find(p=>p.id===s.productId);
    const user = DB.users.find(u=>u.id===s.userId);
    const sup = DB.suppliers?.find(x=>x.id===s.supplierId);
    const typeBadge = {in:'badge-green',out:'badge-red',inv:'badge-blue'}[s.type];
    const typeLabel = {in:'↓ Приход',out:'↑ Списание',inv:'⚖️ Инвент.'}[s.type];
    return `<tr>
      <td>${s.id}</td>
      <td>${s.date}</td>
      <td><span class="badge ${typeBadge}">${typeLabel}</span></td>
      <td>${prod?prod.name:'—'}</td>
      <td><span style="font-family:var(--font-mono);font-weight:600">${s.qty} ${prod?prod.unit:''}</span></td>
      <td>${sup?sup.name:'—'}</td>
      <td>${user?user.name:'—'}</td>
      <td style="font-size:12px;color:var(--text-2)">${s.note||'—'}</td>
    </tr>`;
  }).join('');
}

function updateSupplySelects() {
  const sel = document.getElementById('supply-product');
  if(sel) sel.innerHTML = DB.products.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
}

