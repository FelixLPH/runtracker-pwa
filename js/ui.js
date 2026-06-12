// ============================================================
// RunTracker — UI Rendering Module
// Handles all DOM rendering and user interactions
// ============================================================

const UI = {

  // ========== HOME PAGE ==========
  async renderHome() {
    let activities = [];
    try {
      activities = await DB.getAllActivities();
    } catch (e) {
      console.warn('Could not load activities:', e);
    }
    const name = DB.getSetting('name', 'Corredor');

    const hour = new Date().getHours();
    let greeting;
    if (hour < 6) greeting = 'Boa madrugada';
    else if (hour < 12) greeting = 'Bom dia';
    else if (hour < 18) greeting = 'Boa tarde';
    else greeting = 'Boa noite';

    // Weekly stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyActivities = activities.filter(a => new Date(a.date) >= weekAgo);
    const weeklyDistance = weeklyActivities.reduce((sum, a) => sum + a.distance, 0);
    const weeklyTime = weeklyActivities.reduce((sum, a) => sum + a.duration, 0);
    const weeklyRuns = weeklyActivities.length;

    const container = document.getElementById('page-home');
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="greeting">${greeting}, <span class="accent">${name}</span></h1>
          <p class="subtitle">Vamos correr hoje?</p>
        </div>
        <div class="header-icon" onclick="App.navigateTo('profile')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      </div>

      <div class="weekly-summary glass-card">
        <h3 class="card-title">📊 Esta semana</h3>
        <div class="stats-row">
          <div class="mini-stat">
            <span class="mini-stat-value">${Stats.formatDistance(weeklyDistance)}</span>
            <span class="mini-stat-label">km</span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-value">${weeklyRuns}</span>
            <span class="mini-stat-label">corridas</span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-value">${Stats.formatDuration(weeklyTime)}</span>
            <span class="mini-stat-label">tempo</span>
          </div>
        </div>
      </div>

      <div class="section-header">
        <h2>Atividades recentes</h2>
      </div>

      <div class="activities-list" id="home-activities">
        ${activities.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🏃</div>
            <p>Nenhuma atividade ainda</p>
            <p class="text-muted">Toque em "Gravar" para começar!</p>
          </div>
        ` : activities.slice(0, 5).map(a => this._renderActivityCard(a)).join('')}
      </div>
    `;
  },

  _renderActivityCard(activity) {
    var sportCfg = Stats.getSportConfig(activity.sport || 'run');
    var date = new Date(activity.date);
    const dateStr = date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `
      <div class="activity-card glass-card" onclick="App.navigateTo('activity', ${activity.id})">
        <div class="activity-card-header">
          <div class="activity-card-icon">${sportCfg.icon}</div>
          <div class="activity-card-info">
            <h4>${activity.title}</h4>
            <span class="activity-card-date">${dateStr}</span>
          </div>
        </div>
        <div class="activity-card-stats">
          <div class="mini-stat">
            <span class="mini-stat-value">${Stats.formatDistance(activity.distance)}</span>
            <span class="mini-stat-label">km</span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-value">${activity.pace}</span>
            <span class="mini-stat-label">${activity.paceLabel || sportCfg.paceLabel}</span>
          </div>
          <div class="mini-stat">
            <span class="mini-stat-value">${Stats.formatDuration(activity.duration)}</span>
            <span class="mini-stat-label">tempo</span>
          </div>
        </div>
      </div>
    `;
  },

  // ========== RECORD PAGE ==========
  updateTimer(formattedTime) {
    const el = document.getElementById('record-timer');
    if (el) el.textContent = formattedTime;
  },

  updateRecordStats(distanceKm, elapsedSeconds) {
    var distEl = document.getElementById('record-distance');
    var paceEl = document.getElementById('record-pace');
    if (distEl) distEl.textContent = Stats.formatDistance(distanceKm);
    if (paceEl) paceEl.textContent = Stats.getPaceOrSpeed(elapsedSeconds, distanceKm, App.selectedSport);
  },

  showGPSStatus(status, message) {
    const el = document.getElementById('gps-status');
    if (!el) return;
    const statusMap = {
      searching: { text: '📡 Buscando GPS...', class: 'status-warning' },
      active: { text: '📍 GPS ativo', class: 'status-active' },
      low_accuracy: { text: '⚠️ Sinal GPS fraco', class: 'status-warning' },
      error: { text: message || '❌ Erro GPS', class: 'status-error' },
      denied: { text: '🚫 GPS negado', class: 'status-error' },
      stopped: { text: '', class: '' }
    };
    const s = statusMap[status] || { text: '', class: '' };
    el.textContent = s.text;
    el.className = `gps-status ${s.class}`;
  },

  setRecordingState(state) {
    const controls = document.getElementById('record-controls');
    if (!controls) return;

    switch (state) {
      case 'idle':
        controls.innerHTML = `
          <button class="btn-record btn-record--start" id="btn-start" onclick="App.startRun()">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </button>
          <span class="btn-record-label">INICIAR</span>
        `;
        break;

      case 'recording':
        controls.innerHTML = `
          <button class="btn-record btn-record--pause" id="btn-pause" onclick="App.pauseRun()">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          </button>
          <span class="btn-record-label">PAUSAR</span>
        `;
        break;

      case 'paused':
        controls.innerHTML = `
          <div class="controls-paused">
            <div class="control-item">
              <button class="btn-record btn-record--resume" onclick="App.resumeRun()">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </button>
              <span class="btn-record-label">RETOMAR</span>
            </div>
            <div class="control-item">
              <button class="btn-record btn-record--stop" onclick="App.finishRun()">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              </button>
              <span class="btn-record-label">CONCLUIR</span>
            </div>
          </div>
        `;
        break;
    }
  },

  // ========== HISTORY PAGE ==========
  async renderHistory() {
    let activities = [];
    try {
      activities = await DB.getAllActivities();
    } catch (e) {
      console.warn('Could not load activities:', e);
    }
    const container = document.getElementById('page-history');

    const totalDistance = activities.reduce((s, a) => s + a.distance, 0);
    const totalTime = activities.reduce((s, a) => s + a.duration, 0);

    container.innerHTML = `
      <div class="page-header">
        <h1>Histórico</h1>
      </div>

      <div class="total-banner glass-card">
        <div class="mini-stat">
          <span class="mini-stat-value">${activities.length}</span>
          <span class="mini-stat-label">corridas</span>
        </div>
        <div class="mini-stat">
          <span class="mini-stat-value">${Stats.formatDistance(totalDistance)}</span>
          <span class="mini-stat-label">km total</span>
        </div>
        <div class="mini-stat">
          <span class="mini-stat-value">${Stats.formatDuration(totalTime)}</span>
          <span class="mini-stat-label">tempo total</span>
        </div>
      </div>

      <div class="activities-list">
        ${activities.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <p>Nenhuma atividade registrada</p>
            <p class="text-muted">Suas corridas aparecerão aqui</p>
          </div>
        ` : activities.map(a => this._renderActivityCard(a)).join('')}
      </div>
    `;
  },

  // ========== ACTIVITY DETAIL PAGE ==========
  async renderActivity(data) {
    const container = document.getElementById('page-activity');
    let activity;

    if (typeof data === 'number') {
      activity = await DB.getActivity(data);
    } else {
      activity = data;
    }

    if (!activity) {
      App.navigateTo('history');
      return;
    }

    var sportCfg = Stats.getSportConfig(activity.sport || 'run');

    const date = new Date(activity.date);
    const dateStr = date.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    container.innerHTML = `
      <div class="activity-detail">
        <div class="activity-map-container">
          <div id="activity-map" class="activity-map"></div>
          <button class="btn-back" onclick="App.navigateTo('history')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
        </div>

        <div class="activity-info">
          <div class="activity-title-row">
            <h2 class="activity-title" id="activity-title" contenteditable="true"
                onblur="UI.saveActivityTitle(${activity.id}, this.textContent)">${activity.title}</h2>
          </div>
          <p class="activity-date">📅 ${dateStr}</p>

          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-label">Distância</span>
              <span class="stat-value">${Stats.formatDistance(activity.distance)} <small>km</small></span>
            </div>
            <div class="stat-card">
              <span class="stat-label">${sportCfg.usePace ? 'Ritmo médio' : 'Velocidade média'}</span>
              <span class="stat-value">${activity.pace} <small>${activity.paceLabel || sportCfg.paceLabel}</small></span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Tempo</span>
              <span class="stat-value">${Stats.formatDuration(activity.duration)}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Calorias</span>
              <span class="stat-value">${activity.calories} <small>kcal</small></span>
            </div>
            ${activity.elevationGain !== undefined && activity.elevationGain !== null ? `
            <div class="stat-card">
              <span class="stat-label">Ganho de elevação</span>
              <span class="stat-value">${activity.elevationGain} <small>m</small></span>
            </div>
            ` : ''}
            ${activity.maxElevation !== null && activity.maxElevation !== undefined ? `
            <div class="stat-card">
              <span class="stat-label">Elevação máx.</span>
              <span class="stat-value">${activity.maxElevation} <small>m</small></span>
            </div>
            ` : ''}
          </div>

          <button class="btn-danger" onclick="UI.confirmDeleteActivity(${activity.id})">
            🗑️ Excluir atividade
          </button>
        </div>
      </div>
    `;

    // Init map and show route
    setTimeout(() => {
      if (App.activityMap) App.activityMap.destroy();
      App.activityMap = new RunMap();
      App.activityMap.init('activity-map');
      if (activity.route && activity.route.length > 0) {
        App.activityMap.setRoute(activity.route);
      }
    }, 200);
  },

  async saveActivityTitle(id, newTitle) {
    if (newTitle && newTitle.trim()) {
      await DB.updateActivity(id, { title: newTitle.trim() });
    }
  },

  async confirmDeleteActivity(id) {
    if (confirm('Tem certeza que deseja excluir esta atividade? Esta ação não pode ser desfeita.')) {
      await DB.deleteActivity(id);
      App.navigateTo('history');
      UI.showToast('Atividade excluída');
    }
  },

  // ========== PROFILE PAGE ==========
  renderProfile() {
    const name = DB.getSetting('name', '');
    const weight = DB.getSetting('weight', '');
    const height = DB.getSetting('height', '');
    const birthDate = DB.getSetting('birthDate', '');
    const container = document.getElementById('page-profile');

    // Calculate age if birth date is set
    let ageDisplay = '';
    if (birthDate) {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
      ageDisplay = `${age} anos`;
    }

    // Get initial for avatar
    const initial = name ? name.charAt(0).toUpperCase() : '?';

    container.innerHTML = `
      <div class="page-header">
        <h1>Perfil</h1>
      </div>

      <div class="profile-avatar-section">
        <div class="profile-avatar">${initial}</div>
        <h2 class="profile-display-name">${name || 'Corredor'}</h2>
        ${ageDisplay ? `<p class="text-muted">${ageDisplay}${height ? ` · ${height} cm` : ''}${weight ? ` · ${weight} kg` : ''}</p>` : ''}
      </div>

      <div class="profile-form glass-card">
        <div class="input-group">
          <label for="profile-name">Nome</label>
          <input type="text" id="profile-name" class="input-field"
                 value="${name}" placeholder="Seu nome">
        </div>
        <div class="input-row">
          <div class="input-group">
            <label for="profile-weight">Peso (kg)</label>
            <input type="number" id="profile-weight" class="input-field"
                   value="${weight}" placeholder="70" min="30" max="300" step="0.1">
          </div>
          <div class="input-group">
            <label for="profile-height">Altura (cm)</label>
            <input type="number" id="profile-height" class="input-field"
                   value="${height}" placeholder="175" min="100" max="250" step="1">
          </div>
        </div>
        <div class="input-group">
          <label for="profile-birth">Data de nascimento</label>
          <input type="date" id="profile-birth" class="input-field"
                 value="${birthDate}">
        </div>
        <button class="btn-primary" onclick="UI.saveProfile()">
          💾 Salvar perfil
        </button>
      </div>

      <div class="profile-section glass-card" id="profile-total-stats">
        <h3 class="card-title">📊 Estatísticas totais</h3>
        <p class="text-muted">Carregando...</p>
      </div>

      <button class="btn-secondary" onclick="UI.exportData()" style="margin-bottom: var(--space-md);">
        📤 Exportar dados (JSON)
      </button>

      <div class="profile-divider"></div>

      <button class="btn-logout" onclick="UI.logout()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sair da conta
      </button>

      <button class="btn-danger" onclick="UI.resetAccount()" style="margin-top: var(--space-sm);">
        🗑️ Apagar todos os dados
      </button>
    `;

    this._loadProfileStats();
  },

  async _loadProfileStats() {
    const activities = await DB.getAllActivities();
    const total = activities.length;
    const totalDist = activities.reduce((s, a) => s + a.distance, 0);
    const totalTime = activities.reduce((s, a) => s + a.duration, 0);
    const totalCal = activities.reduce((s, a) => s + (a.calories || 0), 0);
    const totalElevation = activities.reduce((s, a) => s + (a.elevationGain || 0), 0);

    const container = document.getElementById('profile-total-stats');
    if (!container) return;

    container.innerHTML = `
      <h3 class="card-title">📊 Estatísticas totais</h3>
      <div class="stats-grid">
        <div class="stat-card stat-card--compact">
          <span class="stat-label">Corridas</span>
          <span class="stat-value">${total}</span>
        </div>
        <div class="stat-card stat-card--compact">
          <span class="stat-label">Distância</span>
          <span class="stat-value">${Stats.formatDistance(totalDist)} <small>km</small></span>
        </div>
        <div class="stat-card stat-card--compact">
          <span class="stat-label">Tempo</span>
          <span class="stat-value">${Stats.formatDuration(totalTime)}</span>
        </div>
        <div class="stat-card stat-card--compact">
          <span class="stat-label">Calorias</span>
          <span class="stat-value">${totalCal} <small>kcal</small></span>
        </div>
        <div class="stat-card stat-card--compact">
          <span class="stat-label">Elevação</span>
          <span class="stat-value">${totalElevation} <small>m</small></span>
        </div>
      </div>
    `;
  },

  saveProfile() {
    const name = document.getElementById('profile-name').value.trim();
    const weight = parseFloat(document.getElementById('profile-weight').value);
    const height = parseFloat(document.getElementById('profile-height').value);
    const birthDate = document.getElementById('profile-birth').value;

    if (name) DB.setSetting('name', name);
    if (weight && weight > 0) DB.setSetting('weight', weight);
    if (height && height > 0) DB.setSetting('height', height);
    if (birthDate) DB.setSetting('birthDate', birthDate);

    this.showToast('Perfil salvo com sucesso! ✅');
  },

  async exportData() {
    const activities = await DB.getAllActivities();
    const data = JSON.stringify(activities, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `runtracker-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Dados exportados! 📤');
  },

  logout() {
    DB.setSetting('onboarded', false);
    App.navigateTo('onboarding');
    this.showToast('Você saiu da conta');
  },

  resetAccount() {
    if (confirm('⚠️ Isso irá apagar TODOS os seus dados (perfil e atividades). Tem certeza?')) {
      if (confirm('Última chance! Esta ação não pode ser desfeita. Continuar?')) {
        // Clear localStorage
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('runtracker_')) keys.push(key);
        }
        keys.forEach(k => localStorage.removeItem(k));

        // Clear IndexedDB
        const request = indexedDB.deleteDatabase('RunTrackerDB');
        request.onsuccess = () => {
          this.showToast('Conta resetada');
          // Re-initialize DB and go to onboarding
          DB.init().then(() => App.navigateTo('onboarding'));
        };
        request.onerror = () => {
          this.showToast('Conta resetada');
          App.navigateTo('onboarding');
        };
      }
    }
  },

  // ========== TOAST NOTIFICATION ==========
  showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
      });
    });

    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
};
