// ============================================================
// RunTracker — Firebase Cloud Storage Module
// Uses Google Sign-In + Realtime Database
// ============================================================

const Cloud = {
  _db: null,
  _auth: null,
  _initialized: false,
  _user: null,

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
      this._auth = firebase.auth();
      this._initialized = true;
      console.log('✅ Firebase initialized');
    } catch (e) {
      console.error('Firebase init error:', e);
    }
  },

  // ========== AUTH ==========
  async loginWithGoogle() {
    if (!this._initialized || !this._auth) throw new Error('Firebase not initialized');
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    // Use redirect (works on mobile, no popup blocking)
    await this._auth.signInWithRedirect(provider);
  },

  async signupWithEmail(email, password) {
    if (!this._initialized || !this._auth) throw new Error('Firebase not initialized');
    var result = await this._auth.createUserWithEmailAndPassword(email, password);
    this._user = result.user;
    return this._user;
  },

  async loginWithEmail(email, password) {
    if (!this._initialized || !this._auth) throw new Error('Firebase not initialized');
    var result = await this._auth.signInWithEmailAndPassword(email, password);
    this._user = result.user;
    return this._user;
  },

  async resetPassword(email) {
    if (!this._initialized || !this._auth) throw new Error('Firebase not initialized');
    await this._auth.sendPasswordResetEmail(email);
  },

  getCurrentUser() {
    if (!this._auth) return null;
    return this._auth.currentUser;
  },

  getUID() {
    var user = this.getCurrentUser();
    return user ? user.uid : null;
  },

  async logout() {
    if (this._auth) {
      await this._auth.signOut();
      this._user = null;
    }
  },

  // Wait for auth state to resolve on load
  waitForAuth() {
    if (!this._auth) return Promise.resolve(null);
    return new Promise(function(resolve) {
      // First check redirect result
      Cloud._auth.getRedirectResult().then(function(result) {
        if (result && result.user) {
          Cloud._user = result.user;
          resolve(result.user);
        }
      }).catch(function(e) {
        console.warn('Redirect result error:', e);
      });

      // Also listen for auth state changes
      var unsubscribe = Cloud._auth.onAuthStateChanged(function(user) {
        unsubscribe();
        Cloud._user = user;
        resolve(user);
      });
    });
  },

  // ========== SAVE PROFILE ==========
  async saveProfile(profileData) {
    var uid = this.getUID();
    if (!this._initialized || !this._db || !uid) return false;
    try {
      await this._db.ref('users/' + uid + '/profile').set(profileData);
      await this._db.ref('users/' + uid + '/updatedAt').set(Date.now());
      console.log('☁️ Profile saved');
      return true;
    } catch (e) {
      console.error('Cloud save error:', e);
      return false;
    }
  },

  // ========== LOAD PROFILE ==========
  async loadProfile() {
    var uid = this.getUID();
    if (!this._initialized || !this._db || !uid) return null;
    try {
      var snapshot = await this._db.ref('users/' + uid + '/profile').once('value');
      if (snapshot.exists()) {
        console.log('☁️ Profile loaded');
        return snapshot.val();
      }
      return null;
    } catch (e) {
      console.error('Cloud load error:', e);
      return null;
    }
  },

  // ========== SAVE ACTIVITY ==========
  async saveActivity(activity) {
    var uid = this.getUID();
    if (!this._initialized || !this._db || !uid) return false;
    try {
      var actId = 'act_' + new Date(activity.date).getTime();
      await this._db.ref('users/' + uid + '/activities/' + actId).set(activity);
      console.log('☁️ Activity saved');
      return true;
    } catch (e) {
      console.error('Cloud save activity error:', e);
      return false;
    }
  },

  // ========== LOAD ALL ACTIVITIES ==========
  async loadActivities() {
    var uid = this.getUID();
    if (!this._initialized || !this._db || !uid) return [];
    try {
      var snapshot = await this._db.ref('users/' + uid + '/activities').once('value');
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
  async deleteActivity(activityDate) {
    var uid = this.getUID();
    if (!this._initialized || !this._db || !uid) return false;
    try {
      var actId = 'act_' + new Date(activityDate).getTime();
      await this._db.ref('users/' + uid + '/activities/' + actId).remove();
      console.log('☁️ Activity deleted');
      return true;
    } catch (e) {
      console.error('Cloud delete error:', e);
      return false;
    }
  },

  // ========== FULL SYNC: Cloud → Local ==========
  async syncFromCloud() {
    var uid = this.getUID();
    if (!this._initialized || !uid) return false;
    try {
      var profile = await this.loadProfile();
      if (!profile) return false;

      // Restore profile locally
      if (profile.name) DB.setSetting('name', profile.name);
      if (profile.weight) DB.setSetting('weight', profile.weight);
      if (profile.height) DB.setSetting('height', profile.height);
      if (profile.birthDate) DB.setSetting('birthDate', profile.birthDate);
      if (profile.weeklyGoal) DB.setSetting('weeklyGoal', profile.weeklyGoal);
      DB.setSetting('onboarded', true);

      // Load activities from cloud
      var cloudActivities = await this.loadActivities();
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
