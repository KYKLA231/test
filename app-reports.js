function renderReports() {
  const period = +document.getElementById('report-period')?.value||30;
  const products = DB.products;
  const totalVal = products.reduce((s,p)=>s+p.qty*p.price,0);
  const avgPrice = products.length>0?Math.round(products.reduce((s,p)=>s+p.price,0)/products.length):0;
  const totalOrders = DB.orders.length;
  const completedOrders = DB.orders.filter(o=>o.status==='delivered').length;

  document.getElementById('report-kpis').innerHTML = `
    <div class="stat-card" style="--card-accent:var(--accent)">
      <div class="stat-label">Стоимость остатков</div>
      <div class="stat-value" style="font-size:28px">${formatPriceShort(totalVal)}</div>
    </div>
    <div class="stat-card" style="--card-accent:var(--accent-green)">
      <div class="stat-label">Средняя цена</div>
      <div class="stat-value" style="font-size:28px">${formatPriceShort(avgPrice)}</div>
    </div>
    <div class="stat-card" style="--card-accent:var(--accent-3)">
      <div class="stat-label">Выполнено заказов</div>
      <div class="stat-value" style="font-size:28px">${completedOrders}</div>
    </div>
    <div class="stat-card" style="--card-accent:var(--accent-2)">
      <div class="stat-label">Операций за период</div>
      <div class="stat-value" style="font-size:28px">${DB.supplies.length}</div>
    </div>`;

  const topProds = [...products].sort((a,b)=>b.qty*b.price-(a.qty*a.price)).slice(0,5);
  const maxTurnover = topProds[0]?.qty*topProds[0]?.price||1;
  document.getElementById('top-products-list').innerHTML = topProds.map(p=>{
    const val = p.qty*p.price;
    const pct = Math.round(val/maxTurnover*100);
    return `<div style="padding:10px 16px;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span><b>${p.name}</b></span>
        <span style="font-family:var(--font-mono);font-size:12px">${formatPrice(val)}</span>
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');

  setTimeout(()=>{
    const canvas = document.getElementById('chart-value');
    if(!canvas) return;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const catData = DB.categories.map(c=>({
      name:c.name, val:DB.products.filter(p=>p.catId===c.id).reduce((s,p)=>s+p.qty*p.price,0)
    })).filter(c=>c.val>0).sort((a,b)=>b.val-a.val);
    drawBarChart(ctx,canvas.width,200,catData.map(c=>c.name.slice(0,6)),
      [{data:catData.map(c=>c.val), color:'rgba(166,127,82,0.75)', label:'Стоимость'}]);

    const canvas2 = document.getElementById('chart-orders-trend');
    if(!canvas2) return;
    canvas2.width = canvas2.parentElement.clientWidth;
    canvas2.height = 120;
    const ctx2 = canvas2.getContext('2d');
    ctx2.clearRect(0,0,canvas2.width,canvas2.height);
    const months=['Сен','Окт','Ноя','Дек','Янв','Фев'];
    const orderData=[4,7,5,9,6,11];
    drawLineChart(ctx2,canvas2.width,120,months,orderData,'#7d9e92');
  },50);
}

