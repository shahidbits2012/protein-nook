// ============================================================
//  THE PROTEIN NOOK — Admin Dashboard
// ============================================================

(() => {
  // Auth — only available on admin page (firebase-auth-compat.js loaded in admin.html)
  const auth = DEV_MODE ? null : firebase.auth();

  // ─── State ──────────────────────────────────────────────
  let allOrders     = [];
  let currentFilter = 'all';
  let menuState     = {};
  let storeSettings = {};
  let ordersUnsub   = null;
  let menuUnsub     = null;
  let settingsUnsub = null;

  // selectedDate: YYYY-MM-DD string in local time; null = today
  let selectedDate  = localDateStr(new Date());

  // ─── Date helpers ────────────────────────────────────────
  function localDateStr(d) {
    // Returns "YYYY-MM-DD" in local time (not UTC)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function orderDateStr(order) {
    if (!order.createdAt) return localDateStr(new Date()); // no timestamp = today (just placed)
    const d = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
    return localDateStr(d);
  }

  function friendlyDate(dateStr) {
    const today     = localDateStr(new Date());
    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    if (dateStr === today)     return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function updateDateNav() {
    const today = localDateStr(new Date());
    $('date-label').textContent = friendlyDate(selectedDate);

    const dayOrders = allOrders.filter(o => orderDateStr(o) === selectedDate);
    const pending = dayOrders.filter(o => o.status === 'pending').length;
    const done    = dayOrders.filter(o => o.status === 'done').length;
    $('date-summary').textContent = dayOrders.length
      ? `${dayOrders.length} order${dayOrders.length !== 1 ? 's' : ''} · ${pending} pending · ${done} done`
      : 'No orders';

    const isToday = selectedDate === today;
    $('btn-next-date').disabled = isToday;
    if (isToday) $('btn-today').classList.add('hidden');
    else         $('btn-today').classList.remove('hidden');
  }

  // ─── DOM ─────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const elLoginPage  = $('login-page');
  const elAdminPage  = $('admin-page');
  const elLoginError = $('login-error');

  // ─── Auth ────────────────────────────────────────────────
  if (DEV_MODE) {
    // Skip login in dev mode — go straight to dashboard with mock data
    console.warn('⚠️  DEV_MODE is ON — auth bypassed. Set DEV_MODE=false before deploying!');
    showDashboard();
  } else {
    auth.onAuthStateChanged(user => {
      if (user) showDashboard();
      else showLogin();
    });
  }

  function showLogin() {
    elLoginPage.style.display  = 'flex';
    elAdminPage.classList.remove('active');
    stopListeners();
  }

  function showDashboard() {
    elLoginPage.style.display = 'none';
    elAdminPage.classList.add('active');
    startListeners();
  }

  function stopListeners() {
    if (ordersUnsub)   { ordersUnsub();   ordersUnsub = null; }
    if (menuUnsub)     { menuUnsub();     menuUnsub = null; }
    if (settingsUnsub) { settingsUnsub(); settingsUnsub = null; }
  }

  // ─── Login ───────────────────────────────────────────────
  async function doLogin() {
    const email    = $('login-email').value.trim();
    const password = $('login-password').value;
    const btn      = $('btn-login');

    if (!email || !password) {
      elLoginError.textContent = '⚠️ Please enter your email and password.';
      elLoginError.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in...';
    elLoginError.classList.remove('show');

    try {
      await auth.signInWithEmailAndPassword(email, password);
      // onAuthStateChanged will call showDashboard()
    } catch (err) {
      elLoginError.textContent = '❌ Incorrect email or password.';
      elLoginError.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  }

  $('btn-login').addEventListener('click', doLogin);
  $('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('login-email').addEventListener('keydown', e => { if (e.key === 'Enter') $('login-password').focus(); });

  $('btn-logout').addEventListener('click', () => {
    if (DEV_MODE) { showLogin(); return; }
    auth.signOut();
  });

  // ─── Tabs ────────────────────────────────────────────────
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(`panel-${name}`).classList.add('active');
    });
  });

  // ─── Start Realtime Listeners ────────────────────────────
  function startListeners() {
    if (DEV_MODE) {
      // Load mock data so the UI is fully testable without Firebase
      const now = new Date();
      const yesterday = new Date(now - 86400000);
      function mockTs(d, h, m) {
        const t = new Date(d); t.setHours(h, m, 0, 0);
        return { toDate: () => t };
      }
      allOrders = [
        {
          orderId: 'PN-TODAY-TEST',
          customerName: 'Rahul Sharma',
          customerPhone: '9876543210',
          items: [
            { name: 'Masala Dosa', qty: 2, price: 65, subtotal: 130 },
            { name: 'Normal Tea',  qty: 2, price: 10, subtotal: 20  },
          ],
          total: 150,
          status: 'pending',
          specialNote: 'Extra chutney please!',
          session: 'morning',
          createdAt: mockTs(now, 8, 15),
        },
        {
          orderId: 'PN-TODAY-DEMO',
          customerName: 'Priya Patel',
          customerPhone: '9123456789',
          items: [
            { name: 'Omelette & Toast', qty: 1, price: 50, subtotal: 50 },
            { name: 'Extra Cheese',     qty: 1, price: 20, subtotal: 20 },
          ],
          total: 70,
          status: 'ready',
          specialNote: '',
          session: 'morning',
          createdAt: mockTs(now, 9, 40),
        },
        {
          orderId: 'PN-YDAY-SMPL',
          customerName: 'Arjun Kumar',
          customerPhone: '9000011111',
          items: [
            { name: 'Upma Peserattu', qty: 1, price: 90, subtotal: 90 },
          ],
          total: 90,
          status: 'done',
          specialNote: '',
          session: 'morning',
          createdAt: mockTs(yesterday, 8, 55),
        },
      ];
      renderOrders();
      updateStats();
      renderMenuManagement();

      // Default settings UI
      const toggle = $('toggle-accepting');
      const status = $('accepting-status');
      toggle.checked = true;
      status.textContent = '✅ Open — Accepting Orders';
      status.className = 'accepting-status open';
      // Timing inputs already have defaults from HTML
      return;
    }

    // ── Live Firebase listeners ──────────────────────────
    // Orders — real-time, newest first
    ordersUnsub = db.collection('orders')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        allOrders = snap.docs.map(doc => doc.data());
        renderOrders();
        updateStats();
      });

    // Menu state
    menuUnsub = db.collection('menuState').onSnapshot(snap => {
      menuState = {};
      snap.forEach(doc => { menuState[doc.id] = doc.data(); });
      renderMenuManagement();
    });

    // Settings
    settingsUnsub = db.collection('settings').doc('store').onSnapshot(snap => {
      const data = snap.exists ? snap.data() : { acceptingOrders: true };
      storeSettings = data;
      const toggle = $('toggle-accepting');
      const status = $('accepting-status');
      toggle.checked = !!data.acceptingOrders;
      if (data.acceptingOrders) {
        status.textContent = '✅ Open — Accepting Orders';
        status.className = 'accepting-status open';
      } else {
        status.textContent = '🔴 Closed — Not Accepting Orders';
        status.className = 'accepting-status closed';
      }
      applyTimingsToForm(data);
    });
  }

  // ─── Orders Rendering ────────────────────────────────────
  function renderOrders() {
    const list = $('orders-list');
    const dayOrders = allOrders.filter(o => orderDateStr(o) === selectedDate);
    const filtered = currentFilter === 'all'
      ? dayOrders
      : dayOrders.filter(o => o.status === currentFilter);

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon">📭</div>
          <h4>${currentFilter === 'all' ? 'No orders yet' : `No ${currentFilter} orders`}</h4>
          <p>Orders will appear here in real-time as customers place them.</p>
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(order => renderOrderCard(order)).join('');

    // Attach action button listeners
    list.querySelectorAll('.btn-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const orderId = btn.dataset.orderId;
        const action  = btn.dataset.action;
        await updateOrderStatus(orderId, action);
      });
    });
  }

  function renderOrderCard(order) {
    const statusLabel = { pending: '🟡 Pending', ready: '🟢 Ready', done: '✅ Done' }[order.status] || order.status;
    const time = order.createdAt ? formatDateTime(order.createdAt) : 'Just now';

    const itemLines = order.items.map(item =>
      `<div class="order-item-line">
        <strong>${item.name}</strong>
        <span>${item.qty} × ₹${item.price} = ₹${item.subtotal}</span>
      </div>`
    ).join('');

    const noteHtml = order.specialNote
      ? `<div class="order-note">📝 ${order.specialNote}</div>`
      : '';

    const actions = buildActionButtons(order);

    return `
      <div class="order-card status-${order.status}" id="card-${order.orderId}">
        <div class="order-card-header">
          <div>
            <div class="order-id">${order.orderId}</div>
            <div class="order-time">⏰ ${time} · ${order.session || 'walk-in'}</div>
          </div>
          <span class="status-badge ${order.status}">${statusLabel}</span>
        </div>

        <div class="order-customer">
          <span>👤 ${order.customerName}</span>
          <span>📱 ${order.customerPhone}</span>
        </div>

        <div class="order-items">${itemLines}</div>

        <div class="order-total">Total: ₹${order.total}</div>

        ${noteHtml}

        <div class="order-actions">${actions}</div>
      </div>
    `;
  }

  function buildActionButtons(order) {
    const { status, orderId } = order;
    if (status === 'pending') return `
      <button class="btn-action btn-ready" data-order-id="${orderId}" data-action="ready">Mark Ready 🔔</button>
      <button class="btn-action btn-done" data-order-id="${orderId}" data-action="done">Mark Done ✅</button>
    `;
    if (status === 'ready') return `
      <button class="btn-action btn-undo" data-order-id="${orderId}" data-action="pending">← Pending</button>
      <button class="btn-action btn-done" data-order-id="${orderId}" data-action="done">Mark Done ✅</button>
    `;
    if (status === 'done') return `
      <button class="btn-action btn-undo" data-order-id="${orderId}" data-action="pending">← Reopen</button>
    `;
    return '';
  }

  async function updateOrderStatus(orderId, status) {
    if (DEV_MODE) {
      // Update local mock data and re-render
      const order = allOrders.find(o => o.orderId === orderId);
      if (order) { order.status = status; renderOrders(); updateStats(); }
      return;
    }
    try {
      await db.collection('orders').doc(orderId).update({ status });
    } catch (err) {
      console.error('Status update failed:', err);
      alert('Failed to update order. Please try again.');
    }
  }

  // ─── Date Navigation ─────────────────────────────────────
  $('btn-prev-date').addEventListener('click', () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    selectedDate = localDateStr(d);
    updateDateNav();
    renderOrders();
    updateStats();
  });

  $('btn-next-date').addEventListener('click', () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const next = localDateStr(d);
    const today = localDateStr(new Date());
    if (next <= today) {
      selectedDate = next;
      updateDateNav();
      renderOrders();
      updateStats();
    }
  });

  $('btn-today').addEventListener('click', () => {
    selectedDate = localDateStr(new Date());
    updateDateNav();
    renderOrders();
    updateStats();
  });

  // ─── Order Filters ────────────────────────────────────────
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderOrders();
    });
  });

  // ─── Menu Management ─────────────────────────────────────
  function renderMenuManagement() {
    renderManageSection('manage-dosas',     MENU.dosas);
    renderManageSection('manage-omelettes', MENU.omelettes);
    renderManageSection('manage-addons',    MENU.addons);
  }

  function renderManageSection(containerId, items) {
    const container = $(containerId);
    container.innerHTML = items.map(item => {
      const state   = menuState[item.id];
      const enabled = state === undefined ? true : state.enabled !== false;
      return `
        <div class="menu-manage-item">
          <div class="item-emoji">${item.emoji}</div>
          <div class="item-name">${item.name}</div>
          <div class="item-price">₹${item.price}</div>
          <div class="toggle-wrap">
            <label class="toggle">
              <input type="checkbox" ${enabled ? 'checked' : ''} data-item-id="${item.id}" />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">${enabled ? 'ON' : 'OFF'}</span>
          </div>
        </div>
      `;
    }).join('');

    // Attach toggle listeners
    container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', async () => {
        const itemId  = chk.dataset.itemId;
        const enabled = chk.checked;
        const label   = chk.closest('.toggle-wrap').querySelector('.toggle-label');
        if (label) label.textContent = enabled ? 'ON' : 'OFF';
        if (DEV_MODE) {
          menuState[itemId] = { enabled };
          return;
        }
        try {
          await db.collection('menuState').doc(itemId).set({ enabled }, { merge: true });
        } catch (err) {
          console.error('Menu toggle failed:', err);
          chk.checked = !enabled; // revert on error
          alert('Failed to update item. Check your connection.');
        }
      });
    });
  }

  // ─── Settings — Accepting Orders ─────────────────────────
  $('toggle-accepting').addEventListener('change', async e => {
    const accepting = e.target.checked;
    const status = $('accepting-status');
    if (DEV_MODE) {
      status.textContent = accepting ? '✅ Open — Accepting Orders' : '🔴 Closed — Not Accepting Orders';
      status.className   = `accepting-status ${accepting ? 'open' : 'closed'}`;
      return;
    }
    try {
      await db.collection('settings').doc('store').set(
        { acceptingOrders: accepting, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error('Settings update failed:', err);
      e.target.checked = !accepting; // revert
      alert('Failed to update settings. Please try again.');
    }
  });

  // ─── Stats ───────────────────────────────────────────────
  function updateStats() {
    // Stats for the currently selected date
    const dayOrders = allOrders.filter(o => orderDateStr(o) === selectedDate);
    const revenue = dayOrders.reduce((s, o) => s + (o.total || 0), 0);
    const pending = dayOrders.filter(o => o.status === 'pending').length;
    const done    = dayOrders.filter(o => o.status === 'done').length;

    $('stat-total-orders').textContent = dayOrders.length;
    $('stat-total-revenue').textContent = `₹${revenue}`;
    $('stat-pending').textContent = pending;
    $('stat-done').textContent = done;

    updateDateNav();
  }

  // ─── Timing Settings ─────────────────────────────────────
  $('btn-save-timings').addEventListener('click', async () => {
    const btn = $('btn-save-timings');
    const mo = $('morning-open').value;
    const mc = $('morning-close').value;
    const eo = $('evening-open').value;
    const ec = $('evening-close').value;

    if (DEV_MODE) {
      storeSettings = { ...storeSettings, morningOpen: mo, morningClose: mc, eveningOpen: eo, eveningClose: ec };
      showTimingsSaved();
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await db.collection('settings').doc('store').set(
        { morningOpen: mo, morningClose: mc, eveningOpen: eo, eveningClose: ec,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      showTimingsSaved();
    } catch (err) {
      console.error('Timings save failed:', err);
      alert('Failed to save timings. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Timings';
    }
  });

  function showTimingsSaved() {
    const msg = $('timings-save-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 3000);
  }

  function applyTimingsToForm(data) {
    if (data.morningOpen)  $('morning-open').value  = data.morningOpen;
    if (data.morningClose) $('morning-close').value = data.morningClose;
    if (data.eveningOpen)  $('evening-open').value  = data.eveningOpen;
    if (data.eveningClose) $('evening-close').value = data.eveningClose;
  }

})();
