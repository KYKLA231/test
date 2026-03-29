function renderCategories() {
  const draw = function () {
    const grid = document.getElementById('categories-grid');
    grid.innerHTML = DB.categories.map(c=>{
      const count = DB.products.filter(p=>p.catId===c.id).length;
      const totalQty = DB.products.filter(p=>p.catId===c.id).reduce((s,p)=>s+p.qty,0);
      const totalVal = DB.products.filter(p=>p.catId===c.id).reduce((s,p)=>s+p.qty*p.price,0);
      return `<div class="card" style="border-top:2px solid ${c.color}">
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:44px;height:44px;border-radius:var(--radius);border:1px solid var(--border);background:var(--bg-3);display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:600;color:${c.color};font-family:var(--font-body)">${(c.icon&&c.icon.trim())?c.icon.trim().slice(0,2):c.name.charAt(0)}</div>
            <div>
              <div style="font-family:var(--font-cond);font-size:17px;font-weight:600">${c.name}</div>
              <div style="font-size:11px;color:var(--text-2);font-family:var(--font-mono)">${count} товар(ов)</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
            <div style="background:var(--bg-3);border-radius:var(--radius);padding:8px;text-align:center">
              <div style="font-family:var(--font-cond);font-size:24px;font-weight:600;color:${c.color}">${totalQty}</div>
              <div style="font-size:10px;color:var(--text-2);font-family:var(--font-mono)">ед. на складе</div>
            </div>
            <div style="background:var(--bg-3);border-radius:var(--radius);padding:8px;text-align:center">
              <div style="font-family:var(--font-cond);font-size:20px;font-weight:600;color:${c.color}">${formatPriceShort(totalVal)}</div>
              <div style="font-size:10px;color:var(--text-2);font-family:var(--font-mono)">стоимость</div>
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-secondary" style="flex:1" onclick="nav('products');document.getElementById('prod-cat-filter').value=${c.id};filterProducts()">Смотреть товары</button>
            ${currentUser.role==='admin'?`<button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})" title="Удалить">Уд.</button>`:''}
          </div>
        </div>
      </div>`;
    }).join('');
  };
  if (typeof loadCategoriesFromServer === 'function' && typeof canUseServerProducts === 'function' && canUseServerProducts()) {
    Promise.all([loadCategoriesFromServer(false), loadProductsFromServer(false)]).finally(draw);
    return;
  }
  draw();
}

function saveCategory() {
  const name = document.getElementById('cat-name').value.trim();
  if(!name) { showToast('Введите название','error'); return; }
  if (typeof canUseServerProducts === 'function' && canUseServerProducts()) {
    fetch(skladApiBase() + '/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        icon: document.getElementById('cat-icon').value.trim(),
        color: document.getElementById('cat-color').value
      })
    })
      .then(r => r.json().catch(() => null).then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok || !j || !j.ok) {
          showToast((j && j.error) ? j.error : 'Ошибка сохранения категории', 'error');
          return;
        }
        if (typeof __categoriesServerSync !== 'undefined') __categoriesServerSync.loaded = false;
        addAudit(`Добавлена категория «${name}»`,'create');
        closeModal('modal-add-cat');
        document.getElementById('cat-name').value='';
        renderCategories();
        showToast('Категория добавлена','success');
      })
      .catch(() => showToast('Ошибка сохранения категории','error'));
    return;
  }
  const cat = {
    id: Date.now(), name,
    icon: document.getElementById('cat-icon').value.trim(),
    color: document.getElementById('cat-color').value
  };
  DB.categories.push(cat);
  addAudit(`Добавлена категория «${name}»`,'create');
  saveDB(); closeModal('modal-add-cat'); renderCategories();
  document.getElementById('cat-name').value='';
  showToast('Категория добавлена','success');
}

function deleteCategory(id) {
  const count = DB.products.filter(p=>p.catId===id).length;
  if(count>0 && !confirm(`В категории ${count} товаров. Удалить?`)) return;
  const cat = DB.categories.find(c=>c.id===id);
  if (typeof canUseServerProducts === 'function' && canUseServerProducts()) {
    fetch(skladApiBase() + '/api/categories/' + encodeURIComponent(id), { method: 'DELETE' })
      .then(r => r.json().catch(() => null).then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok || !j || !j.ok) {
          showToast((j && j.error) ? j.error : 'Ошибка удаления категории', 'error');
          return;
        }
        if (typeof __categoriesServerSync !== 'undefined') __categoriesServerSync.loaded = false;
        addAudit(`Удалена категория «${cat?.name}»`,'delete');
        renderCategories();
        showToast('Категория удалена','success');
      })
      .catch(() => showToast('Ошибка удаления категории','error'));
    return;
  }
  DB.categories = DB.categories.filter(c=>c.id!==id);
  addAudit(`Удалена категория «${cat?.name}»`,'delete');
  saveDB(); renderCategories();
  showToast('Категория удалена','success');
}

