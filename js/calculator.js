/**
 * Calculator Module - Pure calculation functions for cost splitting
 * All methods return result objects, no DOM manipulation
 */
const Calculator = (() => {
  function roundUp1k(n) { return Math.ceil(n / 1000) * 1000; }
  function formatMoney(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) return '0 ₫';
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + ' ₫';
  }
  function parseMoney(str) { return parseInt(String(str).replace(/\./g, '').replace(/\D/g, '')) || 0; }
  function formatCurrencyValue(val) {
    const v = String(val).replace(/\D/g, '');
    return v ? parseInt(v, 10).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : '';
  }

  return {
    formatMoney,
    parseMoney,
    roundUp1k,
    formatCurrencyValue,

    // Count digits before the caret so grouping separators do not move it to the end.
    formatCurrencyEdit(value, caret = String(value).length) {
      const raw = String(value);
      const digitsBefore = raw.slice(0, caret).replace(/\D/g, '').length;
      const digits = raw.replace(/\D/g, '');
      const trimmed = digits.replace(/^0+(?=\d)/, '');
      const formatted = trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const target = Math.max(0, digitsBefore - (digits.length - trimmed.length));
      let position = 0, seen = 0;
      while (position < formatted.length && seen < target) {
        if (/\d/.test(formatted[position])) seen++;
        position++;
      }
      return { value: formatted, caret: position };
    },

    summarizePlayers(totalCost, players) {
      const totalCollected = players.reduce((sum, player) => sum + player.amount, 0);
      const playerCount = players.reduce((sum, player) => sum + (player.count || 1), 0);
      return { totalCollected, difference: totalCollected - totalCost, playerCount };
    },

    /**
     * Sân Nhà - Hỗ trợ cả 2 chế độ:
     * 1. Nữ GL 1 giá (isNuGLMode = true): Nữ GL = nuGLPrice, Nữ CĐ = max(0, Nữ GL - glOffset). Nam gánh phần còn lại, Nam GL = Nam CĐ + glOffset.
     * 2. Nam hơn Nữ (isNuGLMode = false): Nữ CĐ = base. Nam CĐ = base + namOffset. Nữ GL = base + glOffset. Nam GL = base + namOffset + glOffset.
     */
    calcSanNha(totalCost, activeMembers, namGL, nuGL, isNuGLMode, nuGLPrice, namOffset, glOffset) {
      const cM = activeMembers.filter(m => m.gender === 'nam').length;
      const cN = activeMembers.filter(m => m.gender === 'nu').length;
      const totalP = cM + cN + namGL + nuGL;
      if (totalP === 0) return null;

      let pNamCD = 0, pNuCD = 0, pNamGL = 0, pNuGL = 0;

      if (isNuGLMode) {
        pNuGL = nuGLPrice;
        pNuCD = Math.max(0, pNuGL - glOffset);
        const totalNu = (pNuCD * cN) + (pNuGL * nuGL);

        const totalNamCount = cM + namGL;
        if (totalNamCount > 0) {
          const remainingForNam = Math.max(0, totalCost - totalNu);
          const baseNam = Math.max(0, remainingForNam - (glOffset * namGL)) / totalNamCount;
          pNamCD = roundUp1k(baseNam);
          pNamGL = pNamCD + glOffset;
        }
      } else {
        const offsetFixed = cM * namOffset;
        const offsetGL = (namGL * (namOffset + glOffset)) + (nuGL * glOffset);
        const totalOffset = offsetFixed + offsetGL;

        const base = Math.max(0, totalCost - totalOffset) / totalP;
        pNuCD = roundUp1k(base);
        pNamCD = pNuCD + namOffset;
        pNuGL = pNuCD + glOffset;
        pNamGL = pNuCD + namOffset + glOffset;
      }

      const totalCollected = (pNamCD * cM) + (pNuCD * cN) + (pNamGL * namGL) + (pNuGL * nuGL);

      return {
        memberResults: activeMembers.map(m => ({
          name: m.name,
          gender: m.gender,
          price: m.gender === 'nam' ? pNamCD : pNuCD,
          amount: m.gender === 'nam' ? pNamCD : pNuCD
        })),
        pNamCD, pNuCD, pNamGL, pNuGL,
        totalCollected,
        difference: totalCollected - totalCost
      };
    },

    /**
     * Sân Khách - Nam nộp hơn Nữ (offset)
     */
    calcNam20k(totalCost, namGL, nuGL, offset) {
      const totalP = namGL + nuGL;
      if (totalP === 0) return null;
      const totalOffset = namGL * offset;
      const base = Math.max(0, totalCost - totalOffset) / totalP;
      const pF = roundUp1k(base);
      return { pNam: pF + offset, pNu: pF };
    },

    /**
     * Sân Khách - Chia đều 100%
     */
    calcChiaDeu(totalCost, namGL, nuGL) {
      const totalP = namGL + nuGL;
      if (totalP === 0) return null;
      const pF = roundUp1k(totalCost / totalP);
      return { pNam: pF, pNu: pF };
    },

    /**
     * Sân Khách - Nữ cố định, Nam chia đều phần còn lại
     */
    calcNuCoDinh(totalCost, namGL, nuGL, nuPrice) {
      const totalP = namGL + nuGL;
      if (totalP === 0) return null;
      let pNu = nuPrice;
      let pNam = 0;
      if (namGL > 0) {
        const remaining = Math.max(0, totalCost - (pNu * nuGL));
        pNam = roundUp1k(remaining / namGL);
      } else {
        pNu = roundUp1k(totalCost / nuGL);
      }
      return { pNam, pNu };
    },

    /**
     * Sân Khách - Quy chế Sân Nhà (same logic as Sân Nhà auto but with manual counts)
     */
    calcSanNhaRule(totalCost, namCD, nuCD, namGL, nuGL, settings) {
      const totalP = namCD + nuCD + namGL + nuGL;
      if (totalP === 0) return null;

      const oNamCD = settings.offsetNamCD ?? 25000;
      const oNamGL = settings.offsetNamGL ?? 30000;
      const oNuGL = settings.offsetNuGL ?? 5000;

      const offsetGL = (namGL * oNamGL) + (nuGL * oNuGL);
      const offsetFixed = namCD * oNamCD;
      const base = Math.max(0, totalCost - offsetFixed - offsetGL) / totalP;
      const pF = roundUp1k(base);

      return {
        pNu: pF,
        pNam: pF + oNamCD,
        pNamGL: pF + oNamGL,
        pNuGL: pF + oNuGL
      };
    },

    /**
     * Calculate cau (shuttle) cost from detailed items
     * @param {Array} items - Array of {giaTup, soQua}
     * @returns {Object} {total, details}
     */
    calcCauDetail(items) {
      let total = 0;
      const details = [];
      items.forEach(item => {
        if (item.soQua > 0 && item.giaTup > 0) {
          const cost = Math.round((item.giaTup / 12) * item.soQua);
          total += cost;
          details.push({ soQua: item.soQua, giaTup: item.giaTup, cost, label: `${item.soQua}q-${formatMoney(item.giaTup)}` });
        }
      });
      return { total, details, detailText: details.length > 0 ? details.map(d => d.label).join(', ') : '0 quả' };
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Calculator;
}
