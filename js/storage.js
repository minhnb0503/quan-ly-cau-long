const Storage = (() => {
    // Legacy Sync methods
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
        let s = JSON.parse(localStorage.getItem('clp_settings')) || {};
        let updated = false;
        for (let k in defaults) {
            if (s[k] === undefined) { s[k] = defaults[k]; updated = true; }
        }
        if (updated) saveSettings(s);
        return { ...defaults, ...s };
    };
    const saveSettings = (s) => localStorage.setItem('clp_settings', JSON.stringify(s));
    
    const getMembers = () => {
        let m = JSON.parse(localStorage.getItem('clp_members'));
        if (!m || m.length === 0) {
            m = [
              { name: 'Minh', gender: 'nam', isDefault: true, emoji: '🤵🏻‍♂️' },
              { name: 'Thảo', gender: 'nu', isDefault: true, emoji: '👩🏻‍💼' },
              { name: 'Tú', gender: 'nam', isDefault: true, emoji: '🤵🏻‍♂️' },
              { name: 'Quân', gender: 'nam', isDefault: true, emoji: '🤵🏻‍♂️' },
              { name: 'Ly', gender: 'nu', isDefault: true, emoji: '👩🏻‍💼' }
            ];
            saveMembers(m);
        }
        return m;
    };
    const saveMembers = (m) => localStorage.setItem('clp_members', JSON.stringify(m));

    const getHistory = () => JSON.parse(localStorage.getItem('clp_history')) || [];
    const saveHistory = (h) => localStorage.setItem('clp_history', JSON.stringify(h));
    const addToHistory = (entry) => {
        const h = getHistory();
        h.unshift({ ...entry, id: Date.now() });
        saveHistory(h);
    };
    const removeFromHistory = (idx) => {
        const h = getHistory();
        h.splice(idx, 1);
        saveHistory(h);
    };
    const clearHistory = () => localStorage.removeItem('clp_history');

    const getTheme = () => localStorage.getItem('clp_theme') || 'light';
    const setTheme = (t) => localStorage.setItem('clp_theme', t);

    const getFormState = () => JSON.parse(localStorage.getItem('clp_form'));
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
        const id = 'ses_' + Date.now();
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

    const getStats = async () => {
        const sessions = await getAllSessions();
        const openSessions = await getOpenSessions();
        let unpaidTotal = 0;
        let unpaidCount = 0;
        
        openSessions.forEach(s => {
            if (s.players) {
                s.players.forEach(p => {
                    if (!p.paid) {
                        unpaidTotal += (p.amount || 0);
                        unpaidCount++;
                    }
                });
            }
        });

        const m = getMembers();
        
        return {
            totalSessions: sessions.length,
            unpaidTotal,
            unpaidCount,
            memberCount: m.length
        };
    };

    const getPlayerStats = async (playerName) => {
        const sessions = await getAllSessions();
        let totalSessions = 0;
        let totalPaid = 0;
        let debtAmount = 0;
        const history = [];

        sessions.forEach(s => {
            if (s.players) {
                const p = s.players.find(pl => pl.name === playerName);
                if (p) {
                    totalSessions++;
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

        const avgPerSession = totalSessions ? Math.round(totalPaid / totalSessions) : 0;

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
        
        return JSON.stringify(data);
    };

    const importAll = async (jsonString) => {
        const data = JSON.parse(jsonString);
        const db = await getDB();
        const collections = ['sessions', 'members', 'settings', 'payments'];
        
        for (const col of collections) {
            if (data[col] && data[col].length) {
                await new Promise((resolve, reject) => {
                    const tx = db.transaction([col], 'readwrite');
                    const store = tx.objectStore(col);
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                    
                    data[col].forEach(item => store.put(item));
                });
            }
        }
        
        if (data.localSettings) saveSettings(data.localSettings);
        if (data.localMembers) saveMembers(data.localMembers);
        if (data.localHistory) localStorage.setItem('clp_history', JSON.stringify(data.localHistory));
        if (data.theme) setTheme(data.theme);
        
        return true;
    };

    return {
        // Sync
        getSettings, saveSettings,
        getMembers, saveMembers,
        getHistory, addToHistory, removeFromHistory, clearHistory,
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
