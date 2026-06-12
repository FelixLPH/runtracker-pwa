class GPSTracker {
  constructor() {
    this._watchId = null;
    this._points = [];
    this._totalDistance = 0;
    this._isTracking = false;
    this._isPaused = false;
    this._callbacks = { update: null, error: null, status: null };
    this._lastPoint = null;
  }

  onUpdate(cb) { this._callbacks.update = cb; }
  onError(cb) { this._callbacks.error = cb; }
  onStatusChange(cb) { this._callbacks.status = cb; }

  start() {
    if (!navigator.geolocation) {
      this._emit('error', { message: 'GPS não disponível neste dispositivo' });
      return false;
    }
    this._points = [];
    this._totalDistance = 0;
    this._isTracking = true;
    this._isPaused = false;
    this._lastPoint = null;
    this._emit('status', 'searching');

    this._watchId = navigator.geolocation.watchPosition(
      (pos) => this._onPosition(pos),
      (err) => this._onError(err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    return true;
  }

  _onPosition(position) {
    const { latitude, longitude, accuracy, altitude, speed } = position.coords;
    const timestamp = position.timestamp;

    if (accuracy > 25) { this._emit('status', 'low_accuracy'); return; }
    this._emit('status', 'active');
    if (this._isPaused) return;

    const point = { lat: latitude, lng: longitude, alt: altitude, accuracy, speed, timestamp };

    if (this._lastPoint) {
      const delta = Stats.haversineDistance(this._lastPoint.lat, this._lastPoint.lng, point.lat, point.lng);
      const timeDelta = (timestamp - this._lastPoint.timestamp) / 1000;
      const impliedSpeed = (delta * 1000) / timeDelta;
      if (impliedSpeed > 12) return; // > 43km/h = GPS glitch
      this._totalDistance += delta;
    }

    this._points.push(point);
    this._lastPoint = point;
    this._emit('update', { point, totalDistance: this._totalDistance, pointCount: this._points.length });
  }

  _onError(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        this._emit('error', { message: 'Permissão de localização negada. Ative nas configurações.' });
        this._emit('status', 'denied');
        break;
      case error.POSITION_UNAVAILABLE:
      case error.TIMEOUT:
        this._emit('status', 'searching');
        break;
    }
  }

  pause() { this._isPaused = true; }
  resume() { this._isPaused = false; }

  stop() {
    if (this._watchId !== null) { navigator.geolocation.clearWatch(this._watchId); this._watchId = null; }
    this._isTracking = false;
    this._isPaused = false;
    this._emit('status', 'stopped');
  }

  getPoints() { return [...this._points]; }
  getDistance() { return this._totalDistance; }
  get isTracking() { return this._isTracking; }
  get isPaused() { return this._isPaused; }

  _emit(type, data) { if (this._callbacks[type]) this._callbacks[type](data); }
}
