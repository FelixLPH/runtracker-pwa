class RunMap {
  constructor() {
    this._map = null;
    this._routeLine = null;
    this._routeCoords = [];
    this._currentPosMarker = null;
    this._startMarker = null;
    this._endMarker = null;
  }

  init(containerId, initialLat, initialLng) {
    if (this._map) this.destroy();
    initialLat = initialLat || -26.9194;
    initialLng = initialLng || -49.0661;

    this._map = L.map(containerId, { zoomControl: false, attributionControl: false }).setView([initialLat, initialLng], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap © CARTO'
    }).addTo(this._map);

    this._routeCoords = [];
    this._routeLine = L.polyline([], {
      color: '#FC4C02', weight: 5, opacity: 0.9, lineJoin: 'round', lineCap: 'round'
    }).addTo(this._map);
  }

  addPoint(lat, lng) {
    if (!this._map) return;
    this._routeCoords.push([lat, lng]);
    this._routeLine.setLatLngs(this._routeCoords);
    if (this._routeCoords.length === 1) this._addStartMarker(lat, lng);
    this._updateCurrentPosition(lat, lng);
    this._map.setView([lat, lng], this._map.getZoom());
  }

  _addStartMarker(lat, lng) {
    const icon = L.divIcon({ className: 'marker-start', html: '<div class="marker-dot marker-dot--green"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
    this._startMarker = L.marker([lat, lng], { icon }).addTo(this._map);
  }

  _addEndMarker(lat, lng) {
    const icon = L.divIcon({ className: 'marker-end', html: '<div class="marker-dot marker-dot--red"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
    this._endMarker = L.marker([lat, lng], { icon }).addTo(this._map);
  }

  _updateCurrentPosition(lat, lng) {
    if (this._currentPosMarker) {
      this._currentPosMarker.setLatLng([lat, lng]);
    } else {
      const icon = L.divIcon({ className: 'marker-current', html: '<div class="marker-pulse"></div>', iconSize: [24, 24], iconAnchor: [12, 12] });
      this._currentPosMarker = L.marker([lat, lng], { icon }).addTo(this._map);
    }
  }

  fitRoute() {
    if (!this._map || this._routeCoords.length === 0) return;
    if (this._currentPosMarker) { this._map.removeLayer(this._currentPosMarker); this._currentPosMarker = null; }
    const lastCoord = this._routeCoords[this._routeCoords.length - 1];
    this._addEndMarker(lastCoord[0], lastCoord[1]);
    this._map.fitBounds(this._routeLine.getBounds(), { padding: [30, 30] });
  }

  setRoute(points) {
    if (!this._map) return;
    this._routeCoords = points.map(p => [p.lat, p.lng]);
    this._routeLine.setLatLngs(this._routeCoords);
    if (this._routeCoords.length > 0) {
      this._addStartMarker(this._routeCoords[0][0], this._routeCoords[0][1]);
      const last = this._routeCoords[this._routeCoords.length - 1];
      this._addEndMarker(last[0], last[1]);
      this._map.fitBounds(this._routeLine.getBounds(), { padding: [30, 30] });
    }
  }

  clear() {
    this._routeCoords = [];
    if (this._routeLine) this._routeLine.setLatLngs([]);
    if (this._startMarker) { this._map.removeLayer(this._startMarker); this._startMarker = null; }
    if (this._endMarker) { this._map.removeLayer(this._endMarker); this._endMarker = null; }
    if (this._currentPosMarker) { this._map.removeLayer(this._currentPosMarker); this._currentPosMarker = null; }
  }

  invalidateSize() { if (this._map) setTimeout(() => this._map.invalidateSize(), 100); }

  destroy() {
    if (this._map) { this._map.remove(); this._map = null; }
    this._routeLine = null; this._routeCoords = []; this._startMarker = null; this._endMarker = null; this._currentPosMarker = null;
  }
}
