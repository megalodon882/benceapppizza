const supabaseClient = window.supabaseClient;
const form = document.querySelector('#account-form');
const usernameField = document.querySelector('#username-field');
const usernameInput = usernameField.querySelector('input');
const roleField = document.querySelector('#role-field');
const roleInputs = roleField.querySelectorAll('input[name="role"]');
const passwordInput = form.querySelector('[name="password"]');
const description = document.querySelector('#form-description');
const submitButton = document.querySelector('#submit-button');
const feedback = document.querySelector('#feedback');
const modeButtons = document.querySelectorAll('[data-mode]');
const accountPanel = document.querySelector('#account-panel');
const appPanel = document.querySelector('#app-panel');
const logoutButton = document.querySelector('#logout-button');
const activeUser = document.querySelector('#active-user');
const activeRoleBadge = document.querySelector('#active-role-badge');
const managerWelcome = document.querySelector('#manager-welcome');
const managerName = document.querySelector('#manager-name');
const orderStatLabel = document.querySelector('#order-stat-label');
const incomeStatLabel = document.querySelector('#income-stat-label');
const ordersTabLabel = document.querySelector('#orders-tab-label');
const accountingTabLabel = document.querySelector('#accounting-tab-label');
const orderForm = document.querySelector('#order-form');
const newOrderHeading = document.querySelector('#new-order-heading');
const ordersListHeading = document.querySelector('#orders-list-heading');
const addressInput = document.querySelector('#address-input');
const phoneInput = orderForm.querySelector('[name="phone"]');
const savedAddressList = document.querySelector('#saved-addresses');
const orderList = document.querySelector('#order-list');
const managerCouriers = document.querySelector('#manager-couriers');
const managerCourierList = document.querySelector('#manager-courier-list');
const managerCourierCount = document.querySelector('#manager-courier-count');
const orderCount = document.querySelector('#order-count');
const totalIncome = document.querySelector('#total-income');
const visibleOrderCount = document.querySelector('#visible-order-count');
const orderSearch = document.querySelector('#order-search');
const deleteAllButton = document.querySelector('#delete-all-button');
const deleteAllWrap = document.querySelector('#delete-all-wrap');
const deleteAllConfirm = document.querySelector('#delete-all-confirm');
const deleteAllInput = document.querySelector('#delete-all-input');
const deleteAllFinal = document.querySelector('#delete-all-final');
const deleteAllFeedback = document.querySelector('#delete-all-feedback');
const filterButtons = document.querySelectorAll('[data-filter]');
const sortButtons = document.querySelectorAll('[data-sort]');
const colorInputs = document.querySelectorAll('input[name="color"]');
const tabButtons = document.querySelectorAll('[data-tab]');
const ordersView = document.querySelector('#orders-view');
const accountingView = document.querySelector('#accounting-view');
const accountingList = document.querySelector('#accounting-list');
const accountingCopy = document.querySelector('#accounting-copy');
const accountingSearch = document.querySelector('#accounting-search');
const managerSettlement = document.querySelector('#manager-settlement');
const managerSettlementList = document.querySelector('#manager-settlement-list');
const managerSettlementCount = document.querySelector('#manager-settlement-count');
const managerSettlementTotal = document.querySelector('#manager-settlement-total');
const manualWorkerForm = document.querySelector('#manual-worker-form');
const dailyFlowInput = document.querySelector('#daily-flow-input');
const dailyFlowResult = document.querySelector('#daily-flow-result');
const toastContainer = document.querySelector('#toast-container');
const colorChangeModal = document.querySelector('#color-change-modal');
const colorChangeCopy = document.querySelector('#color-change-copy');
const colorChangeCancel = document.querySelector('#color-change-cancel');
const colorChangeConfirm = document.querySelector('#color-change-confirm');
const expenseForm = document.querySelector('#expense-form');
const expenseList = document.querySelector('#expense-list');
const selectedOrderCount = document.querySelector('#selected-order-count');
const summaryTotal = document.querySelector('#summary-total');
const summaryBlack = document.querySelector('#summary-black');
const summaryWhite = document.querySelector('#summary-white');
const summaryNetTotal = document.querySelector('#summary-net-total');
const summaryNetBlack = document.querySelector('#summary-net-black');
const summaryNetAfterExpenses = document.querySelector('#summary-net-after-expenses');
const expensesPanel = document.querySelector('.expenses-panel');

const orders = [];
const savedAddresses = [];
const couriers = [];
const manualWorkers = [];
const expenses = [];
let currentUser = null;
let ordersChannel = null;
let ordersRefreshInterval = null;
let isRefreshingOrders = false;
let activeFilter = 'all';
let activeSort = 'default';
let colorChangeOrderId = null;
let toastTimeout;

form.dataset.mode = 'register';

function showToast(message, type = 'error') {
  window.clearTimeout(toastTimeout);
  toastContainer.innerHTML = `<div class="toast toast-${type}">${escapeHtml(message)}</div>`;
  window.setTimeout(() => toastContainer.firstElementChild?.classList.add('is-visible'), 10);
  toastTimeout = window.setTimeout(() => {
    toastContainer.firstElementChild?.classList.remove('is-visible');
    window.setTimeout(() => {
      toastContainer.innerHTML = '';
    }, 220);
  }, 2600);
}

function setMode(mode) {
  const isRegistering = mode === 'register';
  form.dataset.mode = mode;
  usernameField.hidden = !isRegistering;
  roleField.hidden = !isRegistering;
  usernameInput.required = isRegistering;
  roleInputs.forEach((input) => {
    input.required = isRegistering;
  });
  passwordInput.autocomplete = isRegistering ? 'new-password' : 'current-password';
  description.textContent = isRegistering ? 'Hozd létre a fiókodat.' : 'Jelentkezz be a fiókodba.';
  submitButton.textContent = isRegistering ? 'Regisztráció' : 'Bejelentkezés';
  feedback.textContent = '';

  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive);
  });
}

async function loadUserData(user) {
  const [{ data: profile, error: profileError }, { data: addressRows, error: addressError }, { data: orderRows, error: orderError }, { data: courierRows, error: courierError }] = await Promise.all([
    supabaseClient.from('profiles').select('id, username, role, requested_role').eq('id', user.id).single(),
    supabaseClient.from('addresses').select('id, address, phone, created_at, updated_at').order('updated_at', { ascending: false }),
    supabaseClient.from('orders').select('*').order('created_at', { ascending: false }),
    supabaseClient.from('profiles').select('id, username, role').order('username', { ascending: true }),
  ]);

  if (profileError) throw profileError;
  if (addressError) throw addressError;
  if (orderError) throw orderError;
  if (courierError) throw courierError;

  currentUser = profile;
  couriers.splice(0, couriers.length, ...courierRows
    .filter((courier) => courier.role === 'courier')
    .map((courier) => {
      const previousCourier = couriers.find((item) => item.id === courier.id);
      return {
        id: courier.id,
        username: courier.username,
        isWorking: previousCourier?.isWorking ?? true,
      };
    }));
  savedAddresses.splice(0, savedAddresses.length, ...addressRows
    .map((address) => ({
      id: address.id,
      key: normalizeAddress(address.address),
      address: address.address,
      phone: address.phone || '',
      createdAt: new Date(address.updated_at || address.created_at).getTime(),
    }))
    .sort((first, second) => second.createdAt - first.createdAt));
  orders.splice(0, orders.length, ...orderRows.map((order) => ({
    id: order.id,
    courierId: order.courier_id,
    address: order.address_snapshot,
    phone: order.phone_snapshot || '',
    color: order.color === 'white' ? 'Fehér' : 'Fekete',
    details: order.details || '',
    price: Number(order.price),
    status: order.status,
    checked: order.checked === true,
    createdAt: new Date(order.created_at),
  })));

  renderSavedAddresses();
  renderOrders();
  renderAccounting();
}

function openApp() {
  const role = currentUser?.role === 'manager' ? 'manager' : 'courier';
  const roleLabel = role === 'manager' ? 'MANAGER' : 'FUTÁR';
  const isManager = role === 'manager';
  activeUser.textContent = currentUser?.username || roleLabel;
  activeRoleBadge.textContent = isManager ? '🧠 MANAGER' : '🚗 FUTÁR';
  appPanel.classList.toggle('manager-mode', isManager);
  managerWelcome.hidden = !isManager;
  managerName.textContent = currentUser?.username || 'Manager';
  orderStatLabel.textContent = isManager ? '✅ LEZÁRT KISZÁLLÍTÁSOK' : '📦 RENDELÉSEK';
  incomeStatLabel.textContent = isManager ? '📈 LEZÁRT BEVÉTEL' : '💰 MAI BEVÉTEL';
  ordersTabLabel.textContent = isManager ? '📍 KISZÁLLÍTÁSOK' : '📦 MEGRENDELÉSEK';
  accountingTabLabel.textContent = isManager ? '📊 ELSZÁMOLÁS' : '💳 ELSZÁMOLÁS';
  managerCouriers.hidden = !isManager;
  orderSearch.placeholder = isManager
    ? 'Keresés cím vagy futár neve alapján...'
    : 'Megrendelések keresése cím alapján...';
  newOrderHeading.hidden = isManager;
  orderForm.hidden = isManager;
  deleteAllWrap.hidden = isManager;
  expensesPanel.hidden = isManager;
  managerSettlement.hidden = !isManager;
  ordersListHeading.textContent = isManager ? '📍 KIVITT CÍMEK' : '📋 MAI MEGRENDELÉSEK';
  orderForm.reset();
  updateColorSelection();
  accountPanel.hidden = true;
  appPanel.hidden = false;
  document.title = 'Mepper Pill V 2';
  renderAccounting();
  subscribeToOrders();
  startOrdersRefreshFallback();
}

function formatPrice(price) {
  return `${Number(price).toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('hu-HU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getPhoneHref(phone) {
  return `tel:${String(phone).trim().replace(/[^\d+]/g, '')}`;
}

function normalizeAddress(address) {
  return address.trim().replace(/\s+/g, ' ').toLocaleLowerCase('hu-HU');
}

function findSavedAddress(address) {
  const normalizedAddress = normalizeAddress(address);
  return savedAddresses.find((savedAddress) => savedAddress.key === normalizedAddress);
}

function renderSavedAddresses() {
  savedAddressList.innerHTML = '';
  savedAddresses.forEach((savedAddress) => {
    const option = document.createElement('option');
    option.value = savedAddress.address;
    savedAddressList.append(option);
  });
}

function fillSavedPhone() {
  const savedAddress = findSavedAddress(addressInput.value);
  if (savedAddress) phoneInput.value = savedAddress.phone;
}

function updateColorSelection() {
  colorInputs.forEach((input) => {
    input.closest('.color-option').classList.toggle('selected', input.checked);
  });
}

document.querySelectorAll('input, textarea, select').forEach((field) => {
  field.addEventListener('focus', () => {
    window.setTimeout(() => {
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
  });
});

async function saveAddress(address, phone) {
  const normalizedAddress = normalizeAddress(address);
  const existingAddress = savedAddresses.find((savedAddress) => savedAddress.key === normalizedAddress);

  if (existingAddress) {
    if (phone && phone !== existingAddress.phone) {
      const { error } = await supabaseClient
        .from('addresses')
        .update({ phone, updated_at: new Date().toISOString() })
        .eq('id', existingAddress.id);
      if (error) throw error;
      existingAddress.phone = phone;
    } else {
      const { error } = await supabaseClient
        .from('addresses')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existingAddress.id);
      if (error) throw error;
    }
    savedAddresses.splice(savedAddresses.indexOf(existingAddress), 1);
    savedAddresses.unshift(existingAddress);
    renderSavedAddresses();
    return existingAddress;
  }

  const { data, error } = await supabaseClient
    .from('addresses')
    .insert({ address, phone, owner_id: currentUser.id })
    .select('id, address, phone')
    .single();
  if (error) throw error;

  const savedAddress = {
    id: data.id,
    key: normalizedAddress,
    address: data.address,
    phone: data.phone || '',
    createdAt: Date.now(),
  };
  savedAddresses.unshift(savedAddress);
  renderSavedAddresses();
  return savedAddress;
}

function getVisibleOrders() {
  const searchTerm = orderSearch.value.trim().toLocaleLowerCase('hu-HU');
  const filteredOrders = orders.filter((order) => {
    const courierName = getCourierName(order.courierId).toLocaleLowerCase('hu-HU');
    const matchesSearch = order.address.toLocaleLowerCase('hu-HU').includes(searchTerm) || courierName.includes(searchTerm);
    const matchesFilter = activeFilter === 'all' || order.color === activeFilter;
    return matchesSearch && matchesFilter;
  });

  return filteredOrders.sort((first, second) => {
    if (activeSort === 'address-asc') return first.address.localeCompare(second.address, 'hu');
    if (activeSort === 'address-desc') return second.address.localeCompare(first.address, 'hu');
    if (activeSort === 'price-asc') return first.price - second.price;
    if (activeSort === 'price-desc') return second.price - first.price;
    return second.createdAt - first.createdAt;
  });
}

function getCourierName(courierId) {
  return couriers.find((courier) => courier.id === courierId)?.username || 'Ismeretlen futár';
}

function renderManagerCouriers() {
  const isManager = currentUser?.role === 'manager';
  if (!isManager) return;

  const searchTerm = orderSearch.value.trim().toLocaleLowerCase('hu-HU');
  const visibleOrders = getVisibleOrders();
  const visibleCouriers = couriers.filter((courier) => {
    const courierMatches = courier.username.toLocaleLowerCase('hu-HU').includes(searchTerm);
    const hasMatchingAddress = visibleOrders.some((order) => order.courierId === courier.id);
    return !searchTerm || courierMatches || hasMatchingAddress;
  });

  managerCourierCount.textContent = `${couriers.length} futár`;
  managerCourierList.innerHTML = visibleCouriers.length === 0
    ? '<p class="empty-state">Még nincs regisztrált futár vagy ilyen cím.</p>'
    : visibleCouriers.map((courier) => {
      const courierOrders = visibleOrders.filter((order) => order.courierId === courier.id);
      const total = courierOrders.reduce((sum, order) => sum + order.price, 0);
      return `
        <article class="manager-courier-group">
          <header class="manager-courier-group-heading">
            <h3>🚗 ${escapeHtml(courier.username)}</h3>
            <span>${courierOrders.length} cím</span>
          </header>
          <div class="manager-delivery-list">
            ${courierOrders.length === 0
              ? '<p class="manager-no-deliveries">Nincs lezárt kiszállítása.</p>'
              : courierOrders.map((order) => `
                <div class="manager-delivery-row">
                  <span>${escapeHtml(order.address)}</span>
                  <strong>${formatPrice(order.price)}</strong>
                </div>
              `).join('')}
          </div>
          <footer class="manager-courier-total">
            <span>VÉGÖSSZEG</span>
            <strong>${formatPrice(total)}</strong>
          </footer>
        </article>
      `;
    }).join('');
}

function renderOrders() {
  const visibleOrders = getVisibleOrders();
  const income = orders.reduce((sum, order) => sum + order.price, 0);
  orderCount.textContent = orders.length;
  totalIncome.textContent = formatPrice(income);
  visibleOrderCount.textContent = `${visibleOrders.length} találat`;

  if (currentUser?.role === 'manager') {
    orderList.hidden = true;
    renderManagerCouriers();
    return;
  }

  orderList.hidden = false;
  if (visibleOrders.length === 0) {
    orderList.innerHTML = '<p class="empty-state">Még nincs ilyen rendelés. Az új rendelés a fenti űrlappal vehető fel.</p>';
    return;
  }

  orderList.innerHTML = visibleOrders.map((order) => `
    <article class="order-card">
      <div class="order-card-top">
        <strong class="order-card-address">${escapeHtml(order.address)}</strong>
        <span class="order-color ${order.color === 'Fekete' ? 'order-color-black' : 'order-color-white'} ${order.checked ? 'is-color-editable' : ''}" ${order.checked ? `data-change-color="${order.id}"` : ''}><span class="color-dot ${order.color === 'Fekete' ? 'black-dot' : 'white-dot'}"></span> ${order.color.toUpperCase()}</span>
      </div>
      <p class="order-card-details">${escapeHtml(order.details || 'Nincsenek részletek')}</p>
      <div class="order-card-meta">
        <span>${order.phone ? escapeHtml(order.phone) : 'Telefon nélkül'}</span>
        <span>Hozzáadva: ${formatDate(order.createdAt)}</span>
      </div>
      <div class="order-card-price">
        <strong>${formatPrice(order.price)}</strong>
        <div class="order-actions">
          ${order.phone ? `<a class="call-button" href="${getPhoneHref(order.phone)}">☎ HÍVÁS</a>` : ''}
          <button class="delete-button" type="button" data-delete-order="${order.id}">TÖRLÉS</button>
        </div>
      </div>
    </article>
  `).join('');

}

function renderAccounting() {
  const isManager = currentUser?.role === 'manager';
  if (isManager) {
    accountingList.hidden = true;
    document.querySelector('.settlement-summary').hidden = true;
    accountingSearch.hidden = true;
    accountingCopy.textContent = 'A futárok és a papíron dolgozó munkások teljes elszámolása.';
    renderManagerSettlement();
    return;
  }

  managerSettlement.hidden = true;
  accountingList.hidden = false;
  document.querySelector('.settlement-summary').hidden = false;
  accountingSearch.hidden = false;
  const searchTerm = accountingSearch.value.trim().toLocaleLowerCase('hu-HU');
  const accountingOrders = (isManager ? orders.filter((order) => order.checked) : orders)
    .filter((order) => order.address.toLocaleLowerCase('hu-HU').includes(searchTerm));
  accountingCopy.textContent = isManager
    ? 'Kiszállított rendelések és címek áttekintése.'
    : 'Jelöld ki a címeket, amiket biztos te vittél.';
  renderSettlementSummary();

  if (accountingOrders.length === 0) {
    accountingList.innerHTML = '<p class="empty-state">Még nincs megjeleníthető rendelés.</p>';
    return;
  }

  accountingList.innerHTML = accountingOrders.map((order) => `
    <article class="accounting-order ${order.checked ? 'is-completed' : ''}">
      <div>
        <strong class="accounting-address">${escapeHtml(order.address)}</strong>
        <span class="accounting-meta"><strong class="accounting-price">${formatPrice(order.price)}</strong><span class="order-color ${order.color === 'Fekete' ? 'order-color-black' : 'order-color-white'}"><span class="color-dot ${order.color === 'Fekete' ? 'black-dot' : 'white-dot'}"></span> ${order.color.toUpperCase()}</span></span>
      </div>
      <label class="delivery-check ${order.checked ? 'is-checked' : ''}" aria-label="${order.checked ? 'Kiszállítva' : 'Nincs kiszállítva'}">
        <input type="checkbox" data-complete-order="${order.id}" ${order.checked ? 'checked' : ''} ${isManager ? 'disabled' : ''}>
        <span class="checkmark" aria-hidden="true">${order.checked ? '✓' : '✕'}</span>
      </label>
    </article>
  `).join('');
}

function renderManagerSettlement() {
  const courierEntries = couriers.map((courier) => {
    const total = orders
      .filter((order) => order.courierId === courier.id)
      .reduce((sum, order) => sum + order.price, 0);
    return { ...courier, name: courier.username, amount: total, type: 'FUTÁR' };
  });
  const workerEntries = manualWorkers.map((worker) => ({ ...worker, type: 'MUNKÁS' }));
  const entries = [...courierEntries, ...workerEntries];
  const total = entries.reduce((sum, entry) => sum + (entry.type === 'FUTÁR' && !entry.isWorking ? 0 : entry.amount), 0);

  managerSettlementCount.textContent = `${entries.length} tétel`;
  managerSettlementTotal.textContent = formatPrice(total);
  updateDailyFlow(total);
  managerSettlementList.innerHTML = entries.length === 0
    ? '<p class="empty-state">Még nincs elszámolható tétel.</p>'
    : entries.map((entry) => `
      <div class="manager-settlement-row">
        <div>
          <strong>${escapeHtml(entry.name)}</strong>
          <span>${entry.type}</span>
        </div>
        <div class="manager-settlement-actions">
          <strong>${formatPrice(entry.amount)}</strong>
          ${entry.type === 'FUTÁR'
            ? `<button class="worker-status-button ${entry.isWorking ? 'is-working' : 'is-off'}" type="button" data-toggle-courier="${entry.id}">${entry.isWorking ? 'DOLGOZIK' : 'NEM DOLGOZIK'}</button>`
            : `<button class="worker-delete-button" type="button" data-delete-worker="${entry.id}" aria-label="${escapeHtml(entry.name)} törlése">TÖRLÉS</button>`}
        </div>
      </div>
    `).join('');
}

function updateDailyFlow(settlementTotal) {
  const rawFlow = dailyFlowInput.value.trim();
  const dailyFlow = Number(rawFlow);
  dailyFlowResult.className = 'daily-flow-result';

  if (!rawFlow || !Number.isFinite(dailyFlow) || dailyFlow < 0) {
    dailyFlowResult.textContent = 'Add meg a napi folyam összegét.';
    return;
  }

  const difference = settlementTotal - dailyFlow;
  if (difference === 0) {
    dailyFlowResult.classList.add('is-balanced');
    dailyFlowResult.textContent = 'Az elszámolás rendben van.';
    return;
  }

  if (difference < 0) {
    dailyFlowResult.classList.add('is-missing');
    dailyFlowResult.textContent = `HIÁNYZIK: ${formatPrice(Math.abs(difference))}`;
    return;
  }

  dailyFlowResult.classList.add('is-surplus');
  dailyFlowResult.textContent = `TÖBBLET: ${formatPrice(difference)}`;
}

function renderSettlementSummary() {
  const checkedOrders = orders.filter((order) => order.checked);
  const blackIncome = checkedOrders
    .filter((order) => order.color === 'Fekete')
    .reduce((sum, order) => sum + order.price, 0);
  const whiteIncome = checkedOrders
    .filter((order) => order.color === 'Fehér')
    .reduce((sum, order) => sum + order.price, 0);
  const totalIncome = blackIncome + whiteIncome;
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  selectedOrderCount.textContent = checkedOrders.length;
  summaryTotal.textContent = formatPrice(totalIncome);
  summaryBlack.textContent = formatPrice(blackIncome);
  summaryWhite.textContent = formatPrice(whiteIncome);
  summaryNetBlack.textContent = formatPrice(blackIncome - totalExpenses);
  summaryNetTotal.textContent = formatPrice(totalIncome - totalExpenses);
  summaryNetAfterExpenses.textContent = formatPrice(totalIncome - totalExpenses);

  expenseList.innerHTML = expenses.length === 0
    ? '<p class="empty-state">Nincsenek költségek</p>'
    : expenses.map((expense) => `
      <div class="expense-row">
        <span>${escapeHtml(expense.name)}</span>
        <strong>${formatPrice(expense.amount)}</strong>
      </div>
    `).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character]));
}

modeButtons.forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;

  try {
    const formData = new FormData(form);
    if (form.dataset.mode === 'login') {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: formData.get('email'),
        password: formData.get('password'),
      });
      if (error) throw error;
      await loadUserData(data.user);
      openApp();
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
      email: formData.get('email'),
      password: formData.get('password'),
      options: {
        data: {
          username: formData.get('username'),
          role: formData.get('role'),
        },
      },
    });
    if (error) throw error;

    feedback.textContent = data.session
      ? 'A regisztráció sikeres. Most már bejelentkezhetsz.'
      : 'A regisztráció sikeres. Ellenőrizd az emailedet a belépéshez.';
    setMode('login');
  } catch (error) {
    const errorMessage = error.message || '';
    feedback.textContent = errorMessage.toLowerCase().includes('rate limit')
      ? 'A Supabase email-küldési korlátja betelt. Várj egy kicsit, vagy kapcsold ki ideiglenesen az email-megerősítést a Supabase Auth beállításaiban.'
      : errorMessage || 'Ismeretlen Supabase hiba történt.';
  } finally {
    submitButton.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  if (ordersChannel) {
    await supabaseClient.removeChannel(ordersChannel);
    ordersChannel = null;
  }
  if (ordersRefreshInterval) {
    window.clearInterval(ordersRefreshInterval);
    ordersRefreshInterval = null;
  }
  currentUser = null;
  orders.splice(0, orders.length);
  savedAddresses.splice(0, savedAddresses.length);
  expenses.splice(0, expenses.length);
  manualWorkers.splice(0, manualWorkers.length);
  appPanel.hidden = true;
  accountPanel.hidden = false;
  document.title = 'Mepper Pill V 2';
  setMode('login');
});

orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const orderSubmitButton = orderForm.querySelector('.order-submit');
  orderSubmitButton.disabled = true;

  try {
  const formData = new FormData(orderForm);
  const address = formData.get('address').trim().replace(/\s+/g, ' ');
  const phone = formData.get('phone').trim();
  const rawPrice = String(formData.get('price') || '').trim();
  const price = Number(rawPrice);

  if (!address) {
    showToast('A cím megadása kötelező.', 'error');
    return;
  }

  if (!rawPrice || !Number.isFinite(price) || price < 0) {
    showToast('Adj meg érvényes, nem negatív árat.', 'error');
    return;
  }

  const savedAddress = await saveAddress(address, phone);
  const { error } = await supabaseClient.from('orders').insert({
    address_id: savedAddress.id,
    courier_id: currentUser.id,
    address_snapshot: address,
    phone_snapshot: phone,
    color: formData.get('color') === 'Fehér' ? 'white' : 'black',
    details: formData.get('details'),
    price,
    status: 'new',
    checked: false,
  });
  if (error) throw error;

  orderForm.reset();
  updateColorSelection();
  await loadUserData({ id: currentUser.id });
  showToast('A rendelés sikeresen mentve.', 'success');
  } catch (error) {
    showToast(error.message || 'A rendelés mentése nem sikerült.', 'error');
    feedback.textContent = error.message || 'A rendelés mentése nem sikerült.';
  } finally {
    orderSubmitButton.disabled = false;
  }
});

function closeColorChangeModal() {
  colorChangeOrderId = null;
  colorChangeModal.hidden = true;
}

function openColorChangeModal(orderId) {
  colorChangeOrderId = orderId;
  colorChangeCopy.textContent = 'A rendelés automatikusan a másik színre vált. Folytatod?';
  colorChangeModal.hidden = false;
  colorChangeConfirm.focus();
}

colorChangeCancel.addEventListener('click', closeColorChangeModal);

colorChangeConfirm.addEventListener('click', async () => {
  if (!colorChangeOrderId) return;
  colorChangeConfirm.disabled = true;
  const order = orders.find((item) => item.id === colorChangeOrderId);
  const nextColor = order?.color === 'Fekete' ? 'white' : 'black';
  const { error } = await supabaseClient
    .from('orders')
    .update({ color: nextColor })
    .eq('id', colorChangeOrderId)
    .eq('courier_id', currentUser.id);

  if (error) {
    showToast(error.message || 'A rendelés színének módosítása nem sikerült.', 'error');
    colorChangeConfirm.disabled = false;
    return;
  }

  closeColorChangeModal();
  colorChangeConfirm.disabled = false;
  await loadUserData({ id: currentUser.id });
  showToast('A rendelés színe módosítva.', 'success');
});

accountingList.addEventListener('change', async (event) => {
  const checkbox = event.target.closest('[data-complete-order]');
  if (!checkbox || currentUser?.role === 'manager') return;

  checkbox.disabled = true;
  const nextStatus = checkbox.checked ? 'completed' : 'active';
  const { error } = await supabaseClient
    .from('orders')
    .update({ status: nextStatus, checked: checkbox.checked })
    .eq('id', checkbox.dataset.completeOrder)
    .eq('courier_id', currentUser.id);

  if (error) {
    checkbox.checked = !checkbox.checked;
    checkbox.disabled = false;
    feedback.textContent = error.message || 'A rendelés állapotának mentése nem sikerült.';
    return;
  }

  await loadUserData({ id: currentUser.id });
});

orderList.addEventListener('click', (event) => {
  const changeColorButton = event.target.closest('[data-change-color]');
  if (!changeColorButton || currentUser?.role === 'manager') return;

  event.preventDefault();
  event.stopPropagation();
  openColorChangeModal(changeColorButton.dataset.changeColor);
});

addressInput.addEventListener('input', fillSavedPhone);
addressInput.addEventListener('change', fillSavedPhone);
colorInputs.forEach((input) => input.addEventListener('change', updateColorSelection));

orderList.addEventListener('click', async (event) => {
  const deleteButton = event.target.closest('[data-delete-order]');
  if (!deleteButton) return;

  deleteButton.disabled = true;
  const { error } = await supabaseClient
    .from('orders')
    .delete()
    .eq('id', deleteButton.dataset.deleteOrder);
  if (!error) {
    const orderIndex = orders.findIndex((order) => order.id === deleteButton.dataset.deleteOrder);
    if (orderIndex !== -1) orders.splice(orderIndex, 1);
    renderOrders();
  }
});

deleteAllButton.addEventListener('click', () => {
  deleteAllConfirm.hidden = false;
  deleteAllInput.value = '';
  deleteAllFeedback.textContent = '';
  deleteAllInput.focus();
});

deleteAllFinal.addEventListener('click', async () => {
  if (deleteAllInput.value.trim().toUpperCase() !== 'IGEN') {
    deleteAllFeedback.textContent = 'A törléshez pontosan ezt kell beírni: IGEN.';
    return;
  }

  deleteAllFinal.disabled = true;
  const { error } = await supabaseClient
    .from('orders')
    .delete()
    .eq('courier_id', currentUser.id);

  if (error) {
    deleteAllFeedback.textContent = error.message || 'A rendelések törlése nem sikerült.';
    deleteAllFinal.disabled = false;
    return;
  }

  deleteAllConfirm.hidden = true;
  deleteAllFinal.disabled = false;
  await loadUserData({ id: currentUser.id });
});

orderSearch.addEventListener('input', renderOrders);
accountingSearch.addEventListener('input', renderAccounting);

expenseForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(expenseForm);
  const name = formData.get('name').trim();
  const rawAmount = String(formData.get('amount') || '').trim();
  const amount = Number(rawAmount);

  if (!name) {
    showToast('A költség nevének megadása kötelező.', 'error');
    return;
  }
  if (!rawAmount || !Number.isFinite(amount) || amount < 0) {
    showToast('Adj meg érvényes, nem negatív költséget.', 'error');
    return;
  }

  const expenseSubmit = expenseForm.querySelector('button');
  expenseSubmit.disabled = true;
  expenses.unshift({ id: `${Date.now()}-${Math.random()}`, name, amount });

  expenseForm.reset();
  renderSettlementSummary();
  showToast('A költség sikeresen mentve.', 'success');
  expenseSubmit.disabled = false;
});

manualWorkerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(manualWorkerForm);
  const name = String(formData.get('name') || '').trim();
  const rawAmount = String(formData.get('amount') || '').trim();
  const amount = Number(rawAmount);

  if (!name || !rawAmount || !Number.isFinite(amount) || amount < 0) {
    showToast('Adj meg érvényes nevet és nem negatív összeget.', 'error');
    return;
  }

  manualWorkers.push({ id: `${Date.now()}-${Math.random()}`, name, amount });
  manualWorkerForm.reset();
  renderManagerSettlement();
  showToast('A munkás hozzáadva az elszámoláshoz.', 'success');
});

dailyFlowInput.addEventListener('input', renderManagerSettlement);

managerSettlementList.addEventListener('click', (event) => {
  const toggleButton = event.target.closest('[data-toggle-courier]');
  if (toggleButton) {
    const courier = couriers.find((item) => item.id === toggleButton.dataset.toggleCourier);
    if (!courier) return;
    courier.isWorking = !courier.isWorking;
    renderManagerSettlement();
    return;
  }

  const deleteButton = event.target.closest('[data-delete-worker]');
  if (!deleteButton) return;
  const workerIndex = manualWorkers.findIndex((worker) => worker.id === deleteButton.dataset.deleteWorker);
  if (workerIndex === -1) return;
  manualWorkers.splice(workerIndex, 1);
  renderManagerSettlement();
  showToast('A munkás törölve az elszámolásból.', 'success');
});

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((filterButton) => filterButton.classList.toggle('active', filterButton === button));
    renderOrders();
  });
});

sortButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activeSort = button.dataset.sort;
    sortButtons.forEach((sortButton) => sortButton.classList.toggle('active', sortButton === button));
    renderOrders();
  });
});

tabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const showingOrders = button.dataset.tab === 'orders';
    ordersView.hidden = !showingOrders;
    accountingView.hidden = showingOrders;
    if (!showingOrders) renderAccounting();
    tabButtons.forEach((tabButton) => {
      const isActive = tabButton === button;
      tabButton.classList.toggle('active', isActive);
      tabButton.setAttribute('aria-selected', isActive);
    });
  });
});

async function restoreSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) return;

  try {
    await loadUserData(data.session.user);
    openApp();
  } catch (error) {
    feedback.textContent = error.message || 'A munkamenet betöltése nem sikerült.';
  }
}

function subscribeToOrders() {
  if (ordersChannel) return;

  ordersChannel = supabaseClient
    .channel('orders-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
      if (!currentUser) return;
      try {
        await loadUserData({ id: currentUser.id });
      } catch (error) {
        console.error('Realtime rendelésfrissítés sikertelen:', error);
      }
    })

    .subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        console.info('Orders realtime kapcsolat aktív.');
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('Orders realtime kapcsolat hibás:', error || status);
      }
    });
}

function startOrdersRefreshFallback() {
  if (ordersRefreshInterval) return;

  ordersRefreshInterval = window.setInterval(async () => {
    if (!currentUser || isRefreshingOrders) return;
    isRefreshingOrders = true;
    try {
      await loadUserData({ id: currentUser.id });
    } catch (error) {
      console.error('Automatikus rendelésfrissítés sikertelen:', error);
    } finally {
      isRefreshingOrders = false;
    }
  }, 2000);
}

renderOrders();
updateColorSelection();
restoreSession();
