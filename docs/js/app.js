// ============================================================
//  THE PROTEIN NOOK — Public Ordering App
// ============================================================

(() => {
  // ─── State ──────────────────────────────────────────────
  let cart       = {};   // { itemId: qty }
  let menuState  = {};   // { itemId: { enabled: bool } }
  let settings   = { acceptingOrders: true };
  let isSubmitting = false;

  // ─── DOM Refs ────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const elLoading      = $('loading');
  const elMenuContainer = $('menu-container');
  const elBannerClosed  = $('banner-closed');
  const elCartBar       = $('cart-bar');
  const elCartCount     = $('cart-count');
  const elCartTotal     = $('cart-total');
  const elOrderModal    = $('order-modal');
  const elSuccessModal  = $('success-modal');

  // ─── Init ────────────────────────────────────────────────
  async function init() {
    // Real-time settings listener
    db.collection('settings').doc('store').onSnapshot(snap => {
      if (snap.exists) settings = snap.data();
      else settings = { acceptingOrders: true };
      applySettings();
    });

    // Real-time menu state listener
    db.collection('menuState').onSnapshot(snap => {
      menuState = {};
      snap.forEach(doc => { menuState[doc.id] = doc.data(); });
      renderMenu();
    });
  }

  // ─── Settings ────────────────────────────────────────────
  function applySettings() {
    if (!settings.acceptingOrders) {
      elBannerClosed.classList.remove('hidden');
      $('btn-place-order').disabled = true;
    } else {
      elBannerClosed.classList.add('hidden');
      $('btn-place-order').disabled = false;
    }
  }

  // ─── Menu Rendering ──────────────────────────────────────
  function isEnabled(itemId) {
    if (menuState[itemId] === undefined) return true; // default enabled
    return menuState[itemId].enabled !== false;
  }

  function renderMenu() {
    elLoading.classList.add('hidden');
    elMenuContainer.classList.remove('hidden');

    renderCategory('dosas-list',    MENU.dosas,    renderItemCard);
    renderCategory('omelettes-list', MENU.omelettes, renderItemCard);
    renderCategory('addons-list',   MENU.addons,   renderAddonCard);
  }

  function renderCategory(containerId, items, renderFn) {
    const container = $(containerId);
    container.innerHTML = '';
    items.forEach(item => {
      const el = renderFn(item);
      container.appendChild(el);
    });
  }

  function renderItemCard(item) {
    const enabled = isEnabled(item.id);
    const qty = cart[item.id] || 0;

    const card = document.createElement('div');
    card.className = `item-card${!enabled ? ' disabled' : ''}${qty > 0 ? ' in-cart' : ''}`;
    card.dataset.id = item.id;

    card.innerHTML = `
      <div class="item-emoji">${item.emoji}</div>
      <div class="item-info">
        <div class="item-name">${item.name}</div>
        <div class="item-desc">${item.desc}</div>
      </div>
      <div class="item-price">₹${item.price}</div>
      <div class="qty-control">
        <button class="qty-btn minus" data-id="${item.id}" data-action="dec" aria-label="Remove one">−</button>
        <span class="qty-display" id="qty-${item.id}">${qty}</span>
        <button class="qty-btn plus" data-id="${item.id}" data-action="inc" aria-label="Add one">+</button>
      </div>
    `;
    return card;
  }

  function renderAddonCard(item) {
    const enabled = isEnabled(item.id);
    const qty = cart[item.id] || 0;

    const card = document.createElement('div');
    card.className = `addon-card${!enabled ? ' disabled' : ''}${qty > 0 ? ' in-cart' : ''}`;
    card.dataset.id = item.id;

    card.innerHTML = `
      <span class="addon-emoji">${item.emoji}</span>
      <div class="addon-info">
        <div class="addon-name">${item.name}</div>
        <div class="addon-price">₹${item.price}</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn minus" data-id="${item.id}" data-action="dec" aria-label="Remove one">−</button>
        <span class="qty-display" id="qty-${item.id}">${qty}</span>
        <button class="qty-btn plus" data-id="${item.id}" data-action="inc" aria-label="Add one">+</button>
      </div>
    `;
    return card;
  }

  // ─── Cart Logic ──────────────────────────────────────────
  function updateQty(itemId, delta) {
    if (!settings.acceptingOrders) return;
    const current = cart[itemId] || 0;
    const next = Math.max(0, current + delta);
    if (next === 0) delete cart[itemId];
    else cart[itemId] = next;

    // Update qty display
    const qtyEl = $(`qty-${itemId}`);
    if (qtyEl) qtyEl.textContent = next;

    // Update card class
    const card = document.querySelector(`[data-id="${itemId}"]`);
    if (card) card.classList.toggle('in-cart', next > 0);

    updateCartBar();
  }

  function getCartTotal() {
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const item = ALL_ITEMS.find(i => i.id === id);
      return sum + (item ? item.price * qty : 0);
    }, 0);
  }

  function getCartCount() {
    return Object.values(cart).reduce((a, b) => a + b, 0);
  }

  function updateCartBar() {
    const count = getCartCount();
    const total = getCartTotal();
    elCartCount.textContent = `${count} item${count !== 1 ? 's' : ''}`;
    elCartTotal.textContent = `₹${total}`;
    elCartBar.classList.toggle('visible', count > 0);
  }

  // ─── Order Modal ─────────────────────────────────────────
  function openOrderModal() {
    if (!settings.acceptingOrders) return;

    // Build cart review HTML
    const review = Object.entries(cart).map(([id, qty]) => {
      const item = ALL_ITEMS.find(i => i.id === id);
      if (!item) return '';
      return `
        <div class="cart-review-item">
          <span class="name">${item.emoji} ${item.name}</span>
          <span class="qty-price">${qty} × ₹${item.price} = <strong>₹${item.price * qty}</strong></span>
        </div>
      `;
    }).join('');

    $('cart-review').innerHTML = review;
    $('modal-total').textContent = `₹${getCartTotal()}`;

    elOrderModal.classList.add('open');
    document.body.style.overflow = 'hidden';
    $('customer-name').focus();
  }

  function closeOrderModal() {
    elOrderModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ─── Submit Order ────────────────────────────────────────
  async function submitOrder() {
    if (isSubmitting) return;

    const name  = $('customer-name').value.trim();
    const phone = $('customer-phone').value.trim();
    const note  = $('special-note').value.trim();

    // Validate
    let valid = true;
    if (!name) {
      $('customer-name').classList.add('error');
      valid = false;
    } else $('customer-name').classList.remove('error');

    if (!phone || !/^\d{10}$/.test(phone)) {
      $('customer-phone').classList.add('error');
      valid = false;
    } else $('customer-phone').classList.remove('error');

    if (!valid) return;

    isSubmitting = true;
    const btn = $('btn-confirm-order');
    btn.disabled = true;
    btn.textContent = 'Placing order...';

    const orderId = generateOrderId();
    const items = Object.entries(cart).map(([id, qty]) => {
      const item = ALL_ITEMS.find(i => i.id === id);
      return { id, name: item.name, qty, price: item.price, subtotal: item.price * qty };
    });

    const order = {
      orderId,
      customerName: name,
      customerPhone: phone,
      items,
      total: getCartTotal(),
      status: 'pending',
      specialNote: note,
      session: getCurrentSession(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await db.collection('orders').doc(orderId).set(order);

      // Success!
      closeOrderModal();
      $('order-id-display').textContent = orderId;
      $('success-note').textContent = `Hi ${name}! We'll call ${phone} when your order is ready. Come hungry, leave happy! 😊`;
      elSuccessModal.classList.add('open');

      // Reset
      cart = {};
      updateCartBar();
      renderMenu();

    } catch (err) {
      console.error('Order failed:', err);
      alert('Failed to place order. Please try again.');
    } finally {
      isSubmitting = false;
      btn.disabled = false;
      btn.textContent = 'Confirm & Place Order 🚀';
    }
  }

  // ─── Event Listeners ─────────────────────────────────────
  // Qty buttons (delegated — menu re-renders)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.qty-btn');
    if (!btn) return;
    const id     = btn.dataset.id;
    const action = btn.dataset.action;
    if (!id || !action) return;
    updateQty(id, action === 'inc' ? 1 : -1);
  });

  $('btn-place-order').addEventListener('click', openOrderModal);
  $('modal-close').addEventListener('click', closeOrderModal);

  // Close on overlay click
  elOrderModal.addEventListener('click', e => {
    if (e.target === elOrderModal) closeOrderModal();
  });

  $('btn-confirm-order').addEventListener('click', submitOrder);

  $('btn-new-order').addEventListener('click', () => {
    elSuccessModal.classList.remove('open');
    document.body.style.overflow = '';
    // Clear form
    $('customer-name').value = '';
    $('customer-phone').value = '';
    $('special-note').value = '';
  });

  // Phone: numbers only
  $('customer-phone').addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });

  // ─── Boot ────────────────────────────────────────────────
  init();
})();
