/**
 * Academic Hub - 音效系统
 * 使用 Web Audio API 创建悦耳的交互音效
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(frequency, duration, type = 'sine', volume = 0.15) {
    if (!this.enabled || !this.ctx) return;
    this.ensureContext();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  // 悬停音效 - 清脆的高音
  playHover() {
    this.playTone(880, 0.08, 'sine', 0.08);
  }

  // 点击音效 - 温暖的确认音
  playClick() {
    this.playTone(523.25, 0.12, 'sine', 0.12);
    setTimeout(() => this.playTone(659.25, 0.12, 'sine', 0.1), 50);
  }

  // 收藏音效 - 愉悦的和弦
  playFavorite() {
    this.playTone(523.25, 0.15, 'sine', 0.1);
    setTimeout(() => this.playTone(659.25, 0.15, 'sine', 0.1), 80);
    setTimeout(() => this.playTone(783.99, 0.2, 'sine', 0.1), 160);
  }

  // 取消收藏 - 下降音
  playUnfavorite() {
    this.playTone(659.25, 0.12, 'sine', 0.08);
    setTimeout(() => this.playTone(523.25, 0.15, 'sine', 0.06), 60);
  }

  // 下载音效 - 轻快的琶音
  playDownload() {
    this.playTone(440, 0.1, 'sine', 0.08);
    setTimeout(() => this.playTone(554.37, 0.1, 'sine', 0.08), 60);
    setTimeout(() => this.playTone(659.25, 0.1, 'sine', 0.08), 120);
    setTimeout(() => this.playTone(880, 0.15, 'sine', 0.1), 180);
  }

  // 搜索音效 - 轻快的滑音
  playSearch() {
    this.playTone(440, 0.1, 'sine', 0.06);
    setTimeout(() => this.playTone(554.37, 0.1, 'sine', 0.06), 80);
  }

  // 切换标签音效
  playSwitch() {
    this.playTone(392, 0.08, 'sine', 0.06);
  }

  // 成功提示音
  playSuccess() {
    this.playTone(523.25, 0.1, 'sine', 0.08);
    setTimeout(() => this.playTone(659.25, 0.1, 'sine', 0.08), 100);
    setTimeout(() => this.playTone(783.99, 0.15, 'sine', 0.1), 200);
    setTimeout(() => this.playTone(1046.5, 0.2, 'sine', 0.1), 300);
  }

  // 错误提示音
  playError() {
    this.playTone(200, 0.2, 'sawtooth', 0.05);
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  setEnabled(value) {
    this.enabled = value;
  }
}

// 创建全局音效引擎实例
window.audioEngine = new AudioEngine();

// 页面首次交互时初始化音频上下文
document.addEventListener('click', () => {
  window.audioEngine.ensureContext();
}, { once: true });
