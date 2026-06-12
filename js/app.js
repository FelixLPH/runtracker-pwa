// ============================================================
// RunTracker — Main Application Module
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
      console.log('✅ IndexedDB initialized');
    } catch (e) {
      console.error('❌ IndexedDB failed:', e);
    }

    try {
      this.setupNavigation();
      this.setupRecording();
      this.registerSW();
    } catch (e) {
      console.error('❌ Setup failed:', e);
    }

    // Always run onboarding check, even if something above failed
    try {
      const hasOnboarded = DB.getSetting('onboarded', false);
      if (hasOnboarded) {
        this.navigateTo('home');
      } else {
        this.navigateTo('onboarding');
      }
    } catch (e) {
      console.error('❌ Navigation failed:', e);
      // Fallback: show onboarding
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

  // ========== ONBOARDING ==========
  completeOnboarding() {
    try {
      const name = (document.getElementById('onboard-name').value || '').trim();
      const weight = parseFloat(document.getElementById('onboard-weight').value) || 0;
      const height = parseFloat(document.getElementById('onboard-height').value) || 0;
      const birth = document.getElementById('onboard-birth').value || '';

      // Validate name (required)
      if (!name) {
        UI.showToast('Por favor, informe seu nome');
        document.getElementById('onboard-name').focus();
        return;
      }

      // Save user data
      try {
        DB.setSetting('name', name);
        DB.setSetting('onboarded', true);
        if (weight > 0) DB.setSetting('weight', weight);
        if (height > 0) DB.setSetting('height', height);
        if (birth) DB.setSetting('birthDate', birth);
      } catch (storageErr) {
        console.warn('localStorage failed, continuing anyway:', storageErr);
      }

      // Navigate to dashboard
      this.navigateTo('home');
      UI.showToast('Bem-vindo, ' + name + '! 🎉');
    } catch (e) {
      console.error('Onboarding error:', e);
      alert('Erro: ' + e.message);
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
