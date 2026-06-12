class RunTimer {
  constructor() {
    this._startTime = null;
    this._pausedTime = null;
    this._totalPausedDuration = 0;
    this._isRunning = false;
    this._isPaused = false;
    this._intervalId = null;
    this._onTick = null;
  }

  start(onTick) {
    this._startTime = performance.now();
    this._totalPausedDuration = 0;
    this._pausedTime = null;
    this._isRunning = true;
    this._isPaused = false;
    this._onTick = onTick;
    this._startInterval();
  }

  pause() {
    if (!this._isRunning || this._isPaused) return;
    this._isPaused = true;
    this._pausedTime = performance.now();
    this._stopInterval();
  }

  resume() {
    if (!this._isPaused) return;
    this._totalPausedDuration += performance.now() - this._pausedTime;
    this._pausedTime = null;
    this._isPaused = false;
    this._startInterval();
  }

  stop() {
    this._isRunning = false;
    this._isPaused = false;
    this._stopInterval();
    return this.getElapsedSeconds();
  }

  reset() {
    this._startTime = null;
    this._pausedTime = null;
    this._totalPausedDuration = 0;
    this._isRunning = false;
    this._isPaused = false;
    this._stopInterval();
  }

  getElapsedMs() {
    if (!this._startTime) return 0;
    let elapsed;
    if (this._isPaused) elapsed = this._pausedTime - this._startTime - this._totalPausedDuration;
    else if (this._isRunning) elapsed = performance.now() - this._startTime - this._totalPausedDuration;
    else elapsed = (this._pausedTime || performance.now()) - this._startTime - this._totalPausedDuration;
    return Math.max(0, elapsed);
  }

  getElapsedSeconds() { return this.getElapsedMs() / 1000; }
  getFormattedTime() { return Stats.formatDuration(this.getElapsedSeconds()); }
  get isRunning() { return this._isRunning && !this._isPaused; }
  get isPaused() { return this._isPaused; }
  get isStopped() { return !this._isRunning; }

  _startInterval() {
    this._stopInterval();
    this._intervalId = setInterval(() => {
      if (this._onTick) this._onTick(this.getFormattedTime(), this.getElapsedSeconds());
    }, 1000);
  }

  _stopInterval() {
    if (this._intervalId) { clearInterval(this._intervalId); this._intervalId = null; }
  }
}
