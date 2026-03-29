function renderAudit() {
  const log = document.getElementById('audit-log');
  const typeColors = {create:'var(--accent-green)',update:'var(--accent)',delete:'var(--accent-red)',auth:'var(--accent-3)',supply:'var(--accent-2)',order:'var(--accent-purple)',settings:'var(--text-1)'};
  const draw = function () {
    log.innerHTML = [...DB.audit].reverse().map(e=>`
    <div class="log-entry">
      <span class="log-time">${e.time}</span>
      <span class="log-user">${e.user}</span>
      <span class="log-action">${e.action}</span>
      <span class="log-type" style="color:${typeColors[e.type]||'#fff'};font-family:var(--font-mono);font-size:10px;min-width:80px">${e.type?.toUpperCase()}</span>
    </div>`).join('');
  };
  if (typeof loadAuditFromServer === 'function' && typeof canUseServerProducts === 'function' && canUseServerProducts()) {
    Promise.all([loadAuditFromServer(false)]).finally(draw);
    return;
  }
  draw();
}
function renderUsers() {
  const grid = document.getElementById('users-grid');
  const roleLabels={admin:'Администратор',manager:'Менеджер',worker:'Работник склада'};
  const roleCls={admin:'role-admin',manager:'role-manager',worker:'role-worker'};

  const renderList = (items) => {
    grid.innerHTML = (items || []).map(u=>{
      const avatar = initialsFromName(u.full_name || u.username || u.email || '');
      const role = String(u.role || 'worker').toLowerCase();
      return `<div class="card">
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
            <div style="width:50px;height:50px;border-radius:50%;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-family:var(--font-cond);font-size:18px;font-weight:700;color:var(--accent)">${avatar}</div>
            <div style="flex:1">
              <div style="font-weight:600;font-size:14px">${u.full_name||u.username||u.email||'—'}</div>
              <div style="font-size:11px;color:var(--text-2);font-family:var(--font-mono)">@${u.username||'—'}</div>
            </div>
            <span class="badge ${roleCls[role]||'badge-gray'}" style="font-size:10px">${roleLabels[role]||role}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:12px;color:var(--text-1)">
            <div style="display:flex;gap:6px;align-items:center"><span style="color:var(--text-2);font-family:var(--font-mono);font-size:10px;width:50px">email</span>${u.email||'—'}</div>
            <div style="display:flex;gap:6px;align-items:center"><span style="color:var(--text-2);font-family:var(--font-mono);font-size:10px;width:50px">тел.</span>${u.phone||'—'}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;justify-content:space-between">
            <span class="badge ${u.active===false?'badge-red':'badge-green'}">${u.active===false?'Отключён':'Активен'}</span>
            <button class="btn btn-sm btn-secondary" onclick="resetUserPassword('${u.id}')">Сменить пароль</button>
          </div>
        </div>
      </div>`;
    }).join('');
  };

  (async () => {
    try {
      if (!window.supabaseClient) { renderList([]); return; }
      const s = await window.supabaseClient.auth.getSession();
      const token = s && s.data && s.data.session ? s.data.session.access_token : '';
      if (!token) { renderList([]); showToast('Нужно войти через Supabase (email+пароль).', 'warning'); return; }
      const resp = await fetch(skladApiBase() + '/api/admin/staff', { headers: { Authorization: 'Bearer ' + token } });
      const j = await resp.json().catch(() => null);
      if (!resp.ok || !j || !j.ok) { renderList([]); showToast((j && j.error) ? j.error : 'Ошибка загрузки', 'error'); return; }
      renderList(j.items || []);
    } catch (e) {
      renderList([]);
      showToast('Ошибка загрузки пользователей', 'error');
    }
  })();
}

function toggleUser(id) {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  const u = DB.users.find(x=>x.id===id);
  if(u) { u.active=!u.active; addAudit(`${u.active?'Разблокирован':'Заблокирован'} пользователь ${u.name}`,'update'); }
  saveDB(); renderUsers();
}

function deleteUser(id) {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  if(!confirm('Удалить пользователя?')) return;
  const u = DB.users.find(x=>x.id===id);
  DB.users = DB.users.filter(x=>x.id!==id);
  addAudit(`Удалён пользователь ${u?.name}`,'delete');
  saveDB(); renderUsers(); showToast('Пользователь удалён','success');
}

function saveUser() {
  (async () => {
    try {
      if (!window.supabaseClient) { showToast('Supabase не готов', 'error'); return; }
      const name=document.getElementById('usr-name').value.trim();
      const username=document.getElementById('usr-login').value.trim();
      const password=document.getElementById('usr-pass').value;
      const role=document.getElementById('usr-role').value;
      const email=document.getElementById('usr-email').value.trim();
      const phone=document.getElementById('usr-phone').value.trim();
      if(!name||!username||!password||!email) { showToast('Заполните имя, логин, email и пароль', 'error'); return; }
      const s = await window.supabaseClient.auth.getSession();
      const token = s && s.data && s.data.session ? s.data.session.access_token : '';
      if (!token) { showToast('Нужно войти через Supabase (email+пароль).', 'warning'); return; }
      const resp = await fetch(skladApiBase() + '/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ full_name: name, username, password, role, email, phone })
      });
      const j = await resp.json().catch(() => null);
      if (!resp.ok || !j || !j.ok) { showToast((j && j.error) ? j.error : 'Ошибка создания пользователя', 'error'); return; }
      closeModal('modal-add-user');
      document.getElementById('usr-name').value='';
      document.getElementById('usr-login').value='';
      document.getElementById('usr-pass').value='';
      document.getElementById('usr-email').value='';
      document.getElementById('usr-phone').value='';
      showToast('Пользователь создан', 'success');
      renderUsers();
    } catch (e) {
      showToast('Ошибка создания пользователя', 'error');
    }
  })();
}

function resetUserPassword(id) {
  const pwd = prompt('Новый пароль (минимум 8 символов):');
  if (!pwd) return;
  (async () => {
    try {
      const s = await window.supabaseClient.auth.getSession();
      const token = s && s.data && s.data.session ? s.data.session.access_token : '';
      if (!token) { showToast('Нужно войти через Supabase (email+пароль).', 'warning'); return; }
      const resp = await fetch(skladApiBase() + '/api/admin/staff/' + encodeURIComponent(id) + '/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ password: pwd })
      });
      const j = await resp.json().catch(() => null);
      if (!resp.ok || !j || !j.ok) { showToast((j && j.error) ? j.error : 'Ошибка смены пароля', 'error'); return; }
      showToast('Пароль обновлён', 'success');
    } catch (e) {
      showToast('Ошибка смены пароля', 'error');
    }
  })();
}

function seedStaff() {
  (async () => {
    try {
      if (!window.supabaseClient) { showToast('Supabase не готов', 'error'); return; }
      const s = await window.supabaseClient.auth.getSession();
      const token = s && s.data && s.data.session ? s.data.session.access_token : '';
      if (!token) { showToast('Нужно войти через Supabase (email+пароль).', 'warning'); return; }
      const resp = await fetch(skladApiBase() + '/api/admin/seed-staff', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      });
      const j = await resp.json().catch(() => null);
      if (!resp.ok || !j || !j.ok) { showToast((j && j.error) ? j.error : 'Ошибка', 'error'); return; }
      console.log('Seed staff created:', j.created);
      showToast('Тестовые сотрудники созданы. Смотри Console.', 'success');
      renderUsers();
    } catch (e) {
      showToast('Ошибка', 'error');
    }
  })();
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  const unread = DB.notifications.filter(n=>!n.read).length;
  document.getElementById('notif-dot').style.display = unread>0?'block':'none';
  list.innerHTML = DB.notifications.map(n=>`
    <div class="notif-item ${n.read?'':'unread'}" onclick="readNotif(${n.id})">
      ${!n.read?'<div class="notif-dot-sm"></div>':'<div style="width:6px"></div>'}
      <div>
        <div class="notif-text">${n.text}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>`).join('');
}

function readNotif(id) {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  const n = DB.notifications.find(x=>x.id===id);
  if(n) n.read=true;
  saveDB(); renderNotifications();
}

function markAllRead() {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  DB.notifications.forEach(n=>n.read=true);
  saveDB(); renderNotifications();
}

function addNotification(text, type='info') {
  if(currentUser?.active === false) return;
  DB.notifications.unshift({ id:Date.now(), text, time:'Только что', read:false, type });
  renderNotifications();
}

function toggleNotif() {
  if (typeof closeMobileNav === 'function') closeMobileNav();
  notifOpen = !notifOpen;
  document.getElementById('notif-panel').classList.toggle('open', notifOpen);
  if(notifOpen) renderNotifications();
}

function openModal(id) {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  document.getElementById(id).classList.add('open');
  if(id==='modal-add-order') {
    const sel = document.getElementById('ord-product');
    sel.innerHTML = DB.products.map(p=>`<option value="${p.id}">${p.name} (${p.qty} ${p.unit})</option>`).join('');
  }
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.addEventListener('click', e=>{
  if(e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
  if(notifOpen && !e.target.closest('#notif-panel') && !e.target.closest('.icon-btn')) {
    notifOpen=false; document.getElementById('notif-panel').classList.remove('open');
  }
});

function toggleSetting(el) { el.classList.toggle('on'); }

function saveSettings() {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  DB.settings.name = document.getElementById('set-name').value;
  DB.settings.minstock = +document.getElementById('set-minstock').value;
  DB.settings.currency = document.getElementById('set-currency').value;
  addAudit('Настройки обновлены','settings');
  saveDB(); showToast('Настройки сохранены','success');
}

