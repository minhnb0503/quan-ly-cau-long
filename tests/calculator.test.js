const test = require('node:test');
const assert = require('node:assert/strict');
const Calculator = require('../js/calculator.js');

test('định dạng và đọc số tiền Việt Nam', () => {
  assert.equal(Calculator.formatMoney(125000), '125.000 ₫');
  assert.equal(Calculator.parseMoney('125.000 ₫'), 125000);
  assert.equal(Calculator.formatCurrencyValue('00125000'), '125.000');
});

test('chia đều sân khách và làm tròn đến nghìn', () => {
  const result = Calculator.calcChiaDeu(605000, 4, 3);
  assert.deepEqual(result, { pNam: 87000, pNu: 87000 });
});

test('sân khách nam trả cao hơn nữ theo mức chênh lệch', () => {
  const result = Calculator.calcNam20k(600000, 4, 2, 20000);
  assert.deepEqual(result, { pNam: 107000, pNu: 87000 });
  assert.ok(result.pNam > result.pNu);
});

test('sân nhà giữ tổng thu không thấp hơn tổng chi sau khi làm tròn', () => {
  const members = [
    { name: 'A', gender: 'nam' },
    { name: 'B', gender: 'nam' },
    { name: 'C', gender: 'nu' }
  ];
  const result = Calculator.calcSanNha(520000, members, 1, 1, false, 50000, 20000, 5000);
  assert.equal(result.memberResults.length, 3);
  assert.ok(result.totalCollected >= 520000);
  assert.equal(result.difference, result.totalCollected - 520000);
});

test('tính chi phí cầu theo số quả từ nhiều loại ống', () => {
  const result = Calculator.calcCauDetail([
    { giaTup: 300000, soQua: 6 },
    { giaTup: 360000, soQua: 3 }
  ]);
  assert.equal(result.total, 240000);
  assert.equal(result.details.length, 2);
});

test('cho phép cấu hình mức chênh lệch bằng 0', () => {
  const result = Calculator.calcSanNhaRule(400000, 1, 1, 1, 1, {
    offsetNamCD: 0,
    offsetNamGL: 0,
    offsetNuGL: 0
  });
  assert.deepEqual(result, { pNu: 100000, pNam: 100000, pNamGL: 100000, pNuGL: 100000 });
});

test('sửa số tiền ở giữa giữ con trỏ theo chữ số thay vì nhảy về cuối', () => {
  assert.deepEqual(Calculator.formatCurrencyEdit('2500.000', 3), { value: '2.500.000', caret: 4 });
  assert.deepEqual(Calculator.formatCurrencyEdit('250.00', 6), { value: '25.000', caret: 6 });
  assert.deepEqual(Calculator.formatCurrencyEdit('', 0), { value: '', caret: 0 });
  assert.deepEqual(Calculator.formatCurrencyEdit('00125000', 8), { value: '125.000', caret: 7 });
});

test('thu nữ cố định vượt tổng chi không tạo tiền âm cho nam', () => {
  const result = Calculator.calcSanNha(10000, [
    { name: 'A', gender: 'nam' }, { name: 'B', gender: 'nu' }
  ], 1, 0, true, 50000, 20000, 5000);
  assert.equal(result.pNamCD, 0);
  assert.equal(result.pNamGL, 5000);
  assert.ok(result.memberResults.every(player => player.price >= 0));
  assert.equal(result.difference, 40000);
});

test('sân khách hiển thị và lưu đúng tổng cần thu, tiền dư của cả nhóm', () => {
  const result = Calculator.calcChiaDeu(605000, 4, 3);
  const totals = Calculator.summarizePlayers(605000, [
    { amount: result.pNam * 4, count: 4 }, { amount: result.pNu * 3, count: 3 }
  ]);
  assert.deepEqual(totals, { totalCollected: 609000, difference: 4000, playerCount: 7 });
});

test('mức thu cố định chưa đủ phải báo số tiền còn thiếu', () => {
  const result = Calculator.calcSanNha(200000, [{ name: 'B', gender: 'nu' }], 0, 1, true, 50000, 20000, 5000);
  const totals = Calculator.summarizePlayers(200000, [
    { amount: result.pNuCD, count: 1 }, { amount: result.pNuGL, count: 1 }
  ]);
  assert.equal(totals.difference, -105000);
  assert.equal(totals.totalCollected, 95000);
});
