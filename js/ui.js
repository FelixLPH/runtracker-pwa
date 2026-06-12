// ============================================================
// PACEMEET — UI Rendering Module
// Handles all DOM rendering and user interactions
// ============================================================

const UI = {

  // ========== HOME PAGE ==========
  async renderHome() {
    var activities = [];
    try {
      activities = await DB.getAllActivities();
    } catch (e) {
      console.warn('Could not load activities:', e);
    }
    var name = DB.getSetting('name', 'Corredor');
    var weeklyGoal = DB.getSetting('weeklyGoal', 10);

    var hour = new Date().getHours();
    var greeting;
    if (hour < 6) greeting = 'Boa madrugada';
    else if (hour < 12) greeting = 'Bom dia';
    else if (hour < 18) greeting = 'Boa tarde';
    else greeting = 'Boa noite';

    // Motivational quotes
    var quotes = [
      { emoji: '💪', text: 'A dor é temporária, o orgulho é para sempre.' },
      { emoji: '🔥', text: 'Cada passo te leva mais perto do seu objetivo.' },
      { emoji: '🏆', text: 'Você é mais forte do que imagina.' },
      { emoji: '⚡', text: 'Não pare quando estiver cansado, pare quando terminar.' },
      { emoji: '🎯', text: 'Disciplina é escolher entre o que você quer agora e o que você mais quer.' },
      { emoji: '🌟', text: 'O único treino ruim é aquele que não aconteceu.' },
      { emoji: '🚀', text: 'Seu corpo consegue. É a sua mente que precisa convencer.' },
      { emoji: '💎', text: 'Resultados acontecem com o tempo, não da noite pro dia.' },
      { emoji: '🏃', text: 'Corra quando puder, ande se precisar, mas nunca desista.' },
      { emoji: '🦁', text: 'Levante. Vista-se. Apareça. Nunca desista.' }
    ];
    var quote = quotes[Math.floor(Math.random() * quotes.length)];

    // Weekly data (Mon-Sun)
    var now = new Date();
    var todayDow = now.getDay(); // 0=Sun, 1=Mon...
    var mondayOffset = todayDow === 0 ? -6 : 1 - todayDow;
    var monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    var dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    var dailyDist = [0, 0, 0, 0, 0, 0, 0];
    var weeklyActivities = [];

    for (var i = 0; i < activities.length; i++) {
      var aDate = new Date(activities[i].date);
      if (aDate >= monday) {
        var dayIdx = aDate.getDay();
        var chartIdx = dayIdx === 0 ? 6 : dayIdx - 1; // Mon=0, Sun=6
        dailyDist[chartIdx] += activities[i].distance;
        weeklyActivities.push(activities[i]);
      }
    }

    var weeklyDistance = weeklyActivities.reduce(function(s, a) { return s + a.distance; }, 0);
    var weeklyTime = weeklyActivities.reduce(function(s, a) { return s + a.duration; }, 0);
    var weeklyCals = weeklyActivities.reduce(function(s, a) { return s + (a.calories || 0); }, 0);
    var weeklyCount = weeklyActivities.length;

    // Chart bars
    var maxDist = Math.max.apply(null, dailyDist.concat([0.1]));
    var todayIdx = todayDow === 0 ? 6 : todayDow - 1;
    var barsHtml = '';
    for (var d = 0; d < 7; d++) {
      var pct = Math.round((dailyDist[d] / maxDist) * 100);
      var isToday = d === todayIdx;
      var hasData = dailyDist[d] > 0;
      var barVal = hasData ? dailyDist[d].toFixed(1).replace('.', ',') : '';
      barsHtml += '<div class="chart-bar-col">' +
        '<span class="chart-bar-value">' + barVal + '</span>' +
        '<div class="chart-bar' + (hasData ? ' has-data' : '') + (isToday ? ' today' : '') +
        '" style="height: ' + (hasData ? Math.max(pct, 8) : 3) + '%"></div>' +
        '<span class="chart-bar-day' + (isToday ? ' today' : '') + '">' + dayNames[d] + '</span>' +
        '</div>';
    }

    // Goal progress
    var goalPct = weeklyGoal > 0 ? Math.min(Math.round((weeklyDistance / weeklyGoal) * 100), 100) : 0;
    var goalCompleted = goalPct >= 100;
    var goalRemaining = Math.max(0, weeklyGoal - weeklyDistance);

    var container = document.getElementById('page-home');
    container.innerHTML =
      '<div class="page-header">' +
        '<div>' +
          '<h1 class="greeting">' + greeting + ', <span class="accent">' + name + '</span></h1>' +
          '<p class="subtitle">Vamos treinar hoje?</p>' +
        '</div>' +
        '<div class="header-icon" onclick="App.navigateTo(\'profile\')">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
            '<circle cx="12" cy="7" r="4"/>' +
          '</svg>' +
        '</div>' +
      '</div>' +

      '<div class="motivation-card">' +
        '<span class="motivation-emoji">' + quote.emoji + '</span>' +
        '<span class="motivation-text">' + quote.text + '</span>' +
      '</div>' +

      '<div class="weekly-chart">' +
        '<h3 class="card-title">📊 Esta semana</h3>' +
        '<div class="chart-bars">' + barsHtml + '</div>' +
      '</div>' +

      '<div class="goal-card">' +
        '<div class="goal-header">' +
          '<span class="goal-title">🎯 Meta semanal</span>' +
          '<span class="goal-value"><span class="accent">' + Stats.formatDistance(weeklyDistance) + '</span> / ' + weeklyGoal + ' km</span>' +
        '</div>' +
        '<div class="goal-progress-bar">' +
          '<div class="goal-progress-fill' + (goalCompleted ? ' completed' : '') + '" style="width: ' + goalPct + '%"></div>' +
        '</div>' +
        '<span class="goal-subtitle">' + (goalCompleted ? '✅ Meta alcançada!' : 'Faltam ' + Stats.formatDistance(goalRemaining) + ' km') + '</span>' +
      '</div>' +

      '<div class="summary-grid">' +
        '<div class="summary-item"><span class="summary-item-icon">📏</span><span class="summary-item-value">' + Stats.formatDistance(weeklyDistance) + ' <small>km</small></span><span class="summary-item-label">Distância</span></div>' +
        '<div class="summary-item"><span class="summary-item-icon">🏅</span><span class="summary-item-value">' + weeklyCount + '</span><span class="summary-item-label">Atividades</span></div>' +
        '<div class="summary-item"><span class="summary-item-icon">⏱️</span><span class="summary-item-value">' + Stats.formatDuration(weeklyTime) + '</span><span class="summary-item-label">Tempo</span></div>' +
        '<div class="summary-item"><span class="summary-item-icon">🔥</span><span class="summary-item-value">' + weeklyCals + ' <small>kcal</small></span><span class="summary-item-label">Calorias</span></div>' +
      '</div>' +

      '<div class="section-header">' +
        '<h2>Atividades recentes</h2>' +
        (activities.length > 3 ? '<span class="view-all" onclick="App.navigateTo(\'history\')">Ver todas →</span>' : '') +
      '</div>' +

      '<div class="activities-list" id="home-activities">' +
        (activities.length === 0 ?
          '<div class="empty-state"><div class="empty-icon">🏃</div><p>Nenhuma atividade ainda</p><p class="text-muted">Toque em "Gravar" para começar!</p></div>'
          : activities.slice(0, 3).map(function(a) { return UI._renderActivityCard(a); }).join('')) +
      '</div>';
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
  _historyFilters: { sport: 'all', period: 'all' },

  async renderHistory() {
    var allActivities = [];
    try {
      allActivities = await DB.getAllActivities();
    } catch (e) {
      console.warn('Could not load activities:', e);
    }

    var sportFilter = this._historyFilters.sport;
    var periodFilter = this._historyFilters.period;

    // Apply sport filter
    var filtered = allActivities;
    if (sportFilter !== 'all') {
      filtered = filtered.filter(function(a) { return (a.sport || 'run') === sportFilter; });
    }

    // Apply period filter
    var now = new Date();
    if (periodFilter !== 'all') {
      var cutoff = new Date();
      if (periodFilter === 'week') cutoff.setDate(now.getDate() - 7);
      else if (periodFilter === 'month') cutoff.setMonth(now.getMonth() - 1);
      else if (periodFilter === '3months') cutoff.setMonth(now.getMonth() - 3);
      filtered = filtered.filter(function(a) { return new Date(a.date) >= cutoff; });
    }

    // Totals
    var totalDist = filtered.reduce(function(s, a) { return s + a.distance; }, 0);
    var totalTime = filtered.reduce(function(s, a) { return s + a.duration; }, 0);
    var totalCals = filtered.reduce(function(s, a) { return s + (a.calories || 0); }, 0);

    // Personal records (from ALL activities, not filtered)
    var bestDist = null, bestPace = null, bestDuration = null;
    for (var i = 0; i < allActivities.length; i++) {
      var a = allActivities[i];
      if (!bestDist || a.distance > bestDist.distance) bestDist = a;
      if (a.distance > 0.1 && (!bestPace || a.pace < bestPace.pace)) bestPace = a;
      if (!bestDuration || a.duration > bestDuration.duration) bestDuration = a;
    }

    // Group by month
    var months = {};
    var monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    for (var j = 0; j < filtered.length; j++) {
      var date = new Date(filtered[j].date);
      var key = date.getFullYear() + '-' + (date.getMonth() < 10 ? '0' : '') + date.getMonth();
      var label = monthNames[date.getMonth()] + ' ' + date.getFullYear();
      if (!months[key]) months[key] = { label: label, activities: [] };
      months[key].activities.push(filtered[j]);
    }

    // Build sport filter pills
    var sportPills = [
      { key: 'all', label: 'Todos', icon: '' },
      { key: 'run', label: 'Corrida', icon: '🏃 ' },
      { key: 'cycle', label: 'Ciclismo', icon: '🚴 ' },
      { key: 'walk', label: 'Caminhada', icon: '🚶 ' }
    ];
    var sportPillsHtml = '';
    for (var s = 0; s < sportPills.length; s++) {
      var sp = sportPills[s];
      sportPillsHtml += '<button class="filter-pill' + (sportFilter === sp.key ? ' active' : '') +
        '" onclick="UI.setHistoryFilter(\'sport\',\'' + sp.key + '\')">' + sp.icon + sp.label + '</button>';
    }

    // Build period filter pills
    var periodPills = [
      { key: 'week', label: '7 dias' },
      { key: 'month', label: '30 dias' },
      { key: '3months', label: '3 meses' },
      { key: 'all', label: 'Tudo' }
    ];
    var periodPillsHtml = '';
    for (var p = 0; p < periodPills.length; p++) {
      var pp = periodPills[p];
      periodPillsHtml += '<button class="filter-pill' + (periodFilter === pp.key ? ' active' : '') +
        '" onclick="UI.setHistoryFilter(\'period\',\'' + pp.key + '\')">' + pp.label + '</button>';
    }

    // Records HTML
    var recordsHtml = '';
    if (allActivities.length > 0) {
      recordsHtml = '<div class="records-section">' +
        '<div class="records-title">🏆 Recordes pessoais</div>' +
        '<div class="records-scroll">';
      if (bestDist) {
        recordsHtml += '<div class="record-card"><div class="record-card-icon">📏</div>' +
          '<div class="record-card-value">' + Stats.formatDistance(bestDist.distance) + ' km</div>' +
          '<div class="record-card-label">Maior distância</div></div>';
      }
      if (bestPace && bestPace.pace && bestPace.pace !== '--:--') {
        var paceLbl = (bestPace.sport === 'cycle') ? 'Maior velocidade' : 'Melhor ritmo';
        recordsHtml += '<div class="record-card"><div class="record-card-icon">⚡</div>' +
          '<div class="record-card-value">' + bestPace.pace + ' ' + (bestPace.paceLabel || '/km') + '</div>' +
          '<div class="record-card-label">' + paceLbl + '</div></div>';
      }
      if (bestDuration) {
        recordsHtml += '<div class="record-card"><div class="record-card-icon">⏱️</div>' +
          '<div class="record-card-value">' + Stats.formatDuration(bestDuration.duration) + '</div>' +
          '<div class="record-card-label">Maior duração</div></div>';
      }
      recordsHtml += '</div></div>';
    }

    // Activities grouped by month
    var activitiesHtml = '';
    var monthKeys = Object.keys(months).sort().reverse();
    if (monthKeys.length === 0) {
      activitiesHtml = '<div class="empty-state"><div class="empty-icon">📋</div>' +
        '<p>Nenhuma atividade encontrada</p>' +
        '<p class="text-muted">Ajuste os filtros ou grave uma atividade</p></div>';
    } else {
      for (var m = 0; m < monthKeys.length; m++) {
        var month = months[monthKeys[m]];
        activitiesHtml += '<div class="month-header">' + month.label + '</div>';
        activitiesHtml += '<div class="activities-list">';
        for (var k = 0; k < month.activities.length; k++) {
          activitiesHtml += this._renderActivityCard(month.activities[k]);
        }
        activitiesHtml += '</div>';
      }
    }

    var container = document.getElementById('page-history');
    container.innerHTML =
      '<div class="page-header"><h1>Histórico</h1></div>' +

      '<div class="filter-section">' +
        '<div class="filter-row">' + sportPillsHtml + '</div>' +
        '<div class="filter-row">' + periodPillsHtml + '</div>' +
      '</div>' +

      '<div class="history-stats">' +
        '<div class="history-stat-item"><span class="history-stat-value">' + filtered.length + '</span><span class="history-stat-label">Atividades</span></div>' +
        '<div class="history-stat-item"><span class="history-stat-value">' + Stats.formatDistance(totalDist) + '</span><span class="history-stat-label">Km</span></div>' +
        '<div class="history-stat-item"><span class="history-stat-value">' + Stats.formatDuration(totalTime) + '</span><span class="history-stat-label">Tempo</span></div>' +
        '<div class="history-stat-item"><span class="history-stat-value">' + totalCals + '</span><span class="history-stat-label">Kcal</span></div>' +
      '</div>' +

      recordsHtml +
      activitiesHtml;
  },

  setHistoryFilter(type, value) {
    this._historyFilters[type] = value;
    this.renderHistory();
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
      // Note: title update in cloud would need activity date lookup
      // For now, cloud will have original title
    }
  },

  async confirmDeleteActivity(id) {
    if (confirm('Tem certeza que deseja excluir esta atividade? Esta ação não pode ser desfeita.')) {
      var activity = await DB.getActivity(id);
      await DB.deleteActivity(id);

      // Delete from cloud too
      if (activity && activity.date) {
        Cloud.deleteActivity(activity.date);
      }

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
        <div class="input-group">
          <label for="profile-goal">🎯 Meta semanal (km)</label>
          <input type="number" id="profile-goal" class="input-field"
                 value="${DB.getSetting('weeklyGoal', 10)}" placeholder="10" min="1" max="500" step="1">
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

      <div class="profile-section glass-card">
        <h3 class="card-title">☁️ Conta vinculada</h3>
        <div style="text-align:center; padding: var(--space-md) 0;">
          <div style="font-size:0.95rem; color:var(--text-secondary); background:var(--bg-secondary); padding:var(--space-md); border-radius:var(--radius-sm); border:1px solid var(--bg-tertiary);">
            <span style="color:var(--success);">●</span> ${Cloud.getCurrentUser() ? Cloud.getCurrentUser().email : 'Google'}</div>
          <p class="text-muted" style="margin-top:var(--space-sm); font-size:0.75rem;">Seus dados estão seguros na nuvem via Google</p>
        </div>
      </div>

      <div class="profile-section glass-card">
        <h3 class="card-title">💜 PACEMEET Social</h3>
        <p class="text-muted" style="font-size:0.8rem; margin-bottom:var(--space-md);">Ative para descobrir corredores, dar match e se conectar.</p>
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <span style="font-size:0.9rem;">Perfil social ativo</span>
          <label class="toggle-switch">
            <input type="checkbox" id="social-toggle" ${Cloud._cachedProfile && Cloud._cachedProfile.socialEnabled ? 'checked' : ''} onchange="UI.toggleSocial(this.checked)">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      ${(Cloud._cachedProfile && Cloud._cachedProfile.socialEnabled) ? this._renderSocialEditForm(Cloud._cachedProfile) : ''}
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
    const goal = parseInt(document.getElementById('profile-goal').value) || 10;

    if (name) DB.setSetting('name', name);
    if (weight && weight > 0) DB.setSetting('weight', weight);
    if (height && height > 0) DB.setSetting('height', height);
    if (birthDate) DB.setSetting('birthDate', birthDate);
    DB.setSetting('weeklyGoal', goal);

    // Sync to cloud — merge with existing profile to preserve social data
    var existingProfile = Cloud._cachedProfile || {};
    var updatedProfile = Object.assign({}, existingProfile, {
      name: name || DB.getSetting('name', ''),
      weight: weight || DB.getSetting('weight', 0),
      height: height || DB.getSetting('height', 0),
      birthDate: birthDate || DB.getSetting('birthDate', ''),
      weeklyGoal: goal
    });
    Cloud.saveProfile(updatedProfile);

    this.showToast('Perfil salvo com sucesso! ✅');
  },

  async toggleSocial(enabled) {
    DB.setSetting('socialEnabled', enabled);
    App._updateSocialNav(enabled);
    
    // Update in cloud
    var profile = Cloud._cachedProfile || {};
    profile.socialEnabled = enabled;
    await Cloud.saveProfile(profile);
    
    if (enabled) {
      this.showToast('Social ativado! 💜');
    } else {
      this.showToast('Social desativado');
    }
    // Re-render profile to show/hide edit form
    this.renderProfile();
  },

  _socialPhotoSlot: 0,

  _renderSocialEditForm(p) {
    var genderOptions = ['Masculino', 'Feminino', 'Prefiro não informar'];
    var prefOptions = ['Homens', 'Mulheres', 'Tanto faz'];
    var goalOptions = ['Relacionamento sério', 'Casual', 'Nada sério, vamos ver', 'Algo sério, deixa rolar', 'Amizades', 'Parceiro de treino'];
    var smokingOptions = ['Não fumo', 'Fumo', 'Tentando parar', 'Fumo quando bebo', 'Não curto fumante'];
    var allInterests = ['🏖️ Praia', '🌿 Campo', '🏠 Ficar em casa', '🏋️ Treinar', '✈️ Viajar', '🎵 Música', '📚 Ler', '🎮 Games', '🍳 Cozinhar', '🐾 Pets', '🎬 Filmes', '☕ Café'];
    
    var myInterests = p.interests || [];
    var photos = p.photos || [];

    var makeOptions = function(options, selected, groupId) {
      return '<div class="option-group" id="' + groupId + '">' + options.map(function(opt) {
        return '<div class="option-item' + (opt === selected ? ' selected' : '') + '" onclick="UI.selectSocialOption(\'' + groupId + '\', this)">' + opt + '</div>';
      }).join('') + '</div>';
    };

    var photoSlots = '';
    for (var i = 0; i < 5; i++) {
      if (photos[i]) {
        photoSlots += '<div class="photo-slot has-photo' + (i === 0 ? ' main-photo' : '') + '" onclick="UI.pickSocialPhoto(' + i + ')">' +
          '<img src="' + photos[i] + '">' +
          '<button class="photo-slot-remove" onclick="event.stopPropagation(); UI.removeSocialPhoto(' + i + ')">✕</button></div>';
      } else {
        photoSlots += '<div class="photo-slot" onclick="UI.pickSocialPhoto(' + i + ')">' +
          '<div class="photo-slot-add"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Adicionar</span></div></div>';
      }
    }

    var interestPills = allInterests.map(function(int) {
      var sel = myInterests.indexOf(int) >= 0 ? ' selected' : '';
      return '<div class="interest-pill' + sel + '" onclick="this.classList.toggle(\'selected\')">' + int + '</div>';
    }).join('');

    return '<div class="profile-section glass-card" id="social-edit-section">' +
      '<h3 class="card-title">✏️ Editar perfil social</h3>' +
      
      '<label class="input-label">Sexo</label>' +
      makeOptions(genderOptions, p.gender, 'edit-gender') +
      
      '<label class="input-label">Quero ver</label>' +
      makeOptions(prefOptions, p.preference, 'edit-preference') +
      
      '<label class="input-label">O que busca</label>' +
      makeOptions(goalOptions, p.relationshipGoal, 'edit-goal') +
      
      '<label class="input-label">Fotos (até 5)</label>' +
      '<div class="photo-grid" id="social-photo-grid">' + photoSlots + '</div>' +
      '<input type="file" id="social-photo-input" accept="image/*" style="display:none" onchange="UI.handleSocialPhoto(event)">' +
      
      '<div class="input-group"><label for="edit-bio">Bio</label>' +
      '<textarea id="edit-bio" class="input-field" placeholder="Conte sobre você..." maxlength="300" rows="3" style="resize:none">' + (p.bio || '') + '</textarea></div>' +
      
      '<label class="input-label">O que curte?</label>' +
      '<div class="interests-grid" id="edit-interests">' + interestPills + '</div>' +
      
      '<label class="input-label">Sobre fumar</label>' +
      makeOptions(smokingOptions, p.smoking, 'edit-smoking') +
      
      '<div class="input-row"><div class="input-group"><label for="edit-city">Cidade</label>' +
      '<input type="text" id="edit-city" class="input-field" value="' + (p.city || '') + '" placeholder="São Paulo"></div>' +
      '<div class="input-group"><label for="edit-state">Estado</label>' +
      '<input type="text" id="edit-state" class="input-field" value="' + (p.state || '') + '" placeholder="SP" maxlength="2"></div></div>' +
      
      '<label class="input-label">Privacidade — o que mostrar</label>' +
      '<div style="display:flex; flex-direction:column; gap:var(--space-sm); margin:var(--space-sm) 0 var(--space-lg);">' +
        '<label style="display:flex; align-items:center; justify-content:space-between; font-size:0.85rem;"><span>Mostrar peso</span><label class="toggle-switch"><input type="checkbox" id="edit-showWeight" ' + (p.showWeight !== false ? 'checked' : '') + '><span class="toggle-slider"></span></label></label>' +
        '<label style="display:flex; align-items:center; justify-content:space-between; font-size:0.85rem;"><span>Mostrar altura</span><label class="toggle-switch"><input type="checkbox" id="edit-showHeight" ' + (p.showHeight !== false ? 'checked' : '') + '><span class="toggle-slider"></span></label></label>' +
        '<label style="display:flex; align-items:center; justify-content:space-between; font-size:0.85rem;"><span>Mostrar localização</span><label class="toggle-switch"><input type="checkbox" id="edit-showLocation" ' + (p.showLocation !== false ? 'checked' : '') + '><span class="toggle-slider"></span></label></label>' +
      '</div>' +
      
      '<button class="btn-primary" onclick="UI.saveSocialProfile()">💾 Salvar perfil social</button>' +
    '</div>';
  },

  selectSocialOption(groupId, el) {
    var group = document.getElementById(groupId);
    group.querySelectorAll('.option-item').forEach(function(item) { item.classList.remove('selected'); });
    el.classList.add('selected');
  },

  pickSocialPhoto(index) {
    this._socialPhotoSlot = index;
    document.getElementById('social-photo-input').click();
  },

  async handleSocialPhoto(event) {
    var file = event.target.files[0];
    if (!file) return;
    var index = this._socialPhotoSlot;
    this.showToast('Processando foto...');
    try {
      var base64 = await Social.compressAndUploadPhoto(file);
      var profile = Cloud._cachedProfile || {};
      if (!profile.photos) profile.photos = [];
      profile.photos[index] = base64;
      await Cloud.saveProfile(profile);
      this.showToast('Foto salva! 📸');
      this.renderProfile();
    } catch(e) {
      this.showToast('Erro ao processar foto');
    }
    event.target.value = '';
  },

  async removeSocialPhoto(index) {
    var profile = Cloud._cachedProfile || {};
    if (profile.photos) {
      profile.photos.splice(index, 1);
      await Cloud.saveProfile(profile);
      this.showToast('Foto removida');
      this.renderProfile();
    }
  },

  async saveSocialProfile() {
    var profile = Cloud._cachedProfile || {};
    
    // Collect selected options
    var getSelected = function(groupId) {
      var el = document.querySelector('#' + groupId + ' .option-item.selected');
      return el ? el.textContent.trim() : '';
    };
    
    profile.gender = getSelected('edit-gender') || profile.gender;
    profile.preference = getSelected('edit-preference') || profile.preference;
    profile.relationshipGoal = getSelected('edit-goal') || profile.relationshipGoal;
    profile.smoking = getSelected('edit-smoking') || profile.smoking;
    
    profile.bio = (document.getElementById('edit-bio').value || '').trim();
    profile.city = (document.getElementById('edit-city').value || '').trim();
    profile.state = (document.getElementById('edit-state').value || '').trim().toUpperCase();
    
    // Collect interests
    var interests = [];
    document.querySelectorAll('#edit-interests .interest-pill.selected').forEach(function(el) {
      interests.push(el.textContent.trim());
    });
    profile.interests = interests;
    
    // Privacy toggles
    profile.showWeight = document.getElementById('edit-showWeight').checked;
    profile.showHeight = document.getElementById('edit-showHeight').checked;
    profile.showLocation = document.getElementById('edit-showLocation').checked;
    
    await Cloud.saveProfile(profile);
    this.showToast('Perfil social salvo! 💜');
  },


  async exportData() {
    const activities = await DB.getAllActivities();
    const data = JSON.stringify(activities, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pacemeet-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('Dados exportados! 📤');
  },

  async logout() {
    await Cloud.logout();
    DB.setSetting('onboarded', false);
    var loginStep = document.getElementById('onboarding-step-login');
    var profileStep = document.getElementById('onboarding-step-profile');
    if (loginStep) loginStep.style.display = 'block';
    if (profileStep) profileStep.style.display = 'none';
    App._emailMode = 'login';
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
