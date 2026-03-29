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
window.addEventListener('DOMContentLoaded', async ()=>{
  if(!loadDB()) initData();
  if(!DB.suppliers) DB.suppliers = JSON.parse(JSON.stringify(SUPPLIERS_DEFAULT));
  renderNotifications();

  try {
    var autoRaw = sessionStorage.getItem('skladpro_autologin');
    if (autoRaw) {
      sessionStorage.removeItem('skladpro_autologin');
      var creds = JSON.parse(autoRaw);
      if (creds && creds.login && creds.password) {
        var deadline = Date.now() + 6000;
        while (Date.now() < deadline && window.supabaseClient === undefined) {
          await new Promise(function (r) { setTimeout(r, 40); });
        }
        var lu = document.getElementById('login-user');
        var lp = document.getElementById('login-pass');
        if (lu) lu.value = creds.login;
        if (lp) lp.value = creds.password;
        document.querySelectorAll('.role-btn').forEach(function (b) { b.classList.remove('active'); });
        var adminBtn = document.querySelector('.role-btn');
        if (adminBtn) adminBtn.classList.add('active');
        selectedRole = 'admin';
        await doLogin();
        return;
      }
    }
    var prefill = sessionStorage.getItem('skladpro_prefill_login');
    if (prefill) {
      sessionStorage.removeItem('skladpro_prefill_login');
      var lu2 = document.getElementById('login-user');
      if (lu2) lu2.value = prefill;
    }
  } catch (_) {}
});

document.addEventListener('keydown', e=>{
  if(e.key==='Escape') {
    if (typeof closeMobileNav === 'function') closeMobileNav();
    document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
    if(notifOpen) { notifOpen=false; document.getElementById('notif-panel').classList.remove('open'); }
  }
  if(e.key==='Enter' && document.getElementById('login-screen').style.display!=='none') doLogin();
});
