/**
 * soundPlayer.test.ts
 * soundPlayer 模块单元测试
 *
 * 测试环境：Node.js（jest testEnvironment: 'node'）
 * 通过 global.window 和 global.Audio mock 模拟浏览器环境
 */

import { playMessageSound, unlockAudio, _resetForTest } from '../soundPlayer';

// ── Mock Audio 类 ──────────────────────────────────────────
interface MockAudioInstance {
  src: string;
  volume: number;
  play: jest.Mock;
  pause: jest.Mock;
}

let AudioConstructor: jest.Mock;
let createdInstances: MockAudioInstance[];

/**
 * 创建一个新的 Mock Audio 工厂，每次 new Audio() 时追踪实例
 */
function setupAudioMock(playResult: Promise<void> | (() => Promise<void>) = Promise.resolve()) {
  createdInstances = [];
  AudioConstructor = jest.fn().mockImplementation((src?: string) => {
    const instance: MockAudioInstance = {
      src: src ?? '',
      volume: 1,
      play: jest.fn().mockImplementation(() =>
        typeof playResult === 'function' ? playResult() : playResult
      ),
      pause: jest.fn(),
    };
    createdInstances.push(instance);
    return instance;
  });
  (global as unknown as Record<string, unknown>).Audio = AudioConstructor;
}

beforeEach(() => {
  _resetForTest();
  // 模拟浏览器环境：设置 global.window（让 SSR guard 通过）
  (global as unknown as Record<string, unknown>).window = {};
  setupAudioMock(); // 默认 play() 成功 resolve
});

afterEach(() => {
  delete (global as unknown as Record<string, unknown>).window;
  delete (global as unknown as Record<string, unknown>).Audio;
  jest.clearAllMocks();
});

// ── playMessageSound 测试 ──────────────────────────────────

describe('playMessageSound', () => {
  test('用例1：正常调用 new Audio 并 play()', () => {
    playMessageSound();
    expect(AudioConstructor).toHaveBeenCalledTimes(1);
    expect(AudioConstructor).toHaveBeenCalledWith('/sounds/msg.wav');
    expect(createdInstances[0].play).toHaveBeenCalledTimes(1);
  });

  test('用例1b：volume 被设置为 0.7', () => {
    playMessageSound();
    expect(createdInstances[0].volume).toBe(0.7);
  });

  test('用例2：play() 返回 reject 时不抛异常', async () => {
    setupAudioMock(Promise.reject(new Error('NotAllowedError: autoplay blocked')));
    // 不应抛出任何异常
    expect(() => playMessageSound()).not.toThrow();
    // 等待 Promise 处理完成（catch 静默处理）
    await new Promise((resolve) => setTimeout(resolve, 10));
    // 验证无 unhandled rejection：无报错即通过
  });

  test('用例3：Audio 构造函数抛异常时不抛出', () => {
    AudioConstructor = jest.fn().mockImplementation(() => {
      throw new Error('Audio not supported');
    });
    (global as unknown as Record<string, unknown>).Audio = AudioConstructor;
    expect(() => playMessageSound()).not.toThrow();
  });

  test('用例4：SSR 环境（window=undefined）下不调用 Audio', () => {
    delete (global as unknown as Record<string, unknown>).window;
    playMessageSound();
    expect(AudioConstructor).not.toHaveBeenCalled();
  });
});

// ── unlockAudio 测试 ──────────────────────────────────────

describe('unlockAudio', () => {
  test('用例5：正常解锁流程 — volume=0，调用 play()', async () => {
    unlockAudio();
    expect(AudioConstructor).toHaveBeenCalledTimes(1);
    expect(createdInstances[0].volume).toBe(0);
    expect(createdInstances[0].play).toHaveBeenCalledTimes(1);
    // 等待 then() 执行
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(createdInstances[0].pause).toHaveBeenCalledTimes(1);
  });

  test('用例6：幂等性 — 成功解锁后，再次调用不创建新 Audio', async () => {
    unlockAudio();
    await new Promise((resolve) => setTimeout(resolve, 10));
    // 第二次调用：已解锁，应直接返回
    unlockAudio();
    expect(AudioConstructor).toHaveBeenCalledTimes(1);
  });

  test('用例7：解锁失败后 _unlocking 重置，允许重试', async () => {
    let callCount = 0;
    setupAudioMock(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('blocked'));
      return Promise.resolve();
    });

    unlockAudio(); // 第一次：失败
    await new Promise((resolve) => setTimeout(resolve, 10));
    // _unlocking 已重置，第二次可以重试
    unlockAudio();
    await new Promise((resolve) => setTimeout(resolve, 10));
    // 两次都创建了 Audio 实例（第一次失败，第二次成功）
    expect(AudioConstructor).toHaveBeenCalledTimes(2);
  });

  test('用例8：并发调用只执行一次（_unlocking 保护）', async () => {
    // play() 返回一个不立即 resolve 的 Promise（模拟耗时操作）
    let resolvePlay!: () => void;
    const neverResolve = new Promise<void>((resolve) => { resolvePlay = resolve; });
    setupAudioMock(neverResolve);

    // 并发调用三次
    unlockAudio();
    unlockAudio();
    unlockAudio();

    // 只有第一次创建了 Audio（后两次被 _unlocking 拦截）
    expect(AudioConstructor).toHaveBeenCalledTimes(1);

    // 清理：resolve promise 避免悬挂
    resolvePlay();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});
