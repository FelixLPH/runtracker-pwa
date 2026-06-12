const Stats = {
  // Sport type configuration
  SPORTS: {
    run:   { icon: '🏃', label: 'Corrida', paceLabel: '/km', usePace: true },
    cycle: { icon: '🚴', label: 'Ciclismo', paceLabel: 'km/h', usePace: false },
    walk:  { icon: '🚶', label: 'Caminhada', paceLabel: '/km', usePace: true }
  },

  getSportConfig(type) {
    return this.SPORTS[type] || this.SPORTS.run;
  },

  haversineDistance(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = this._toRad(lat2 - lat1);
    var dLon = this._toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this._toRad(lat1)) * Math.cos(this._toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  _toRad(deg) { return deg * (Math.PI / 180); },

  calculateTotalDistance(points) {
    var total = 0;
    for (var i = 1; i < points.length; i++) {
      total += this.haversineDistance(points[i-1].lat, points[i-1].lng, points[i].lat, points[i].lng);
    }
    return total;
  },

  // Pace for running/walking (min/km)
  calculatePace(totalSeconds, distanceKm) {
    if (distanceKm <= 0.01) return '--:--';
    var paceDecimal = (totalSeconds / 60) / distanceKm;
    if (paceDecimal > 99) return '--:--';
    var minutes = Math.floor(paceDecimal);
    var seconds = Math.round((paceDecimal - minutes) * 60);
    if (seconds === 60) return (minutes + 1) + ':00';
    return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  },

  // Speed for cycling (km/h)
  calculateSpeed(totalSeconds, distanceKm) {
    if (totalSeconds <= 0 || distanceKm <= 0.01) return '0,0';
    var speed = (distanceKm / totalSeconds) * 3600;
    return speed.toFixed(1).replace('.', ',');
  },

  // Returns pace or speed based on sport type
  getPaceOrSpeed(totalSeconds, distanceKm, sportType) {
    var sport = this.getSportConfig(sportType);
    if (sport.usePace) {
      return this.calculatePace(totalSeconds, distanceKm);
    }
    return this.calculateSpeed(totalSeconds, distanceKm);
  },

  formatDuration(totalSeconds) {
    var hrs = Math.floor(totalSeconds / 3600);
    var mins = Math.floor((totalSeconds % 3600) / 60);
    var secs = Math.floor(totalSeconds % 60);
    if (hrs > 0) return hrs + ':' + (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
  },

  formatDistance(km) {
    return km.toFixed(2).replace('.', ',');
  },

  estimateCalories(weightKg, durationSeconds, distanceKm, sportType) {
    if (!weightKg || weightKg <= 0 || durationSeconds <= 0) return 0;
    var met;
    var speedKmh = (distanceKm / (durationSeconds || 1)) * 3600;

    if (sportType === 'cycle') {
      // Cycling MET by speed
      if (speedKmh > 30) met = 12.0;
      else if (speedKmh > 25) met = 10.0;
      else if (speedKmh > 20) met = 8.0;
      else if (speedKmh > 15) met = 6.8;
      else met = 4.0;
    } else if (sportType === 'walk') {
      // Walking MET by speed
      if (speedKmh > 6.5) met = 5.0;
      else if (speedKmh > 5.5) met = 4.3;
      else if (speedKmh > 4.5) met = 3.5;
      else met = 2.8;
    } else {
      // Running MET by pace
      var paceMinPerKm = (durationSeconds / 60) / (distanceKm || 0.01);
      if (paceMinPerKm < 4) met = 14.5;
      else if (paceMinPerKm < 5) met = 11.5;
      else if (paceMinPerKm < 6) met = 9.8;
      else if (paceMinPerKm < 7) met = 8.3;
      else met = 7.0;
    }

    return Math.round(met * weightKg * (durationSeconds / 3600));
  },

  calculateElevationGain(points) {
    var gain = 0;
    var threshold = 2;
    var lastAlt = null;
    for (var i = 0; i < points.length; i++) {
      var point = points[i];
      if (point.alt === null || point.alt === undefined) continue;
      if (lastAlt === null) { lastAlt = point.alt; continue; }
      var diff = point.alt - lastAlt;
      if (diff > threshold) { gain += diff; lastAlt = point.alt; }
      else if (diff < -threshold) { lastAlt = point.alt; }
    }
    return Math.round(gain);
  },

  getMaxElevation(points) {
    var max = null;
    for (var i = 0; i < points.length; i++) {
      var point = points[i];
      if (point.alt !== null && point.alt !== undefined) {
        if (max === null || point.alt > max) max = point.alt;
      }
    }
    return max !== null ? Math.round(max) : null;
  }
};
