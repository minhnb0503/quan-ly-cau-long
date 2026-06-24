// ============================================================
//  app.js — Cầu Lông Fluid Pro · Main Application Logic
// ============================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwNEr60FdL26zfy-EwqlburOHdvrr5bFBK2lN6XAZftAO4lTR4G4-h0XSU-54114PJI/exec";

// ======================== STATE ==============================
let mode = 'home';
let isCauDetailMode = false;
let moneyHistory = { 'tienSan': [], 'tienCau': [] };
let isPublicMode = false;
let userIPInfo = "Đang lấy IP...";
let currentSplitMethod = 'nam20k';
let isShowingQR = false;
let customCount = { nam: 1, nu: 1 };
let promptResolve;
let lastTeleStr = '';  // stored for copy/share
let isFixedPriceMode = false;

// ======================== UTILS ==============================

async function fetchUserIP() {
  try {
    let response = await fetch('https://api.ipify.org?format=json');
    let data = await response.json();
    userIPInfo = data.ip;
  } catch (error) { userIPInfo = "Không xác định"; }
}

function getOS() {
  let userAgent = window.navigator.userAgent, platform = window.navigator.platform,
      macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'],
      windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'],
      iosPlatforms = ['iPhone', 'iPad', 'iPod'], os = null;
  if (macosPlatforms.indexOf(platform) !== -1) os = 'Mac OS';
  else if (iosPlatforms.indexOf(platform) !== -1) os = 'iOS';
  else if (windowsPlatforms.indexOf(platform) !== -1) os = 'Windows';
  else if (/Android/.test(userAgent)) os = 'Android';
  else if (!os && /Linux/.test(platform)) os = 'Linux';
  return os || 'Unknown';
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
  toast.innerText = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration || 2500);
}

// ======================== FORMAT / VALIDATE ===================

function formatCurrency(input) {
  let v = input.value.replace(/\D/g, '');
  input.value = v ? Calculator.formatCurrencyValue(parseInt(v, 10)) : "";
}

function formatMoney(n) {
  return Calculator.formatMoney(n);
}

function parseMoney(str) {
  return Calculator.parseMoney(str);
}

function handleInputFocus(el) {
  if (el.value === '0') { el.value = ''; }
  setTimeout(function () { el.selectionStart = el.selectionEnd = el.value.length; }, 10);
}

function validateInputEmpty(el) {
  let v = el.value.replace(/\D/g, '');
  el.value = v ? Calculator.formatCurrencyValue(parseInt(v, 10)) : '';
}

function validateInputZero(el) {
  let v = el.value.replace(/\D/g, '');
  if (v === '' || isNaN(parseInt(v))) { el.value = '0'; }
  else { el.value = parseInt(v, 10).toString(); }
}

// ======================== DATE ================================

function updateDateDisplay(val) {
  if (!val) return;
  let parts = val.split('-');
  document.getElementById('displayDate').innerText = `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ======================== TABS ================================

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

  if (selected === 'home') {
    ind.style.transform = 'translateX(0)';
    tHome.classList.add('active');
    tAway.classList.remove('active');
    fTeam.classList.remove('hidden');
    gTitle.innerText = "KHÁCH GIAO LƯU";
    splitContainer.style.display = 'none';
    document.getElementById('nuCoDinhWrap').style.display = 'none';
    document.getElementById('namCoDinhWrap').style.display = 'none';
    document.getElementById('nuCoDinhWrap2').style.display = 'none';
    document.getElementById('labelNamGL').innerText = "🤵🏻‍♂️ Số Nam";
    document.getElementById('labelNuGL').innerText = "👩🏻‍💼 Số Nữ";
    if (fpWrap) fpWrap.style.display = '';
  } else {
    ind.style.transform = 'translateX(100%)';
    tAway.classList.add('active');
    tHome.classList.remove('active');
    fTeam.classList.add('hidden');
    gTitle.innerText = "THÔNG TIN NGƯỜI CHƠI";
    splitContainer.style.display = 'flex';
    if (fpWrap) fpWrap.style.display = 'none';

    if (currentSplitMethod === 'nuCoDinh') document.getElementById('nuCoDinhWrap').style.display = 'flex';

  }
}

// ======================== DROPDOWN ============================

function toggleDropdown() {
  triggerHaptic('light');
  document.getElementById('customSelectWrapper').classList.toggle('open');
}

function selectMethod(value, text) {
  triggerHaptic('light');
  currentSplitMethod = value;
  document.getElementById('splitMethodText').innerText = text;
  document.getElementById('customSelectWrapper').classList.remove('open');

  document.getElementById('opt-nam20k').classList.remove('selected');
  document.getElementById('opt-chiaDeu').classList.remove('selected');
  document.getElementById('opt-nuCoDinh').classList.remove('selected');
  document.getElementById('opt-' + value).classList.add('selected');

  if (value === 'nuCoDinh') {
    document.getElementById('nuCoDinhWrap').style.display = 'flex';
  } else {
    document.getElementById('nuCoDinhWrap').style.display = 'none';
  }

  document.getElementById('namCoDinhWrap').style.display = 'none';
  document.getElementById('nuCoDinhWrap2').style.display = 'none';
  document.getElementById('labelNamGL').innerText = "🤵🏻‍♂️ Số Nam";
  document.getElementById('labelNuGL').innerText = "👩🏻‍💼 Số Nữ";
}

// ======================== CAU DETAIL ==========================

function toggleCauMode() {
  triggerHaptic('light');
  isCauDetailMode = document.getElementById('cauToggleSwitch').checked;
  let m1 = document.getElementById('cauMode1Wrap');
  let m2 = document.getElementById('cauMode2Wrap');
  let inner1 = m1.querySelector('.mode-inner');
  let inner2 = m2.querySelector('.mode-inner');
  if (isCauDetailMode) {
    m1.style.gridTemplateRows = '0fr'; inner1.style.opacity = '0';
    m2.style.gridTemplateRows = '1fr'; inner2.style.opacity = '1';
  } else {
    m2.style.gridTemplateRows = '0fr'; inner2.style.opacity = '0';
    m1.style.gridTemplateRows = '1fr'; inner1.style.opacity = '1';
  }
}

function addCauRow() {
  triggerHaptic('light');
  let container = document.getElementById('cauListContainer');
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
}

function updateCauTotal() {
  let items = [];
  document.querySelectorAll('.cau-item').forEach(item => {
    let giaTup = parseMoney(item.querySelector('.giaCau').value);
    let slInput = item.querySelector('.slCau');
    let soQuaStr = slInput.value.replace(/[^0-9]/g, '');
    if (soQuaStr !== slInput.value) slInput.value = soQuaStr;
    let soQua = parseInt(soQuaStr) || 0;
    items.push({ giaTup, soQua });
  });
  let result = Calculator.calcCauDetail(items);
  document.getElementById('cauTotalIndicator').innerText = "Thành tiền: " + formatMoney(result.total);
  return result.total;
}

// ======================== MONEY CHIPS =========================

function addMoney(id, amount) {
  triggerHaptic('light');
  let el = document.getElementById(id);
  let currentVal = parseMoney(el.value);
  if (!moneyHistory[id]) moneyHistory[id] = [];
  moneyHistory[id].push(currentVal);
  el.value = (currentVal + amount).toString();
  formatCurrency(el);
  let undoBtn = document.getElementById('undo_' + id);
  if (undoBtn) undoBtn.classList.remove('disabled');
  if (id === 'giaCau') updateCauTotal();
}

function clearMoney(id) {
  triggerHaptic('heavy');
  let el = document.getElementById(id);
  let currentVal = parseMoney(el.value);
  if (currentVal === 0) return;
  if (!moneyHistory[id]) moneyHistory[id] = [];
  moneyHistory[id].push(currentVal);
  el.value = '';
  let undoBtn = document.getElementById('undo_' + id);
  if (undoBtn) undoBtn.classList.remove('disabled');
  if (id === 'giaCau') updateCauTotal();
}

function undoMoney(id) {
  triggerHaptic('light');
  if (!moneyHistory[id] || moneyHistory[id].length === 0) return;
  let el = document.getElementById(id);
  let lastVal = moneyHistory[id].pop();
  if (lastVal === 0) el.value = '';
  else { el.value = lastVal.toString(); formatCurrency(el); }
  if (moneyHistory[id].length === 0) {
    let undoBtn = document.getElementById('undo_' + id);
    if (undoBtn) undoBtn.classList.add('disabled');
  }
  if (id === 'giaCau') updateCauTotal();
}

function clearUndo(id) {
  if (!moneyHistory[id]) moneyHistory[id] = [];
  moneyHistory[id] = [];
  let undoBtn = document.getElementById('undo_' + id);
  if (undoBtn) undoBtn.classList.add('disabled');
}

// ======================== STEPPER =============================

function stepVal(id, step) {
  triggerHaptic('light');
  let el = document.getElementById(id);
  let val = (parseInt(el.value) || 0) + step;
  if (val < 0) val = 0;
  el.value = val;
}

// ======================== CUSTOM PROMPT =======================

function openCustomPrompt(title, defaultText) {
  return new Promise(resolve => {
    triggerHaptic('light');
    promptResolve = resolve;
    document.getElementById('customPromptTitle').innerText = title;
    let input = document.getElementById('customPromptInput');
    input.value = '';
    input.placeholder = `Vd: ${defaultText}`;
    document.getElementById('customPromptOverlay').classList.add('show');

    setTimeout(() => input.focus(), 100);

    input.onkeydown = function (e) {
      if (e.key === 'Enter') closeCustomPrompt(true);
    };
  });
}

function closeCustomPrompt(isConfirm) {
  triggerHaptic('light');
  document.getElementById('customPromptOverlay').classList.remove('show');
  if (isConfirm) {
    promptResolve(document.getElementById('customPromptInput').value);
  } else {
    promptResolve(null);
  }
}

// ======================== MEMBERS =============================

function renderMembersFromStorage() {
  let members = Storage.getMembers();
  let grid = document.getElementById('tagsGrid');
  grid.innerHTML = '';
  members.forEach(m => {
    let tag = document.createElement('div');
    tag.className = 'player-tag' + (m.isDefault !== false ? ' active' : '');
    if (!m.isDefault) tag.classList.add('custom-tag');
    tag.setAttribute('data-name', m.name);
    tag.setAttribute('data-gender', m.gender);
    tag.onclick = function () { toggleTag(this); };

    if (m.isDefault) {
      tag.textContent = m.name;
    } else {
      tag.innerHTML = `${m.name} <span style="margin-left:6px; font-size:12px; color:inherit; opacity:0.6; padding: 2px 6px; border-radius:50%; background:rgba(0,0,0,0.1)" onclick="event.stopPropagation(); triggerHaptic('heavy'); this.parentElement.remove(); saveMembersState();">✕</span>`;
    }
    grid.appendChild(tag);
  });
}

function saveMembersState() {
  let members = [];
  document.querySelectorAll('#tagsGrid .player-tag').forEach(tag => {
    members.push({
      name: tag.getAttribute('data-name'),
      gender: tag.getAttribute('data-gender'),
      isDefault: !tag.classList.contains('custom-tag')
    });
  });
  Storage.saveMembers(members);
}

function toggleTag(el) {
  triggerHaptic('light');
  el.classList.toggle('active');
  saveMembersState();
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

  let grid = document.getElementById('tagsGrid');
  let newTag = document.createElement('div');
  newTag.className = 'player-tag active custom-tag anim-pop';
  newTag.setAttribute('data-name', finalName);
  newTag.setAttribute('data-gender', gender);
  newTag.innerHTML = `${finalName} <span style="margin-left:6px; font-size:12px; color:inherit; opacity:0.6; padding: 2px 6px; border-radius:50%; background:rgba(0,0,0,0.1)" onclick="event.stopPropagation(); triggerHaptic('heavy'); this.parentElement.remove(); saveMembersState();">✕</span>`;
  newTag.onclick = function () { toggleTag(this); };
  grid.appendChild(newTag);
  saveMembersState();
}

// ======================== TÙY CHỈNH SÂN NHÀ ===================

function toggleSanNhaNuGL() {
  triggerHaptic('light');
  let isNuGL = document.getElementById('sanNhaNuGLToggle').checked;
  if (isNuGL) {
    document.getElementById('sanNhaNuGLInputWrap').style.display = 'flex';
    document.getElementById('sanNhaNamHonNuWrap').style.display = 'none';
  } else {
    document.getElementById('sanNhaNuGLInputWrap').style.display = 'none';
    document.getElementById('sanNhaNamHonNuWrap').style.display = 'flex';
  }
  let s = Storage.getSettings();
  s.sanNhaNuGLToggle = isNuGL;
  Storage.saveSettings(s);
}

// ======================== QR ==================================

function closeSheet() {
  document.getElementById('resultSheet').classList.remove('show');
}

function toggleQR() {
  triggerHaptic('light');
  isShowingQR = !isShowingQR;
  let qrBtn = document.getElementById('qrBtn');
  let content = document.getElementById('receiptContainer');
  let qrCont = document.getElementById('qrContainer');

  if (isShowingQR) {
    content.style.display = 'none';
    qrCont.style.display = 'block';
    qrBtn.innerHTML = '🧾 Xem Biên Lai';
  } else {
    content.style.display = 'block';
    qrCont.style.display = 'none';
    qrBtn.innerHTML = '💳 QR Chủ sân';
  }
}

// ======================== RECEIPT TABS =========================

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
    tabReceipt.classList.add('active');
    tabHistory.classList.remove('active');
    receiptContainer.style.display = '';
    if (lastTeleStr) shareActions.style.display = '';
    historySection.style.display = 'none';
    syncStatus.style.display = '';
    if (!isPublicMode && mode === 'home') qrBtn.style.display = '';
  } else {
    tabReceipt.classList.remove('active');
    tabHistory.classList.add('active');
    receiptContainer.style.display = 'none';
    shareActions.style.display = 'none';
    historySection.style.display = '';
    syncStatus.style.display = 'none';
    qrContainer.style.display = 'none';
    qrBtn.style.display = 'none';
    renderHistory();
  }
}

// ======================== HISTORY =============================

function renderHistory() {
  let history = Storage.getHistory();
  let container = document.getElementById('historyList');
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
            <div style="font-weight: 700; font-size: 14px; color: var(--text-main);">${item.date}</div>
            <div style="font-size: 12px; color: var(--text-sub); margin-top: 2px;">${modeLabel} · ${formatMoney(item.totalCost)}</div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn-remove-cau" onclick="event.stopPropagation(); deleteHistoryItem(${idx})" title="Xóa">✕</button>
          </div>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

function viewHistoryItem(idx) {
  triggerHaptic('light');
  let history = Storage.getHistory();
  if (!history[idx]) return;
  let item = history[idx];
  document.getElementById('receiptContent').innerHTML = item.receipt;
  lastTeleStr = item.teleStr || '';
  switchReceiptTab('receipt');
}

function deleteHistoryItem(idx) {
  triggerHaptic('heavy');
  Storage.removeFromHistory(idx);
  renderHistory();
  showToast('Đã xóa! 🗑️');
}

function clearAllHistory() {
  triggerHaptic('heavy');
  Storage.clearHistory();
  renderHistory();
  showToast('Đã xóa toàn bộ lịch sử! 🗑️');
}

// ======================== COPY / SHARE ========================

function copyReceipt() {
  triggerHaptic('light');
  if (!lastTeleStr) return;
  let plainText = lastTeleStr.replace(/<b>/g, '').replace(/<\/b>/g, '').replace(/\\n/g, '\n');
  navigator.clipboard.writeText(plainText).then(() => {
    let btn = document.getElementById('copyBtn');
    btn.innerText = 'Đã copy! ✓';
    btn.style.background = 'rgba(16, 185, 129, 0.15)';
    btn.style.color = '#10b981';
    setTimeout(() => {
      btn.innerText = '📋 Copy';
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  }).catch(() => {
    showToast('Không thể copy, hãy thử lại');
  });
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

// ======================== RESET ===============================

function resetForm() {
  triggerHaptic('heavy');
  document.getElementById('tienSan').value = '';
  document.getElementById('tienCau').value = '';
  document.getElementById('namGL').value = '0';
  document.getElementById('nuGL').value = '0';
  document.getElementById('namCD').value = '0';
  document.getElementById('nuCD').value = '0';
  document.getElementById('nuCoDinhGia').value = '50.000';

  customCount = { nam: 1, nu: 1 };

  let cauList = document.getElementById('cauListContainer');
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

  selectMethod('nam20k', 'Luật: Nam nộp hơn Nữ 20k');
  clearUndo('tienSan');
  clearUndo('tienCau');

  // Reset fixed price
  isFixedPriceMode = false;
  let fpToggle = document.getElementById('fixedPriceToggle');
  if (fpToggle) fpToggle.checked = false;
  let fpSection = document.getElementById('fixedPriceSection');
  if (fpSection) fpSection.style.display = 'none';
  loadFixedPriceDefaults();

  // Remove custom tags, re-render from default members
  let defaultMembers = [
    { name: 'Minh', gender: 'nam', isDefault: true },
    { name: 'Thảo', gender: 'nu', isDefault: true },
    { name: 'Tú', gender: 'nam', isDefault: true },
    { name: 'Quân', gender: 'nam', isDefault: true },
    { name: 'Ly', gender: 'nu', isDefault: true }
  ];
  Storage.saveMembers(defaultMembers);
  renderMembersFromStorage();

  if (!isPublicMode) { switchTab('home'); }
  closeSheet();

  let emptyStateHTML = '<div class="empty-state"><svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg><div class="empty-text">Chưa có dữ liệu tính toán.<br>Hãy nhập số tiền và thực hiện cú <strong>Smash "Phân Bổ"</strong> ngay nhé! 🏸</div></div>';
  document.getElementById('receiptContent').innerHTML = emptyStateHTML;
  document.getElementById('qrBtn').style.display = 'none';
  document.getElementById('syncStatus').style.display = 'none';
  document.getElementById('shareActions').style.display = 'none';
  lastTeleStr = '';
  updateCauTotal();
  showToast('Đã làm sạch form sẵn sàng cho trận mới! 🏸');
}

// ======================== PROCESS DATA ========================

function processData() {
  let dateRaw = document.getElementById('dateInput').value;
  if (!dateRaw) { alert("Chọn ngày đi đã!"); return; }
  let dateStr = dateRaw.split('-').reverse().join('/');

  let san = parseMoney(document.getElementById('tienSan').value);
  let cau = 0;
  let cauDisplay = `<strong>${formatMoney(cau)}</strong>`;
  let teleCauStr = `🏸 Cầu: ${formatMoney(cau)}`;

  if (isCauDetailMode) {
    let items = [];
    document.querySelectorAll('.cau-item').forEach(item => {
      let giaTup = parseMoney(item.querySelector('.giaCau').value);
      let soQua = parseInt(item.querySelector('.slCau').value) || 0;
      items.push({ giaTup, soQua });
    });
    let cauResult = Calculator.calcCauDetail(items);
    cau = cauResult.total;
    let detailText = cauResult.detailText;
    cauDisplay = `<div style="text-align:right"><strong>${formatMoney(cau)}</strong><div class="receipt-sub" style="margin-top:0">${detailText}</div></div>`;
    teleCauStr = `🏸 Cầu: ${formatMoney(cau)} (${detailText})`;
  } else {
    cau = parseMoney(document.getElementById('tienCau').value);
    cauDisplay = `<strong>${formatMoney(cau)}</strong>`;
    teleCauStr = `🏸 Cầu: ${formatMoney(cau)}`;
  }

  let totalCost = san + cau;
  let namGL = parseInt(document.getElementById('namGL').value) || 0;
  let nuGL = parseInt(document.getElementById('nuGL').value) || 0;

  let html = `
    <div class="receipt-item"><span style="color:var(--text-sub); font-weight:600;">💎 Tiền Sân:</span> <strong>${formatMoney(san)}</strong></div>
    <div class="receipt-item"><span style="color:var(--text-sub); font-weight:600;">🏸 Tiền Cầu:</span> ${cauDisplay}</div>
    <div class="divider-dash"></div>
    <div class="receipt-item"><span><strong>TỔNG CHI PHÍ:</strong></span> <strong style="color:var(--accent); font-size: 20px;">${formatMoney(totalCost)}</strong></div>
    <div class="divider"></div>
  `;
  let teleStr = `<b>🏸 BẢNG TÍNH ${mode === 'away' ? 'SÂN KHÁCH' : 'SÂN NHÀ'} (${dateStr})</b>\\n💎 Sân: ${formatMoney(san)} | ${teleCauStr}\\n------------------\\n`;

  let settings = Storage.getSettings();

  if (mode === 'away') {
    document.getElementById('qrBtn').style.display = 'none';

    if (currentSplitMethod === 'sanNha') {
      let namCD = parseInt(document.getElementById('namCD').value) || 0;
      let nuCD = parseInt(document.getElementById('nuCD').value) || 0;
      let totalP = namCD + nuCD + namGL + nuGL;
      if (totalP === 0) { alert("Nhập số lượng người chơi nhé!"); return; }

      let result = Calculator.calcSanNhaRule(totalCost, namCD, nuCD, namGL, nuGL, settings);

      if (namCD) {
        html += `<div class="receipt-item"><span>🏅 Nam Cố định x${namCD}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(result.pNam)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(result.pNam * namCD)}</div></div></div>`;
        teleStr += `🏅 Nam CD (${namCD}): <b>${formatMoney(result.pNam * namCD)}</b> (${formatMoney(result.pNam)}/ng)\\n`;
      }
      if (nuCD) {
        html += `<div class="receipt-item"><span>🏅 Nữ Cố định x${nuCD}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(result.pNu)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(result.pNu * nuCD)}</div></div></div>`;
        teleStr += `🏅 Nữ CD (${nuCD}): <b>${formatMoney(result.pNu * nuCD)}</b> (${formatMoney(result.pNu)}/ng)\\n`;
      }
      if (namGL || nuGL) {
        html += `<div class="divider-dash" style="margin-top:8px"></div>`;
        teleStr += `------------------\\n`;
      }
      if (namGL) {
        html += `<div class="receipt-item"><span>👤 Nam Giao lưu x${namGL}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(result.pNamGL)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(result.pNamGL * namGL)}</div></div></div>`;
        teleStr += `👤 Nam GL (${namGL}): <b>${formatMoney(result.pNamGL * namGL)}</b> (${formatMoney(result.pNamGL)}/ng)\\n`;
      }
      if (nuGL) {
        html += `<div class="receipt-item"><span>👤 Nữ Giao lưu x${nuGL}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(result.pNuGL)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(result.pNuGL * nuGL)}</div></div></div>`;
        teleStr += `👤 Nữ GL (${nuGL}): <b>${formatMoney(result.pNuGL * nuGL)}</b> (${formatMoney(result.pNuGL)}/ng)\\n`;
      }

    } else {
      let totalP = namGL + nuGL;
      if (totalP === 0) { alert("Nhập số lượng người chơi nhé!"); return; }

      let pNam = 0, pNu = 0;

      if (currentSplitMethod === 'nuCoDinh') {
        let nuPrice = parseMoney(document.getElementById('nuCoDinhGia').value);
        let result = Calculator.calcNuCoDinh(totalCost, namGL, nuGL, nuPrice);
        pNam = result.pNam;
        pNu = result.pNu;
      } else if (currentSplitMethod === 'nam20k') {
        let result = Calculator.calcNam20k(totalCost, namGL, nuGL, settings.offsetNam20k);
        pNam = result.pNam;
        pNu = result.pNu;
      } else {
        // chiaDeu
        let result = Calculator.calcChiaDeu(totalCost, namGL, nuGL);
        pNam = result.pNam;
        pNu = result.pNu;
      }

      if (namGL) {
        html += `<div class="receipt-item"><span>🤵🏻‍♂️ Nam x${namGL}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(pNam)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(pNam * namGL)}</div></div></div>`;
        teleStr += `🤵🏻‍♂️ Nam (${namGL}): <b>${formatMoney(pNam * namGL)}</b> (${formatMoney(pNam)}/ng)\\n`;
      }
      if (nuGL) {
        html += `<div class="receipt-item"><span>👩🏻‍💼 Nữ x${nuGL}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(pNu)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(pNu * nuGL)}</div></div></div>`;
        teleStr += `👩🏻‍💼 Nữ (${nuGL}): <b>${formatMoney(pNu * nuGL)}</b> (${formatMoney(pNu)}/ng)\\n`;
      }
    }

  } else {
    // HOME MODE
    if (!isPublicMode) { document.getElementById('qrBtn').style.display = 'block'; }

    let activeTags = document.querySelectorAll('#tagsGrid .player-tag.active');
    let activeMembers = [];
    activeTags.forEach(tag => {
      activeMembers.push({
        name: tag.getAttribute('data-name'),
        gender: tag.getAttribute('data-gender')
      });
    });

    let totalP = activeMembers.length + namGL + nuGL;
    if (totalP === 0) { alert("Chưa ai ra sân cả!"); return; }

    let nuGLPrice = parseMoney(document.getElementById('sanNhaNuGL').value);
    let glOffset = parseMoney(document.getElementById('sanNhaGLOffset').value);
    let namOffset = parseMoney(document.getElementById('sanNhaNamOffset').value);
    let isNuGLMode = document.getElementById('sanNhaNuGLToggle').checked;
    
    let result = Calculator.calcSanNha(totalCost, activeMembers, namGL, nuGL, isNuGLMode, nuGLPrice, namOffset, glOffset);

    let pNamCD = result.pNamCD;
    let pNuCD = result.pNuCD;
    let pNamGL = result.pNamGL;
    let pNuGL = result.pNuGL;

    let fixedMembersHtml = "";
    result.memberResults.forEach(mr => {
      let icon = mr.gender === 'nam' ? '🤵🏻‍♂️' : '👩🏻‍💼';
      fixedMembersHtml += `<div class="receipt-item fixed-member"><span>${mr.name}</span> <strong class="price-badge">${formatMoney(mr.price)}</strong></div>`;
      teleStr += `${icon} ${mr.name}: <b>${formatMoney(mr.price)}</b>\\n`;
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
    }
    if (nuGL) {
      html += `<div class="receipt-item"><span>Nữ GL x${nuGL}</span> <div style="text-align:right"><strong class="price-badge">${formatMoney(pNuGL)}/ng</strong><div class="receipt-sub">Tổng: ${formatMoney(pNuGL * nuGL)}</div></div></div>`;
      teleStr += `👤 Nữ GL (${nuGL}): <b>${formatMoney(pNuGL * nuGL)}</b> (${formatMoney(pNuGL)}/ng)\\n`;
    }

    // Difference badge
    if (result && result.difference !== undefined) {
      let diff = result.difference;
      let diffLabel = diff >= 0 ? 'Dư' : 'Thiếu';
      let diffColor = diff >= 0 ? '#10b981' : '#f43f5e';
      let diffBg = diff >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)';
      html += `<div class="divider"></div><div class="receipt-item"><span style="font-weight:700;">💰 Thu được:</span><strong>${formatMoney(result.totalCollected)}</strong></div>`;
      html += `<div class="receipt-item"><span style="font-weight:700;">📊 Chênh lệch:</span><span class="price-badge" style="background:${diffBg}; color:${diffColor};">${diffLabel} ${formatMoney(Math.abs(diff))}</span></div>`;
      teleStr += `------------------\\n💰 Thu: ${formatMoney(result.totalCollected)} | ${diffLabel}: ${formatMoney(Math.abs(diff))}\\n`;
    }
  }

  triggerHaptic('success');
  isShowingQR = false;
  lastTeleStr = teleStr;

  document.getElementById('receiptContainer').style.display = 'block';
  document.getElementById('qrContainer').style.display = 'none';
  if (!isPublicMode && mode === 'home') document.getElementById('qrBtn').innerHTML = '💳 QR Chủ sân';

  let contentContainer = document.getElementById('receiptContainer');
  let contentInner = document.getElementById('receiptContent');
  let statusEl = document.getElementById('syncStatus');
  contentContainer.classList.remove('anim-pop');
  void contentContainer.offsetWidth;
  contentInner.innerHTML = html;
  contentContainer.classList.add('anim-pop');

  // Show share actions
  let shareActions = document.getElementById('shareActions');
  shareActions.style.display = '';
  let shareBtn = document.getElementById('shareBtn');
  if (!navigator.share) { shareBtn.style.display = 'none'; }
  else { shareBtn.style.display = ''; }

  // Switch to receipt tab
  switchReceiptTab('receipt');
  document.getElementById('resultSheet').classList.add('show');

  // Save to history
  Storage.addToHistory({
    date: dateStr,
    mode: mode,
    totalCost: totalCost,
    receipt: html,
    teleStr: teleStr,
    timestamp: Date.now()
  });

  // Reporting
  let payloadInfo = {
    source: "github_web",
    reportText: teleStr,
    tracking: { ip: userIPInfo, os: getOS(), total_cost: totalCost, mode: mode, isPublic: isPublicMode ? "Có" : "Không" }
  };

  statusEl.style.display = 'block';
  statusEl.style.color = '#10b981';

  if (isPublicMode || APPS_SCRIPT_URL === "") {
    statusEl.innerText = 'Tính toán thành công! ✅';
    if (APPS_SCRIPT_URL !== "") { fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(payloadInfo) }).catch(e => e); }
    return;
  }

  statusEl.innerText = 'Ting ting! Đã báo cáo cho Minh! 💸✅';

  fetch(APPS_SCRIPT_URL, {
    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payloadInfo)
  }).catch(err => {
    statusEl.style.color = '#f43f5e';
    statusEl.innerText = 'Lỗi mạng, chưa gửi được báo cáo!';
  });
}

// ======================== INITIALIZATION ======================

document.addEventListener("DOMContentLoaded", () => {

  // IP
  fetchUserIP();

  // Date
  let today = new Date();
  let local = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
  let dateStr = local.toISOString().split('T')[0];
  let dateInput = document.getElementById('dateInput');
  dateInput.value = dateStr;
  updateDateDisplay(dateStr);
  dateInput.addEventListener('change', (e) => { updateDateDisplay(e.target.value); e.target.blur(); });

  // Sync status
  document.getElementById('syncStatus').style.display = 'none';

  // Members from Storage
  let storedMembers = Storage.getMembers();
  if (storedMembers && storedMembers.length > 0) {
    renderMembersFromStorage();
  }
  // else the HTML already has default tags — save them to storage
  else {
    saveMembersState();
  }

  // Sân Nhà Defaults
  let settings = Storage.getSettings();
  document.getElementById('sanNhaNuGL').value = Calculator.formatCurrencyValue(settings.sanNhaNuGL);
  document.getElementById('sanNhaGLOffset').value = Calculator.formatCurrencyValue(settings.sanNhaGLOffset);
  document.getElementById('sanNhaNamOffset').value = Calculator.formatCurrencyValue(settings.sanNhaNamOffset);
  document.getElementById('sanNhaNuGLToggle').checked = settings.sanNhaNuGLToggle;
  
  if (settings.sanNhaNuGLToggle) {
    document.getElementById('sanNhaNuGLInputWrap').style.display = 'flex';
    document.getElementById('sanNhaNamHonNuWrap').style.display = 'none';
  } else {
    document.getElementById('sanNhaNuGLInputWrap').style.display = 'none';
    document.getElementById('sanNhaNamHonNuWrap').style.display = 'flex';
  }

  document.getElementById('sanNhaNuGL').addEventListener('change', function() {
    let s = Storage.getSettings(); s.sanNhaNuGL = parseMoney(this.value); Storage.saveSettings(s);
  });
  document.getElementById('sanNhaGLOffset').addEventListener('change', function() {
    let s = Storage.getSettings(); s.sanNhaGLOffset = parseMoney(this.value); Storage.saveSettings(s);
  });
  document.getElementById('sanNhaNamOffset').addEventListener('change', function() {
    let s = Storage.getSettings(); s.sanNhaNamOffset = parseMoney(this.value); Storage.saveSettings(s);
  });
    document.getElementById('tabContainer').classList.add('public-mode-hidden');
    mode = 'away';
    document.getElementById('fixedTeamWrap').classList.add('hidden');
    document.getElementById('guestTitle').innerText = "THÔNG TIN NGƯỜI CHƠI";
    document.getElementById('mainTitle').innerHTML = 'Tính Tiền <span style="color: var(--accent)">Cầu Lông</span>';
    document.getElementById('splitMethodContainer').style.display = 'flex';
    let fpWrap = document.getElementById('fixedPriceWrap');
    if (fpWrap) fpWrap.style.display = 'none';
  }

  // Share button visibility
  if (!navigator.share) {
    let shareBtn = document.getElementById('shareBtn');
    if (shareBtn) shareBtn.style.display = 'none';
  }
});

// Close dropdown on outside click
document.addEventListener('click', function (event) {
  let wrapper = document.getElementById('customSelectWrapper');
  if (wrapper && !wrapper.contains(event.target)) { wrapper.classList.remove('open'); }
});
