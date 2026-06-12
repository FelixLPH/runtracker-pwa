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

    // Request persistent storage
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
          if (!db.objectStoreNames.contains(DB.SETTINGS_STORE)) {
            db.createObjectStore(DB.SETTINGS_STORE, { keyPath: 'key' });
          }
        };
        request.onsuccess = function() {
          DB._db = request.result;
          DB.restoreSettings().then(function() {
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

  // ========== COOKIE BACKUP (Samsung-proof) ==========
  _setCookie(key, value) {
    try {
      var encoded = encodeURIComponent(JSON.stringify(value));
      // Cookie expires in 10 years
      var expires = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = 'rt_' + key + '=' + encoded + '; expires=' + expires + '; path=/; SameSite=Lax';
    } catch (e) { /* ignore */ }
  },

  _getCookie(key) {
    try {
      var name = 'rt_' + key + '=';
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i].trim();
        if (c.indexOf(name) === 0) {
          return JSON.parse(decodeURIComponent(c.substring(name.length)));
        }
      }
    } catch (e) { /* ignore */ }
    return undefined;
  },

  _getAllCookieSettings() {
    var settings = {};
    try {
      var cookies = document.cookie.split(';');
      for (var i = 0; i < cookies.length; i++) {
        var c = cookies[i].trim();
        if (c.indexOf('rt_') === 0) {
          var eqIdx = c.indexOf('=');
          var key = c.substring(3, eqIdx); // remove 'rt_' prefix
          var val = decodeURIComponent(c.substring(eqIdx + 1));
          try { settings[key] = JSON.parse(val); } catch (e) { settings[key] = val; }
        }
      }
    } catch (e) { /* ignore */ }
    return settings;
  },

  // ========== SYNC & RESTORE ==========
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
    } catch (e) { /* ignore */ }
  },

  _setSettingIDB(key, rawValue) {
    if (!this._db) return;
    try {
      var tx = this._db.transaction(this.SETTINGS_STORE, 'readwrite');
      var store = tx.objectStore(this.SETTINGS_STORE);
      store.put({ key: key, value: rawValue });
    } catch (e) { /* ignore */ }
  },

  async restoreSettings() {
    // 1. Try restore from IndexedDB first
    var restoredFromIDB = false;
    if (this._db) {
      try {
        var tx = this._db.transaction(this.SETTINGS_STORE, 'readonly');
        var store = tx.objectStore(this.SETTINGS_STORE);
        var req = store.getAll();
        await new Promise(function(resolve) {
          req.onsuccess = function() {
            var items = req.result || [];
            console.log('📦 IDB has ' + items.length + ' settings');
            for (var i = 0; i < items.length; i++) {
              var item = items[i];
              try {
                localStorage.setItem('runtracker_' + item.key, item.value);
              } catch (e) { /* blocked */ }
              try {
                DB._settingsCache[item.key] = JSON.parse(item.value);
              } catch (e) {
                DB._settingsCache[item.key] = item.value;
              }
            }
            if (items.length > 0) restoredFromIDB = true;
            resolve();
          };
          req.onerror = function() { resolve(); };
        });
      } catch (e) { /* ignore */ }
    }

    // 2. If IDB was empty, try restore from cookies
    if (!restoredFromIDB) {
      var cookieSettings = this._getAllCookieSettings();
      var cookieKeys = Object.keys(cookieSettings);
      console.log('🍪 Restoring from ' + cookieKeys.length + ' cookies');
      for (var j = 0; j < cookieKeys.length; j++) {
        var ck = cookieKeys[j];
        this._settingsCache[ck] = cookieSettings[ck];
        try {
          localStorage.setItem('runtracker_' + ck, JSON.stringify(cookieSettings[ck]));
        } catch (e) { /* blocked */ }
        // Also save to IDB for next time
        this._setSettingIDB(ck, JSON.stringify(cookieSettings[ck]));
      }
    }
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

  // ========== SETTINGS (triple storage: localStorage + IndexedDB + Cookies) ==========
  _settingsCache: {},

  getSetting(key, defaultValue) {
    // 1. Memory cache
    if (this._settingsCache.hasOwnProperty(key)) {
      return this._settingsCache[key];
    }
    // 2. localStorage
    try {
      var val = localStorage.getItem('runtracker_' + key);
      if (val !== null) {
        var parsed = JSON.parse(val);
        this._settingsCache[key] = parsed;
        return parsed;
      }
    } catch (e) { /* blocked */ }
    // 3. Cookie fallback
    var cookieVal = this._getCookie(key);
    if (cookieVal !== undefined) {
      this._settingsCache[key] = cookieVal;
      return cookieVal;
    }
    return defaultValue;
  },

  setSetting(key, value) {
    // Memory cache
    this._settingsCache[key] = value;
    // localStorage
    try {
      localStorage.setItem('runtracker_' + key, JSON.stringify(value));
    } catch (e) { /* blocked */ }
    // IndexedDB backup
    this._setSettingIDB(key, JSON.stringify(value));
    // Cookie backup (Samsung-proof)
    this._setCookie(key, value);
  }
};
