function renderAudit() {
  const log = document.getElementById('audit-log');
  const typeColors = {create:'var(--accent-green)',update:'var(--accent)',delete:'var(--accent-red)',auth:'var(--accent-3)',supply:'var(--accent-2)',order:'var(--accent-purple)',settings:'var(--text-1)'};
  log.innerHTML = [...DB.audit].reverse().map(e=>`
    <div class="log-entry">
      <span class="log-time">${e.time}</span>
      <span class="log-user">${e.user}</span>
      <span class="log-action">${e.action}</span>
      <span class="log-type" style="color:${typeColors[e.type]||'#fff'};font-family:var(--font-mono);font-size:10px;min-width:80px">${e.type?.toUpperCase()}</span>
    </div>`).join('');
}
function renderUsers() {
  const grid = document.getElementById('users-grid');
  grid.innerHTML = DB.users.map(u=>{
    const roleLabels={admin:'Администратор',manager:'Менеджер',worker:'Работник склада'};
    const roleCls={admin:'role-admin',manager:'role-manager',worker:'role-worker'};
    return `<div class="card">
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
          <div style="width:50px;height:50px;border-radius:50%;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-family:var(--font-cond);font-size:18px;font-weight:700;color:var(--accent)">${u.avatar}</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:14px">${u.name}</div>
            <div style="font-size:11px;color:var(--text-2);font-family:var(--font-mono)">@${u.login}</div>
          </div>
          <span class="badge ${roleCls[u.role]}" style="font-size:10px">${roleLabels[u.role]}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:12px;color:var(--text-1)">
          <div style="display:flex;gap:6px;align-items:center"><span style="color:var(--text-2);font-family:var(--font-mono);font-size:10px;width:36px">email</span>${u.email||'—'}</div>
          <div style="display:flex;gap:6px;align-items:center"><span style="color:var(--text-2);font-family:var(--font-mono);font-size:10px;width:36px">тел.</span>${u.phone||'—'}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;justify-content:space-between">
          <span class="badge ${u.active?'badge-green':'badge-red'}">${u.active?'Активен':'Заблокирован'}</span>
          ${currentUser.role==='admin'&&u.id!==currentUser.id?`<div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-secondary" onclick="toggleUser(${u.id})">${u.active?'Блок':'Разблок'}</button>
            <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})" title="Удалить">Уд.</button>
          </div>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
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
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  const name=document.getElementById('usr-name').value.trim();
  const login=document.getElementById('usr-login').value.trim();
  const pass=document.getElementById('usr-pass').value;
  if(!name||!login||!pass) { showToast('Заполните обязательные поля','error'); return; }
  if(DB.users.find(u=>u.login===login)) { showToast('Логин уже занят','error'); return; }
  const user = {
    id: Date.now(), name, login, pass,
    role: document.getElementById('usr-role').value,
    email: document.getElementById('usr-email').value,
    phone: document.getElementById('usr-phone').value,
    active: true, avatar: name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  };
  DB.users.push(user);
  addAudit(`Добавлен пользователь ${name}`,'create');
  saveDB(); closeModal('modal-add-user'); renderUsers();
  document.getElementById('usr-name').value='';
  document.getElementById('usr-login').value='';
  document.getElementById('usr-pass').value='';
  showToast('Пользователь добавлен','success');
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

