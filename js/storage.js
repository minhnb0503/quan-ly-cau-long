/**
 * Storage Module - LocalStorage persistence
 * Manages settings, members, form state, history, and theme
 */
const Storage = (() => {
  const KEYS = {
    SETTINGS: 'clp_settings',
    MEMBERS: 'clp_members',
    FORM_STATE: 'clp_form',
    HISTORY: 'clp_history',
    THEME: 'clp_theme'
  };
  const MAX_HISTORY = 50;

  function _get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function _set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) { console.warn('Storage error:', e); }
  }

  return {
    getSettings() {
      return _get(KEYS.SETTINGS, {
        offsetNam20k: 20000,
        offsetNamCD: 25000,
        offsetNuCD: 0,
        offsetNamGL: 30000,
        offsetNuGL: 5000,
        fixedPriceNamGL: 80000,
        fixedPriceNuGL: 60000,
        fixedPriceDiscount: 5000
      });
    },
    saveSettings(s) { _set(KEYS.SETTINGS, s); },

    getMembers() {
      return _get(KEYS.MEMBERS, [
        { name: 'Minh', gender: 'nam', isDefault: true },
        { name: 'Thảo', gender: 'nu', isDefault: true },
        { name: 'Tú', gender: 'nam', isDefault: true },
        { name: 'Quân', gender: 'nam', isDefault: true }
      ]);
    },
    saveMembers(members) { _set(KEYS.MEMBERS, members); },

    getHistory() { return _get(KEYS.HISTORY, []); },
    addToHistory(entry) {
      let h = this.getHistory();
      h.unshift({ ...entry, timestamp: Date.now() });
      if (h.length > MAX_HISTORY) h = h.slice(0, MAX_HISTORY);
      _set(KEYS.HISTORY, h);
    },
    removeFromHistory(idx) {
      let h = this.getHistory();
      if (idx >= 0 && idx < h.length) {
        h.splice(idx, 1);
        _set(KEYS.HISTORY, h);
      }
    },
    clearHistory() { _set(KEYS.HISTORY, []); },

    getTheme() { return _get(KEYS.THEME, 'light'); },
    setTheme(t) { _set(KEYS.THEME, t); },

    saveFormState(state) { _set(KEYS.FORM_STATE, state); },
    getFormState() { return _get(KEYS.FORM_STATE, null); },
    clearFormState() { localStorage.removeItem(KEYS.FORM_STATE); }
  };
})();
