let DB = {
  products: [],
  categories: [],
  supplies: [],
  orders: [],
  users: [],
  audit: [],
  notifications: [],
  settings: { name:'Центральный склад', minstock:10, currency:'RUB' }
};

let currentUser = null;
let selectedRole = 'admin';
let notifOpen = false;
let realtimeInterval = null;

const USERS_DEFAULT = [
  { id:1, name:'Алексей Николаев', login:'admin', pass:'admin123', role:'admin', email:'admin@sklad.ru', phone:'+7 999 001-01-01', active:true, avatar:'АН' },
  { id:2, name:'Мария Петрова', login:'manager', pass:'mgr123', role:'manager', email:'manager@sklad.ru', phone:'+7 999 002-02-02', active:true, avatar:'МП' },
  { id:3, name:'Дмитрий Козлов', login:'worker', pass:'wrk123', role:'worker', email:'worker@sklad.ru', phone:'+7 999 003-03-03', active:true, avatar:'ДК' },
  { id:4, name:'Ольга Смирнова', login:'olga', pass:'olga123', role:'manager', email:'olga@sklad.ru', phone:'+7 999 004-04-04', active:true, avatar:'ОС' },
];

const CATEGORIES_DEFAULT = [
  { id:1, name:'Электроника', icon:'', color:'var(--accent-3)', count:0 },
  { id:2, name:'Бытовая техника', icon:'', color:'var(--accent)', count:0 },
  { id:3, name:'Инструменты', icon:'', color:'var(--accent-red)', count:0 },
  { id:4, name:'Мебель', icon:'', color:'var(--accent-purple)', count:0 },
  { id:5, name:'Канцелярия', icon:'', color:'var(--accent-green)', count:0 },
  { id:6, name:'Продукты питания', icon:'', color:'var(--accent-2)', count:0 },
];

const PRODUCTS_DEFAULT = [
  { id:1,name:'Ноутбук HP Pavilion 15',sku:'HP-PAV-15',catId:1,qty:25,minQty:5,price:65000,unit:'шт',location:'A-1-01',supplierId:1,desc:'15.6", Core i5, 8GB RAM' },
  { id:2,name:'Смартфон Samsung Galaxy A54',sku:'SAM-A54',catId:1,qty:3,minQty:10,price:32000,unit:'шт',location:'A-1-02',supplierId:1,desc:'6.4", 128GB, 5G' },
  { id:3,name:'Наушники Sony WH-1000XM5',sku:'SONY-WH5',catId:1,qty:12,minQty:3,price:28000,unit:'шт',location:'A-2-01',supplierId:2,desc:'Bluetooth, шумодав' },
  { id:4,name:'Холодильник LG GBB62',sku:'LG-GBB62',catId:2,qty:8,minQty:2,price:85000,unit:'шт',location:'B-1-01',supplierId:3,desc:'No Frost, 384L' },
  { id:5,name:'Стиральная машина Bosch WGA',sku:'BOSCH-WGA',catId:2,qty:2,minQty:3,price:55000,unit:'шт',location:'B-1-02',supplierId:3,desc:'7кг, 1400 об/мин' },
  { id:6,name:'Дрель Makita HP488D',sku:'MAK-HP488',catId:3,qty:18,minQty:5,price:12000,unit:'шт',location:'C-1-01',supplierId:4,desc:'Ударная, 18V' },
  { id:7,name:'Набор отвёрток Stanley',sku:'STAN-SET',catId:3,qty:45,minQty:10,price:1800,unit:'набор',location:'C-1-02',supplierId:4,desc:'10 предметов' },
  { id:8,name:'Офисный стул Riva',sku:'RIVA-CH',catId:4,qty:6,minQty:5,price:15000,unit:'шт',location:'D-1-01',supplierId:5,desc:'Кожа, подлокотники' },
  { id:9,name:'Стол письменный 160см',sku:'DESK-160',catId:4,qty:4,minQty:2,price:22000,unit:'шт',location:'D-2-01',supplierId:5,desc:'МДФ, белый' },
  { id:10,name:'Бумага А4 500 листов',sku:'PAP-A4',catId:5,qty:0,minQty:20,price:450,unit:'уп',location:'E-1-01',supplierId:6,desc:'80г/м², мультифункц.' },
  { id:11,name:'Ручка шариковая синяя',sku:'PEN-BLUE',catId:5,qty:200,minQty:50,price:35,unit:'шт',location:'E-1-02',supplierId:6,desc:'0.7мм' },
  { id:12,name:'Ноутбук Dell Latitude 5540',sku:'DELL-L5540',catId:1,qty:7,minQty:3,price:95000,unit:'шт',location:'A-3-01',supplierId:1,desc:'15.6", Core i7, 16GB' },
];

const SUPPLIERS_DEFAULT = [
  { id:1, name:'ТехноИмпорт', contact:'Иван Сидоров', phone:'+7 495 111-11-11' },
  { id:2, name:'АудиоМастер', contact:'Елена Волкова', phone:'+7 495 222-22-22' },
  { id:3, name:'БытТехника Опт', contact:'Сергей Морозов', phone:'+7 495 333-33-33' },
  { id:4, name:'ИнструментСнаб', contact:'Андрей Белов', phone:'+7 495 444-44-44' },
  { id:5, name:'МебельПром', contact:'Наталья Орлова', phone:'+7 495 555-55-55' },
  { id:6, name:'Канцтовары Плюс', contact:'Павел Кузнецов', phone:'+7 495 666-66-66' },
];

const ORDERS_DEFAULT = [
  { id:1, client:'ООО «СтройГрупп»', productId:6, qty:5, status:'processing', priority:'high', address:'Москва, Строительная 1', note:'', createdAt:'2026-01-15 10:30' },
  { id:2, client:'ИП Иванова А.С.', productId:11, qty:100, status:'shipped', priority:'normal', address:'СПб, Невский пр. 10', note:'Хрупко', createdAt:'2026-01-14 14:20' },
  { id:3, client:'ЗАО «Офис Плюс»', productId:10, qty:30, status:'new', priority:'urgent', address:'Казань, Баумана 5', note:'Срочно!', createdAt:'2026-01-16 09:00' },
  { id:4, client:'ООО «Ритейл Сеть»', productId:1, qty:3, status:'delivered', priority:'normal', address:'Краснодар, Красная 20', note:'', createdAt:'2026-01-13 11:00' },
  { id:5, client:'АО «ТехноМаркет»', productId:2, qty:10, status:'processing', priority:'high', address:'Москва, Тверская 15', note:'', createdAt:'2026-01-16 15:00' },
];

const SUPPLIES_DEFAULT = [
  { id:1, type:'in', productId:1, qty:10, supplierId:1, userId:1, note:'Плановая поставка', date:'2026-01-10 09:00' },
  { id:2, type:'out', productId:10, qty:5, supplierId:null, userId:3, note:'Списание по акту', date:'2026-01-11 11:30' },
  { id:3, type:'in', productId:3, qty:8, supplierId:2, userId:2, note:'', date:'2026-01-12 14:00' },
  { id:4, type:'inv', productId:7, qty:45, supplierId:null, userId:2, note:'Инвентаризация Q1', date:'2026-01-13 16:00' },
  { id:5, type:'in', productId:6, qty:12, supplierId:4, userId:1, note:'Экстренный заказ', date:'2026-01-14 10:00' },
  { id:6, type:'out', productId:8, qty:2, supplierId:null, userId:3, note:'Повреждён при транспортировке', date:'2026-01-15 13:00' },
];

function initData() {
  DB.users = JSON.parse(JSON.stringify(USERS_DEFAULT));
  DB.categories = JSON.parse(JSON.stringify(CATEGORIES_DEFAULT));
  DB.products = JSON.parse(JSON.stringify(PRODUCTS_DEFAULT));
  DB.supplies = JSON.parse(JSON.stringify(SUPPLIES_DEFAULT));
  DB.orders = JSON.parse(JSON.stringify(ORDERS_DEFAULT));
  DB.suppliers = JSON.parse(JSON.stringify(SUPPLIERS_DEFAULT));
  DB.audit = generateAuditLog();
  DB.notifications = generateNotifications();
  saveDB();
}

function saveDB() {
  try { localStorage.setItem('skladpro_db', JSON.stringify(DB)); } catch(e){}
}

function loadDB() {
  try {
    const saved = localStorage.getItem('skladpro_db');
    if(saved) { DB = JSON.parse(saved); return true; }
  } catch(e){}
  return false;
}

function initialsFromName(name) {
  const s = (name || '').trim();
  if(!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if(parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  return s.charAt(0).toUpperCase();
}

function generateAuditLog() {
  const actions = [
    ['Добавлен товар «Ноутбук HP Pavilion 15»','create'],
    ['Изменено количество товара #2','update'],
    ['Создан заказ #1 для ООО «СтройГрупп»','order'],
    ['Приход 10 ед. Ноутбук HP','supply'],
    ['Пользователь manager вошёл в систему','auth'],
    ['Списание 5 ед. Бумага А4','supply'],
    ['Обновлены настройки склада','settings'],
    ['Создан пользователь Мария Петрова','create'],
    ['Заказ #4 помечен как «Доставлен»','order'],
    ['Инвентаризация набора отвёрток','supply'],
  ];
  const users = ['admin','manager','worker'];
  return actions.map((a,i) => ({
    id: i+1,
    time: new Date(Date.now() - (i*3600000)).toLocaleString('ru'),
    user: users[i%3],
    action: a[0],
    type: a[1]
  }));
}

function generateNotifications() {
  return [
    { id:1, text:'Критически низкий остаток: Смартфон Samsung (3 шт)', time:'10 мин назад', read:false, type:'warning' },
    { id:2, text:'Бумага А4 — остаток 0 шт. Требуется пополнение!', time:'25 мин назад', read:false, type:'error' },
    { id:3, text:'Новый заказ от ЗАО «Офис Плюс» на 30 уп.', time:'1 ч назад', read:false, type:'info' },
    { id:4, text:'Стиральная машина Bosch — ниже минимума', time:'2 ч назад', read:true, type:'warning' },
    { id:5, text:'Поставщик ТехноИмпорт подтвердил поставку', time:'3 ч назад', read:true, type:'success' },
    { id:6, text:'Заказ #4 успешно доставлен', time:'5 ч назад', read:true, type:'success' },
  ];
}

function selectRole(el, role) {
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedRole = role;
  const logins = { admin:'admin', manager:'manager', worker:'worker' };
  const passes = { admin:'admin123', manager:'mgr123', worker:'wrk123' };
  document.getElementById('login-user').value = logins[role];
  document.getElementById('login-pass').value = '';
  setTimeout(()=>document.getElementById('login-pass').value=passes[role],50);
}

function normalizeProfileRole(r) {
  const x = String(r || '').toLowerCase().trim();
  if (x === 'manager' || x === 'worker' || x === 'admin') return x;
  return 'admin';
}

/** Расшифровка типичных ошибок /auth/v1/token и signInWithPassword */
function supabaseLoginHint(err) {
  const m = String((err && err.message) ? err.message : '').toLowerCase();
  const status = err && err.status;
  if (/email not confirmed|confirm your email|email_not_confirmed|verification|not verified/.test(m)) {
    return 'Email ещё не подтверждён. Откройте письмо от Supabase или в Dashboard: Authentication → Users → подтвердите вручную. Для тестов можно отключить «Confirm email» в Authentication → Providers → Email.';
  }
  if (/invalid login|invalid credentials|invalid_grant|wrong password|email or password/.test(m) || status === 400) {
    return 'Неверный email или пароль для Supabase, либо аккаунт не подтверждён (см. Authentication → Users). Если регистрировались только локально — войдите логином из формы, не только email.';
  }
  return (err && err.message) ? err.message : 'Не удалось войти через Supabase.';
}

async function doLogin() {
  if (window.__skladLoginBusy) return;
  window.__skladLoginBusy = true;
  try {
  const login = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value.trim();

  if (!login || !pass) {
    showLoginError('Введите логин и пароль');
    return;
  }

  const openSession = (displayName) => {
    addAudit(`${displayName} вошёл в систему`, 'auth');
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    setupUI();
    startRealtime();
    nav('dashboard');
  };

  const openFromServerUser = (u) => {
    currentUser = {
      id: u.id,
      name: u.full_name || u.username || u.email || 'Пользователь',
      login: u.username || u.email,
      pass: pass,
      role: 'admin',
      email: u.email,
      phone: u.phone,
      active: true,
      avatar: initialsFromName(u.full_name || u.username || u.email)
    };
    openSession(currentUser.name);
  };

  let serverPayload = null;
  let serverStatus = null;
  try {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password: pass })
    });
    serverStatus = resp.status;
    if (resp.ok) {
      serverPayload = await resp.json();
    } else if (resp.status === 401) {
      await resp.json().catch(() => null);
    }
  } catch (e) {
    console.warn('/api/login request failed', e);
  }

  const serverUser = serverPayload && serverPayload.ok && serverPayload.user ? serverPayload.user : null;

  // Сначала пробуем Supabase (профиль + роль), если есть клиент и подошёл пароль к облаку
  if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient && window.supabaseClient.auth) {
    const emailForSb = serverUser
      ? String(serverUser.email || '').trim().toLowerCase()
      : (login.includes('@') ? String(login).trim().toLowerCase() : null);

    if (emailForSb) {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email: emailForSb,
        password: pass
      });
      if (!error && data && data.user) {
        const { data: prof, error: pErr } = await window.supabaseClient
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();
        if (pErr) console.warn('profiles:', pErr);
        const p = prof || {};
        const role = normalizeProfileRole(p.role);
        currentUser = {
          id: data.user.id,
          name: p.full_name || p.username || emailForSb,
          login: p.username || emailForSb,
          pass: pass,
          role,
          email: p.email || emailForSb,
          phone: p.phone,
          company: p.company,
          active: true,
          avatar: initialsFromName(p.full_name || p.username || emailForSb)
        };
        openSession(currentUser.name);
        return;
      }
      if (login.includes('@') && !serverUser) {
        showLoginError(supabaseLoginHint(error));
        return;
      }
    }
  }

  if (serverUser) {
    openFromServerUser(serverUser);
    return;
  }

  if (serverStatus === 401) {
    showLoginError('Неверный логин или пароль');
    return;
  }

  if(!DB.users) initData();
  const user = DB.users.find(u => u.login===login);
  if(!user) {
    showLoginError('Пользователь не найден. Для аккаунта с сайта укажите логин или email и пароль регистрации.');
    return;
  }
  if(user.pass !== pass) { showLoginError('Неверный пароль'); return; }
  const isBlocked = user.active === false;
  currentUser = user;
  addAudit(`${user.name} вошёл в систему`, 'auth');
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  setupUI();
  if(isBlocked) {
    const crumb = document.getElementById('topbar-crumb');
    if(crumb) crumb.textContent = 'Вы заблокированы, обратитесь к администратору';
  }
  nav('dashboard');
  if(isBlocked) {
    showToast('Вы заблокированы, обратитесь к администратору', 'error');
  } else {
    startRealtime();
  }
  } finally {
    window.__skladLoginBusy = false;
  }
}

function showLoginError(msg) {
  const box = document.querySelector('.login-box');
  box.style.borderColor = 'var(--accent-red)';
  setTimeout(()=>box.style.borderColor='',1500);
  showToast(msg, 'error');
}

function doLogout() {
  if(!confirm('Выйти из системы?')) return;
  addAudit(`${currentUser.name} вышел из системы`, 'auth');
  if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient && window.supabaseClient.auth) {
    window.supabaseClient.auth.signOut().catch(()=>{});
  }
  saveDB();
  clearInterval(realtimeInterval);
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  currentUser = null;
}

function setupUI() {
  document.getElementById('sidebar-username').textContent = currentUser.name;
  document.getElementById('sidebar-role').textContent = currentUser.role;
  document.getElementById('sidebar-avatar').textContent = currentUser.avatar || currentUser.name[0];
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = currentUser.role === 'admin' ? '' : 'none';
  });
}
const panelTitles = {
  dashboard:'Дашборд', products:'Товары', categories:'Категории',
  supplies:'Поставки', orders:'Заказы', history:'История операций',
  reports:'Отчёты', audit:'Аудит', users:'Пользователи', settings:'Настройки'
};

function nav(panel) {
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const p = document.getElementById(`panel-${panel}`);
  if(p) p.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>{
    if(n.getAttribute('onclick')===`nav('${panel}')`) n.classList.add('active');
  });
  document.getElementById('topbar-title').textContent = panelTitles[panel]||panel;
  if(panel==='dashboard') renderDashboard();
  if(panel==='products') renderProducts();
  if(panel==='categories') renderCategories();
  if(panel==='supplies') renderSupplies();
  if(panel==='orders') renderOrders();
  if(panel==='history') renderHistory();
  if(panel==='reports') renderReports();
  if(panel==='audit') renderAudit();
  if(panel==='users') renderUsers();
}

function renderDashboard() {
  const products = DB.products;
  const total = products.length;
  const instock = products.filter(p=>p.qty>0).length;
  const lowstock = products.filter(p=>p.qty>0 && p.qty<=p.minQty).length;
  const outstock = products.filter(p=>p.qty===0).length;
  const activeOrders = DB.orders.filter(o=>o.status!=='delivered').length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-instock').textContent = instock;
  document.getElementById('stat-low').textContent = lowstock + outstock;
  document.getElementById('stat-orders').textContent = activeOrders;
  document.getElementById('stat-total-d').textContent = `${total} позиций в базе`;
  document.getElementById('stat-instock-d').textContent = `${outstock} нет в наличии`;
  document.getElementById('last-update').textContent = new Date().toLocaleTimeString('ru');

  const critical = products.filter(p=>p.qty===0||p.qty<=p.minQty);
  const alertEl = document.getElementById('low-stock-alert');
  if(critical.length>0) {
    alertEl.style.display='flex';
    document.getElementById('low-stock-msg').textContent = `⚠️ ${critical.length} товар(ов) требуют пополнения`;
  }

  const ops = [...DB.supplies].reverse().slice(0,6);
  const opsEl = document.getElementById('dash-recent-ops');
  opsEl.innerHTML = ops.map(op=>{
    const prod = DB.products.find(p=>p.id===op.productId);
    const color = op.type==='in'?'var(--accent-green)':op.type==='out'?'var(--accent-red)':'var(--accent)';
    const label = {in:'↓ Приход',out:'↑ Списание',inv:'⚖️ Инвент.'}[op.type];
    return `<div class="timeline-item">
      <div class="timeline-dot" style="color:${color}"></div>
      <div class="timeline-content">
        <div class="timeline-title">${label}: <b>${prod?prod.name:'—'}</b> × ${op.qty} ${prod?prod.unit:''}</div>
        <div class="timeline-meta">${op.date}</div>
      </div>
    </div>`;
  }).join('');

  const critEl = document.getElementById('dash-critical');
  critEl.innerHTML = critical.slice(0,6).map(p=>{
    const pct = p.minQty>0 ? Math.min(100,Math.round((p.qty/p.minQty)*100)) : 0;
    const cls = p.qty===0?'danger':p.qty<=p.minQty?'warn':'';
    return `<div style="padding:10px 16px;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:13px">${p.name}</span>
        <span style="font-family:var(--font-mono);font-size:12px;color:${p.qty===0?'var(--accent-red)':'var(--accent)'}">${p.qty} ${p.unit}</span>
      </div>
      <div class="stock-indicator">
        <div class="bar-wrap"><div class="bar ${cls}" style="width:${pct}%"></div></div>
        <span style="font-size:10px;color:var(--text-2);font-family:var(--font-mono);min-width:30px">мин:${p.minQty}</span>
      </div>
    </div>`;
  }).join('') || '<div class="empty-state"><p>Критических остатков нет</p></div>';

  setTimeout(()=>{
    drawMovementsChart();
    drawCategoriesChart();
    drawMonthlyChart();
  }, 50);
}

function refreshDashboard() {
  renderDashboard();
  showToast('Данные обновлены','success');
}

function drawMovementsChart() {
  const canvas = document.getElementById('chart-movements');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = 180;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const days=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const inData=[12,19,8,25,14,7,18];
  const outData=[5,8,12,6,10,3,9];
  drawBarChart(ctx, canvas.width, canvas.height, days, [
    {data:inData, color:'rgba(109,159,126,0.75)', label:'Приход'},
    {data:outData, color:'rgba(201,122,109,0.65)', label:'Расход'}
  ]);
}

function drawCategoriesChart() {
  const canvas = document.getElementById('chart-categories');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = 180;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const catCounts = DB.categories.map(c=>({
    name:c.name, count:DB.products.filter(p=>p.catId===c.id).length
  })).filter(c=>c.count>0);
  const colors=['#c9a87c','#7d9e92','#6d9f7e','#c97a6d','#9b8abd','#a67f52'];
  drawDonutChart(ctx, canvas.width, canvas.height, catCounts, colors);
}

function drawMonthlyChart() {
  const canvas = document.getElementById('chart-monthly');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = 100;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const months=['Авг','Сен','Окт','Ноя','Дек','Янв'];
  const data=[120,145,132,178,156,192];
  drawLineChart(ctx, canvas.width, canvas.height, months, data, '#a67f52');
}

function drawBarChart(ctx, w, h, labels, datasets) {
  const pad={l:40,r:20,t:20,b:30};
  const innerW=w-pad.l-pad.r, innerH=h-pad.t-pad.b;
  const n=labels.length, gw=innerW/n, bw=gw*0.35, gap=2;
  const maxVal=Math.max(...datasets.flatMap(d=>d.data));

  ctx.strokeStyle='rgba(42,51,71,0.8)'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad.t+innerH*(1-i/4);
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke();
    ctx.fillStyle='rgba(100,116,139,0.7)';
    ctx.font=`10px "IBM Plex Mono", monospace`;
    ctx.textAlign='right';
    ctx.fillText(Math.round(maxVal*i/4),pad.l-4,y+3);
  }

  datasets.forEach((ds,di)=>{
    ds.data.forEach((val,i)=>{
      const bh=Math.round((val/maxVal)*innerH);
      const x=pad.l+i*gw+(gw-(bw*datasets.length+gap*(datasets.length-1)))/2+di*(bw+gap);
      const y=pad.t+innerH-bh;
      ctx.fillStyle=ds.color;
      roundRect(ctx,x,y,bw,bh,2);
      ctx.fill();
    });
  });

  ctx.fillStyle='rgba(100,116,139,0.9)';
  ctx.font='10px "IBM Plex Mono", monospace'; ctx.textAlign='center';
  labels.forEach((l,i)=>{
    ctx.fillText(l,pad.l+(i+0.5)*gw,h-8);
  });

  datasets.forEach((ds,i)=>{
    ctx.fillStyle=ds.color; ctx.fillRect(pad.l+i*80,4,10,8);
    ctx.fillStyle='rgba(148,163,184,0.9)'; ctx.font='10px "IBM Plex Mono", monospace'; ctx.textAlign='left';
    ctx.fillText(ds.label,pad.l+i*80+14,12);
  });
}

function drawDonutChart(ctx, w, h, data, colors) {
  const cx=w*0.35, cy=h/2, r=Math.min(h,w*0.6)*0.42, ir=r*0.55;
  const total=data.reduce((s,d)=>s+d.count,0);
  let ang=-Math.PI/2;
  data.forEach((d,i)=>{
    const slice=(d.count/total)*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,ang,ang+slice);
    ctx.closePath(); ctx.fillStyle=colors[i%colors.length]; ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy,ir,0,Math.PI*2);
    ctx.fillStyle='#1b2129'; ctx.fill();
    ang+=slice;
  });
  ctx.fillStyle='#ece9e3'; ctx.font=`600 18px "IBM Plex Sans", sans-serif`; ctx.textAlign='center';
  ctx.fillText(total, cx, cy+3);
  ctx.fillStyle='#7a756c'; ctx.font=`10px "IBM Plex Mono", monospace`;
  ctx.fillText('товаров', cx, cy+16);

  const lx=w*0.62, ly=h/2-(data.length*14)/2;
  data.slice(0,6).forEach((d,i)=>{
    ctx.fillStyle=colors[i%colors.length]; ctx.fillRect(lx,ly+i*18,8,8);
    ctx.fillStyle='#a8a49a'; ctx.font='10px "IBM Plex Mono", monospace'; ctx.textAlign='left';
    ctx.fillText(`${d.name} (${d.count})`, lx+12, ly+i*18+8);
  });
}

function drawLineChart(ctx, w, h, labels, data, color) {
  const pad={l:40,r:20,t:10,b:24};
  const innerW=w-pad.l-pad.r, innerH=h-pad.t-pad.b;
  const n=data.length, max=Math.max(...data), min=Math.min(...data)-20;
  const xs=data.map((_,i)=>pad.l+i*(innerW/(n-1)));
  const ys=data.map(v=>pad.t+innerH-(v-min)/(max-min)*innerH);

  ctx.strokeStyle='rgba(42,51,71,0.8)'; ctx.lineWidth=1;
  for(let i=0;i<=3;i++){
    const y=pad.t+innerH*i/3;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(w-pad.r,y); ctx.stroke();
  }

  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+innerH);
  if(typeof color==='string' && color.startsWith('#') && color.length>=7) {
    const r=parseInt(color.slice(1,3),16), g=parseInt(color.slice(3,5),16), b=parseInt(color.slice(5,7),16);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.22)`);
  } else {
    grad.addColorStop(0, String(color).replace(')',',0.3)').replace('rgb','rgba'));
  }
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath(); ctx.moveTo(xs[0],ys[0]);
  for(let i=1;i<n;i++) ctx.lineTo(xs[i],ys[i]);
  ctx.lineTo(xs[n-1],pad.t+innerH); ctx.lineTo(xs[0],pad.t+innerH); ctx.closePath();
  ctx.fillStyle=grad; ctx.fill();

  ctx.beginPath(); ctx.moveTo(xs[0],ys[0]);
  for(let i=1;i<n;i++) ctx.lineTo(xs[i],ys[i]);
  ctx.strokeStyle=color; ctx.lineWidth=2; ctx.stroke();

  data.forEach((_,i)=>{
    ctx.beginPath(); ctx.arc(xs[i],ys[i],3,0,Math.PI*2);
    ctx.fillStyle=color; ctx.fill();
    ctx.fillStyle='rgba(148,163,184,0.8)'; ctx.font='10px "IBM Plex Mono", monospace'; ctx.textAlign='center';
    ctx.fillText(labels[i],xs[i],h-4);
  });
}

function roundRect(ctx,x,y,w,h,r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

function renderProducts() {
  updateCategorySelects();
  filterProducts();
}

function filterProducts() {
  let products = [...DB.products];
  const search = document.getElementById('prod-search')?.value.toLowerCase()||'';
  const cat = document.getElementById('prod-cat-filter')?.value||'';
  const status = document.getElementById('prod-status-filter')?.value||'';
  const sort = document.getElementById('prod-sort')?.value||'name';

  if(search) products = products.filter(p=>p.name.toLowerCase().includes(search)||p.sku?.toLowerCase().includes(search));
  if(cat) products = products.filter(p=>p.catId==cat);
  if(status==='instock') products = products.filter(p=>p.qty>p.minQty);
  if(status==='low') products = products.filter(p=>p.qty>0&&p.qty<=p.minQty);
  if(status==='out') products = products.filter(p=>p.qty===0);

  if(sort==='name') products.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  if(sort==='qty-asc') products.sort((a,b)=>a.qty-b.qty);
  if(sort==='qty-desc') products.sort((a,b)=>b.qty-a.qty);
  if(sort==='price') products.sort((a,b)=>b.price-a.price);

  document.getElementById('prod-count').textContent = products.length;

  const tbody = document.getElementById('products-tbody');
  if(products.length===0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-2)">Товары не найдены</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p=>{
    const cat = DB.categories.find(c=>c.id===p.catId);
    let statusBadge, statusText;
    if(p.qty===0) { statusBadge='badge-red'; statusText='Нет в наличии'; }
    else if(p.qty<=p.minQty) { statusBadge='badge-amber'; statusText='Заканчивается'; }
    else { statusBadge='badge-green'; statusText='В наличии'; }
    const pct=p.minQty>0?Math.min(100,Math.round(p.qty/p.minQty*100)):100;
    const barCls=p.qty===0?'danger':p.qty<=p.minQty?'warn':'';
    const canEdit = currentUser.active !== false && (currentUser.role==='admin'||currentUser.role==='manager');
    return `<tr>
      <td>${p.id}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="product-thumb" title="${p.name.replace(/"/g,'')}">${initialsFromName(p.name)}</div>
          <div>
            <div style="font-size:13px;font-weight:500">${p.name}</div>
            <div style="font-size:11px;color:var(--text-2)">${p.location||''} ${p.unit}</div>
          </div>
        </div>
      </td>
      <td><span style="font-family:var(--font-mono);font-size:11px;color:var(--text-2)">${p.sku||'—'}</span></td>
      <td>${cat?`<span>${cat.name}</span>`:'—'}</td>
      <td>
        <div style="min-width:100px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-family:var(--font-mono);font-size:13px;font-weight:600">${p.qty}</span>
            <span style="font-size:10px;color:var(--text-2);font-family:var(--font-mono)">мин:${p.minQty}</span>
          </div>
          <div class="progress-wrap"><div class="progress-bar ${barCls}" style="width:${pct}%"></div></div>
        </div>
      </td>
      <td><span style="font-family:var(--font-mono);font-size:12px">${p.minQty} ${p.unit}</span></td>
      <td><span style="font-family:var(--font-mono)">${formatPrice(p.price)}</span></td>
      <td><span class="badge ${statusBadge}">${statusText}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          ${canEdit?`<button class="btn btn-sm btn-secondary" onclick="editProduct(${p.id})" title="Редактировать">Изм.</button>`:''}
          ${canEdit?`<button class="btn btn-sm btn-success" onclick="quickSupply(${p.id},'in')" title="Приход">+</button>`:''}
          ${canEdit?`<button class="btn btn-sm btn-danger" onclick="quickSupply(${p.id},'out')" title="Списать">−</button>`:''}
          ${currentUser.role==='admin'?`<button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})" title="Удалить">Уд.</button>`:''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function editProduct(id) {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  const p = DB.products.find(x=>x.id===id);
  if(!p) return;
  document.getElementById('edit-prod-id').value = id;
  document.getElementById('prod-modal-title').textContent = 'Редактировать товар';
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-sku').value = p.sku||'';
  document.getElementById('prod-qty').value = p.qty;
  document.getElementById('prod-minqty').value = p.minQty;
  document.getElementById('prod-price').value = p.price;
  document.getElementById('prod-unit').value = p.unit;
  document.getElementById('prod-location').value = p.location||'';
  document.getElementById('prod-desc').value = p.desc||'';
  updateCategorySelects();
  document.getElementById('prod-cat').value = p.catId;
  openModal('modal-add-product');
}

function deleteProduct(id) {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  if(!confirm('Удалить товар?')) return;
  const p = DB.products.find(x=>x.id===id);
  DB.products = DB.products.filter(x=>x.id!==id);
  addAudit(`Удалён товар «${p.name}»`, 'delete');
  saveDB(); renderProducts();
  showToast('Товар удалён','success');
}

function quickSupply(productId, type) {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  openSupplyModal(type);
  setTimeout(()=>{
    document.getElementById('supply-product').value = productId;
  },50);
}

function saveProduct() {
  if(currentUser?.active === false) {
    showToast('Вы заблокированы, обратитесь к администратору','error');
    return;
  }
  const name = document.getElementById('prod-name').value.trim();
  if(!name) { showToast('Введите название товара','error'); return; }
  const editId = document.getElementById('edit-prod-id').value;
  const prod = {
    name, sku: document.getElementById('prod-sku').value.trim(),
    catId: +document.getElementById('prod-cat').value,
    qty: +document.getElementById('prod-qty').value||0,
    minQty: +document.getElementById('prod-minqty').value||10,
    price: +document.getElementById('prod-price').value||0,
    unit: document.getElementById('prod-unit').value,
    location: document.getElementById('prod-location').value.trim(),
    desc: document.getElementById('prod-desc').value.trim(),
  };
  if(editId) {
    const idx = DB.products.findIndex(p=>p.id==editId);
    if(idx>=0) { DB.products[idx]={...DB.products[idx],...prod}; addAudit(`Обновлён товар «${name}»`,'update'); }
    showToast('Товар обновлён','success');
  } else {
    prod.id = Date.now();
    DB.products.push(prod);
    addAudit(`Добавлен товар «${name}»`,'create');
    showToast('Товар добавлен','success');
  }
  closeModal('modal-add-product');
  document.getElementById('edit-prod-id').value='';
  document.getElementById('prod-modal-title').textContent='Добавить товар';
  saveDB(); renderProducts();
}

