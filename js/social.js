// ============================================================
// PACEMEET — Social Module
// Discovery, likes, matches, and social interactions
// ============================================================

const Social = {
  _discoveryQueue: [],
  _currentIndex: 0,
  _matches: [],

  // ========== DISCOVERY ==========
  
  // Load profiles for discovery, filtered by preferences
  async loadDiscoveryQueue() {
    var uid = Cloud.getUID();
    if (!uid || !Cloud._db) return [];
    
    // Load my profile to get preferences
    var myProfile = await Cloud.loadProfile();
    if (!myProfile) return [];
    
    // Load all users
    var snapshot = await Cloud._db.ref('users').once('value');
    var allUsers = snapshot.val() || {};
    
    // Load my likes and dislikes to exclude
    var likesSnap = await Cloud._db.ref('social/likes/' + uid).once('value');
    var dislikesSnap = await Cloud._db.ref('social/dislikes/' + uid).once('value');
    var myLikes = likesSnap.val() || {};
    var myDislikes = dislikesSnap.val() || {};
    
    var queue = [];
    var myPref = myProfile.preference || 'Tanto faz';
    var myGender = myProfile.gender || '';
    
    for (var oderId in allUsers) {
      if (oderId === uid) continue; // Skip self
      if (myLikes[oderId] || myDislikes[oderId]) continue; // Already swiped
      
      var otherProfile = allUsers[oderId].profile;
      if (!otherProfile || !otherProfile.name) continue; // No profile
      if (!otherProfile.photos || otherProfile.photos.length === 0) continue; // No photos
      
      // Gender filter
      var otherGender = otherProfile.gender || '';
      var otherPref = otherProfile.preference || 'Tanto faz';
      
      // Check if I want to see them
      if (myPref !== 'Tanto faz') {
        if (myPref === 'Homens' && otherGender !== 'Masculino') continue;
        if (myPref === 'Mulheres' && otherGender !== 'Feminino') continue;
      }
      
      // Check if they want to see me
      if (otherPref !== 'Tanto faz') {
        if (otherPref === 'Homens' && myGender !== 'Masculino') continue;
        if (otherPref === 'Mulheres' && myGender !== 'Feminino') continue;
      }
      
      queue.push({
        uid: oderId,
        profile: otherProfile
      });
    }
    
    // Shuffle the queue
    for (var i = queue.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = queue[i];
      queue[i] = queue[j];
      queue[j] = temp;
    }
    
    this._discoveryQueue = queue;
    this._currentIndex = 0;
    return queue;
  },
  
  getCurrentProfile() {
    if (this._currentIndex >= this._discoveryQueue.length) return null;
    return this._discoveryQueue[this._currentIndex];
  },
  
  // ========== LIKES / DISLIKES ==========
  
  async likeUser(targetUid) {
    var uid = Cloud.getUID();
    if (!uid || !Cloud._db) return false;
    
    // Record the like
    await Cloud._db.ref('social/likes/' + uid + '/' + targetUid).set(Date.now());
    
    // Check if it's a mutual like (match!)
    var theirLike = await Cloud._db.ref('social/likes/' + targetUid + '/' + uid).once('value');
    if (theirLike.val()) {
      // IT'S A MATCH!
      await this._createMatch(uid, targetUid);
      this._currentIndex++;
      return true; // indicates match
    }
    
    this._currentIndex++;
    return false; // no match yet
  },
  
  async dislikeUser(targetUid) {
    var uid = Cloud.getUID();
    if (!uid || !Cloud._db) return;
    
    await Cloud._db.ref('social/dislikes/' + uid + '/' + targetUid).set(Date.now());
    this._currentIndex++;
  },
  
  // ========== MATCHES ==========
  
  async _createMatch(uid1, uid2) {
    if (!Cloud._db) return;
    
    // Create a sorted match ID so it's the same regardless of who matched first
    var matchId = [uid1, uid2].sort().join('_');
    
    await Cloud._db.ref('social/matches/' + matchId).set({
      user1: uid1,
      user2: uid2,
      timestamp: Date.now()
    });
  },
  
  async getMatches() {
    var uid = Cloud.getUID();
    if (!uid || !Cloud._db) return [];
    
    var snapshot = await Cloud._db.ref('social/matches').once('value');
    var allMatches = snapshot.val() || {};
    var myMatches = [];
    
    for (var matchId in allMatches) {
      var match = allMatches[matchId];
      if (match.user1 === uid || match.user2 === uid) {
        var otherUid = match.user1 === uid ? match.user2 : match.user1;
        
        // Load the other user's profile
        var profileSnap = await Cloud._db.ref('users/' + otherUid + '/profile').once('value');
        var otherProfile = profileSnap.val();
        
        if (otherProfile) {
          myMatches.push({
            matchId: matchId,
            uid: otherUid,
            profile: otherProfile,
            timestamp: match.timestamp
          });
        }
      }
    }
    
    // Sort by most recent
    myMatches.sort(function(a, b) { return b.timestamp - a.timestamp; });
    this._matches = myMatches;
    return myMatches;
  },
  
  // ========== PHOTO MANAGEMENT ==========
  
  async compressAndUploadPhoto(file, index) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var canvas = document.createElement('canvas');
          var maxSize = 600; // Max width/height
          var width = img.width;
          var height = img.height;
          
          if (width > height) {
            if (width > maxSize) { height = height * maxSize / width; width = maxSize; }
          } else {
            if (height > maxSize) { width = width * maxSize / height; height = maxSize; }
          }
          
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG at 70% quality (~50-100KB)
          var base64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve(base64);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
  
  async savePhotos(photos) {
    var uid = Cloud.getUID();
    if (!uid || !Cloud._db) return;
    await Cloud._db.ref('users/' + uid + '/profile/photos').set(photos);
  },
  
  async deletePhoto(index) {
    var uid = Cloud.getUID();
    if (!uid || !Cloud._db) return;
    var snap = await Cloud._db.ref('users/' + uid + '/profile/photos').once('value');
    var photos = snap.val() || [];
    photos.splice(index, 1);
    await Cloud._db.ref('users/' + uid + '/profile/photos').set(photos);
    return photos;
  },
  
  // ========== HELPERS ==========
  
  calcAge(birthDate) {
    if (!birthDate) return null;
    var today = new Date();
    var birth = new Date(birthDate);
    var age = today.getFullYear() - birth.getFullYear();
    var m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }
};
