function startRealtime() {
  realtimeInterval = setInterval(()=>{
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString('ru');
    
    if(Math.random()<0.15) {
      const prods = DB.products.filter(p=>p.qty>2);
      if(prods.length) {
        const p = prods[Math.floor(Math.random()*prods.length)];
        const delta = Math.random()>0.5?1:-1;
        p.qty = Math.max(0, p.qty+delta);
      }
    }
    if(Math.random()<0.05) {
      const msg = [
        'Получено подтверждение от поставщика',
        'Заказ обновлён — проверьте статус',
        'Новое сообщение от менеджера склада',
        'Автоматическая резервная копия создана'
      ][Math.floor(Math.random()*4)];
      addNotification(msg,'info');
    }
  }, 8000);
}
window.addEventListener('DOMContentLoaded', ()=>{
  if(!loadDB()) initData();
  if(!DB.suppliers) DB.suppliers = JSON.parse(JSON.stringify(SUPPLIERS_DEFAULT));
  renderNotifications();
});

document.addEventListener('keydown', e=>{
  if(e.key==='Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
    if(notifOpen) { notifOpen=false; document.getElementById('notif-panel').classList.remove('open'); }
  }
  if(e.key==='Enter' && document.getElementById('login-screen').style.display!=='none') doLogin();
});
