// ============================================================
//  app.js — Cầu Lông Pro · Main Application Logic
// ============================================================

// ======================== 1. Constants & State ==============================
let mode = 'home';
let isCauDetailMode = false;
let moneyHistory = { 'tienSan': [], 'tienCau': [] };
let isPublicMode = new URLSearchParams(window.location.search).get('public') === 'true';
let currentSplitMethod = 'nam20k';
let isShowingQR = false;
let customCount = { nam: 1, nu: 1 };
let promptResolve;
let lastTeleStr = '';
let currentReceiptData = null;
let currentReceiptMode = 'home';
let currentView = 'dashboard';
let currentSessionId = null;
let toastTimer = null;
let lastFocusedElement = null;
let imgPreviewUrl = null;

// ======================== 2. Utility Functions ==============================

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function sanitizeStoredHTML(value) {
  const template = document.createElement('template');
  template.innerHTML = String(value || '');
  template.content.querySelectorAll('script, iframe, object, embed, link, meta, form').forEach(node => node.remove());
  template.content.querySelectorAll('*').forEach(node => {
    [...node.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const attrValue = attribute.value.trim().toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'src') && attrValue.startsWith('javascript:'))) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return template.innerHTML;
}

function setOverlayState(overlay, isOpen) {
  if (!overlay) return;
  overlay.classList.toggle('show', isOpen);
  overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  document.body.style.overflow = isOpen || document.querySelector('.sheet-overlay.show, .settings-overlay.show, .custom-modal-overlay.show, .profile-overlay.show') ? 'hidden' : '';
  if (isOpen) {
    lastFocusedElement = document.activeElement;
    const focusable = overlay.querySelector('button, input, select, [tabindex]:not([tabindex="-1"])');
    if (focusable) setTimeout(() => focusable.focus(), 50);
  } else if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

function triggerHaptic(type = 'light') {
  if (!navigator.vibrate) return;
  try {
    if (type === 'light') navigator.vibrate(10);
    else if (type === 'heavy') navigator.vibrate(30);
    else if (type === 'success') navigator.vibrate([15, 50, 20]);
  } catch (e) {}
}

function showToast(message, duration) {
  let toast = document.getElementById('toast');
  if(toast) {
    clearTimeout(toastTimer);
    toast.innerText = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), duration || 2500);
  }
}

function formatCurrency(input) {
  let v = input.value.replace(/\D/g, '');
  input.value = v ? Calculator.formatCurrencyValue(parseInt(v, 10)) : "";
  updateLiveSummary();
}

function formatMoney(n) {
  return typeof Calculator !== 'undefined' ? Calculator.formatMoney(n) : n;
}

function parseMoney(str) {
  return typeof Calculator !== 'undefined' ? Calculator.parseMoney(str) : 0;
}

function handleInputFocus(el) {
  if (el.value === '0') { el.value = ''; }
  setTimeout(function () { el.selectionStart = el.selectionEnd = el.value.length; }, 10);
}

function validateInputEmpty(el) {
  let v = el.value.replace(/\D/g, '');
  el.value = v ? Calculator.formatCurrencyValue(parseInt(v, 10)) : '';
  updateLiveSummary();
}

function validateInputZero(el) {
  let v = el.value.replace(/\D/g, '');
  if (v === '' || isNaN(parseInt(v, 10))) { el.value = '0'; }
  else { el.value = parseInt(v, 10).toString(); }
  updateLiveSummary();
}

function applyTheme(theme) {
  const selected = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = selected;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', selected === 'dark' ? '#07111f' : '#f7f9fb');
  if (typeof Storage !== 'undefined') Storage.setTheme(selected);
  const button = document.getElementById('themeBtn');
  if (button) {
    button.setAttribute('aria-label', selected === 'dark' ? 'Bật giao diện sáng' : 'Bật giao diện tối');
    button.title = selected === 'dark' ? 'Giao diện sáng' : 'Giao diện tối';
  }
}

function toggleTheme() {
  triggerHaptic('light');
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

function updateLiveSummary() {
  const costEl = document.getElementById('liveTotalCost');
  const playerEl = document.getElementById('livePlayerCount');
  if (!costEl || !playerEl) return;
  const courtCost = parseMoney(document.getElementById('tienSan')?.value || '');
  const shuttleCost = isCauDetailMode
    ? [...document.querySelectorAll('.cau-item')].reduce((total, item) => {
        const tube = parseMoney(item.querySelector('.giaCau')?.value || '');
        const count = parseInt(item.querySelector('.slCau')?.value || '0', 10) || 0;
        return total + Math.round((tube / 12) * count);
      }, 0)
    : parseMoney(document.getElementById('tienCau')?.value || '');
  const fixedCount = mode === 'home' ? document.querySelectorAll('#tagsGrid .player-tag.active').length : 0;
  const guestCount = ['namGL', 'nuGL', ...(mode === 'away' && currentSplitMethod === 'sanNha' ? ['namCD', 'nuCD'] : [])]
    .reduce((sum, id) => sum + (parseInt(document.getElementById(id)?.value || '0', 10) || 0), 0);
  costEl.textContent = formatMoney(courtCost + shuttleCost);
  playerEl.textContent = String(fixedCount + guestCount);
}

function updateDateDisplay(val) {
  if (!val) return;
  let parts = val.split('-');
  let displayDate = document.getElementById('displayDate');
  if(displayDate) {
    displayDate.innerText = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
}

// ======================== 3. Main Tab Switching ==============================

function switchMainTab(tab) {
  triggerHaptic('light');
  currentView = tab;
  document.body.classList.toggle('calc-mode', tab === 'calc');
  
  let tDash = document.getElementById('mainTabDashboard');
  let tCalc = document.getElementById('mainTabCalc');
  let dashView = document.getElementById('dashboardView');
  let calcView = document.getElementById('calcView');
  let resetBtn = document.getElementById('resetBtn');
  let dateChip = document.getElementById('dateChip');
  let exportBtn = document.getElementById('exportBtn');
  let qrSettingsBtn = document.getElementById('qrSettingsBtn');
  let headerBackBtn = document.getElementById('headerBackBtn');

  if(tDash) tDash.setAttribute('aria-selected', tab === 'dashboard' ? 'true' : 'false');
  if(tCalc) tCalc.setAttribute('aria-selected', tab === 'calc' ? 'true' : 'false');
  if(dashView) dashView.setAttribute('aria-hidden', tab === 'dashboard' ? 'false' : 'true');
  if(calcView) calcView.setAttribute('aria-hidden', tab === 'calc' ? 'false' : 'true');

  if (tab === 'dashboard') {
    if(tDash) tDash.classList.add('active');
    if(tCalc) tCalc.classList.remove('active');
    if(dashView) dashView.style.display = 'flex';
    if(calcView) calcView.style.display = 'none';
    if(resetBtn) resetBtn.style.display = 'none';
    if(dateChip) dateChip.style.display = 'none';
    if(headerBackBtn) headerBackBtn.style.display = 'none';
    if(exportBtn) exportBtn.style.display = '';
    if(qrSettingsBtn) qrSettingsBtn.style.display = '';
    refreshDashboard();
  } else {
    if(tCalc) tCalc.classList.add('active');
    if(tDash) tDash.classList.remove('active');
    if(dashView) dashView.style.display = 'none';
    if(calcView) calcView.style.display = 'flex';
    if(resetBtn) resetBtn.style.display = '';
    if(dateChip) dateChip.style.display = '';
    if(headerBackBtn) headerBackBtn.style.display = 'inline-flex';
    if(exportBtn) exportBtn.style.display = 'none';
    if(qrSettingsBtn) qrSettingsBtn.style.display = 'none';
    updateLiveSummary();
  }
}

function startNewSession() {
  switchMainTab('calc');
  resetForm(true);
  
  let today = new Date();
  let local = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
  let dateStr = local.toISOString().split('T')[0];
  let dateInput = document.getElementById('dateInput');
  if(dateInput) {
    dateInput.value = dateStr;
    updateDateDisplay(dateStr);
  }
  currentSessionId = null;
}

function backToDashboard() {
  switchMainTab('dashboard');
}

// ======================== 4. Dashboard Functions ==============================

async function refreshDashboard() {
  if (typeof Storage === 'undefined' || !Storage.getStats) return;
  try {
    const sessions = await Storage.getAllSessions();
    const stats = await Storage.getStats(sessions);
    animateCounter('statTotalSessions', stats.totalSessions);
    animateCounter('statUnpaidTotal', stats.unpaidTotal);
    animateCounter('statUnpaidCount', stats.unpaidCount);
    animateCounter('statMemberCount', stats.memberCount);
    renderSessionCards(sessions);
    renderDashboardMembers();
  } catch (error) {
    showToast('Không thể đọc dữ liệu trên thiết bị này. Hãy thử tải lại trang.');
  }
}

function animateCounter(elementId, targetValue, prefix = '', suffix = '') {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.innerText = elementId === 'statUnpaidTotal'
    ? formatMoney(targetValue)
    : prefix + targetValue + suffix;
}

function createBadge(text, className) {
  const badge = document.createElement('span');
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

function renderSessionCards(sessions) {
  const container = document.getElementById('sessionsList');
  if (!container) return;
  
  if (!sessions || sessions.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-text"><strong>Chưa có buổi chơi nào</strong><br>Buổi đầu tiên sẽ xuất hiện ở đây sau khi bạn chia chi phí.</div></div>';
    return;
  }
  
  // Sort by date desc
  sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  container.replaceChildren();
  sessions.forEach(session => {
    const players = Array.isArray(session.players) ? session.players : [];
    const card = document.createElement('article');
    card.className = 'session-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Mở buổi ${session.dateDisplay || ''}, ${formatMoney(Number(session.totalCost) || 0)}`);
    card.addEventListener('click', () => openSessionDetail(session.id));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openSessionDetail(session.id); }
    });

    const header = document.createElement('div');
    header.className = 'session-card-header';
    const date = document.createElement('div');
    date.className = 'session-card-date';
    date.textContent = session.dateDisplay || session.date || 'Không rõ ngày';
    const badges = document.createElement('div');
    badges.className = 'session-card-badges';
    badges.append(createBadge(session.mode === 'home' ? 'Sân nhà' : 'Sân khách', session.mode === 'home' ? 'badge-home' : 'badge-away'));
    badges.append(createBadge(session.status === 'open' ? 'Đang mở' : 'Đã chốt', session.status === 'open' ? 'badge-open' : 'badge-closed'));
    const unpaidCount = session.status === 'open'
      ? players.reduce((sum, player) => sum + (!player.paid ? Math.max(1, Number(player.count) || 1) : 0), 0)
      : 0;
    if (unpaidCount) badges.append(createBadge(`Thiếu ${unpaidCount}`, 'badge-unpaid'));
    header.append(date, badges);

    const body = document.createElement('div');
    body.className = 'session-card-body';
    const total = document.createElement('div');
    total.className = 'session-card-total';
    total.textContent = formatMoney(Number(session.totalCost) || 0);
    const count = document.createElement('div');
    count.className = 'session-card-players';
    const playerCount = players.reduce((sum, player) => sum + Math.max(1, Number(player.count) || 1), 0);
    count.textContent = `${playerCount} người chơi`;
    body.append(total, count);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn-delete-session';
    remove.setAttribute('aria-label', `Xóa buổi ${date.textContent}`);
    remove.textContent = '✕';
    remove.addEventListener('click', event => { event.stopPropagation(); deleteSessionCard(session.id); });
    card.append(header, body, remove);
    container.append(card);
  });
}

function renderDashboardMembers() {
  const container = document.getElementById('dashboardMemberTags');
  if (!container) return;
  
  const members = typeof Storage !== 'undefined' ? Storage.getMembers() : [];
  if (!members || members.length === 0) {
    container.innerHTML = '<div style="font-size:12px; color:var(--text-sub);">Chưa có thành viên nào.</div>';
    return;
  }
  
  container.replaceChildren();
  members.forEach(member => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dash-member-chip';
    button.addEventListener('click', () => openProfile(member.name));
    const avatar = document.createElement('span');
    avatar.className = 'dash-member-avatar';
    avatar.textContent = member.emoji || (member.gender === 'nu' ? '👩🏻‍💼' : '🤵🏻‍♂️');
    const name = document.createElement('span');
    name.textContent = member.name;
    button.append(avatar, name);
    container.append(button);
  });
}

// ======================== 5. Tab Switching (Home/Away) ==============================

function switchTab(selected) {
  if (mode === selected || isPublicMode) return;
  triggerHaptic('light');
  mode = selected;
  let ind = document.getElementById('tabIndicator');
  let tHome = document.getElementById('tabHome');
  let tAway = document.getElementById('tabAway');
  let fTeam = document.getElementById('fixedTeamWrap');
  let gTitle = document.getElementById('guestTitle');
  let fpWrap = document.getElementById('sanNhaConfigWrap');

  if(tHome) tHome.setAttribute('aria-selected', selected === 'home' ? 'true' : 'false');
  if(tAway) tAway.setAttribute('aria-selected', selected === 'away' ? 'true' : 'false');

  if (selected === 'home') {
    if(ind) ind.style.transform = 'translateX(0)';
    if(tHome) tHome.classList.add('active');
    if(tAway) tAway.classList.remove('active');
    if(fTeam) fTeam.classList.remove('hidden');
    if(gTitle) gTitle.innerText = "KHÁCH GIAO LƯU";
    
    let splitMethod = document.getElementById('splitMethodContainer');
    if(splitMethod) splitMethod.style.display = 'none';
    
    let nuCoDinhWrap = document.getElementById('nuCoDinhWrap');
    if(nuCoDinhWrap) nuCoDinhWrap.style.display = 'none';
    
    let namCoDinhWrap = document.getElementById('namCoDinhWrap');
    if(namCoDinhWrap) namCoDinhWrap.style.display = 'none';
    
    let nuCoDinhWrap2 = document.getElementById('nuCoDinhWrap2');
    if(nuCoDinhWrap2) nuCoDinhWrap2.style.display = 'none';
    
    let labelNamGL = document.getElementById('labelNamGL');
    if(labelNamGL) labelNamGL.innerText = "🤵🏻‍♂️ Số Nam";
    
    let labelNuGL = document.getElementById('labelNuGL');
    if(labelNuGL) labelNuGL.innerText = "👩🏻‍💼 Số Nữ";
    
    if (fpWrap) fpWrap.style.display = '';
  } else {
    if(ind) ind.style.transform = 'translateX(100%)';
    if(tAway) tAway.classList.add('active');
    if(tHome) tHome.classList.remove('active');
    if(fTeam) fTeam.classList.add('hidden');
    if(gTitle) gTitle.innerText = "THÔNG TIN NGƯỜI CHƠI";
    
    let splitMethod = document.getElementById('splitMethodContainer');
    if(splitMethod) splitMethod.style.display = 'flex';
    
    if (fpWrap) fpWrap.style.display = 'none';

    let nuCoDinhWrap = document.getElementById('nuCoDinhWrap');
    if(nuCoDinhWrap) nuCoDinhWrap.style.display = currentSplitMethod === 'nuCoDinh' ? 'flex' : 'none';
    let namCoDinhWrap = document.getElementById('namCoDinhWrap');
    if(namCoDinhWrap) namCoDinhWrap.style.display = currentSplitMethod === 'sanNha' ? 'flex' : 'none';
    let nuCoDinhWrap2 = document.getElementById('nuCoDinhWrap2');
    if(nuCoDinhWrap2) nuCoDinhWrap2.style.display = currentSplitMethod === 'sanNha' ? 'flex' : 'none';
  }
  updateLiveSummary();
}

// ======================== 6. Dropdown ==============================

function toggleDropdown() {
  triggerHaptic('light');
  let wrapper = document.getElementById('customSelectWrapper');
  if(wrapper) {
    wrapper.classList.toggle('open');
    wrapper.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', wrapper.classList.contains('open') ? 'true' : 'false');
  }
}

function selectMethod(value, text) {
  triggerHaptic('light');
  currentSplitMethod = value;
  
  let splitMethodText = document.getElementById('splitMethodText');
  if(splitMethodText) splitMethodText.innerText = text;
  
  let wrapper = document.getElementById('customSelectWrapper');
  if(wrapper) {
    wrapper.classList.remove('open');
    wrapper.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
  }

  ['nam20k', 'chiaDeu', 'nuCoDinh', 'sanNha'].forEach(v => {
    let opt = document.getElementById('opt-' + v);
    if (opt) opt.classList.remove('selected');
  });
  
  let selectedOpt = document.getElementById('opt-' + value);
  if(selectedOpt) selectedOpt.classList.add('selected');

  let nuCoDinhWrap = document.getElementById('nuCoDinhWrap');
  if(nuCoDinhWrap) {
    if (value === 'nuCoDinh') {
      nuCoDinhWrap.style.display = 'flex';
    } else {
      nuCoDinhWrap.style.display = 'none';
    }
  }

  let namCoDinhWrap = document.getElementById('namCoDinhWrap');
  if(namCoDinhWrap) namCoDinhWrap.style.display = value === 'sanNha' ? 'flex' : 'none';
  
  let nuCoDinhWrap2 = document.getElementById('nuCoDinhWrap2');
  if(nuCoDinhWrap2) nuCoDinhWrap2.style.display = value === 'sanNha' ? 'flex' : 'none';
  
  let labelNamGL = document.getElementById('labelNamGL');
  if(labelNamGL) labelNamGL.innerText = "🤵🏻‍♂️ Số Nam";
  
  let labelNuGL = document.getElementById('labelNuGL');
  if(labelNuGL) labelNuGL.innerText = "👩🏻‍💼 Số Nữ";
  updateLiveSummary();
}

// ======================== 7. Cau Detail ==============================

function toggleCauMode() {
  triggerHaptic('light');
  let toggle = document.getElementById('cauToggleSwitch');
  isCauDetailMode = toggle ? toggle.checked : false;
  
  let m1 = document.getElementById('cauMode1Wrap');
  let m2 = document.getElementById('cauMode2Wrap');
  if(!m1 || !m2) return;
  
  let inner1 = m1.querySelector('.mode-inner');
  let inner2 = m2.querySelector('.mode-inner');
  
  if (isCauDetailMode) {
    m1.style.gridTemplateRows = '0fr'; if(inner1) inner1.style.opacity = '0';
    m2.style.gridTemplateRows = '1fr'; if(inner2) inner2.style.opacity = '1';
  } else {
    m2.style.gridTemplateRows = '0fr'; if(inner2) inner2.style.opacity = '0';
    m1.style.gridTemplateRows = '1fr'; if(inner1) inner1.style.opacity = '1';
  }
  updateLiveSummary();
}

function addCauRow() {
  triggerHaptic('light');
  let container = document.getElementById('cauListContainer');
  if(!container) return;
  
  let row = document.createElement('div');
  row.className = 'cau-detail-flex cau-item anim-pop';
  row.innerHTML = `
      <div class="cau-col">
        <span>GIÁ 1 TÚP (12 QUẢ)</span>
        <input type="text" class="giaCau" placeholder="0 ₫" inputmode="numeric" pattern="[0-9]*" onfocus="handleInputFocus(this)" onblur="validateInputEmpty(this)" oninput="formatCurrency(this); updateCauTotal();">
      </div>
      <div class="divider-vert"></div>
      <div class="cau-col">
        <span>SỐ QUẢ</span>
        <input type="text" class="slCau" placeholder="0" inputmode="numeric" pattern="[0-9]*" onfocus="handleInputFocus(this)" onblur="validateInputZero(this)" oninput="updateCauTotal();">
      </div>
      <div class="cau-action-col">
        <button type="button" class="btn-remove-cau" onclick="triggerHaptic('heavy'); this.closest('.cau-item').remove(); updateCauTotal();">✕</button>
      </div>
  `;
  container.appendChild(row);
  updateLiveSummary();
}

function updateCauTotal() {
  if(typeof Calculator === 'undefined') return 0;
  
  let items = [];
  document.querySelectorAll('.cau-item').forEach(item => {
    let giaInput = item.querySelector('.giaCau');
    let slInput = item.querySelector('.slCau');
    if(!giaInput || !slInput) return;
    
    let giaTup = parseMoney(giaInput.value);
    let soQuaStr = slInput.value.replace(/[^0-9]/g, '');
    if (soQuaStr !== slInput.value) slInput.value = soQuaStr;
    let soQua = parseInt(soQuaStr, 10) || 0;
    items.push({ giaTup, soQua });
  });
  
  let result = Calculator.calcCauDetail(items);
  let ind = document.getElementById('cauTotalIndicator');
  if(ind) ind.innerText = "Thành tiền: " + formatMoney(result.total);
  updateLiveSummary();
  return result.total;
}

// ======================== 8. Money Chips ==============================

function addMoney(id, amount) {
  triggerHaptic('light');
  let el = document.getElementById(id);
  if(!el) return;
  
  let currentVal = parseMoney(el.value);
  if (!moneyHistory[id]) moneyHistory[id] = [];
  moneyHistory[id].push(currentVal);
  
  el.value = (currentVal + amount).toString();
  formatCurrency(el);
  
  let undoBtn = document.getElementById('undo_' + id);
  if (undoBtn) undoBtn.classList.remove('disabled');
  if (id === 'giaCau') updateCauTotal();
  updateLiveSummary();
}

function clearMoney(id) {
  triggerHaptic('heavy');
  let el = document.getElementById(id);
  if(!el) return;
  
  let currentVal = parseMoney(el.value);
  if (currentVal === 0) return;
  
  if (!moneyHistory[id]) moneyHistory[id] = [];
  moneyHistory[id].push(currentVal);
  
  el.value = '';
  
  let undoBtn = document.getElementById('undo_' + id);
  if (undoBtn) undoBtn.classList.remove('disabled');
  if (id === 'giaCau') updateCauTotal();
  updateLiveSummary();
}

function undoMoney(id) {
  triggerHaptic('light');
  if (!moneyHistory[id] || moneyHistory[id].length === 0) return;
  
  let el = document.getElementById(id);
  if(!el) return;
  
  let lastVal = moneyHistory[id].pop();
  if (lastVal === 0) el.value = '';
  else { el.value = lastVal.toString(); formatCurrency(el); }
  
  if (moneyHistory[id].length === 0) {
    let undoBtn = document.getElementById('undo_' + id);
    if (undoBtn) undoBtn.classList.add('disabled');
  }
  if (id === 'giaCau') updateCauTotal();
  updateLiveSummary();
}

function clearUndo(id) {
  if (!moneyHistory[id]) moneyHistory[id] = [];
  moneyHistory[id] = [];
  let undoBtn = document.getElementById('undo_' + id);
  if (undoBtn) undoBtn.classList.add('disabled');
}

// ======================== 9. Stepper ==============================

function stepVal(id, step) {
  triggerHaptic('light');
  let el = document.getElementById(id);
  if(!el) return;
  
  let val = (parseInt(el.value, 10) || 0) + step;
  if (val < 0) val = 0;
  el.value = val;
  updateLiveSummary();
}

// ======================== 10. Custom Prompt ==============================

function openCustomPrompt(title, defaultText) {
  return new Promise(resolve => {
    triggerHaptic('light');
    promptResolve = resolve;
    
    let titleEl = document.getElementById('customPromptTitle');
    if(titleEl) titleEl.innerText = title;
    
    let input = document.getElementById('customPromptInput');
    if(input) {
      input.value = '';
      input.placeholder = `Vd: ${defaultText}`;
      input.onkeydown = function (e) {
        if (e.key === 'Enter') closeCustomPrompt(true);
      };
    }
    
    let overlay = document.getElementById('customPromptOverlay');
    setOverlayState(overlay, true);
  });
}

function closeCustomPrompt(isConfirm) {
  triggerHaptic('light');
  let overlay = document.getElementById('customPromptOverlay');
  setOverlayState(overlay, false);
  
  if (isConfirm) {
    let input = document.getElementById('customPromptInput');
    promptResolve(input ? input.value : '');
  } else {
    promptResolve(null);
  }
}

// ======================== 11. Members ==============================

function renderMembersFromStorage() {
  if(typeof Storage === 'undefined') return;
  let members = Storage.getMembers();
  let grid = document.getElementById('tagsGrid');
  if(!grid) return;
  
  grid.replaceChildren();
  members.forEach(member => grid.appendChild(createMemberTag(member)));
}

function createMemberTag(member) {
  const tag = document.createElement('div');
  tag.className = `player-tag${member.active !== false ? ' active' : ''}${member.isDefault === false ? ' custom-tag' : ''}`;
  tag.tabIndex = 0;
  tag.setAttribute('role', 'button');
  tag.setAttribute('aria-pressed', member.active !== false ? 'true' : 'false');
  tag.dataset.name = member.name;
  tag.dataset.gender = member.gender;
  tag.dataset.default = member.isDefault === false ? 'false' : 'true';
  tag.dataset.emoji = member.emoji || (member.gender === 'nu' ? '👩🏻‍💼' : '🤵🏻‍♂️');

  const name = document.createElement('span');
  name.textContent = member.name;
  tag.appendChild(name);

  if (member.isDefault === false) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'member-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Xóa thành viên ${member.name}`);
    remove.addEventListener('click', event => {
      event.stopPropagation();
      removeMember(tag);
    });
    tag.appendChild(remove);
  }

  let pressTimer = null;
  let openedProfile = false;
  const startPress = () => {
    openedProfile = false;
    pressTimer = setTimeout(() => {
      openedProfile = true;
      openProfile(member.name);
    }, 550);
  };
  const stopPress = () => clearTimeout(pressTimer);
  tag.addEventListener('pointerdown', startPress);
  tag.addEventListener('pointerup', stopPress);
  tag.addEventListener('pointerleave', stopPress);
  tag.addEventListener('click', () => {
    if (openedProfile) { openedProfile = false; return; }
    toggleTag(tag);
  });
  tag.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTag(tag);
    }
  });
  return tag;
}

function saveMembersState() {
  let members = [];
  document.querySelectorAll('#tagsGrid .player-tag').forEach(tag => {
    members.push({
      name: tag.getAttribute('data-name'),
      gender: tag.getAttribute('data-gender'),
      isDefault: tag.dataset.default !== 'false',
      active: tag.classList.contains('active'),
      emoji: tag.dataset.emoji
    });
  });
  if(typeof Storage !== 'undefined') Storage.saveMembers(members);
}

function toggleTag(el) {
  triggerHaptic('light');
  el.classList.toggle('active');
  el.setAttribute('aria-pressed', el.classList.contains('active') ? 'true' : 'false');
  saveMembersState();
  updateLiveSummary();
}

function removeMember(tag) {
  const name = tag.dataset.name || 'này';
  if (!confirm(`Xóa ${name} khỏi danh sách thành viên?`)) return;
  triggerHaptic('heavy');
  tag.remove();
  saveMembersState();
  updateLiveSummary();
  showToast(`Đã xóa ${name}.`);
}

async function addCustomMember(gender) {
  let defaultText = gender === 'nam' ? 'Nam' : 'Nữ';
  if (customCount[gender] > 1) {
    defaultText += ' ' + customCount[gender];
  }
  let promptMsg = gender === 'nam' ? 'Thêm Nam cố định' : 'Thêm Nữ cố định';
  let name = await openCustomPrompt(promptMsg, defaultText);
  if (name === null) return;

  let finalName = name.trim();
  if (finalName === "") {
    finalName = defaultText;
    customCount[gender]++;
  }

  const existingNames = [...document.querySelectorAll('#tagsGrid .player-tag')]
    .map(tag => (tag.dataset.name || '').toLocaleLowerCase('vi'));
  if (existingNames.includes(finalName.toLocaleLowerCase('vi'))) {
    showToast('Tên này đã có trong danh sách.');
    return;
  }

  let grid = document.getElementById('tagsGrid');
  if(!grid) return;
  
  let newTag = createMemberTag({
    name: finalName,
    gender,
    isDefault: false,
    active: true,
    emoji: gender === 'nu' ? '👩🏻‍💼' : '🤵🏻‍♂️'
  });
  newTag.classList.add('anim-pop');
  grid.appendChild(newTag);
  saveMembersState();
  updateLiveSummary();
  showToast(`Đã thêm ${finalName}.`);
}

// ======================== 12. Sân Nhà Config ==============================

function toggleSanNhaNuGL() {
  triggerHaptic('light');
  let toggle = document.getElementById('sanNhaNuGLToggle');
  let isNuGL = toggle ? toggle.checked : false;
  
  let nuGLWrap = document.getElementById('sanNhaNuGLInputWrap');
  let namHonNuWrap = document.getElementById('sanNhaNamHonNuWrap');
  
  if (isNuGL) {
    if(nuGLWrap) nuGLWrap.style.display = 'flex';
    if(namHonNuWrap) namHonNuWrap.style.display = 'none';
  } else {
    if(nuGLWrap) nuGLWrap.style.display = 'none';
    if(namHonNuWrap) namHonNuWrap.style.display = 'flex';
  }
  
  if(typeof Storage !== 'undefined') {
    let s = Storage.getSettings();
    s.sanNhaNuGLToggle = isNuGL;
    Storage.saveSettings(s);
  }
}

// ======================== 13. QR Toggle ==============================

function closeSheet() {
  let sheet = document.getElementById('resultSheet');
  setOverlayState(sheet, false);
}

function toggleQR() {
  triggerHaptic('light');
  if (typeof VietQR === 'undefined' || !VietQR.hasConfig()) {
    showToast('Thiết lập tài khoản ngân hàng để tạo QR.');
    openQRSettings();
    return;
  }
  isShowingQR = !isShowingQR;
  let qrBtn = document.getElementById('qrBtn');

  if(tabReceipt) tabReceipt.setAttribute('aria-selected', tab === 'receipt' ? 'true' : 'false');
  if(tabHistory) tabHistory.setAttribute('aria-selected', tab === 'history' ? 'true' : 'false');
  let content = document.getElementById('receiptContainer');
  let qrCont = document.getElementById('qrContainer');

  if(content && qrCont && qrBtn) {
    if (isShowingQR) {
      content.style.display = 'none';
      qrCont.style.display = 'block';
      qrCont.replaceChildren();
      VietQR.renderQR(qrCont, {
        amount: 0,
        playerName: 'Chi phí cầu lông',
        sessionDate: currentReceiptData?.date || '',
        size: 250
      });
      const hint = document.createElement('p');
      hint.textContent = 'QR nhận tiền của chủ sân';
      hint.style.cssText = 'margin:10px 0 0;color:var(--text-sub);font-size:13px;font-weight:700';
      qrCont.appendChild(hint);
      qrBtn.innerHTML = '🧾 Xem Biên Lai';
    } else {
      content.style.display = 'block';
      qrCont.style.display = 'none';
      qrBtn.innerHTML = '💳 QR Chủ sân';
    }
  }
}

// ======================== 14. Receipt Tabs ==============================

function switchReceiptTab(tab) {
  triggerHaptic('light');
  let tabReceipt = document.getElementById('tabReceipt');
  let tabHistory = document.getElementById('tabHistory');
  let receiptContainer = document.getElementById('receiptContainer');
  let shareActions = document.getElementById('shareActions');
  let historySection = document.getElementById('historySection');
  let syncStatus = document.getElementById('syncStatus');
  let qrContainer = document.getElementById('qrContainer');
  let qrBtn = document.getElementById('qrBtn');

  if (tab === 'receipt') {
    if(tabReceipt) tabReceipt.classList.add('active');
    if(tabHistory) tabHistory.classList.remove('active');
    if(receiptContainer) receiptContainer.style.display = '';
    if (lastTeleStr && shareActions) shareActions.style.display = '';
    if(historySection) historySection.style.display = 'none';
    if(syncStatus) syncStatus.style.display = '';
    if (qrBtn) qrBtn.style.display = !isPublicMode && currentReceiptMode === 'home' ? '' : 'none';
  } else {
    if(tabReceipt) tabReceipt.classList.remove('active');
    if(tabHistory) tabHistory.classList.add('active');
    if(receiptContainer) receiptContainer.style.display = 'none';
    if(shareActions) shareActions.style.display = 'none';
    if(historySection) historySection.style.display = '';
    if(syncStatus) syncStatus.style.display = 'none';
    if(qrContainer) qrContainer.style.display = 'none';
    if(qrBtn) qrBtn.style.display = 'none';
    renderHistory();
  }
}

// ======================== 15. History ==============================

function renderHistory() {
  if(typeof Storage === 'undefined') return;
  let history = Storage.getHistory();
  let container = document.getElementById('historyList');
  if(!container) return;
  
  if (history.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding: 20px;"><div class="empty-text">Chưa có lịch sử tính tiền.</div></div>';
    return;
  }
  
  let html = '<div style="display: flex; justify-content: flex-end; margin-bottom: 12px;"><button type="button" class="chip chip-clear" onclick="clearAllHistory()">🗑️ Xóa tất cả</button></div>';
  history.forEach((item, idx) => {
    let modeLabel = item.mode === 'home' ? 'Sân Nhà' : 'Sân Khách';
    html += `
      <div class="history-item" style="background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 16px; padding: 12px 16px; margin-bottom: 8px; cursor: pointer; transition: 0.2s; box-shadow: var(--shadow-soft);" onclick="viewHistoryItem(${idx})">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 14px; color: var(--text-main);">${escapeHTML(item.date)}</div>
            <div style="font-size: 12px; color: var(--text-sub); margin-top: 2px;">${modeLabel} · ${formatMoney(Number(item.totalCost) || 0)}</div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn-remove-cau" onclick="event.stopPropagation(); deleteHistoryItem(${idx})" title="Xóa">✕</button>
          </div>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

async function viewHistoryItem(idx) {
  triggerHaptic('light');
  if(typeof Storage === 'undefined') return;
  let history = Storage.getHistory();
  if (!history[idx]) return;
  
  let item = history[idx];
  let content = document.getElementById('receiptContent');
  if(content) content.innerHTML = sanitizeStoredHTML(item.receipt);
  currentSessionId = item.sessionId || null;
  const tracking = document.getElementById('paymentTrackingSection');
  if (currentSessionId && Storage.getSession) {
    const session = await Storage.getSession(currentSessionId);
    if (session) renderPaymentTracking(session);
    else if (tracking) tracking.style.display = 'none';
  } else if (tracking) tracking.style.display = 'none';
  
  lastTeleStr = item.teleStr || '';
  switchReceiptTab('receipt');
}

function deleteHistoryItem(idx) {
  triggerHaptic('heavy');
  if (!confirm('Xóa mục lịch sử này?')) return;
  if(typeof Storage !== 'undefined') Storage.removeFromHistory(idx);
  renderHistory();
  showToast('Đã xóa! 🗑️');
}

function clearAllHistory() {
  triggerHaptic('heavy');
  if (!confirm('Xóa toàn bộ lịch sử tính tiền? Thao tác này không thể hoàn tác.')) return;
  if(typeof Storage !== 'undefined') Storage.clearHistory();
  renderHistory();
  showToast('Đã xóa toàn bộ lịch sử! 🗑️');
}

// ======================== 16. Copy/Share ==============================

function copyReceipt() {
  triggerHaptic('light');
  if (!lastTeleStr) return;
  
  let plainText = lastTeleStr.replace(/<b>/g, '').replace(/<\/b>/g, '').replace(/\\n/g, '\n');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(plainText).then(() => {
      let btn = document.getElementById('copyBtn');
      if(btn) {
        let oldText = btn.innerText;
        btn.innerText = 'Đã copy! ✓';
        btn.style.background = 'rgba(16, 185, 129, 0.15)';
        btn.style.color = '#10b981';
        setTimeout(() => {
          btn.innerText = '📋 Copy';
          btn.style.background = '';
          btn.style.color = '';
        }, 2000);
      }
    }).catch(() => {
      showToast('Không thể copy, hãy thử lại');
    });
  } else {
    showToast('Trình duyệt không hỗ trợ copy');
  }
}

function shareReceipt() {
  triggerHaptic('light');
  if (!lastTeleStr) return;
  
  let plainText = lastTeleStr.replace(/<b>/g, '').replace(/<\/b>/g, '').replace(/\\n/g, '\n');
  if (navigator.share) {
    navigator.share({
      title: 'Biên Lai Cầu Lông',
      text: plainText
    }).catch(() => {});
  }
}

// ======================== 17. Reset ==============================

function resetForm(silent = false) {
  triggerHaptic('heavy');
  
  let fields = ['tienSan', 'tienCau', 'namGL', 'nuGL', 'namCD', 'nuCD'];
  fields.forEach(f => {
    let el = document.getElementById(f);
    if(el) el.value = (f.includes('GL') || f.includes('CD')) ? '0' : '';
  });
  
  let nuCoDinhGia = document.getElementById('nuCoDinhGia');
  if(nuCoDinhGia) nuCoDinhGia.value = '50.000';

  customCount = { nam: 1, nu: 1 };

  let cauList = document.getElementById('cauListContainer');
  if(cauList) {
    cauList.innerHTML = `
        <div class="cau-detail-flex cau-item">
          <div class="cau-col">
            <span>GIÁ 1 TÚP (12 QUẢ)</span>
            <input type="text" class="giaCau" placeholder="0 ₫" inputmode="numeric" pattern="[0-9]*" onfocus="handleInputFocus(this)" onblur="validateInputEmpty(this)" oninput="formatCurrency(this); updateCauTotal();">
          </div>
          <div class="divider-vert"></div>
          <div class="cau-col">
            <span>SỐ QUẢ</span>
            <input type="text" class="slCau" placeholder="0" inputmode="numeric" pattern="[0-9]*" onfocus="handleInputFocus(this)" onblur="validateInputZero(this)" oninput="updateCauTotal();">
          </div>
          <div class="cau-action-col"></div>
        </div>
    `;
  }

  selectMethod('nam20k', 'Nam trả hơn Nữ 20.000đ');
  clearUndo('tienSan');
  clearUndo('tienCau');

  // Reset Sân Nhà settings/toggles
  let customToggle = document.getElementById('sanNhaCustomToggle');
  if (customToggle) {
    customToggle.checked = false;
    let customOpts = document.getElementById('sanNhaCustomOptions');
    if (customOpts) customOpts.style.display = 'none';
  }
  
  let nuGLToggle = document.getElementById('sanNhaNuGLToggle');
  if(typeof Storage !== 'undefined' && typeof Calculator !== 'undefined') {
    let settings = Storage.getSettings();
    let sanNhaNuGL = document.getElementById('sanNhaNuGL');
    let sanNhaGLOffset = document.getElementById('sanNhaGLOffset');
    let sanNhaNamOffset = document.getElementById('sanNhaNamOffset');
    
    if(sanNhaNuGL) sanNhaNuGL.value = Calculator.formatCurrencyValue(settings.sanNhaNuGL);
    if(sanNhaGLOffset) sanNhaGLOffset.value = Calculator.formatCurrencyValue(settings.sanNhaGLOffset);
    if(sanNhaNamOffset) sanNhaNamOffset.value = Calculator.formatCurrencyValue(settings.sanNhaNamOffset);
    if (nuGLToggle) nuGLToggle.checked = settings.sanNhaNuGLToggle;
    const nuGLWrap = document.getElementById('sanNhaNuGLInputWrap');
    const namHonNuWrap = document.getElementById('sanNhaNamHonNuWrap');
    if (nuGLWrap) nuGLWrap.style.display = settings.sanNhaNuGLToggle ? 'flex' : 'none';
    if (namHonNuWrap) namHonNuWrap.style.display = settings.sanNhaNuGLToggle ? 'none' : 'flex';
  }

  if (!isPublicMode) { switchTab('home'); }
  closeSheet();

  let receiptContent = document.getElementById('receiptContent');
  if(receiptContent) {
    receiptContent.innerHTML = '<div class="empty-state"><svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg><div class="empty-text">Chưa có dữ liệu tính toán.<br>Hãy nhập số tiền và thực hiện cú <strong>Smash "Phân Bổ"</strong> ngay nhé! 🏸</div></div>';
  }
  
  let qrBtn = document.getElementById('qrBtn');
  if(qrBtn) qrBtn.style.display = 'none';
  
  let syncStatus = document.getElementById('syncStatus');
  if(syncStatus) syncStatus.style.display = 'none';
  
  let shareActions = document.getElementById('shareActions');
  if(shareActions) shareActions.style.display = 'none';
  
  lastTeleStr = '';
  updateCauTotal();
  currentSessionId = null;
  updateLiveSummary();
  if (!silent) showToast('Đã xóa nội dung buổi này.');
}

// ======================== 18. Process Data ==============================

async function processData() {
  let dateInput = document.getElementById('dateInput');
  let dateRaw = dateInput ? dateInput.value : '';
  if (!dateRaw) {
    showToast('Vui lòng chọn ngày chơi.');
    dateInput?.focus();
    return;
  }
  let dateStr = dateRaw.split('-').reverse().join('/');

  let tienSanEl = document.getElementById('tienSan');
  let san = tienSanEl ? parseMoney(tienSanEl.value) : 0;
  
  let cau = 0;
  let cauDisplay = `<strong>${formatMoney(cau)}</strong>`;
  let teleCauStr = `🏸 Cầu: ${formatMoney(cau)}`;

  if (isCauDetailMode) {
    let items = [];
    document.querySelectorAll('.cau-item').forEach(item => {
      let giaInput = item.querySelector('.giaCau');
      let slInput = item.querySelector('.slCau');
      let giaTup = giaInput ? parseMoney(giaInput.value) : 0;
      let soQua = slInput ? (parseInt(slInput.value, 10) || 0) : 0;
      items.push({ giaTup, soQua });
    });
    if(typeof Calculator !== 'undefined') {
      let cauResult = Calculator.calcCauDetail(items);
      cau = cauResult.total;
      let detailText = cauResult.detailText;
      cauDisplay = `<div style="text-align:right"><strong>${formatMoney(cau)}</strong><div class="receipt-sub" style="margin-top:0">${detailText}</div></div>`;
      teleCauStr = `🏸 Cầu: ${formatMoney(cau)} (${detailText})`;
    }
  } else {
    let tienCauEl = document.getElementById('tienCau');
    cau = tienCauEl ? parseMoney(tienCauEl.value) : 0;
    cauDisplay = `<strong>${formatMoney(cau)}</strong>`;
    teleCauStr = `🏸 Cầu: ${formatMoney(cau)}`;
  }

  let totalCost = san + cau;
  if (totalCost <= 0) {
    showToast('Nhập tiền sân hoặc tiền cầu trước khi chia.');
    tienSanEl?.focus();
    return;
  }
  
  let namGLEl = document.getElementById('namGL');
  let nuGLEl = document.getElementById('nuGL');
  let namGL = namGLEl ? parseInt(namGLEl.value, 10) || 0 : 0;
  let nuGL = nuGLEl ? parseInt(nuGLEl.value, 10) || 0 : 0;

  currentReceiptData = {
    date: dateStr,
    mode: mode,
    san: san,
    cau: cau,
    totalCost: totalCost,
    items: []
  };
  currentReceiptMode = mode;

  let html = `
    <div class="receipt-item"><span style="color:var(--text-sub); font-weight:600;">💎 Tiền Sân:</span> <strong>${formatMoney(san)}</strong></div>
    <div class="receipt-item"><span style="color:var(--text-sub); font-weight:600;">🏸 Tiền Cầu:</span> ${cauDisplay}</div>
    <div class="divider-dash"></div>
    <div class="receipt-item"><span><strong>TỔNG CHI PHÍ:</strong></span> <strong style="color:var(--accent); font-size: 20px;">${formatMoney(totalCost)}</strong></div>
    <div class="divider"></div>
  `;
  let teleStr = `<b>🏸 BẢNG TÍNH ${mode === 'away' ? 'SÂN KHÁCH' : 'SÂN NHÀ'} (${dateStr})</b>\\n💎 Sân: ${formatMoney(san)} | ${teleCauStr}\\n------------------\\n`;

  let settings = typeof Storage !== 'undefined' ? Storage.getSettings() : {};
  let playersList = [];
  let resultData = {}; // to hold extra result props

  if (mode === 'away') {
    let qrBtn = document.getElementById('qrBtn');
    if(qrBtn) qrBtn.style.display = 'none';

    if (currentSplitMethod === 'sanNha') {
      let namCDEl = document.getElementById('namCD');
      let nuCDEl = document.getElementById('nuCD');
      let namCD = namCDEl ? parseInt(namCDEl.value, 10) || 0 : 0;
      let nuCD = nuCDEl ? parseInt(nuCDEl.value, 10) || 0 : 0;
      let totalP = namCD + nuCD + namGL + nuGL;
      if (totalP === 0) { showToast('Hãy nhập số lượng người chơi.'); return; }

      let result = Calculator.calcSanNhaRule(totalCost, namCD, nuCD, namGL, nuGL, settings);
      
      resultData = result;

      if (namCD) {
        html += `<div class="receipt-item"><span>🏅 Nam Cố định x${namCD}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(result.pNam)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(result.pNam * namCD)}</div></div></div>`;
        teleStr += `🏅 Nam CD (${namCD}): <b>${formatMoney(result.pNam * namCD)}</b> (${formatMoney(result.pNam)}/ng)\\n`;
        playersList.push({ name: `Nam Cố định (x${namCD})`, amount: result.pNam * namCD, count: namCD, isGuest: false });
      }
      if (nuCD) {
        html += `<div class="receipt-item"><span>🏅 Nữ Cố định x${nuCD}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(result.pNu)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(result.pNu * nuCD)}</div></div></div>`;
        teleStr += `🏅 Nữ CD (${nuCD}): <b>${formatMoney(result.pNu * nuCD)}</b> (${formatMoney(result.pNu)}/ng)\\n`;
        playersList.push({ name: `Nữ Cố định (x${nuCD})`, amount: result.pNu * nuCD, count: nuCD, isGuest: false });
      }
      if (namGL || nuGL) {
        html += `<div class="divider-dash" style="margin-top:8px"></div>`;
        teleStr += `------------------\\n`;
      }
      if (namGL) {
        html += `<div class="receipt-item"><span>👤 Nam Giao lưu x${namGL}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(result.pNamGL)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(result.pNamGL * namGL)}</div></div></div>`;
        teleStr += `👤 Nam GL (${namGL}): <b>${formatMoney(result.pNamGL * namGL)}</b> (${formatMoney(result.pNamGL)}/ng)\\n`;
        playersList.push({ name: `Nam Giao lưu (x${namGL})`, amount: result.pNamGL * namGL, count: namGL, isGuest: true });
      }
      if (nuGL) {
        html += `<div class="receipt-item"><span>👤 Nữ Giao lưu x${nuGL}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(result.pNuGL)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(result.pNuGL * nuGL)}</div></div></div>`;
        teleStr += `👤 Nữ GL (${nuGL}): <b>${formatMoney(result.pNuGL * nuGL)}</b> (${formatMoney(result.pNuGL)}/ng)\\n`;
        playersList.push({ name: `Nữ Giao lưu (x${nuGL})`, amount: result.pNuGL * nuGL, count: nuGL, isGuest: true });
      }

      currentReceiptData.items = [];
      if (namCD) currentReceiptData.items.push({ label: `Nam Cố định x${namCD}`, value: `${formatMoney(result.pNam)}/ng`, type: 'member', gender: 'nam' });
      if (nuCD) currentReceiptData.items.push({ label: `Nữ Cố định x${nuCD}`, value: `${formatMoney(result.pNu)}/ng`, type: 'member', gender: 'nu' });
      if (namGL) currentReceiptData.items.push({ label: `Nam Giao lưu x${namGL}`, value: `${formatMoney(result.pNamGL)}/ng`, type: 'guest' });
      if (nuGL) currentReceiptData.items.push({ label: `Nữ Giao lưu x${nuGL}`, value: `${formatMoney(result.pNuGL)}/ng`, type: 'guest' });

    } else {
      let totalP = namGL + nuGL;
      if (totalP === 0) { showToast('Hãy nhập số lượng người chơi.'); return; }

      let pNam = 0, pNu = 0;

      if (currentSplitMethod === 'nuCoDinh') {
        let nuCoDinhGia = document.getElementById('nuCoDinhGia');
        let nuPrice = nuCoDinhGia ? parseMoney(nuCoDinhGia.value) : 0;
        let result = Calculator.calcNuCoDinh(totalCost, namGL, nuGL, nuPrice);
        pNam = result.pNam;
        pNu = result.pNu;
      } else if (currentSplitMethod === 'nam20k') {
        let result = Calculator.calcNam20k(totalCost, namGL, nuGL, settings.offsetNam20k);
        pNam = result.pNam;
        pNu = result.pNu;
      } else {
        let result = Calculator.calcChiaDeu(totalCost, namGL, nuGL);
        pNam = result.pNam;
        pNu = result.pNu;
      }

      if (namGL) {
        html += `<div class="receipt-item"><span>🤵🏻‍♂️ Nam x${namGL}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(pNam)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(pNam * namGL)}</div></div></div>`;
        teleStr += `🤵🏻‍♂️ Nam (${namGL}): <b>${formatMoney(pNam * namGL)}</b> (${formatMoney(pNam)}/ng)\\n`;
        playersList.push({ name: `Nam (x${namGL})`, amount: pNam * namGL, count: namGL, isGuest: true });
      }
      if (nuGL) {
        html += `<div class="receipt-item"><span>👩🏻‍💼 Nữ x${nuGL}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(pNu)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(pNu * nuGL)}</div></div></div>`;
        teleStr += `👩🏻‍💼 Nữ (${nuGL}): <b>${formatMoney(pNu * nuGL)}</b> (${formatMoney(pNu)}/ng)\\n`;
        playersList.push({ name: `Nữ (x${nuGL})`, amount: pNu * nuGL, count: nuGL, isGuest: true });
      }

      currentReceiptData.items = [];
      if (namGL) currentReceiptData.items.push({ label: `Nam x${namGL}`, value: `${formatMoney(pNam)}/ng`, type: 'guest' });
      if (nuGL) currentReceiptData.items.push({ label: `Nữ x${nuGL}`, value: `${formatMoney(pNu)}/ng`, type: 'guest' });
    }

  } else {
    // HOME MODE
    let qrBtn = document.getElementById('qrBtn');
    if (!isPublicMode && qrBtn) { qrBtn.style.display = 'block'; }

    let activeTags = document.querySelectorAll('#tagsGrid .player-tag.active');
    let activeMembers = [];
    activeTags.forEach(tag => {
      activeMembers.push({
        name: tag.getAttribute('data-name'),
        gender: tag.getAttribute('data-gender')
      });
    });

    let totalP = activeMembers.length + namGL + nuGL;
    if (totalP === 0) { showToast('Hãy chọn ít nhất một người tham gia.'); return; }

    let sanNhaNuGL = document.getElementById('sanNhaNuGL');
    let sanNhaGLOffset = document.getElementById('sanNhaGLOffset');
    let sanNhaNamOffset = document.getElementById('sanNhaNamOffset');
    let sanNhaNuGLToggle = document.getElementById('sanNhaNuGLToggle');
    
    let nuGLPrice = sanNhaNuGL ? parseMoney(sanNhaNuGL.value) : 0;
    let glOffset = sanNhaGLOffset ? parseMoney(sanNhaGLOffset.value) : 0;
    let namOffset = sanNhaNamOffset ? parseMoney(sanNhaNamOffset.value) : 0;
    let isNuGLMode = sanNhaNuGLToggle ? sanNhaNuGLToggle.checked : false;
    
    let result = Calculator.calcSanNha(totalCost, activeMembers, namGL, nuGL, isNuGLMode, nuGLPrice, namOffset, glOffset);
    resultData = result;

    let pNamCD = result.pNamCD;
    let pNuCD = result.pNuCD;
    let pNamGL = result.pNamGL;
    let pNuGL = result.pNuGL;

    let fixedMembersHtml = "";
    result.memberResults.forEach(mr => {
      let icon = mr.gender === 'nam' ? '🤵🏻‍♂️' : '👩🏻‍💼';
      fixedMembersHtml += `<div class="receipt-item fixed-member"><span>${escapeHTML(mr.name)}</span> <strong class="price-badge">${formatMoney(mr.price)}</strong></div>`;
      teleStr += `${icon} ${String(mr.name).replace(/[<>]/g, '')}: <b>${formatMoney(mr.price)}</b>\\n`;
      playersList.push({ name: mr.name, amount: mr.price, count: 1, isGuest: false });
    });

    if (fixedMembersHtml !== "") {
      html += `
      <div class="fixed-team-receipt-header" onclick="triggerHaptic('light'); this.classList.toggle('collapsed'); this.nextElementSibling.classList.toggle('collapsed');">
          <span>Nội bộ Sân Nhà</span>
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      <div class="fixed-team-receipt-content">
          <div class="fixed-team-receipt-inner">
              ${fixedMembersHtml}
          </div>
      </div>
      `;
    }

    if (namGL || nuGL) {
      html += `<div class="divider-dash" style="margin-top:8px"></div>`;
      teleStr += `------------------\\n`;
    }
    if (namGL) {
      html += `<div class="receipt-item"><span>Nam GL x${namGL}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(pNamGL)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(pNamGL * namGL)}</div></div></div>`;
      teleStr += `👤 Nam GL (${namGL}): <b>${formatMoney(pNamGL * namGL)}</b> (${formatMoney(pNamGL)}/ng)\\n`;
      playersList.push({ name: `Nam Giao lưu (x${namGL})`, amount: pNamGL * namGL, count: namGL, isGuest: true });
    }
    if (nuGL) {
      html += `<div class="receipt-item"><span>Nữ GL x${nuGL}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(pNuGL)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(pNuGL * nuGL)}</div></div></div>`;
      teleStr += `👤 Nữ GL (${nuGL}): <b>${formatMoney(pNuGL * nuGL)}</b> (${formatMoney(pNuGL)}/ng)\\n`;
      playersList.push({ name: `Nữ Giao lưu (x${nuGL})`, amount: pNuGL * nuGL, count: nuGL, isGuest: true });
    }

    if (result && result.difference !== undefined) {
      let diff = result.difference;
      let diffLabel = diff >= 0 ? 'Dư' : 'Thiếu';
      let diffColor = diff >= 0 ? '#10b981' : '#f43f5e';
      let diffBg = diff >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)';
      html += `<div class="divider"></div><div class="receipt-item"><span style="font-weight:700;">💰 Thu được:</span><strong>${formatMoney(result.totalCollected)}</strong></div>`;
      html += `<div class="receipt-item"><span style="font-weight:700;">📊 Chênh lệch:</span><span class="price-badge" style="background:${diffBg}; color:${diffColor};">${diffLabel} ${formatMoney(Math.abs(diff))}</span></div>`;
      teleStr += `------------------\\n💰 Thu: ${formatMoney(result.totalCollected)} | ${diffLabel}: ${formatMoney(Math.abs(diff))}\\n`;
    }

    currentReceiptData.items = [];
    result.memberResults.forEach(mr => {
      currentReceiptData.items.push({ label: mr.name, value: formatMoney(mr.price), type: 'member', gender: mr.gender });
    });
    if (namGL) currentReceiptData.items.push({ label: `Nam Giao lưu x${namGL}`, value: `${formatMoney(pNamGL)}/ng`, type: 'guest' });
    if (nuGL) currentReceiptData.items.push({ label: `Nữ Giao lưu x${nuGL}`, value: `${formatMoney(pNuGL)}/ng`, type: 'guest' });
    
    currentReceiptData.totalCollected = result.totalCollected;
    currentReceiptData.difference = result.difference;
  }

  triggerHaptic('success');
  isShowingQR = false;
  lastTeleStr = teleStr;

  let receiptContainer = document.getElementById('receiptContainer');
  let qrContainer = document.getElementById('qrContainer');
  let qrBtn = document.getElementById('qrBtn');
  let contentInner = document.getElementById('receiptContent');
  let statusEl = document.getElementById('syncStatus');
  let resultSheet = document.getElementById('resultSheet');

  if(receiptContainer) receiptContainer.style.display = 'block';
  if(qrContainer) qrContainer.style.display = 'none';
  if (!isPublicMode && currentReceiptMode === 'home' && qrBtn) qrBtn.innerHTML = '💳 QR Chủ sân';

  if(receiptContainer && contentInner) {
    receiptContainer.classList.remove('anim-pop');
    void receiptContainer.offsetWidth;
    contentInner.innerHTML = html;
    receiptContainer.classList.add('anim-pop');
  }

  let shareActions = document.getElementById('shareActions');
  let shareBtn = document.getElementById('shareBtn');
  if(shareActions) shareActions.style.display = '';
  if (shareBtn) {
    if (!navigator.share) shareBtn.style.display = 'none';
    else shareBtn.style.display = '';
  }

  switchReceiptTab('receipt');
  setOverlayState(resultSheet, true);

  if(typeof Storage !== 'undefined') {
    // Convert to session format
    let finalPlayers = playersList.map(p => ({
      name: p.name,
      amount: p.amount,
      paid: false,
      isGuest: p.isGuest,
      count: p.count
    }));
    
    const sessionData = {
      date: dateRaw,  
      dateDisplay: dateStr,  
      mode: mode,
      status: 'open',
      tienSan: san,
      tienCau: cau,
      totalCost: totalCost,
      splitMethod: mode === 'away' ? currentSplitMethod : 'sanNha',
      players: finalPlayers,  
      guestNam: namGL,
      guestNu: nuGL,
      pNamGL: resultData.pNamGL || 0,
      pNuGL: resultData.pNuGL || 0,
      receipt: html,
      teleStr: teleStr,
      receiptData: currentReceiptData,
      totalCollected: resultData.totalCollected || 0,
      difference: resultData.difference || 0
    };
    
    if (Storage.createSession) {
      let savedSession = currentSessionId ? await Storage.getSession(currentSessionId) : null;
      if (savedSession && savedSession.status === 'open') {
        const previousPlayers = Array.isArray(savedSession.players) ? savedSession.players : [];
        sessionData.players = sessionData.players.map(player => {
          const previous = previousPlayers.find(item => item.name === player.name && item.amount === player.amount);
          return previous ? { ...player, paid: previous.paid, paidAt: previous.paidAt || null } : player;
        });
        savedSession = await Storage.updateSession(currentSessionId, sessionData);
      } else {
        savedSession = await Storage.createSession(sessionData);
        currentSessionId = savedSession.id;
      }
      if (Storage.upsertHistory) {
        Storage.upsertHistory({
          sessionId: currentSessionId,
          date: dateStr,
          mode,
          totalCost,
          receipt: html,
          teleStr,
          timestamp: Date.now()
        });
      }
      renderPaymentTracking(savedSession);
    }
  }

  if(statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.color = '#10b981';
    statusEl.innerText = 'Đã lưu an toàn trên thiết bị này.';
  }
}

// ======================== 19. Payment Tracking ==============================

function renderPaymentTracking(session) {
  let section = document.getElementById('paymentTrackingSection');
  let list = document.getElementById('paymentList');
  if(!section || !list) return;
  
  section.style.display = 'block';
  list.replaceChildren();
  const players = Array.isArray(session.players) ? session.players : [];
  let hasVietQR = typeof VietQR !== 'undefined' && VietQR.hasConfig();
  
  players.forEach((player, index) => {
    const item = document.createElement('div');
    item.className = 'payment-item';

    const label = document.createElement('label');
    label.className = 'payment-checkbox';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(player.paid);
    checkbox.setAttribute('aria-label', `Đánh dấu ${player.name} đã thanh toán`);
    checkbox.addEventListener('change', () => togglePayment(session.id, index));
    const checkmark = document.createElement('span');
    checkmark.className = 'checkmark';
    label.append(checkbox, checkmark);

    const info = document.createElement('div');
    info.className = 'payment-info';
    const name = document.createElement('div');
    name.className = 'payment-name';
    name.textContent = player.name;
    const amount = document.createElement('div');
    amount.className = 'payment-amount';
    amount.textContent = formatMoney(Number(player.amount) || 0);
    info.append(name, amount);

    const actions = document.createElement('div');
    actions.className = 'payment-actions';
    if (!player.paid && hasVietQR && Number(player.amount) > 0) {
      const qr = document.createElement('button');
      qr.type = 'button';
      qr.className = 'btn-qr-mini';
      qr.textContent = 'QR';
      qr.addEventListener('click', () => openQRForPlayer(player.name, Number(player.amount), session.dateDisplay));
      actions.appendChild(qr);
    }
    const badge = document.createElement('span');
    badge.className = `payment-badge payment-badge-${player.paid ? 'paid' : 'unpaid'}`;
    badge.textContent = player.paid ? 'Đã thu' : 'Chưa thu';
    actions.appendChild(badge);
    item.append(label, info, actions);
    list.appendChild(item);
  });
  
  updatePaymentProgress(session);
}

async function togglePayment(sessionId, playerIdx) {
  triggerHaptic('light');
  if(typeof Storage === 'undefined') return;
  
  let session = await Storage.getSession(sessionId);
  if (!session || !Array.isArray(session.players) || !session.players[playerIdx]) return;
  
  session.players[playerIdx].paid = !session.players[playerIdx].paid;
  session.players[playerIdx].paidAt = session.players[playerIdx].paid ? Date.now() : null;
  await Storage.updateSession(sessionId, { players: session.players });
  
  // Update UI locally
  renderPaymentTracking(session);
  
  // Check if all paid
  let allPaid = session.players.every(p => p.paid);
  if (allPaid && session.players.length > 0) {
    triggerHaptic('success');
    showToast('Hoan hô! Đã thu đủ tiền! 🎉');
  }
}

function updatePaymentProgress(session) {
  let bar = document.getElementById('paymentProgressBar');
  let text = document.getElementById('paymentProgressText');
  if(!bar || !text) return;
  
  const players = Array.isArray(session.players) ? session.players : [];
  let total = players.reduce((sum, player) => sum + Math.max(1, Number(player.count) || 1), 0);
  let paid = players.reduce((sum, player) => sum + (player.paid ? Math.max(1, Number(player.count) || 1) : 0), 0);
  let percent = total === 0 ? 0 : Math.round((paid / total) * 100);
  
  bar.style.width = `${percent}%`;
  text.innerText = `Đã thu: ${paid}/${total} người (${percent}%)`;
  
  let btnClose = document.getElementById('btnCloseSession');
  if(btnClose) {
    if (session.status === 'open') {
      btnClose.style.display = 'block';
    } else {
      btnClose.style.display = 'none';
    }
  }
}

async function closeCurrentSession() {
  triggerHaptic('heavy');
  if (!currentSessionId || typeof Storage === 'undefined') return;
  
  let ok = confirm("Chốt buổi này? Buổi đã chốt sẽ không hiển thị thiếu tiền ở màn hình chính nữa.");
  if (!ok) return;
  
  await Storage.closeSession(currentSessionId);
  showToast('Đã chốt buổi thành công! ✅');
  closeSheet();
  backToDashboard();
}

// ======================== 20. Profile Modal ==============================

async function openProfile(memberName) {
  triggerHaptic('light');
  if(typeof Storage === 'undefined') return;
  
  let overlay = document.getElementById('profileOverlay');
  if(!overlay) return;
  
  let stats = await Storage.getPlayerStats(memberName);
  const member = Storage.getMembers().find(item => item.name === memberName);
  
  document.getElementById('profileName').innerText = memberName;
  document.getElementById('profileAvatar').innerText = memberName.charAt(0).toUpperCase();
  document.getElementById('profileMeta').innerText = `${member?.gender === 'nu' ? 'Nữ' : 'Nam'} · Thành viên CLB`;
  document.getElementById('profTotalSessions').innerText = stats.totalSessions;
  document.getElementById('profAvgPerSession').innerText = formatMoney(stats.avgPerSession);
  document.getElementById('profTotalPaid').innerText = formatMoney(stats.totalPaid);
  
  let debtEl = document.getElementById('profDebt');
  if(debtEl) {
    if (stats.debtAmount > 0) {
      debtEl.innerText = formatMoney(stats.debtAmount);
      debtEl.style.color = '#f43f5e';
    } else {
      debtEl.innerText = '0 đ';
      debtEl.style.color = '#10b981';
    }
  }
  
  // History
  let histList = document.getElementById('profileHistory');
  if(histList) {
    histList.innerHTML = '';
    if (stats.history.length === 0) {
      histList.innerHTML = '<div class="empty-state"><div class="empty-text">Chưa có lịch sử chơi.</div></div>';
    } else {
      stats.history.forEach(session => {
        const row = document.createElement('div');
        row.className = 'profile-history-item';
        const date = document.createElement('span');
        date.textContent = session.date || 'Không rõ ngày';
        const summary = document.createElement('span');
        summary.className = `payment-badge payment-badge-${session.paid ? 'paid' : 'unpaid'}`;
        summary.textContent = `${formatMoney(session.amount)} · ${session.paid ? 'Đã đóng' : 'Chưa đóng'}`;
        row.append(date, summary);
        histList.appendChild(row);
      });
    }
  }
  
  setOverlayState(overlay, true);
}

function closeProfile() {
  triggerHaptic('light');
  let overlay = document.getElementById('profileOverlay');
  setOverlayState(overlay, false);
}

// ======================== 21. QR Payment Functions ==============================

function openQRForPlayer(playerName, amount, sessionDate) {
  triggerHaptic('light');
  if (typeof VietQR === 'undefined' || !VietQR.hasConfig()) {
    showToast("Vui lòng thiết lập ngân hàng trước!");
    return;
  }
  
  let overlay = document.getElementById('qrPaymentOverlay');
  let wrap = document.getElementById('qrCanvasWrap');
  let nameEl = document.getElementById('qrPlayerName');
  let amtEl = document.getElementById('qrPayAmount');
  let bankEl = document.getElementById('qrBankInfo');
  
  if(overlay && wrap) {
    nameEl.innerText = playerName;
    amtEl.innerText = formatMoney(amount);
    
    let cfg = VietQR.getConfig();
    const bank = VietQR.BANKS.find(item => item.id === cfg.bankId);
    if(bankEl) bankEl.innerText = `${bank?.shortName || cfg.bankId} · ${cfg.accountNo}`;
    
    VietQR.renderQR(wrap, { amount: amount, playerName: playerName, sessionDate: sessionDate, size: 250 });
    setOverlayState(overlay, true);
  }
}

function closeQRPayment() {
  triggerHaptic('light');
  let overlay = document.getElementById('qrPaymentOverlay');
  setOverlayState(overlay, false);
}

async function saveQRImage() {
  const canvas = document.querySelector('#qrCanvasWrap canvas');
  if (!canvas) { showToast('Chưa có mã QR để lưu.'); return; }
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) { showToast('Không thể tạo ảnh QR.'); return; }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `qr-cau-long-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Đã lưu ảnh QR.');
}

async function shareQRImage() {
  const canvas = document.querySelector('#qrCanvasWrap canvas');
  if (!canvas) { showToast('Chưa có mã QR để chia sẻ.'); return; }
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) { showToast('Không thể tạo ảnh QR.'); return; }
  const file = new File([blob], 'qr-cau-long.png', { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Thanh toán chi phí cầu lông' });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  await saveQRImage();
  showToast('Thiết bị không hỗ trợ chia sẻ trực tiếp; ảnh QR đã được lưu.');
}

// ======================== 22. QR Settings ==============================

function openQRSettings() {
  triggerHaptic('light');
  let overlay = document.getElementById('qrSettingsOverlay');
  let select = document.getElementById('qrBankSelect');
  if(!overlay || !select) return;
  
  if (typeof VietQR !== 'undefined' && select.options.length <= 1) {
    VietQR.BANKS.forEach(b => {
      let opt = document.createElement('option');
      opt.value = b.id;
      opt.text = `${b.shortName} - ${b.name}`;
      select.add(opt);
    });
  }
  
  if (typeof VietQR !== 'undefined' && VietQR.hasConfig()) {
    let cfg = VietQR.getConfig();
    select.value = cfg.bankId;
    document.getElementById('qrAccountNo').value = cfg.accountNo;
    document.getElementById('qrAccountName').value = cfg.accountName;
    updateQRPreview();
  }
  
  setOverlayState(overlay, true);
}

function closeQRSettings() {
  triggerHaptic('light');
  let overlay = document.getElementById('qrSettingsOverlay');
  setOverlayState(overlay, false);
}

function saveQRSettings() {
  triggerHaptic('heavy');
  let bankId = document.getElementById('qrBankSelect').value;
  let accountNo = document.getElementById('qrAccountNo').value.replace(/\D/g, '').slice(0, 20);
  let accountName = document.getElementById('qrAccountName').value.trim().replace(/\s+/g, ' ').toUpperCase().slice(0, 50);
  document.getElementById('qrAccountNo').value = accountNo;
  document.getElementById('qrAccountName').value = accountName;
  
  const knownBank = typeof VietQR !== 'undefined' && VietQR.BANKS.some(bank => bank.id === bankId);
  if (!knownBank || accountNo.length < 4 || !accountName) {
    showToast("Vui lòng nhập đủ thông tin ngân hàng!");
    return;
  }
  
  if (typeof VietQR !== 'undefined') {
    VietQR.saveConfig({ bankId, accountNo, accountName });
    showToast("Đã lưu cấu hình QR! ✅");
    closeQRSettings();
  }
}

function updateQRPreview() {
  let bankId = document.getElementById('qrBankSelect').value;
  let accountInput = document.getElementById('qrAccountNo');
  let accountNo = accountInput.value.replace(/\D/g, '').slice(0, 20);
  accountInput.value = accountNo;
  let accountName = document.getElementById('qrAccountName').value.trim().toUpperCase();
  let previewCont = document.getElementById('qrPreviewContainer');
  let previewWrap = document.getElementById('qrSettingsPreview');
  
  if(bankId && accountNo && accountName && previewCont && typeof VietQR !== 'undefined') {
    previewCont.replaceChildren();
    VietQR.renderQR(previewCont, {
      amount: 50000,
      playerName: 'Xem trước',
      sessionDate: '',
      size: 210,
      config: { bankId, accountNo, accountName }
    });
    if (previewWrap) previewWrap.style.display = 'block';
  } else if (previewWrap) {
    previewWrap.style.display = 'none';
  }
}

// ======================== 23. Export/Import Functions ==============================

function openExportModal() {
  triggerHaptic('light');
  let overlay = document.getElementById('exportOverlay');
  setOverlayState(overlay, true);
}

function closeExportModal() {
  triggerHaptic('light');
  let overlay = document.getElementById('exportOverlay');
  setOverlayState(overlay, false);
}

async function exportData() {
  triggerHaptic('light');
  if(typeof Storage === 'undefined') return;
  
  const json = await Storage.exportAll();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `caulong_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất dữ liệu sao lưu! 📥');
  closeExportModal();
}

async function importData(event) {
  triggerHaptic('heavy');
  if(typeof Storage === 'undefined') return;
  
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    await Storage.importAll(text);
    showToast('Khôi phục dữ liệu thành công! ✅');
    closeExportModal();
    refreshDashboard();
  } catch (e) {
    showToast('Lỗi đọc file sao lưu!');
  }
  // Reset input
  event.target.value = '';
}

async function exportSessionPDF() {
  triggerHaptic('light');
  if (!currentSessionId || typeof Storage === 'undefined' || typeof PDFExport === 'undefined') return;
  
  showToast('Đang tạo PDF... ⏳');
  const session = await Storage.getSession(currentSessionId);
  PDFExport.printReceipt(session);
}

async function exportMonthlyReport() {
  triggerHaptic('light');
  if (typeof Storage === 'undefined' || typeof PDFExport === 'undefined') return;
  
  showToast('Đang tổng hợp báo cáo... ⏳');
  const sessions = await Storage.getAllSessions();
  const now = new Date();
  PDFExport.printMonthlyReport(sessions, now.getMonth() + 1, now.getFullYear());
  closeExportModal();
}

// ======================== 24. Session Detail View ==============================

async function openSessionDetail(sessionId) {
  triggerHaptic('light');
  if(typeof Storage === 'undefined') return;
  
  let session = await Storage.getSession(sessionId);
  if (!session) return;
  
  currentSessionId = sessionId;
  currentReceiptMode = session.mode === 'away' ? 'away' : 'home';
  
  // Render receipt
  let contentInner = document.getElementById('receiptContent');
  if(contentInner) contentInner.innerHTML = sanitizeStoredHTML(session.receipt);
  currentReceiptData = session.receiptData || {
    date: session.dateDisplay,
    mode: session.mode,
    san: Number(session.tienSan) || 0,
    cau: Number(session.tienCau) || 0,
    totalCost: Number(session.totalCost) || 0,
    items: (Array.isArray(session.players) ? session.players : []).map(player => ({
      label: player.name,
      value: formatMoney(Number(player.amount) || 0),
      type: player.isGuest ? 'guest' : 'member'
    })),
    totalCollected: Number(session.totalCollected) || 0,
    difference: Number(session.difference) || 0
  };
  
  lastTeleStr = session.teleStr || '';
  const status = document.getElementById('syncStatus');
  if (status) {
    status.textContent = 'Đã lưu an toàn trên thiết bị này.';
    status.style.color = '#10b981';
  }
  
  // Render payment tracking
  renderPaymentTracking(session);
  
  // Switch to receipt tab and show sheet
  switchReceiptTab('receipt');
  
  let resultSheet = document.getElementById('resultSheet');
  setOverlayState(resultSheet, true);
  
  let shareActions = document.getElementById('shareActions');
  if(shareActions) shareActions.style.display = '';
}

async function deleteSessionCard(sessionId) {
  triggerHaptic('heavy');
  if(typeof Storage === 'undefined') return;
  
  if(confirm("Bạn có chắc muốn xóa buổi chơi này? Mọi dữ liệu thu tiền sẽ bị mất.")) {
    await Storage.deleteSession(sessionId);
    showToast('Đã xóa buổi chơi! 🗑️');
    refreshDashboard();
  }
}

// ======================== 25. Canvas Image Functions ==============================

function drawReceiptCanvas(data) {
  return new Promise((resolve) => {
    const itemHeight = 42;
    const headerHeight = 120;
    const totalsHeight = 110;
    const footerHeight = data.difference !== undefined ? 110 : 70;
    const contentHeight = data.items.length * itemHeight;
    const width = 500;
    const height = headerHeight + totalsHeight + contentHeight + footerHeight;

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Header gradient
    const grad = ctx.createLinearGradient(0, 0, width, 6);
    grad.addColorStop(0, '#6366f1');
    grad.addColorStop(1, '#a855f7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, 6);

    // Title
    ctx.font = 'bold 22px "Be Vietnam Pro", "Segoe UI", sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.fillText('BIÊN LAI CHI PHÍ CẦU LÔNG 🏸', width / 2, 45);

    ctx.font = '600 13px "Be Vietnam Pro", "Segoe UI", sans-serif';
    ctx.fillStyle = '#64748b';
    const modeLabel = data.mode === 'home' ? 'CHẾ ĐỘ: SÂN NHÀ' : 'CHẾ ĐỘ: SÂN KHÁCH';
    ctx.fillText(`${modeLabel}  •  NGÀY: ${data.date}`, width / 2, 70);

    drawCanvasDashedLine(ctx, 20, 90, width - 20, 90);

    // Summary Info
    ctx.textAlign = 'left';
    ctx.font = '500 13px "Be Vietnam Pro", "Segoe UI", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Tiền sân:', 30, 120);
    ctx.fillText('Tiền cầu:', 30, 142);
    ctx.font = 'bold 14px "Be Vietnam Pro", "Segoe UI", sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(formatMoney(data.san), 110, 120);
    ctx.fillText(formatMoney(data.cau), 110, 142);

    // Total Cost Badge
    ctx.fillStyle = 'rgba(99, 102, 241, 0.06)';
    drawCanvasRoundedRect(ctx, width - 210, 105, 180, 50, 12);
    ctx.fill();

    ctx.font = '600 10px "Be Vietnam Pro", "Segoe UI", sans-serif';
    ctx.fillStyle = '#6366f1';
    ctx.fillText('TỔNG CHI PHÍ', width - 195, 121);
    ctx.font = 'bold 18px "Be Vietnam Pro", "Segoe UI", sans-serif';
    ctx.fillStyle = '#6366f1';
    ctx.fillText(formatMoney(data.totalCost), width - 195, 143);

    drawCanvasDashedLine(ctx, 20, 175, width - 20, 175);

    // Items details
    let y = 205;
    data.items.forEach(item => {
      if (item.type === 'member') {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.03)';
        drawCanvasRoundedRect(ctx, 20, y - 18, width - 40, 32, 8);
        ctx.fill();
      }

      ctx.textAlign = 'left';
      ctx.font = item.type === 'member' ? '600 13px "Be Vietnam Pro", "Segoe UI", sans-serif' : '500 13px "Be Vietnam Pro", "Segoe UI", sans-serif';
      ctx.fillStyle = '#1e293b';
      const labelText = item.type === 'member' ? (item.gender === 'nam' ? `🤵🏻‍♂️ ${item.label}` : `👩🏻‍💼 ${item.label}`) : item.label;
      ctx.fillText(labelText, 30, y);

      ctx.textAlign = 'right';
      ctx.font = 'bold 13px "Be Vietnam Pro", "Segoe UI", sans-serif';
      ctx.fillStyle = item.type === 'member' ? '#6366f1' : '#1e293b';
      ctx.fillText(item.value, width - 30, y);

      y += itemHeight;
    });

    drawCanvasDashedLine(ctx, 20, y - 10, width - 20, y - 10);
    y += 15;

    if (data.difference !== undefined) {
      ctx.textAlign = 'left';
      ctx.font = '600 13px "Be Vietnam Pro", "Segoe UI", sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Thu được:', 30, y + 10);
      ctx.fillText('Chênh lệch:', 30, y + 35);

      ctx.textAlign = 'right';
      ctx.font = 'bold 14px "Be Vietnam Pro", "Segoe UI", sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText(formatMoney(data.totalCollected), width - 30, y + 10);

      const diff = data.difference;
      const diffLabel = diff >= 0 ? `Dư ${formatMoney(diff)}` : `Thiếu ${formatMoney(Math.abs(diff))}`;
      const diffColor = diff >= 0 ? '#10b981' : '#f43f5e';
      const diffBg = diff >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)';

      ctx.fillStyle = diffBg;
      ctx.font = 'bold 13px "Be Vietnam Pro", "Segoe UI", sans-serif';
      const textWidth = ctx.measureText(diffLabel).width;
      const badgeWidth = textWidth + 20;
      drawCanvasRoundedRect(ctx, width - 30 - badgeWidth, y + 20, badgeWidth, 24, 6);
      ctx.fill();

      ctx.fillStyle = diffColor;
      ctx.fillText(diffLabel, width - 40, y + 36);

      y += 50;
    }

    ctx.textAlign = 'center';
    ctx.font = 'italic 10px "Be Vietnam Pro", "Segoe UI", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Cầu Lông Fluid Pro • Tính toán tự động chuẩn xác 🏸', width / 2, y + 20);

    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}

function drawCanvasDashedLine(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawCanvasRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function copyReceiptImage() {
  triggerHaptic('light');
  if (!currentReceiptData) return;
  try {
    showToast('Đang tạo ảnh... ⏳');
    const blob = await drawReceiptCanvas(currentReceiptData);
    
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      showToast('Đã copy ảnh vào bộ nhớ! 🖼️✓');
    } else {
      showImgPreview(blob);
      showToast('Không hỗ trợ copy trực tiếp, hãy chạm giữ ảnh để Copy!');
    }
  } catch (e) {
    console.error(e);
    try {
      const blob = await drawReceiptCanvas(currentReceiptData);
      showImgPreview(blob);
      showToast('Chạm giữ ảnh để sao chép nhé!');
    } catch(err) {
      showToast('Lỗi tạo ảnh');
    }
  }
}

async function downloadReceiptImage() {
  triggerHaptic('light');
  if (!currentReceiptData) return;
  try {
    showToast('Đang chuẩn bị tải... ⏳');
    const blob = await drawReceiptCanvas(currentReceiptData);
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      showImgPreview(blob);
      showToast('Hãy chạm giữ ảnh và chọn "Lưu ảnh" nhé!');
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bien_lai_${currentReceiptData.date.replace(/\//g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Đã tải ảnh xuống! 📥✓');
  } catch (e) {
    console.error(e);
    try {
      const blob = await drawReceiptCanvas(currentReceiptData);
      showImgPreview(blob);
      showToast('Hãy chạm giữ ảnh và chọn "Lưu ảnh" nhé!');
    } catch(err) {
      showToast('Lỗi tải ảnh');
    }
  }
}

async function shareReceiptImage() {
  triggerHaptic('light');
  if (!currentReceiptData) return;
  try {
    showToast('Đang tạo ảnh chia sẻ... ⏳');
    const blob = await drawReceiptCanvas(currentReceiptData);
    const file = new File([blob], `bien_lai_${currentReceiptData.date.replace(/\//g, '-')}.png`, { type: 'image/png' });
    
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Biên Lai Cầu Lông',
        text: 'Chi tiết phân bổ chi phí chơi cầu lông 🏸'
      });
    } else {
      showImgPreview(blob);
      showToast('Không hỗ trợ chia sẻ trực tiếp, hãy chạm giữ ảnh!');
    }
  } catch (e) {
    console.error(e);
    try {
      const blob = await drawReceiptCanvas(currentReceiptData);
      showImgPreview(blob);
      showToast('Chạm giữ ảnh để gửi qua Zalo/Messenger!');
    } catch(err) {
      showToast('Lỗi chia sẻ ảnh');
    }
  }
}

function showImgPreview(blob) {
  if (imgPreviewUrl) URL.revokeObjectURL(imgPreviewUrl);
  const url = URL.createObjectURL(blob);
  imgPreviewUrl = url;
  const img = document.createElement('img');
  img.src = url;
  img.style.maxWidth = '100%';
  img.style.borderRadius = '12px';
  img.style.boxShadow = 'var(--shadow-soft)';
  
  const container = document.getElementById('imgPreviewContainer');
  if(container) {
    container.innerHTML = '';
    container.appendChild(img);
  }
  
  let overlay = document.getElementById('imgPreviewOverlay');
  setOverlayState(overlay, true);
}

function closeImgPreview() {
  triggerHaptic('light');
  let overlay = document.getElementById('imgPreviewOverlay');
  setOverlayState(overlay, false);
  if (imgPreviewUrl) {
    URL.revokeObjectURL(imgPreviewUrl);
    imgPreviewUrl = null;
  }
}

// ======================== 26. Initialization ==============================

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(typeof Storage !== 'undefined' ? Storage.getTheme() : 'light');

  // Date
  let today = new Date();
  let local = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
  let dateStr = local.toISOString().split('T')[0];
  let dateInput = document.getElementById('dateInput');
  if(dateInput) {
    dateInput.value = dateStr;
    updateDateDisplay(dateStr);
    dateInput.addEventListener('change', (e) => { updateDateDisplay(e.target.value); e.target.blur(); });
  }

  // Sync status
  let syncStatus = document.getElementById('syncStatus');
  if(syncStatus) syncStatus.style.display = 'none';

  // Members from Storage
  let storedMembers = typeof Storage !== 'undefined' ? Storage.getMembers() : [];
  if (storedMembers && storedMembers.length > 0) {
    renderMembersFromStorage();
  }
  else {
    saveMembersState();
  }

  // Sân Nhà Defaults
  if(typeof Storage !== 'undefined' && typeof Calculator !== 'undefined') {
    let settings = Storage.getSettings();
    let sanNhaNuGL = document.getElementById('sanNhaNuGL');
    let sanNhaGLOffset = document.getElementById('sanNhaGLOffset');
    let sanNhaNamOffset = document.getElementById('sanNhaNamOffset');
    let sanNhaNuGLToggle = document.getElementById('sanNhaNuGLToggle');
    let sanNhaNuGLInputWrap = document.getElementById('sanNhaNuGLInputWrap');
    let sanNhaNamHonNuWrap = document.getElementById('sanNhaNamHonNuWrap');
    
    if(sanNhaNuGL) {
      sanNhaNuGL.value = Calculator.formatCurrencyValue(settings.sanNhaNuGL);
      sanNhaNuGL.addEventListener('change', function() {
        let s = Storage.getSettings(); s.sanNhaNuGL = parseMoney(this.value); Storage.saveSettings(s);
      });
    }
    
    if(sanNhaGLOffset) {
      sanNhaGLOffset.value = Calculator.formatCurrencyValue(settings.sanNhaGLOffset);
      sanNhaGLOffset.addEventListener('change', function() {
        let s = Storage.getSettings(); s.sanNhaGLOffset = parseMoney(this.value); Storage.saveSettings(s);
      });
    }
    
    if(sanNhaNamOffset) {
      sanNhaNamOffset.value = Calculator.formatCurrencyValue(settings.sanNhaNamOffset);
      sanNhaNamOffset.addEventListener('change', function() {
        let s = Storage.getSettings(); s.sanNhaNamOffset = parseMoney(this.value); Storage.saveSettings(s);
      });
    }
    
    if(sanNhaNuGLToggle) {
      sanNhaNuGLToggle.checked = settings.sanNhaNuGLToggle;
      if (settings.sanNhaNuGLToggle) {
        if(sanNhaNuGLInputWrap) sanNhaNuGLInputWrap.style.display = 'flex';
        if(sanNhaNamHonNuWrap) sanNhaNamHonNuWrap.style.display = 'none';
      } else {
        if(sanNhaNuGLInputWrap) sanNhaNuGLInputWrap.style.display = 'none';
        if(sanNhaNamHonNuWrap) sanNhaNamHonNuWrap.style.display = 'flex';
      }
    }
  }

  // Public mode
  if (isPublicMode) {
    document.body.classList.add('public-mode');
    let mainTabs = document.getElementById('mainTabContainer');
    if(mainTabs) mainTabs.classList.add('public-mode-hidden');
    let tabContainer = document.getElementById('tabContainer');
    if(tabContainer) tabContainer.classList.add('public-mode-hidden');
    mode = 'away';
    
    let fTeam = document.getElementById('fixedTeamWrap');
    if(fTeam) fTeam.classList.add('hidden');
    
    let gTitle = document.getElementById('guestTitle');
    if(gTitle) gTitle.innerText = "THÔNG TIN NGƯỜI CHƠI";
    
    let mainTitle = document.getElementById('mainTitle');
    if(mainTitle) mainTitle.innerHTML = 'Tính Tiền <span style="color: var(--accent)">Cầu Lông</span>';
    
    let splitMethod = document.getElementById('splitMethodContainer');
    if(splitMethod) splitMethod.style.display = 'flex';
    
  }

  // Share button visibility
  if (!navigator.share) {
    let shareBtn = document.getElementById('shareBtn');
    if (shareBtn) shareBtn.style.display = 'none';
  }

  // Start on the private dashboard or the public calculator.
  switchMainTab(isPublicMode ? 'calc' : 'dashboard');
  if (isPublicMode) {
    const backButton = document.getElementById('headerBackBtn');
    if (backButton) backButton.style.display = 'none';
  }
  updateLiveSummary();
});

// ======================== 27. Global click handlers ==============================

document.addEventListener('click', function (event) {
  let wrapper = document.getElementById('customSelectWrapper');
  if (wrapper && !wrapper.contains(event.target)) { 
    wrapper.classList.remove('open');
    wrapper.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
  }

  const overlayClosers = {
    customPromptOverlay: () => closeCustomPrompt(false),
    profileOverlay: closeProfile,
    qrPaymentOverlay: closeQRPayment,
    qrSettingsOverlay: closeQRSettings,
    exportOverlay: closeExportModal,
    imgPreviewOverlay: closeImgPreview,
    resultSheet: closeSheet
  };
  if (event.target === event.currentTarget) return;
  const closer = event.target?.id ? overlayClosers[event.target.id] : null;
  if (closer && event.target.classList.contains('show')) closer();
});

document.addEventListener('keydown', function (event) {
  if (event.key !== 'Escape') return;
  const prompt = document.getElementById('customPromptOverlay');
  if (prompt?.classList.contains('show')) { closeCustomPrompt(false); return; }
  const overlays = [
    ['imgPreviewOverlay', closeImgPreview],
    ['qrPaymentOverlay', closeQRPayment],
    ['profileOverlay', closeProfile],
    ['qrSettingsOverlay', closeQRSettings],
    ['exportOverlay', closeExportModal],
    ['resultSheet', closeSheet]
  ];
  const active = overlays.find(([id]) => document.getElementById(id)?.classList.contains('show'));
  if (active) active[1]();
});

document.getElementById('calcView')?.addEventListener('input', updateLiveSummary);
