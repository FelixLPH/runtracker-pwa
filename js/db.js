const DB = {
  _db: null,
  DB_NAME: 'RunTrackerDB',
  DB_VERSION: 1,
  STORE_NAME: 'activities',

  async init() {
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB not available');
      return;
    }
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
        };
        request.onsuccess = function() { DB._db = request.result; resolve(); };
        request.onerror = function() { console.warn('IndexedDB open failed'); resolve(); };
      } catch (e) {
        console.warn('IndexedDB error:', e);
        resolve();
      }
    });
  },

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

  // In-memory fallback for when localStorage is blocked (incognito mode)
  _memoryStore: {},
  _useMemory: false,

  _initStorage() {
    try {
      const testKey = '__runtracker_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      this._useMemory = false;
    } catch (e) {
      console.warn('localStorage blocked, using in-memory fallback');
      this._useMemory = true;
    }
  },

  getSetting(key, defaultValue) {
    try {
      if (this._useMemory) {
        const val = this._memoryStore['runtracker_' + key];
        return val !== undefined ? val : defaultValue;
      }
      const val = localStorage.getItem('runtracker_' + key);
      return val !== null ? JSON.parse(val) : defaultValue;
    } catch (e) {
      const val = this._memoryStore['runtracker_' + key];
      return val !== undefined ? val : defaultValue;
    }
  },

  setSetting(key, value) {
    try {
      if (!this._useMemory) {
        localStorage.setItem('runtracker_' + key, JSON.stringify(value));
      }
    } catch (e) {
      this._useMemory = true;
    }
    this._memoryStore['runtracker_' + key] = value;
  }
};

// Test localStorage availability immediately
DB._initStorage();
