const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Calculator = require('../js/calculator.js');

// Exercise real app save orchestration with an in-memory DOM and storage boundary.
function createApp() {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, value: '', style: {}, hidden: false, disabled: false, open: false,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      setAttribute() {}, addEventListener() {}, focus() {}, blur() {},
      querySelector() { return element('receiptCard'); }
    });
    return elements.get(id);
  }
  element('dateInput').value = '2026-09-06';
  element('tienSan').value = '500000';
  element('tienCau').value = '105000';
  element('namGL').value = '4';
  element('nuGL').value = '3';
  const sessions = new Map();
  let nextId = 1;
  const storage = {
    getSettings: () => ({ offsetNam20k: 20000 }),
    getSession: async id => sessions.get(id),
    createSession: async data => {
      const session = { ...data, id: 'new-' + nextId++ };
      sessions.set(session.id, session);
      return session;
    },
    updateSession: async (id, data) => {
      const session = { ...sessions.get(id), ...data, id };
      sessions.set(id, session);
      return session;
    },
    upsertHistory() {}
  };
  const context = vm.createContext({
    URLSearchParams, Calculator, Storage: storage, navigator: {},
    window: { location: { search: '' } },
    document: { getElementById: element, addEventListener() {}, activeElement: { blur() {} } },
    console: { error() {} }, setTimeout, clearTimeout
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8'), context);
  vm.runInContext(`mode = 'away'; currentSplitMethod = 'chiaDeu';
    triggerHaptic = () => {}; showToast = () => {};
    setOverlayState = () => {}; switchReceiptTab = () => {};
    sanitizeStoredHTML = value => value;
    renderPaymentTracking = () => { document.getElementById('paymentTrackingSection').style.display = 'block'; };`, context);
  return { element, sessions, storage, run: code => vm.runInContext(code, context) };
}

test('xem buổi cũ rồi tính lại chỉ cập nhật buổi đang nhập', async () => {
  const app = createApp();
  await app.run('processData()');
  const original = app.sessions.get('new-1');
  app.sessions.set('old', { ...original, id: 'old', totalCost: 600000, receiptData: { ...original.receiptData, totalCost: 600000 } });
  await app.run("openSessionDetail('old')");
  app.element('tienSan').value = '510000';
  await app.run('processData()');
  assert.equal(app.sessions.size, 2);
  assert.equal(app.sessions.get('old').totalCost, 600000);
  assert.equal(app.sessions.get('new-1').totalCost, 615000);
  assert.equal(app.sessions.get('new-1').totalCollected, 616000);
});

test('lưu lỗi không để thao tác thanh toán trỏ tới buổi cũ', async () => {
  const app = createApp();
  await app.run('processData()');
  app.storage.updateSession = async () => { throw new Error('Disk full'); };
  await app.run('processData()');
  assert.equal(app.run('currentSessionId'), null);
  assert.equal(app.element('paymentTrackingSection').style.display, 'none');
  assert.equal(app.element('calculateBtn').disabled, false);
  assert.match(app.element('syncStatus').textContent, /Chưa lưu được/);
});

test('nhập thiếu chi phí không khóa nút tính', async () => {
  const app = createApp();
  app.element('tienSan').value = '';
  app.element('tienCau').value = '';
  await app.run('processData()');
  assert.equal(app.sessions.size, 0);
  assert.equal(app.element('calculateBtn').disabled, false);
  assert.equal(app.element('formError').hidden, false);
});
