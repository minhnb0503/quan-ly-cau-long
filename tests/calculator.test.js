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
