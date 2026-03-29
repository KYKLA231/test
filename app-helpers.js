function updateCategorySelects() {
  const prodCatSel = document.getElementById('prod-cat');
  const prodCatFilter = document.getElementById('prod-cat-filter');
  const prodSupplier = document.getElementById('prod-supplier');
  const opts = DB.categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  const supOpts = DB.suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  if(prodCatSel) prodCatSel.innerHTML = opts;
  if(prodCatFilter) prodCatFilter.innerHTML = `<option value="">Все категории</option>${opts}`;
  if(prodSupplier) prodSupplier.innerHTML = `<option value="">Не указан</option>${supOpts}`;
}

function formatPrice(n) {
  return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n||0);
}

function formatPriceShort(n) {
  if(n>=1000000) return `${(n/1000000).toFixed(1)}M ₽`;
  if(n>=1000) return `${Math.round(n/1000)}K ₽`;
  return `${n} ₽`;
}

function addAudit(action, type='info') {
  DB.audit.push({
    id: Date.now(), time: new Date().toLocaleString('ru'),
    user: currentUser?.login||'system', action, type
  });
}

function showToast(msg, type='info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-text">${msg}</span><span class="toast-close" onclick="this.parentElement.remove()" title="Закрыть">&times;</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>el.remove(), 4000);
}

function globalSearch(val) {
  if(!val||val.length<2) return;
  const matches = DB.products.filter(p=>p.name.toLowerCase().includes(val.toLowerCase())||p.sku?.toLowerCase().includes(val.toLowerCase()));
  if(matches.length>0) {
    nav('products');
    document.getElementById('prod-search').value=val;
    filterProducts();
  }
}

