// ============================================================
// PACEMEET — Main Application Module
// Router, recording logic, and app initialization
// ============================================================

const App = {
  currentPage: 'home',
  gps: new GPSTracker(),
  timer: new RunTimer(),
  recordMap: null,
  activityMap: null,
  wakeLock: null,
  isRecording: false,
  isPaused: false,
  selectedSport: 'run',

  // ========== INITIALIZATION ==========
  async init() {
    try {
      await DB.init();
    } catch (e) {
      console.error('❌ IndexedDB failed:', e);
    }

    // Initialize Firebase
    try {
      Cloud.init();
    } catch (e) {
      console.warn('Cloud init failed:', e);
    }

    // Restore local settings
    try {
      await DB.restoreSettings();
    } catch (e) {}

    try {
      this.setupNavigation();
      this.setupRecording();
      this.registerSW();
    } catch (e) {
      console.error('❌ Setup failed:', e);
    }

    // Check Firebase Auth state (including redirect result)
    var user = await Cloud.waitForAuth();

    if (user) {
      console.log('✅ User logged in:', user.displayName);

      // Check if user has a profile in the cloud
      var profile = await Cloud.loadProfile();
      if (profile && profile.name) {
        // Existing user — sync and go home
        await Cloud.syncFromCloud();
        this.navigateTo('home');
        UI.showToast('Bem-vindo, ' + profile.name + '! 🎉');
      } else {
        // New user — show profile completion form
        this.navigateTo('onboarding');
        document.getElementById('onboarding-step-login').style.display = 'none';
        document.getElementById('onboarding-step-profile').style.display = 'block';
        // Pre-fill name from Google account
        var nameInput = document.getElementById('onboard-name');
        if (user.displayName) nameInput.value = user.displayName;
      }
    } else {
      // No auth — show login screen
      this.navigateTo('onboarding');
    }
  },

  // ========== NAVIGATION ==========
  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (page) this.navigateTo(page);
      });
    });
  },

  navigateTo(pageName, data) {
    // Don't navigate away from record page while recording
    if (this.isRecording && this.currentPage === 'record' && pageName !== 'record' && pageName !== 'activity') {
      if (!confirm('Você está gravando uma corrida. Deseja sair? A corrida continuará em segundo plano.')) {
        return;
      }
    }

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Show target page
    const target = document.getElementById(`page-${pageName}`);
    if (target) target.classList.add('active');

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === pageName);
    });

    // Hide nav on activity detail and onboarding pages
    const nav = document.getElementById('bottom-nav');
    if (nav) {
      nav.style.display = (pageName === 'activity' || pageName === 'onboarding') ? 'none' : 'flex';
    }

    this.currentPage = pageName;

    // Page-specific initialization
    switch (pageName) {
      case 'home':
        UI.renderHome();
        break;
      case 'record':
        this.initRecordPage();
        break;
      case 'history':
        UI.renderHistory();
        break;
      case 'profile':
        UI.renderProfile();
        break;
      case 'activity':
        UI.renderActivity(data);
        break;
      case 'onboarding':
        // Already rendered in HTML
        break;
    }
  },

  // ========== SPORT SELECTION ==========
  selectSport(type) {
    this.selectedSport = type;
    var pills = document.querySelectorAll('.sport-pill');
    for (var i = 0; i < pills.length; i++) {
      pills[i].classList.toggle('active', pills[i].getAttribute('data-sport') === type);
    }
    var sport = Stats.getSportConfig(type);
    var paceLabel = document.getElementById('record-pace-label');
    if (paceLabel) paceLabel.textContent = sport.paceLabel;
  },
  // ========== GOOGLE AUTH ==========
  async loginWithGoogle() {
    var errorEl = document.getElementById('login-error');
    try {
      errorEl.style.display = 'none';
      var btn = document.getElementById('btn-google-login');
      btn.disabled = true;
      btn.textContent = 'Entrando...';

      var user = await Cloud.loginWithGoogle();
      if (user) {
        // Popup succeeded — handle login
        await this._handlePostLogin(user);
      }
      // If null, redirect happened — init() will handle on reload
    } catch (e) {
      console.error('Google login error:', e);
      var btn = document.getElementById('btn-google-login');
      btn.disabled = false;
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Entrar com Google';
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        errorEl.textContent = 'Login cancelado.';
      } else if (e.code === 'auth/unauthorized-domain') {
        errorEl.textContent = 'Domínio não autorizado. Contate o suporte.';
      } else if (e.code === 'auth/operation-not-supported-in-this-environment') {
        errorEl.textContent = 'Google não disponível neste navegador. Use "Criar conta com email" abaixo.';
      } else {
        errorEl.textContent = 'Google indisponível. Use a opção "Criar conta com email".';
      }
      errorEl.style.display = 'block';
    }
  },

  // ========== EMAIL AUTH ==========
  _emailMode: 'login',

  togglePassword() {
    var input = document.getElementById('auth-password');
    var icon = document.getElementById('eye-icon');
    if (input.type === 'password') {
      input.type = 'text';
      icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
      input.type = 'password';
      icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
  },

  toggleEmailMode() {
    this._emailMode = this._emailMode === 'login' ? 'signup' : 'login';
    this._updateEmailFormUI();
  },

  _updateEmailFormUI() {
    var isLogin = this._emailMode === 'login';
    document.getElementById('email-form-title').textContent = isLogin ? 'Entrar 👋' : 'Criar conta 🏃';
    document.getElementById('email-form-subtitle').textContent = isLogin ? 'Use seu email e senha' : 'Crie sua conta (mín. 6 caracteres na senha)';
    document.getElementById('btn-email-submit').innerHTML = isLogin ? '🔓 Entrar' : '🚀 Criar conta';
    document.getElementById('email-toggle').innerHTML = isLogin
      ? 'Não tem conta? <span class="accent" onclick="App.toggleEmailMode()">Criar conta</span>'
      : 'Já tem conta? <span class="accent" onclick="App.toggleEmailMode()">Entrar</span>';
    document.getElementById('auth-forgot').style.display = isLogin ? 'block' : 'none';
  },

  async submitEmail() {
    var email = (document.getElementById('auth-email').value || '').trim();
    var password = document.getElementById('auth-password').value || '';
    var errorEl = document.getElementById('email-error');
    errorEl.style.display = 'none';

    if (!email) { errorEl.textContent = 'Informe seu email'; errorEl.style.display = 'block'; return; }
    if (password.length < 6) { errorEl.textContent = 'A senha precisa ter pelo menos 6 caracteres'; errorEl.style.display = 'block'; return; }

    var btn = document.getElementById('btn-email-submit');
    btn.disabled = true;
    btn.textContent = 'Aguarde...';

    try {
      var user;
      if (this._emailMode === 'signup') {
        user = await Cloud.signupWithEmail(email, password);
      } else {
        user = await Cloud.loginWithEmail(email, password);
      }
      // Handle post-login (same as Google redirect)
      await this._handlePostLogin(user);
    } catch (e) {
      btn.disabled = false;
      this._updateEmailFormUI();
      var msg = 'Erro ao fazer login.';
      if (e.code === 'auth/email-already-in-use') msg = 'Este email já está cadastrado. Tente entrar.';
      else if (e.code === 'auth/invalid-email') msg = 'Email inválido.';
      else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') msg = 'Senha incorreta.';
      else if (e.code === 'auth/user-not-found') msg = 'Conta não encontrada. Crie uma nova.';
      else if (e.code === 'auth/weak-password') msg = 'Senha muito fraca. Use pelo menos 6 caracteres.';
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }
  },

  async resetPassword() {
    var email = (document.getElementById('auth-email').value || '').trim();
    if (!email) { UI.showToast('Digite seu email primeiro'); return; }
    try {
      await Cloud.resetPassword(email);
      UI.showToast('Email de recuperação enviado! 📧');
    } catch (e) {
      UI.showToast('Erro ao enviar email.');
    }
  },

  async _handlePostLogin(user) {
    var profile = await Cloud.loadProfile();
    if (profile && profile.name) {
      await Cloud.syncFromCloud();
      this.navigateTo('home');
      UI.showToast('Bem-vindo, ' + profile.name + '! 🎉');
    } else {
      document.getElementById('onboarding-step-login').style.display = 'none';
      document.getElementById('onboarding-step-profile').style.display = 'block';
      var nameInput = document.getElementById('onboard-name');
      if (user.displayName) nameInput.value = user.displayName;
      if (user.email) {
        // Pre-fill name from email if no display name
        if (!user.displayName) nameInput.value = user.email.split('@')[0];
      }
    }
  },

  // ========== ONBOARDING (profile completion) ==========
  async completeOnboarding() {
    try {
      var name = (document.getElementById('onboard-name').value || '').trim();
      var weight = parseFloat(document.getElementById('onboard-weight').value) || 0;
      var height = parseFloat(document.getElementById('onboard-height').value) || 0;
      var birth = document.getElementById('onboard-birth').value || '';

      if (!name) {
        UI.showToast('Por favor, informe seu nome');
        document.getElementById('onboard-name').focus();
        return;
      }

      // Save locally
      DB.setSetting('name', name);
      DB.setSetting('onboarded', true);
      if (weight > 0) DB.setSetting('weight', weight);
      if (height > 0) DB.setSetting('height', height);
      if (birth) DB.setSetting('birthDate', birth);

      // Save to cloud
      var profileData = { name: name, weight: weight, height: height, birthDate: birth, weeklyGoal: 10 };
      await Cloud.saveProfile(profileData);

      this.navigateTo('home');
      UI.showToast('Bem-vindo, ' + name + '! 🎉');
    } catch (e) {
      console.error('Onboarding error:', e);
      UI.showToast('Erro ao salvar perfil.');
    }
  },

  // ========== RECORD PAGE ==========
  initRecordPage() {
    if (!this.isRecording) {
      // Fresh record page — initialize map
      setTimeout(() => {
        if (!this.recordMap) {
          this.recordMap = new RunMap();
        }
        this.recordMap.init('record-map');

        // Try to center on user's current location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (this.recordMap && this.recordMap._map) {
                this.recordMap._map.setView(
                  [pos.coords.latitude, pos.coords.longitude], 16
                );
              }
            },
            () => { /* ignore errors for initial centering */ },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
          );
        }

        // Reset UI
        UI.setRecordingState('idle');
        document.getElementById('record-timer').textContent = '00:00';
        document.getElementById('record-distance').textContent = '0,00';
        document.getElementById('record-pace').textContent = '--:--';
        document.getElementById('gps-status').textContent = '';
        document.getElementById('gps-status').className = 'gps-status';

        // Show sport selector & update pace label
        var selector = document.getElementById('sport-selector');
        if (selector) selector.style.display = 'flex';
        var sport = Stats.getSportConfig(App.selectedSport);
        var paceLabel = document.getElementById('record-pace-label');
        if (paceLabel) paceLabel.textContent = sport.paceLabel;
      }, 150);
    } else {
      // Already recording — just refresh the map size
      if (this.recordMap) {
        this.recordMap.invalidateSize();
      }
    }
  },

  setupRecording() {
    // GPS position updates
    this.gps.onUpdate((data) => {
      const { point, totalDistance } = data;

      // Update map with new point
      if (this.recordMap) {
        this.recordMap.addPoint(point.lat, point.lng);
      }

      // Update live stats
      UI.updateRecordStats(totalDistance, this.timer.getElapsedSeconds());
    });

    // GPS errors
    this.gps.onError((error) => {
      UI.showGPSStatus('error', error.message);
    });

    // GPS status changes
    this.gps.onStatusChange((status) => {
      UI.showGPSStatus(status);
    });
  },

  // ========== RUN CONTROLS ==========
  async startRun() {
    this.isRecording = true;
    this.isPaused = false;

    // Hide sport selector during recording
    var selector = document.getElementById('sport-selector');
    if (selector) selector.style.display = 'none';

    // Request wake lock to keep screen on
    await this.requestWakeLock();

    // Clear previous route on map
    if (this.recordMap) {
      this.recordMap.clear();
    }

    // Start GPS tracking
    var gpsStarted = this.gps.start();
    if (!gpsStarted) {
      this.isRecording = false;
      if (selector) selector.style.display = 'flex';
      UI.showToast('GPS não disponível neste dispositivo');
      return;
    }

    // Start timer
    this.timer.start(function(formattedTime, seconds) {
      UI.updateTimer(formattedTime);
      UI.updateRecordStats(App.gps.getDistance(), seconds);
    });

    // Update UI state
    UI.setRecordingState('recording');
    var sportCfg = Stats.getSportConfig(this.selectedSport);
    UI.showToast(sportCfg.label + ' iniciada! ' + sportCfg.icon);
  },

  pauseRun() {
    this.isPaused = true;
    this.timer.pause();
    this.gps.pause();
    UI.setRecordingState('paused');
  },

  resumeRun() {
    this.isPaused = false;
    this.timer.resume();
    this.gps.resume();
    UI.setRecordingState('recording');
  },

  async finishRun() {
    // Get final values before stopping
    const duration = this.timer.stop();
    this.gps.stop();
    this.isRecording = false;
    this.isPaused = false;
    this.releaseWakeLock();

    const points = this.gps.getPoints();
    const distance = this.gps.getDistance();

    // Check if we have any data
    if (points.length < 2 || distance < 0.01) {
      UI.showToast('Atividade muito curta para salvar');
      UI.setRecordingState('idle');
      this.timer.reset();
      return;
    }

    // Get sport config
    var sportType = this.selectedSport;
    var sportCfg = Stats.getSportConfig(sportType);

    // Calculate stats
    var pace = Stats.getPaceOrSpeed(duration, distance, sportType);
    var weight = DB.getSetting('weight', 70);
    var calories = Stats.estimateCalories(weight, duration, distance, sportType);
    var elevationGain = Stats.calculateElevationGain(points);
    var maxElevation = Stats.getMaxElevation(points);

    // Generate title based on sport + day + time of day
    var now = new Date();
    var hour = now.getHours();
    var timeOfDay;
    if (hour < 6) timeOfDay = 'Madrugada';
    else if (hour < 12) timeOfDay = 'Manhã';
    else if (hour < 18) timeOfDay = 'Tarde';
    else timeOfDay = 'Noite';

    var days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    var title = sportCfg.label + ' de ' + days[now.getDay()] + ' à ' + timeOfDay;

    // Build activity object
    var activity = {
      title: title,
      sport: sportType,
      date: now.toISOString(),
      duration: Math.round(duration),
      distance: Math.round(distance * 1000) / 1000,
      pace: pace,
      paceLabel: sportCfg.paceLabel,
      calories: calories,
      elevationGain: elevationGain,
      maxElevation: maxElevation,
      route: points
    };

    // Save to database
    try {
      const id = await DB.saveActivity(activity);
      activity.id = id;
      console.log(`✅ Activity saved with ID: ${id}`);

      // Sync to cloud
      Cloud.saveActivity(activity).then(function() {
        console.log('☁️ Activity synced to cloud');
      });
    } catch (e) {
      console.error('❌ Failed to save activity:', e);
      UI.showToast('Erro ao salvar atividade');
      return;
    }

    // Show completed route on map
    if (this.recordMap) {
      this.recordMap.fitRoute();
    }

    // Navigate to activity detail
    this.navigateTo('activity', activity);

    // Reset for next run
    this.timer.reset();

    UI.showToast('Corrida salva! 🎉');
  },

  // ========== WAKE LOCK ==========
  async requestWakeLock() {
    if (!('wakeLock' in navigator)) {
      console.warn('Wake Lock API not supported');
      return;
    }
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      console.log('🔒 Wake Lock active');
      this.wakeLock.addEventListener('release', () => {
        console.log('🔓 Wake Lock released');
        this.wakeLock = null;
      });
    } catch (e) {
      console.warn('Wake Lock failed:', e.message);
    }
  },

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
  },

  // ========== SERVICE WORKER ==========
  registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
          .then(reg => console.log('✅ Service Worker registered:', reg.scope))
          .catch(err => console.error('❌ SW registration failed:', err));
      });
    }
  }
};

// Re-acquire wake lock when user returns to the app
document.addEventListener('visibilitychange', () => {
  if (App.isRecording && document.visibilityState === 'visible') {
    App.requestWakeLock();
  }
});

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
