/**
 * soundPlayer.ts
 * HTML5 Audio 消息提示音工具模块
 *
 * 设计要点：
 * - 纯 TS 模块（非 React hook），可在 Zustand store 中直接调用
 * - SSR guard：服务端渲染时安全跳过
 * - _audioUnlocked：记录浏览器 Autoplay 策略是否已解锁
 * - _unlocking：防止并发重复解锁（飞行中保护）
 * - 默认提示音：/sounds/msg.wav（WAV 在 HTML5 Audio 中原生支持）
 */

const SOUND_URL = '/sounds/msg.wav';

let _audioUnlocked = false;
let _unlocking = false;

/**
 * 尝试预热 Audio 以解锁浏览器 Autoplay 限制。
 * 幂等函数，多次调用安全。若解锁失败（play() rejected），
 * 会重置 _unlocking 以允许下次用户交互时重试。
 *
 * 由 page.tsx 在每次 click / touchstart 事件时调用。
 */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return; // SSR guard
  if (_audioUnlocked || _unlocking) return;
  _unlocking = true;
  try {
    const audio = new Audio(SOUND_URL);
    audio.volume = 0;
    const p = audio.play();
    if (p !== undefined) {
      p.then(() => {
        audio.pause();
        _audioUnlocked = true;
        _unlocking = false;
      }).catch(() => {
        // 解锁失败，重置 _unlocking，允许下次交互继续重试
        _unlocking = false;
      });
    } else {
      _unlocking = false;
    }
  } catch {
    _unlocking = false;
  }
}

/**
 * 播放消息提示音 /sounds/msg.wav。
 * Autoplay 受限时静默失败，不影响 UI 或消息显示逻辑。
 */
export function playMessageSound(): void {
  if (typeof window === 'undefined') return; // SSR guard
  try {
    const audio = new Audio(SOUND_URL);
    audio.volume = 0.7;
    audio.play().catch(() => {
      // Autoplay blocked — 静默失败
    });
  } catch {
    // Audio 构造异常时静默忽略
  }
}

/**
 * 仅供单元测试使用：重置模块级状态。
 * 生产代码请勿调用。
 */
export function _resetForTest(): void {
  _audioUnlocked = false;
  _unlocking = false;
}
