const DB = {
  _db: null,
  DB_NAME: 'RunTrackerDB',
  DB_VERSION: 2,
  STORE_NAME: 'activities',
  SETTINGS_STORE: 'settings',

  async init() {
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB not available');
      return;
    }

    // Request persistent storage so browser doesn't evict our data
    try {
      if (navigator.storage && navigator.storage.persist) {
        var granted = await navigator.storage.persist();
        console.log(granted ? '✅ Persistent storage granted' : '⚠️ Persistent storage not granted');
      }
    } catch (e) { /* ignore */ }

    return new Promise(function(resolve, reject) {
      try {
        var request = indexedDB.open(DB.DB_NAME, DB.DB_VERSION);
        request.onupgradeneeded = function(event) {
          var db = event.target.result;
          if (!db.objectStoreNames.contains(DB.STORE_NAME)) {
            var store = db.createObjectStore(DB.STORE_NAME, { keyPath: 'id', autoIncrement: true });
            store.createIndex('date', 'date', { unique: false });
            store.createIndex('distance', 'distance', { unique: false });
          }
          // New: settings store for persistent profile data
          if (!db.objectStoreNames.contains(DB.SETTINGS_STORE)) {
            db.createObjectStore(DB.SETTINGS_STORE, { keyPath: 'key' });
          }
        };
        request.onsuccess = function() {
          DB._db = request.result;
          // Restore settings from IndexedDB → localStorage
          DB.restoreSettings().then(function() {
            // Also backup current localStorage → IndexedDB
            DB._syncSettingsToIDB();
            resolve();
          });
        };
        request.onerror = function() { console.warn('IndexedDB open failed'); resolve(); };
      } catch (e) {
        console.warn('IndexedDB error:', e);
        resolve();
      }
    });
  },

  // Sync existing localStorage settings into IndexedDB for backup
  _syncSettingsToIDB() {
    if (!this._db) return;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var lsKey = localStorage.key(i);
        if (lsKey && lsKey.startsWith('runtracker_')) {
          var shortKey = lsKey.replace('runtracker_', '');
          var val = localStorage.getItem(lsKey);
          this._setSettingIDB(shortKey, val);
        }
      }
    } catch (e) { /* localStorage might be blocked */ }
  },

  // Save a single setting to IndexedDB
  _setSettingIDB(key, rawValue) {
    if (!this._db) return;
    try {
      var tx = this._db.transaction(this.SETTINGS_STORE, 'readwrite');
      var store = tx.objectStore(this.SETTINGS_STORE);
      store.put({ key: key, value: rawValue });
    } catch (e) { /* ignore */ }
  },

  // Restore all settings from IndexedDB → localStorage + memory cache
  async restoreSettings() {
    if (!this._db) return;
    try {
      var tx = this._db.transaction(this.SETTINGS_STORE, 'readonly');
      var store = tx.objectStore(this.SETTINGS_STORE);
      var req = store.getAll();
      return new Promise(function(resolve) {
        req.onsuccess = function() {
          var items = req.result || [];
          console.log('📦 Restoring ' + items.length + ' settings from IndexedDB');
          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            // ALWAYS restore to localStorage (browser may have cleared it)
            try {
              localStorage.setItem('runtracker_' + item.key, item.value);
            } catch (e) { /* blocked */ }
            // Restore to memory cache
            try {
              DB._settingsCache[item.key] = JSON.parse(item.value);
            } catch (e) {
              DB._settingsCache[item.key] = item.value;
            }
          }
          resolve();
        };
        req.onerror = function() { resolve(); };
      });
    } catch (e) { return; }
  },

  // ========== ACTIVITIES ==========
  async saveActivity(data) {
    if (!this._db) { console.warn('DB not available'); return null; }
    return new Promise(function(resolve, reject) {
      var tx = DB._db.transaction(DB.STORE_NAME, 'readwrite');
      var store = tx.objectStore(DB.STORE_NAME);
      var request = store.add(data);
      request.onsuccess = function() { resolve(request.result); };
      request.onerror = function() { reject(request.error); };
    });
  },

  async getAllActivities() {
    if (!this._db) return [];
    return new Promise(function(resolve, reject) {
      var tx = DB._db.transaction(DB.STORE_NAME, 'readonly');
      var store = tx.objectStore(DB.STORE_NAME);
      var request = store.getAll();
      request.onsuccess = function() {
        var activities = request.result.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
        resolve(activities);
      };
      request.onerror = function() { resolve([]); };
    });
  },

  async getActivity(id) {
    if (!this._db) return null;
    return new Promise(function(resolve, reject) {
      var tx = DB._db.transaction(DB.STORE_NAME, 'readonly');
      var store = tx.objectStore(DB.STORE_NAME);
      var request = store.get(id);
      request.onsuccess = function() { resolve(request.result); };
      request.onerror = function() { resolve(null); };
    });
  },

  async deleteActivity(id) {
    if (!this._db) return;
    return new Promise(function(resolve, reject) {
      var tx = DB._db.transaction(DB.STORE_NAME, 'readwrite');
      var store = tx.objectStore(DB.STORE_NAME);
      var request = store.delete(id);
      request.onsuccess = function() { resolve(); };
      request.onerror = function() { resolve(); };
    });
  },

  async updateActivity(id, data) {
    if (!this._db) return;
    return new Promise(function(resolve, reject) {
      var tx = DB._db.transaction(DB.STORE_NAME, 'readwrite');
      var store = tx.objectStore(DB.STORE_NAME);
      var getReq = store.get(id);
      getReq.onsuccess = function() {
        var existing = getReq.result;
        if (!existing) { resolve(); return; }
        var updated = Object.assign({}, existing, data, { id: id });
        var putReq = store.put(updated);
        putReq.onsuccess = function() { resolve(); };
        putReq.onerror = function() { resolve(); };
      };
      getReq.onerror = function() { resolve(); };
    });
  },

  // ========== SETTINGS (dual storage: localStorage + IndexedDB) ==========
  _settingsCache: {},

  getSetting(key, defaultValue) {
    // 1. Check memory cache
    if (this._settingsCache.hasOwnProperty(key)) {
      return this._settingsCache[key];
    }
    // 2. Try localStorage
    try {
      var val = localStorage.getItem('runtracker_' + key);
      if (val !== null) {
        var parsed = JSON.parse(val);
        this._settingsCache[key] = parsed;
        return parsed;
      }
    } catch (e) { /* blocked */ }
    // 3. Return default
    return defaultValue;
  },

  setSetting(key, value) {
    // Save to memory cache
    this._settingsCache[key] = value;
    // Save to localStorage
    try {
      localStorage.setItem('runtracker_' + key, JSON.stringify(value));
    } catch (e) { /* blocked */ }
    // Save to IndexedDB (backup)
    this._setSettingIDB(key, JSON.stringify(value));
  }
};
