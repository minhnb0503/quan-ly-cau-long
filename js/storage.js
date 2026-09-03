const Storage = (() => {
    const DEFAULT_MEMBERS = [
        { name: 'Minh', gender: 'nam', isDefault: true, active: true, emoji: '🤵🏻‍♂️' },
        { name: 'Thảo', gender: 'nu', isDefault: true, active: true, emoji: '👩🏻‍💼' },
        { name: 'Tú', gender: 'nam', isDefault: true, active: true, emoji: '🤵🏻‍♂️' },
        { name: 'Quân', gender: 'nam', isDefault: true, active: true, emoji: '🤵🏻‍♂️' },
        { name: 'Ly', gender: 'nu', isDefault: true, active: true, emoji: '👩🏻‍💼' }
    ];

    const safeParse = (value, fallback) => {
        if (!value) return fallback;
        try { return JSON.parse(value); } catch { return fallback; }
    };

    const normalizeMember = (member) => {
        const name = String(member?.name || '').trim().slice(0, 40);
        const gender = member?.gender === 'nu' ? 'nu' : 'nam';
        return {
            name,
            gender,
            isDefault: member?.isDefault !== false,
            active: member?.active !== false,
            emoji: member?.emoji || (gender === 'nu' ? '👩🏻‍💼' : '🤵🏻‍♂️')
        };
    };

    // Synchronous preferences kept small for fast startup.
    const getSettings = () => {
        const defaults = {
            offsetNam20k: 20000,
            offsetNamCD: 25000,
            offsetNuCD: 0,
            offsetNamGL: 30000,
            offsetNuGL: 5000,
            sanNhaNuGL: 50000,
            sanNhaGLOffset: 5000,
            sanNhaNamOffset: 20000,
            sanNhaNuGLToggle: false
        };
        let s = safeParse(localStorage.getItem('clp_settings'), {});
        if (!s || typeof s !== 'object' || Array.isArray(s)) s = {};
        let updated = false;
        for (let k in defaults) {
            if (s[k] === undefined) { s[k] = defaults[k]; updated = true; }
        }
        if (updated) saveSettings(s);
        return { ...defaults, ...s };
    };
    const saveSettings = (s) => localStorage.setItem('clp_settings', JSON.stringify(s));
    
    const getMembers = () => {
        const stored = localStorage.getItem('clp_members');
        let m = stored === null ? null : safeParse(stored, null);
        if (!Array.isArray(m)) {
            m = DEFAULT_MEMBERS.map(member => ({ ...member }));
            saveMembers(m);
            return m;
        }
        const names = new Set();
        const normalized = m
            .map(normalizeMember)
            .filter(member => member.name && !names.has(member.name.toLocaleLowerCase('vi')) && names.add(member.name.toLocaleLowerCase('vi')));
        return normalized;
    };
    const saveMembers = (m) => localStorage.setItem('clp_members', JSON.stringify(Array.isArray(m) ? m.map(normalizeMember).filter(member => member.name) : []));

    const getHistory = () => {
        const history = safeParse(localStorage.getItem('clp_history'), []);
        return Array.isArray(history) ? history : [];
    };
    const saveHistory = (h) => localStorage.setItem('clp_history', JSON.stringify(h));
    const addToHistory = (entry) => {
        const h = getHistory();
        h.unshift({ ...entry, id: Date.now() });
        saveHistory(h);
    };
    const upsertHistory = (entry) => {
        const history = getHistory();
        const index = entry.sessionId ? history.findIndex(item => item.sessionId === entry.sessionId) : -1;
        const normalized = { ...entry, id: index >= 0 ? history[index].id : Date.now() };
        if (index >= 0) history[index] = normalized;
        else history.unshift(normalized);
        saveHistory(history.slice(0, 200));
    };
    const removeFromHistory = (idx) => {
        const h = getHistory();
        h.splice(idx, 1);
        saveHistory(h);
    };
    const clearHistory = () => localStorage.removeItem('clp_history');

    const getTheme = () => localStorage.getItem('clp_theme') === 'dark' ? 'dark' : 'light';
    const setTheme = (t) => localStorage.setItem('clp_theme', t === 'dark' ? 'dark' : 'light');

    const getFormState = () => safeParse(localStorage.getItem('clp_form'), null);
    const saveFormState = (s) => localStorage.setItem('clp_form', JSON.stringify(s));
    const clearFormState = () => localStorage.removeItem('clp_form');

    // IndexedDB setup
    const DB_NAME = 'CauLongFluidPro';
    const DB_VERSION = 1;
    let dbInstance = null;

    const initDB = () => {
        return new Promise((resolve, reject) => {
            if (dbInstance) return resolve(dbInstance);
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = (e) => reject(e.target.error);
            request.onsuccess = (e) => {
                dbInstance = e.target.result;
                resolve(dbInstance);
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
                    sessionStore.createIndex('date', 'date', { unique: false });
                    sessionStore.createIndex('status', 'status', { unique: false });
                }
                if (!db.objectStoreNames.contains('members')) {
                    db.createObjectStore('members', { keyPath: 'name' });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('payments')) {
                    const paymentStore = db.createObjectStore('payments', { keyPath: 'id', autoIncrement: true });
                    paymentStore.createIndex('sessionId', 'sessionId', { unique: false });
                    paymentStore.createIndex('playerName', 'playerName', { unique: false });
                }
            };
        });
    };

    const getDB = async () => {
        if (!dbInstance) await initDB();
        return dbInstance;
    };

    // New Async methods
    const createSession = async (sessionData) => {
        const db = await getDB();
        const id = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const session = { ...sessionData, id, createdAt: Date.now() };
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['sessions'], 'readwrite');
            const store = tx.objectStore('sessions');
            const req = store.add(session);
            req.onsuccess = () => resolve(session);
            req.onerror = () => reject(req.error);
        });
    };

    const getSession = async (id) => {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['sessions'], 'readonly');
            const store = tx.objectStore('sessions');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    };

    const getAllSessions = async () => {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['sessions'], 'readonly');
            const store = tx.objectStore('sessions');
            const req = store.getAll();
            req.onsuccess = () => {
                const sessions = req.result;
                sessions.sort((a, b) => b.createdAt - a.createdAt);
                resolve(sessions);
            };
            req.onerror = () => reject(req.error);
        });
    };

    const updateSession = async (id, updates) => {
        const db = await getDB();
        const session = await getSession(id);
        if (!session) throw new Error('Session not found');
        const updated = { ...session, ...updates };
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['sessions'], 'readwrite');
            const store = tx.objectStore('sessions');
            const req = store.put(updated);
            req.onsuccess = () => resolve(updated);
            req.onerror = () => reject(req.error);
        });
    };

    const deleteSession = async (id) => {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['sessions'], 'readwrite');
            const store = tx.objectStore('sessions');
            const req = store.delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    };

    const getOpenSessions = async () => {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['sessions'], 'readonly');
            const store = tx.objectStore('sessions');
            const idx = store.index('status');
            const req = idx.getAll('open');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    };

    const closeSession = async (id) => {
        return updateSession(id, { status: 'closed', closedAt: Date.now() });
    };

    const markPaid = async (sessionId, playerName, paid) => {
        const session = await getSession(sessionId);
        if (!session) return;
        const pIdx = session.players.findIndex(p => p.name === playerName);
        if (pIdx > -1) {
            session.players[pIdx].paid = paid;
            session.players[pIdx].paidAt = paid ? Date.now() : null;
            await updateSession(sessionId, { players: session.players });
        }
    };

    const getUnpaidTotal = async () => {
        const openSessions = await getOpenSessions();
        let total = 0;
        openSessions.forEach(s => {
            if (s.players) {
                s.players.forEach(p => {
                    if (!p.paid) total += (p.amount || 0);
                });
            }
        });
        return total;
    };

    const getPlayerDebt = async (playerName) => {
        const openSessions = await getOpenSessions();
        let total = 0;
        openSessions.forEach(s => {
            if (s.players) {
                const p = s.players.find(pl => pl.name === playerName);
                if (p && !p.paid) total += (p.amount || 0);
            }
        });
        return total;
    };

    const getStats = async (knownSessions = null) => {
        const sessions = Array.isArray(knownSessions) ? knownSessions : await getAllSessions();
        const openSessions = sessions.filter(session => session.status === 'open');
        let unpaidTotal = 0;
        const unpaidPlayers = new Set();
        
        openSessions.forEach(s => {
            if (s.players) {
                s.players.forEach(p => {
                    if (!p.paid) {
                        unpaidTotal += (p.amount || 0);
                        unpaidPlayers.add(p.name);
                    }
                });
            }
        });

        const m = getMembers();
        
        return {
            totalSessions: sessions.length,
            unpaidTotal,
            unpaidCount: unpaidPlayers.size,
            memberCount: m.length
        };
    };

    const getPlayerStats = async (playerName) => {
        const sessions = await getAllSessions();
        let totalSessions = 0;
        let totalPaid = 0;
        let totalAmount = 0;
        let debtAmount = 0;
        const history = [];

        sessions.forEach(s => {
            if (s.players) {
                const p = s.players.find(pl => pl.name === playerName);
                if (p) {
                    totalSessions++;
                    totalAmount += (p.amount || 0);
                    history.push({
                        sessionId: s.id,
                        date: s.dateDisplay,
                        amount: p.amount || 0,
                        paid: p.paid
                    });
                    if (p.paid) {
                        totalPaid += (p.amount || 0);
                    } else if (s.status === 'open') {
                        debtAmount += (p.amount || 0);
                    }
                }
            }
        });

        const avgPerSession = totalSessions ? Math.round(totalAmount / totalSessions) : 0;

        return {
            totalSessions,
            totalPaid,
            avgPerSession,
            debtAmount,
            history
        };
    };

    const exportAll = async () => {
        const db = await getDB();
        const collections = ['sessions', 'members', 'settings', 'payments'];
        const data = {};
        
        for (const col of collections) {
            data[col] = await new Promise((resolve) => {
                try {
                    const tx = db.transaction([col], 'readonly');
                    const store = tx.objectStore(col);
                    const req = store.getAll();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve([]);
                } catch {
                    resolve([]);
                }
            });
        }
        
        data.localSettings = getSettings();
        data.localMembers = getMembers();
        data.localHistory = getHistory();
        data.theme = getTheme();
        data.schemaVersion = 2;
        data.exportedAt = new Date().toISOString();
        
        return JSON.stringify(data);
    };

    const importAll = async (jsonString) => {
        const data = JSON.parse(jsonString);
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid backup');
        const db = await getDB();
        const collections = ['sessions', 'members', 'settings', 'payments'];
        
        for (const col of collections) {
            if (Array.isArray(data[col])) {
                await new Promise((resolve, reject) => {
                    const tx = db.transaction([col], 'readwrite');
                    const store = tx.objectStore(col);
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                    store.clear();
                    data[col].forEach(item => store.put(item));
                });
            }
        }
        
        if (data.localSettings && typeof data.localSettings === 'object') saveSettings(data.localSettings);
        if (Array.isArray(data.localMembers)) saveMembers(data.localMembers);
        if (Array.isArray(data.localHistory)) saveHistory(data.localHistory.slice(0, 200));
        if (data.theme) setTheme(data.theme);
        
        return true;
    };

    return {
        // Sync
        getSettings, saveSettings,
        getMembers, saveMembers,
        getHistory, addToHistory, upsertHistory, removeFromHistory, clearHistory,
        getTheme, setTheme,
        getFormState, saveFormState, clearFormState,
        
        // Async
        createSession, getSession, getAllSessions, updateSession, deleteSession,
        getOpenSessions, closeSession,
        markPaid, getUnpaidTotal, getPlayerDebt,
        getStats, getPlayerStats,
        exportAll, importAll
    };
})();
