// ============================================================
//  app.js — Cầu Lông Fluid Pro · Main Application Logic
// ============================================================

// ======================== 1. Constants & State ==============================
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwNEr60FdL26zfy-EwqlburOHdvrr5bFBK2lN6XAZftAO4lTR4G4-h0XSU-54114PJI/exec";

let mode = 'home';
let isCauDetailMode = false;
let moneyHistory = { 'tienSan': [], 'tienCau': [] };
let isPublicMode = window.location.search.includes('public=true');
let userIPInfo = "Đang lấy IP...";
let currentSplitMethod = 'nam20k';
let isShowingQR = false;
let customCount = { nam: 1, nu: 1 };
let promptResolve;
let lastTeleStr = '';
let isFixedPriceMode = false;
let currentReceiptData = null;
let currentView = 'dashboard';
let currentSessionId = null;

// ======================== 2. Utility Functions ==============================

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
  if(toast) {
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration || 2500);
  }
}

function formatCurrency(input) {
  let v = input.value.replace(/\D/g, '');
  input.value = v ? Calculator.formatCurrencyValue(parseInt(v, 10)) : "";
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
}

function validateInputZero(el) {
  let v = el.value.replace(/\D/g, '');
  if (v === '' || isNaN(parseInt(v, 10))) { el.value = '0'; }
  else { el.value = parseInt(v, 10).toString(); }
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
  
  let tDash = document.getElementById('mainTabDashboard');
  let tCalc = document.getElementById('mainTabCalc');
  let dashView = document.getElementById('dashboardView');
  let calcView = document.getElementById('calcView');
  let resetBtn = document.getElementById('resetBtn');
  let dateChip = document.getElementById('dateChip');
  let exportBtn = document.getElementById('exportBtn');
  let qrSettingsBtn = document.getElementById('qrSettingsBtn');
  let headerBackBtn = document.getElementById('headerBackBtn');

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
  }
}

function startNewSession() {
  switchMainTab('calc');
  resetForm();
  
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
  
  const stats = await Storage.getStats();
  
  animateCounter('statTotalSessions', stats.totalSessions);
  animateCounter('statUnpaidTotal', stats.unpaidTotal);
  animateCounter('statUnpaidCount', stats.unpaidCount);
  animateCounter('statMemberCount', stats.memberCount);

  const sessions = await Storage.getAllSessions();
  renderSessionCards(sessions);
  renderDashboardMembers();
}

function animateCounter(elementId, targetValue, prefix = '', suffix = '') {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  if (elementId === 'statUnpaidTotal') {
    element.innerText = formatMoney(targetValue);
    return;
  }
  
  const duration = 600;
  const start = 0;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease out quad
    const easeProgress = progress * (2 - progress);
    const current = Math.floor(start + (targetValue - start) * easeProgress);
    
    element.innerText = prefix + current + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.innerText = prefix + targetValue + suffix;
    }
  }
  
  requestAnimationFrame(update);
}

async function renderSessionCards(sessions) {
  const container = document.getElementById('sessionsList');
  if (!container) return;
  
  if (!sessions || sessions.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding: 20px;"><div class="empty-text">Chưa có buổi đánh nào. Nhấn "Bắt đầu tính tiền" để tạo buổi mới!</div></div>';
    return;
  }
  
  // Sort by date desc
  sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  let html = '';
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const modeBadge = s.mode === 'home' ? '<span class="badge badge-home">Sân Nhà</span>' : '<span class="badge badge-away">Sân Khách</span>';
    const statusBadge = s.status === 'open' ? '<span class="badge badge-open">Đang mở</span>' : '<span class="badge badge-closed">Đã chốt</span>';
    
    let unpaidBadge = '';
    if (s.status === 'open') {
      const unpaidCount = s.players.filter(p => !p.paid).length;
      if (unpaidCount > 0) {
        unpaidBadge = `<span class="badge badge-unpaid">Thiếu ${unpaidCount}</span>`;
      }
    }
    
    html += `
      <div class="session-card" onclick="openSessionDetail('${s.id}')">
        <div class="session-card-header">
          <div class="session-card-date">${s.dateDisplay}</div>
          <div class="session-card-badges">
            ${modeBadge}
            ${statusBadge}
            ${unpaidBadge}
          </div>
        </div>
        <div class="session-card-body">
          <div class="session-card-total">${formatMoney(s.totalCost)}</div>
          <div class="session-card-players">${s.players.length} người chơi</div>
        </div>
        <button class="btn-delete-session" onclick="event.stopPropagation(); deleteSessionCard('${s.id}')">✕</button>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

function renderDashboardMembers() {
  const container = document.getElementById('dashboardMemberTags');
  if (!container) return;
  
  const members = typeof Storage !== 'undefined' ? Storage.getMembers() : [];
  if (!members || members.length === 0) {
    container.innerHTML = '<div style="font-size:12px; color:var(--text-sub);">Chưa có thành viên nào.</div>';
    return;
  }
  
  let html = '';
  members.forEach(m => {
    const emoji = m.emoji || (m.gender === 'nu' ? '👩🏻‍💼' : '🤵🏻‍♂️');
    html += `
      <div class="dash-member-chip" onclick="openProfile('${m.name}')">
        <span class="dash-member-avatar">${emoji}</span>
        <span>${m.name}</span>
      </div>`;
  });
  
  container.innerHTML = html;
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

    if (currentSplitMethod === 'nuCoDinh') {
      let nuCoDinhWrap = document.getElementById('nuCoDinhWrap');
      if(nuCoDinhWrap) nuCoDinhWrap.style.display = 'flex';
    }
  }
}

// ======================== 6. Dropdown ==============================

function toggleDropdown() {
  triggerHaptic('light');
  let wrapper = document.getElementById('customSelectWrapper');
  if(wrapper) wrapper.classList.toggle('open');
}

function selectMethod(value, text) {
  triggerHaptic('light');
  currentSplitMethod = value;
  
  let splitMethodText = document.getElementById('splitMethodText');
  if(splitMethodText) splitMethodText.innerText = text;
  
  let wrapper = document.getElementById('customSelectWrapper');
  if(wrapper) wrapper.classList.remove('open');

  ['nam20k', 'chiaDeu', 'nuCoDinh'].forEach(v => {
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
  if(namCoDinhWrap) namCoDinhWrap.style.display = 'none';
  
  let nuCoDinhWrap2 = document.getElementById('nuCoDinhWrap2');
  if(nuCoDinhWrap2) nuCoDinhWrap2.style.display = 'none';
  
  let labelNamGL = document.getElementById('labelNamGL');
  if(labelNamGL) labelNamGL.innerText = "🤵🏻‍♂️ Số Nam";
  
  let labelNuGL = document.getElementById('labelNuGL');
  if(labelNuGL) labelNuGL.innerText = "👩🏻‍💼 Số Nữ";
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
    if(overlay) overlay.classList.add('show');

    if(input) setTimeout(() => input.focus(), 100);
  });
}

function closeCustomPrompt(isConfirm) {
  triggerHaptic('light');
  let overlay = document.getElementById('customPromptOverlay');
  if(overlay) overlay.classList.remove('show');
  
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
  
  grid.innerHTML = '';
  members.forEach(m => {
    let tag = document.createElement('div');
    tag.className = 'player-tag' + (m.isDefault !== false ? ' active' : '');
    if (!m.isDefault) tag.classList.add('custom-tag');
    tag.setAttribute('data-name', m.name);
    tag.setAttribute('data-gender', m.gender);
    
    // Add long-press / double-click for profile
    tag.onclick = function (e) { 
      toggleTag(this); 
    };
    
    let pressTimer;
    tag.onmousedown = tag.ontouchstart = function(e) {
      pressTimer = setTimeout(() => {
        openProfile(m.name);
      }, 500); // 500ms long press
    };
    tag.onmouseup = tag.onmouseleave = tag.ontouchend = function(e) {
      clearTimeout(pressTimer);
    };

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
  if(typeof Storage !== 'undefined') Storage.saveMembers(members);
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
  if(!grid) return;
  
  let newTag = document.createElement('div');
  newTag.className = 'player-tag active custom-tag anim-pop';
  newTag.setAttribute('data-name', finalName);
  newTag.setAttribute('data-gender', gender);
  newTag.innerHTML = `${finalName} <span style="margin-left:6px; font-size:12px; color:inherit; opacity:0.6; padding: 2px 6px; border-radius:50%; background:rgba(0,0,0,0.1)" onclick="event.stopPropagation(); triggerHaptic('heavy'); this.parentElement.remove(); saveMembersState();">✕</span>`;
  
  let pressTimer;
  newTag.onmousedown = newTag.ontouchstart = function(e) {
    pressTimer = setTimeout(() => {
      openProfile(finalName);
    }, 500);
  };
  newTag.onmouseup = newTag.onmouseleave = newTag.ontouchend = function(e) {
    clearTimeout(pressTimer);
  };
  
  newTag.onclick = function () { toggleTag(this); };
  grid.appendChild(newTag);
  saveMembersState();
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
  if(sheet) sheet.classList.remove('show');
}

function toggleQR() {
  triggerHaptic('light');
  isShowingQR = !isShowingQR;
  let qrBtn = document.getElementById('qrBtn');
  let content = document.getElementById('receiptContainer');
  let qrCont = document.getElementById('qrContainer');

  if(content && qrCont && qrBtn) {
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
    if (!isPublicMode && mode === 'home' && qrBtn) qrBtn.style.display = '';
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
  if(typeof Storage === 'undefined') return;
  let history = Storage.getHistory();
  if (!history[idx]) return;
  
  let item = history[idx];
  let content = document.getElementById('receiptContent');
  if(content) content.innerHTML = item.receipt;
  
  lastTeleStr = item.teleStr || '';
  switchReceiptTab('receipt');
}

function deleteHistoryItem(idx) {
  triggerHaptic('heavy');
  if(typeof Storage !== 'undefined') Storage.removeFromHistory(idx);
  renderHistory();
  showToast('Đã xóa! 🗑️');
}

function clearAllHistory() {
  triggerHaptic('heavy');
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

function resetForm() {
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

  selectMethod('nam20k', 'Luật: Nam nộp hơn Nữ 20k');
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
  if (nuGLToggle) {
    nuGLToggle.checked = false;
    let nuGLWrap = document.getElementById('sanNhaNuGLInputWrap');
    if (nuGLWrap) nuGLWrap.style.display = 'none';
    let namHonNuWrap = document.getElementById('sanNhaNamHonNuWrap');
    if (namHonNuWrap) namHonNuWrap.style.display = 'flex';
  }
  
  if(typeof Storage !== 'undefined' && typeof Calculator !== 'undefined') {
    let settings = Storage.getSettings();
    let sanNhaNuGL = document.getElementById('sanNhaNuGL');
    let sanNhaGLOffset = document.getElementById('sanNhaGLOffset');
    let sanNhaNamOffset = document.getElementById('sanNhaNamOffset');
    
    if(sanNhaNuGL) sanNhaNuGL.value = Calculator.formatCurrencyValue(settings.sanNhaNuGL);
    if(sanNhaGLOffset) sanNhaGLOffset.value = Calculator.formatCurrencyValue(settings.sanNhaGLOffset);
    if(sanNhaNamOffset) sanNhaNamOffset.value = Calculator.formatCurrencyValue(settings.sanNhaNamOffset);

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
  showToast('Đã làm sạch form sẵn sàng cho trận mới! 🏸');
}

// ======================== 18. Process Data ==============================

async function processData() {
  let dateInput = document.getElementById('dateInput');
  let dateRaw = dateInput ? dateInput.value : '';
  if (!dateRaw) { alert("Chọn ngày đi đã!"); return; }
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
      if (totalP === 0) { alert("Nhập số lượng người chơi nhé!"); return; }

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
      if (totalP === 0) { alert("Nhập số lượng người chơi nhé!"); return; }

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
    if (totalP === 0) { alert("Chưa ai ra sân cả!"); return; }

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
      fixedMembersHtml += `<div class="receipt-item fixed-member"><span>${mr.name}</span> <strong class="price-badge">${formatMoney(mr.price)}</strong></div>`;
      teleStr += `${icon} ${mr.name}: <b>${formatMoney(mr.price)}</b>\\n`;
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
  if (!isPublicMode && mode === 'home' && qrBtn) qrBtn.innerHTML = '💳 QR Chủ sân';

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
  if(resultSheet) resultSheet.classList.add('show');

  if(typeof Storage !== 'undefined') {
    Storage.addToHistory({
      date: dateStr,
      mode: mode,
      totalCost: totalCost,
      receipt: html,
      teleStr: teleStr,
      timestamp: Date.now()
    });
    
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
      totalCollected: resultData.totalCollected || 0,
      difference: resultData.difference || 0
    };
    
    if (Storage.createSession) {
      const savedSession = await Storage.createSession(sessionData);
      currentSessionId = savedSession.id;
      renderPaymentTracking(savedSession);
    }
  }

  if(statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.color = '#10b981';

    let payloadInfo = {
      source: "github_web",
      reportText: teleStr,
      tracking: { ip: userIPInfo, os: getOS(), total_cost: totalCost, mode: mode, isPublic: isPublicMode ? "Có" : "Không" }
    };

    if (isPublicMode || APPS_SCRIPT_URL === "") {
      statusEl.innerText = 'Tính toán thành công! ✅';
      if (APPS_SCRIPT_URL !== "") { fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify(payloadInfo) }).catch(e => e); }
    } else {
      statusEl.innerText = 'Ting ting! Đã báo cáo cho Minh! 💸✅';
      fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payloadInfo)
      }).catch(err => {
        statusEl.style.color = '#f43f5e';
        statusEl.innerText = 'Lỗi mạng, chưa gửi được báo cáo!';
      });
    }
  }
}

// ======================== 19. Payment Tracking ==============================

function renderPaymentTracking(session) {
  let section = document.getElementById('paymentTrackingSection');
  let list = document.getElementById('paymentList');
  if(!section || !list) return;
  
  section.style.display = 'block';
  list.innerHTML = '';
  
  let hasVietQR = typeof VietQR !== 'undefined' && VietQR.hasConfig();
  
  session.players.forEach((p, idx) => {
    let checked = p.paid ? 'checked' : '';
    let badgeClass = p.paid ? 'paid' : 'unpaid';
    let badgeText = p.paid ? 'Đã thu' : 'Chưa thu';
    
    let qrBtnHtml = '';
    if (!p.paid && hasVietQR && p.amount > 0) {
      qrBtnHtml = `<button class="btn-qr-mini" onclick="openQRForPlayer('${p.name}', ${p.amount}, '${session.dateDisplay}')">💳 QR</button>`;
    }
    
    let html = `
      <div class="payment-item">
        <label class="payment-checkbox">
          <input type="checkbox" onchange="togglePayment('${session.id}', ${idx})" ${checked}>
          <span class="checkmark"></span>
        </label>
        <div class="payment-info">
          <div class="payment-name">${p.name}</div>
          <div class="payment-amount">${formatMoney(p.amount)}</div>
        </div>
        <div class="payment-actions">
          ${qrBtnHtml}
          <span class="payment-badge payment-badge-${badgeClass}">${badgeText}</span>
        </div>
      </div>
    `;
    list.insertAdjacentHTML('beforeend', html);
  });
  
  updatePaymentProgress(session);
}

async function togglePayment(sessionId, playerIdx) {
  triggerHaptic('light');
  if(typeof Storage === 'undefined') return;
  
  let session = await Storage.getSession(sessionId);
  if (!session) return;
  
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
  
  let total = session.players.length;
  let paid = session.players.filter(p => p.paid).length;
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
  backToDashboard();
}

// ======================== 20. Profile Modal ==============================

async function openProfile(memberName) {
  triggerHaptic('light');
  if(typeof Storage === 'undefined') return;
  
  let overlay = document.getElementById('profileOverlay');
  if(!overlay) return;
  
  let stats = await Storage.getPlayerStats(memberName);
  
  document.getElementById('profileName').innerText = memberName;
  document.getElementById('profileAvatar').innerText = memberName.charAt(0).toUpperCase();
  document.getElementById('profTotalSessions').innerText = stats.totalSessions;
  document.getElementById('profAvgPerSession').innerText = formatMoney(stats.avgPerSession);
  document.getElementById('profTotalPaid').innerText = formatMoney(stats.totalPaid);
  
  let debtEl = document.getElementById('profDebt');
  if(debtEl) {
    if (stats.debt > 0) {
      debtEl.innerText = formatMoney(stats.debt);
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
    if (stats.recentSessions.length === 0) {
      histList.innerHTML = '<div style="color:var(--text-sub); font-size:13px;">Chưa có lịch sử chơi.</div>';
    } else {
      stats.recentSessions.forEach(s => {
        let status = s.paid ? '<span style="color:#10b981; font-size:12px;">Đã đóng</span>' : '<span style="color:#f43f5e; font-size:12px;">Chưa đóng</span>';
        histList.innerHTML += `
          <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--glass-border);">
            <div style="font-size:13px;">${s.date}</div>
            <div style="text-align:right;">
              <div style="font-weight:600;">${formatMoney(s.amount)}</div>
              ${status}
            </div>
          </div>
        `;
      });
    }
  }
  
  overlay.classList.add('show');
}

function closeProfile() {
  triggerHaptic('light');
  let overlay = document.getElementById('profileOverlay');
  if(overlay) overlay.classList.remove('show');
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
    if(bankEl) bankEl.innerText = `${cfg.bankId} - ${cfg.accountNo}`;
    
    VietQR.renderQR(wrap, { amount: amount, playerName: playerName, sessionDate: sessionDate, size: 250 });
    overlay.classList.add('show');
  }
}

function closeQRPayment() {
  triggerHaptic('light');
  let overlay = document.getElementById('qrPaymentOverlay');
  if(overlay) overlay.classList.remove('show');
}

async function saveQRImage() {
  // Uses VietQR createPaymentCard internally if needed, or simply exports the canvas
  showToast("Chạm giữ mã QR để lưu ảnh!");
}

async function shareQRImage() {
  showToast("Chạm giữ mã QR để sao chép/chia sẻ!");
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
      opt.value = b.bin;
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
  
  overlay.classList.add('show');
}

function closeQRSettings() {
  triggerHaptic('light');
  let overlay = document.getElementById('qrSettingsOverlay');
  if(overlay) overlay.classList.remove('show');
}

function saveQRSettings() {
  triggerHaptic('heavy');
  let bankId = document.getElementById('qrBankSelect').value;
  let accountNo = document.getElementById('qrAccountNo').value.trim();
  let accountName = document.getElementById('qrAccountName').value.trim().toUpperCase();
  
  if (!bankId || !accountNo || !accountName) {
    showToast("Vui lòng nhập đủ thông tin ngân hàng!");
    return;
  }
  
  if (typeof VietQR !== 'undefined') {
    VietQR.saveConfig(bankId, accountNo, accountName);
    showToast("Đã lưu cấu hình QR! ✅");
    closeQRSettings();
  }
}

function updateQRPreview() {
  let bankId = document.getElementById('qrBankSelect').value;
  let accountNo = document.getElementById('qrAccountNo').value.trim();
  let accountName = document.getElementById('qrAccountName').value.trim().toUpperCase();
  let previewCont = document.getElementById('qrPreviewContainer');
  
  if(bankId && accountNo && accountName && previewCont && typeof VietQR !== 'undefined') {
    // Temporary config object for preview
    let tempCfg = { bankId, accountNo, accountName };
    let tempStr = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=50000&addInfo=TEST&accountName=${encodeURIComponent(accountName)}`;
    previewCont.innerHTML = `<img src="${tempStr}" style="width:100%; border-radius:12px;">`;
  }
}

// ======================== 23. Export/Import Functions ==============================

function openExportModal() {
  triggerHaptic('light');
  let overlay = document.getElementById('exportOverlay');
  if(overlay) overlay.classList.add('show');
}

function closeExportModal() {
  triggerHaptic('light');
  let overlay = document.getElementById('exportOverlay');
  if(overlay) overlay.classList.remove('show');
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
  
  // Render receipt
  let contentInner = document.getElementById('receiptContent');
  if(contentInner) contentInner.innerHTML = session.receipt;
  
  lastTeleStr = session.teleStr || '';
  
  // Render payment tracking
  renderPaymentTracking(session);
  
  // Switch to receipt tab and show sheet
  switchReceiptTab('receipt');
  
  let resultSheet = document.getElementById('resultSheet');
  if(resultSheet) resultSheet.classList.add('show');
  
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
  const url = URL.createObjectURL(blob);
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
  if(overlay) overlay.classList.add('show');
}

function closeImgPreview() {
  triggerHaptic('light');
  let overlay = document.getElementById('imgPreviewOverlay');
  if(overlay) overlay.classList.remove('show');
}

// ======================== 26. Initialization ==============================

document.addEventListener("DOMContentLoaded", async () => {

  // IP
  fetchUserIP();

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
    
    let fpWrap = document.getElementById('fixedPriceWrap');
    if (fpWrap) fpWrap.style.display = 'none';
  }

  // Share button visibility
  if (!navigator.share) {
    let shareBtn = document.getElementById('shareBtn');
    if (shareBtn) shareBtn.style.display = 'none';
  }

  // Initialize dashboard
  await refreshDashboard();

  // Start on dashboard view
  switchMainTab('dashboard');
});

// ======================== 27. Global click handlers ==============================

document.addEventListener('click', function (event) {
  let wrapper = document.getElementById('customSelectWrapper');
  if (wrapper && !wrapper.contains(event.target)) { 
    wrapper.classList.remove('open'); 
  }
});
