// ============================================================
// RunTracker — Firebase Cloud Storage Module
// Uses Realtime Database (free, no billing required)
// Recovery code system (no login required)
// ============================================================

const Cloud = {
  _db: null,
  _initialized: false,

  // Firebase config
  _config: {
    apiKey: "AIzaSyBhnwSwG73NpvIT1CRQqLWmPGgVuWNX6xA",
    authDomain: "runtracker-pwa.firebaseapp.com",
    databaseURL: "https://runtracker-pwa-default-rtdb.firebaseio.com",
    projectId: "runtracker-pwa",
    storageBucket: "runtracker-pwa.firebasestorage.app",
    messagingSenderId: "859349335508",
    appId: "1:859349335508:web:f7079dd45dc93319e12a41"
  },

  init() {
    try {
      if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not loaded');
        return;
      }
      if (!firebase.apps.length) {
        firebase.initializeApp(this._config);
      }
      this._db = firebase.database();
      this._initialized = true;
      console.log('✅ Firebase Realtime DB initialized');
    } catch (e) {
      console.error('Firebase init error:', e);
    }
  },

  // ========== RECOVERY CODE ==========
  generateCode(name) {
    var cleanName = (name || 'user').toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);
    if (cleanName.length < 2) cleanName = 'USER';
    var num = Math.floor(1000 + Math.random() * 9000);
    return cleanName + '-' + num;
  },

  // ========== SAVE PROFILE ==========
  async saveProfile(code, profileData) {
    if (!this._initialized || !this._db) return false;
    try {
      await this._db.ref('users/' + code + '/profile').set(profileData);
      await this._db.ref('users/' + code + '/updatedAt').set(Date.now());
      console.log('☁️ Profile saved:', code);
      return true;
    } catch (e) {
      console.error('Cloud save error:', e);
      return false;
    }
  },

  // ========== LOAD PROFILE ==========
  async loadProfile(code) {
    if (!this._initialized || !this._db) return null;
    try {
      var snapshot = await this._db.ref('users/' + code + '/profile').once('value');
      if (snapshot.exists()) {
        console.log('☁️ Profile loaded:', code);
        return snapshot.val();
      }
      return null;
    } catch (e) {
      console.error('Cloud load error:', e);
      return null;
    }
  },

  // ========== SAVE ACTIVITY ==========
  async saveActivity(code, activity) {
    if (!this._initialized || !this._db) return false;
    try {
      var actId = 'act_' + new Date(activity.date).getTime();
      await this._db.ref('users/' + code + '/activities/' + actId).set(activity);
      console.log('☁️ Activity saved');
      return true;
    } catch (e) {
      console.error('Cloud save activity error:', e);
      return false;
    }
  },

  // ========== LOAD ALL ACTIVITIES ==========
  async loadActivities(code) {
    if (!this._initialized || !this._db) return [];
    try {
      var snapshot = await this._db.ref('users/' + code + '/activities').once('value');
      if (!snapshot.exists()) return [];
      var data = snapshot.val();
      var activities = [];
      for (var key in data) {
        if (data.hasOwnProperty(key)) {
          activities.push(data[key]);
        }
      }
      activities.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
      console.log('☁️ Loaded ' + activities.length + ' activities');
      return activities;
    } catch (e) {
      console.error('Cloud load activities error:', e);
      return [];
    }
  },

  // ========== DELETE ACTIVITY ==========
  async deleteActivity(code, activityDate) {
    if (!this._initialized || !this._db) return false;
    try {
      var actId = 'act_' + new Date(activityDate).getTime();
      await this._db.ref('users/' + code + '/activities/' + actId).remove();
      console.log('☁️ Activity deleted');
      return true;
    } catch (e) {
      console.error('Cloud delete error:', e);
      return false;
    }
  },

  // ========== CHECK IF CODE EXISTS ==========
  async codeExists(code) {
    if (!this._initialized || !this._db) return false;
    try {
      var snapshot = await this._db.ref('users/' + code.toUpperCase()).once('value');
      return snapshot.exists();
    } catch (e) {
      return false;
    }
  },

  // ========== FULL SYNC: Cloud → Local ==========
  async syncFromCloud(code) {
    if (!this._initialized) return false;
    try {
      var profile = await this.loadProfile(code);
      if (!profile) return false;

      // Restore profile locally
      if (profile.name) DB.setSetting('name', profile.name);
      if (profile.weight) DB.setSetting('weight', profile.weight);
      if (profile.height) DB.setSetting('height', profile.height);
      if (profile.birthDate) DB.setSetting('birthDate', profile.birthDate);
      if (profile.weeklyGoal) DB.setSetting('weeklyGoal', profile.weeklyGoal);
      DB.setSetting('onboarded', true);
      DB.setSetting('recoveryCode', code);

      // Load activities from cloud
      var cloudActivities = await this.loadActivities(code);
      for (var i = 0; i < cloudActivities.length; i++) {
        try {
          await DB.saveActivity(cloudActivities[i]);
        } catch (e) { /* may already exist */ }
      }

      console.log('☁️ Full sync complete');
      return true;
    } catch (e) {
      console.error('Cloud sync error:', e);
      return false;
    }
  }
};
