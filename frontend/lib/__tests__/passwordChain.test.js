/**
 * passwordChain.test.js
 * 密码链路修复测试（task43）
 * 测试 ImportConfirmPasswordView / ImportPasswordView duplicate 分支的密码一致性逻辑
 * 运行: node frontend/lib/__tests__/passwordChain.test.js
 */

const { ethers } = require("ethers");

// ======== 模拟 localStorage 和 sessionStorage ========
class MockStorage {
  constructor() { this._data = {}; }
  getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; }
  setItem(k, v) { this._data[k] = String(v); }
  removeItem(k) { delete this._data[k]; }
  clear() { this._data = {}; }
}

global.window = {
  localStorage: new MockStorage(),
  sessionStorage: new MockStorage(),
  crypto: { randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2)}` },
};
global.localStorage = global.window.localStorage;
global.sessionStorage = global.window.sessionStorage;
global.crypto = global.window.crypto;

// ======== 内联核心工具函数（使用快速 scrypt 参数 N=1024 供测试使用）========
const LS_WALLETS_KEY = "ogbo_wallets";
const LS_ACTIVE_KEY = "ogbo_active_wallet";
const SS_SESSION_PK_KEY = "ogbo_session_pk";

function _ls() { return global.window.localStorage; }
function _ss() { return global.window.sessionStorage; }
function _generateId() { return global.window.crypto.randomUUID(); }

// 使用 N=1024 加速测试（生产代码使用 N=8192）
async function encryptWallet(wallet, password) {
  return wallet.encrypt(password, { scrypt: { N: 1024 } });
}
async function decryptWallet(keystore, password) {
  return ethers.Wallet.fromEncryptedJson(keystore, password);
}

function getStoredWallets() {
  try {
    const raw = _ls().getItem(LS_WALLETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function saveWallet(data) {
  const wallets = getStoredWallets();
  const existingIdx = wallets.findIndex(
    w => w.address.toLowerCase() === data.address.toLowerCase()
  );
  let savedWallet;
  if (existingIdx >= 0) {
    savedWallet = {
      ...wallets[existingIdx],
      keystore: data.keystore,
      network: data.network,
      type: data.keystore ? 'imported' : (wallets[existingIdx].type || 'imported'),
    };
    wallets[existingIdx] = savedWallet;
  } else {
    savedWallet = { ...data, id: _generateId(), createdAt: Date.now(), type: data.type || 'imported' };
    wallets.push(savedWallet);
  }
  _ls().setItem(LS_WALLETS_KEY, JSON.stringify(wallets));
  setActiveWalletId(savedWallet.id);
  return savedWallet;
}

function getActiveWallet() {
  const wallets = getStoredWallets();
  if (wallets.length === 0) return null;
  const activeId = _ls().getItem(LS_ACTIVE_KEY);
  if (activeId) {
    const found = wallets.find(w => w.id === activeId);
    if (found) return found;
  }
  // 修复后的回退逻辑：优先返回第一个有 keystore 的 imported 钱包
  return wallets.find(w => w.type !== 'external' && !!w.keystore) ?? wallets[wallets.length - 1];
}

function setActiveWalletId(id) { _ls().setItem(LS_ACTIVE_KEY, id); }
function storeSessionKey(pk) { _ss().setItem(SS_SESSION_PK_KEY, pk); }

// ======== 被测逻辑：ImportConfirmPasswordView duplicate 分支（已修复版本）========
// 精确镜像 LoginApp.tsx 中 ImportConfirmPasswordView.handleComplete 的 duplicate 分支
async function handleImportConfirmDuplicate({ duplicate, wallet, pw }) {
  let passwordMatches = false;
  try {
    await decryptWallet(duplicate.keystore, pw);
    passwordMatches = true;
  } catch {
    // 密码不一致：预期情况
  }

  if (passwordMatches) {
    setActiveWalletId(duplicate.id);
  } else {
    const newKeystore = await encryptWallet(wallet, pw);
    saveWallet({
      name: duplicate.name,
      network: duplicate.network,
      address: duplicate.address,
      keystore: newKeystore,
      type: duplicate.type,
    });
  }
  storeSessionKey(wallet.privateKey);
  return wallet.address;
}

// ======== 被测逻辑：ImportPasswordView duplicate 分支（已修复版本）========
async function handleImportPasswordDuplicate({ duplicate, wallet, pw }) {
  const newKeystore = await encryptWallet(wallet, pw);
  saveWallet({
    name: duplicate.name,
    network: duplicate.network,
    address: duplicate.address,
    keystore: newKeystore,
    type: duplicate.type,
  });
  storeSessionKey(wallet.privateKey);
  return wallet.address;
}

// ======== 测试框架 ========
let passed = 0, failed = 0, total = 0;
const results = [];

async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    results.push({ name, status: "PASS" });
    process.stdout.write(".");
  } catch (e) {
    failed++;
    results.push({ name, status: "FAIL", error: e.message });
    process.stdout.write("F");
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeTruthy: () => { if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`); },
    toBeFalsy: () => { if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`); },
    notToBe: (unexpected) => {
      if (actual === unexpected) throw new Error(`Expected not to be ${JSON.stringify(unexpected)}`);
    },
  };
}

// 已知测试私钥（Hardhat 默认账户 #0）
const PK_A = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
// 另一个测试私钥（Hardhat 默认账户 #1）
const PK_B = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const PW_X = "PasswordX123!";
const PW_OLD = "OldPassword99!";
const PW_A = "WalletPassA1!";

async function runTests() {
  console.log("\n🔐 密码链路修复测试（task43 passwordChain）\n");

  // ---- T2-1: duplicate 存在且密码一致 → 不重新加密 ----
  await test("T2-1: ImportConfirmPassword duplicate 密码一致 → 直接切换不重新加密", async () => {
    _ls().clear();
    _ss().clear();

    const walletA = new ethers.Wallet(PK_A);
    // 先创建 duplicate，用 PW_X 加密
    const keystoreX = await encryptWallet(walletA, PW_X);
    const w0 = saveWallet({ name: "W0", network: "ethereum", address: "0xOther", keystore: '{"v":0}', type: 'imported' });
    const wDup = saveWallet({ name: "WDup", network: "ethereum", address: walletA.address, keystore: keystoreX, type: 'imported' });
    const originalKeystore = wDup.keystore;

    // 设置 active 为 W0（非 duplicate）
    setActiveWalletId(w0.id);

    // 执行 duplicate 分支（密码一致）
    await handleImportConfirmDuplicate({ duplicate: wDup, wallet: walletA, pw: PW_X });

    // 验证：keystore 未被修改（未重新加密）
    const wallets = getStoredWallets();
    const dupInStorage = wallets.find(w => w.address.toLowerCase() === walletA.address.toLowerCase());
    expect(dupInStorage.keystore).toBe(originalKeystore);

    // 验证：active 切换到 duplicate
    expect(_ls().getItem(LS_ACTIVE_KEY)).toBe(wDup.id);

    // 验证：session key 已写入
    expect(_ss().getItem(SS_SESSION_PK_KEY)).toBeTruthy();
  });

  // ---- T2-2: duplicate 存在但密码不一致 → 重新加密 ----
  await test("T2-2: ImportConfirmPassword duplicate 密码不一致 → 重新加密，新 keystore 可用当前密码解密", async () => {
    _ls().clear();
    _ss().clear();

    const walletA = new ethers.Wallet(PK_A);
    // duplicate 用 PW_OLD 加密
    const keystoreOld = await encryptWallet(walletA, PW_OLD);
    const wDup = saveWallet({ name: "WDup", network: "ethereum", address: walletA.address, keystore: keystoreOld, type: 'imported' });

    // 当前活跃钱包用 PW_X 加密
    const walletB = new ethers.Wallet(PK_B);
    const keystoreX = await encryptWallet(walletB, PW_X);
    const w0 = saveWallet({ name: "W0", network: "bsc", address: walletB.address, keystore: keystoreX, type: 'imported' });
    setActiveWalletId(w0.id);

    // 执行 duplicate 分支（密码不一致：pw=PW_X，但 duplicate 用 PW_OLD 加密）
    await handleImportConfirmDuplicate({ duplicate: wDup, wallet: walletA, pw: PW_X });

    // 验证：keystore 已更新（不等于旧 keystore）
    const wallets = getStoredWallets();
    const dupInStorage = wallets.find(w => w.address.toLowerCase() === walletA.address.toLowerCase());
    expect(dupInStorage.keystore).notToBe(keystoreOld);

    // 验证：新 keystore 可用 PW_X 解密
    const decrypted = await decryptWallet(dupInStorage.keystore, PW_X);
    expect(decrypted.address.toLowerCase()).toBe(walletA.address.toLowerCase());

    // 验证：active 切换到 duplicate
    expect(_ls().getItem(LS_ACTIVE_KEY)).toBe(wDup.id);
  });

  // ---- T2-3: 无 duplicate → 正常新建钱包 ----
  await test("T2-3: ImportConfirmPassword 无 duplicate → 正常新建钱包，active 为新钱包", async () => {
    _ls().clear();
    _ss().clear();

    const walletA = new ethers.Wallet(PK_A);
    const walletB = new ethers.Wallet(PK_B);

    // 先存一个现有钱包（不是 duplicate，地址不同）
    const keystoreX = await encryptWallet(walletB, PW_X);
    const w0 = saveWallet({ name: "W0", network: "ethereum", address: walletB.address, keystore: keystoreX, type: 'imported' });
    setActiveWalletId(w0.id);

    // 模拟 ImportConfirmPasswordView 主流程（无 duplicate 时）：验证密码、加密新钱包、保存
    await decryptWallet(keystoreX, PW_X); // 验证现有密码

    const existingWallets = getStoredWallets();
    const duplicate = existingWallets.find(
      w => w.address.toLowerCase() === walletA.address.toLowerCase()
        && w.type !== 'external'
        && !!w.keystore
    );
    expect(duplicate).toBeFalsy(); // 无 duplicate

    const newKeystore = await encryptWallet(walletA, PW_X);
    const saved = saveWallet({ name: "W1", network: "ethereum", address: walletA.address, keystore: newKeystore });

    // 验证：新钱包已存储
    const wallets = getStoredWallets();
    expect(wallets.length).toBe(2);
    expect(_ls().getItem(LS_ACTIVE_KEY)).toBe(saved.id);

    // 验证：新钱包的 keystore 可用 PW_X 解密
    const decrypted = await decryptWallet(newKeystore, PW_X);
    expect(decrypted.address.toLowerCase()).toBe(walletA.address.toLowerCase());
  });

  // ---- T3-1: ImportPasswordView duplicate 分支 → 用新密码重新加密 ----
  await test("T3-1: ImportPassword duplicate 分支 → 用新密码重新加密，新 keystore 可用新密码解密", async () => {
    _ls().clear();
    _ss().clear();

    const walletA = new ethers.Wallet(PK_A);
    // duplicate 用旧密码加密
    const keystoreOld = await encryptWallet(walletA, PW_OLD);
    const wDup = saveWallet({ name: "WDup", network: "ethereum", address: walletA.address, keystore: keystoreOld, type: 'imported' });

    // 执行 ImportPasswordView duplicate 分支（用新密码 PW_A 重新加密）
    await handleImportPasswordDuplicate({ duplicate: wDup, wallet: walletA, pw: PW_A });

    // 验证：keystore 已更新
    const wallets = getStoredWallets();
    const dupInStorage = wallets.find(w => w.address.toLowerCase() === walletA.address.toLowerCase());
    expect(dupInStorage.keystore).notToBe(keystoreOld);

    // 验证：新 keystore 可用 PW_A 解密
    const decrypted = await decryptWallet(dupInStorage.keystore, PW_A);
    expect(decrypted.address.toLowerCase()).toBe(walletA.address.toLowerCase());

    // 验证：active 为 duplicate
    expect(_ls().getItem(LS_ACTIVE_KEY)).toBe(wDup.id);
  });

  // ---- T4-1: 完整流程 — 导入私钥（首次）→ 创建钱包 → 密码确认成功 ----
  await test("T4-1: 完整流程：首次导入私钥设密码 → 创建钱包密码确认 → 成功", async () => {
    _ls().clear();
    _ss().clear();

    const walletA = new ethers.Wallet(PK_A); // 导入的私钥钱包

    // 步骤 1：首次导入私钥，走 ImportPasswordView（设置新密码 PW_A）
    // 无 duplicate（首次导入）
    const keystoreA = await encryptWallet(walletA, PW_A);
    const savedW1 = saveWallet({ name: "Wallet 1", network: "ethereum", address: walletA.address, keystore: keystoreA, type: 'imported' });
    storeSessionKey(walletA.privateKey);
    expect(_ls().getItem(LS_ACTIVE_KEY)).toBe(savedW1.id);

    // 步骤 2：创建助记词钱包 → create-complete 密码确认
    // 使用新助记词
    const mnemonicWallet = ethers.Wallet.createRandom();
    // create-complete: needPasswordConfirm = true（已有 imported 钱包）
    // handlePasswordConfirm: getActiveWallet() → savedW1
    const activeWallet = getActiveWallet();
    expect(activeWallet.id).toBe(savedW1.id);

    // 解密验证密码正确
    const decryptedActive = await decryptWallet(activeWallet.keystore, PW_A);
    expect(decryptedActive.address.toLowerCase()).toBe(walletA.address.toLowerCase());

    // 验证成功：用 PW_A 加密新钱包
    const newMnemonicKeystore = await encryptWallet(mnemonicWallet, PW_A);
    const savedW2 = saveWallet({ name: "Wallet 2", network: "ethereum", address: mnemonicWallet.address, keystore: newMnemonicKeystore });

    // 验证：两个钱包均存在，密码均为 PW_A
    const wallets = getStoredWallets();
    expect(wallets.length).toBe(2);
    await decryptWallet(wallets[0].keystore, PW_A); // 应成功
    await decryptWallet(wallets[1].keystore, PW_A); // 应成功
  });

  // ---- T4-2: 根因场景 — 历史遗留 duplicate 密码不一致 → 修复后应通过 ----
  await test("T4-2: 根因场景：duplicate 历史密码不一致 → 修复后重新加密 → create-complete 密码确认成功", async () => {
    _ls().clear();
    _ss().clear();

    const walletA = new ethers.Wallet(PK_A); // 将被导入的私钥（地址为 addrA）
    const walletB = new ethers.Wallet(PK_B); // 当前活跃钱包（不同地址）

    // 模拟历史遗留场景：
    // W1 = walletA 地址，用 PW_OLD 加密（历史遗留，不是 active）
    const keystoreOld = await encryptWallet(walletA, PW_OLD);
    const wDup = saveWallet({ name: "WDup", network: "ethereum", address: walletA.address, keystore: keystoreOld, type: 'imported' });

    // W0 = walletB 地址，用 PW_X 加密，当前 active
    const keystoreX = await encryptWallet(walletB, PW_X);
    const w0 = saveWallet({ name: "W0", network: "bsc", address: walletB.address, keystore: keystoreX, type: 'imported' });
    setActiveWalletId(w0.id);

    // 步骤 1：用户导入 walletA 私钥，走 import-confirm-password
    // getActiveWallet() → W0，验证密码 PW_X → 成功
    const existingWallet = getActiveWallet();
    expect(existingWallet.id).toBe(w0.id);
    await decryptWallet(existingWallet.keystore, PW_X); // 验证通过

    // 发现 duplicate（walletA 地址已存在）
    const existingWallets = getStoredWallets();
    const duplicate = existingWallets.find(
      w => w.address.toLowerCase() === walletA.address.toLowerCase()
        && w.type !== 'external'
        && !!w.keystore
    );
    expect(duplicate).toBeTruthy();
    expect(duplicate.id).toBe(wDup.id);

    // 执行修复后的 duplicate 分支（pw = PW_X，但 duplicate 用 PW_OLD 加密 → 密码不一致 → 重新加密）
    await handleImportConfirmDuplicate({ duplicate: wDup, wallet: walletA, pw: PW_X });

    // 验证：duplicate 的 keystore 已更新为 PW_X 加密
    const walletsAfterImport = getStoredWallets();
    const dupUpdated = walletsAfterImport.find(w => w.address.toLowerCase() === walletA.address.toLowerCase());
    const decryptedDup = await decryptWallet(dupUpdated.keystore, PW_X); // 应成功
    expect(decryptedDup.address.toLowerCase()).toBe(walletA.address.toLowerCase());

    // active 切换到 duplicate
    expect(_ls().getItem(LS_ACTIVE_KEY)).toBe(wDup.id);

    // 步骤 2：用户创建助记词钱包 → create-complete 密码确认
    // getActiveWallet() → wDup（已用 PW_X 重新加密）
    const activeForCreate = getActiveWallet();
    expect(activeForCreate.id).toBe(wDup.id);

    // 用 PW_X 验证：应该成功（修复前此处会失败）
    await decryptWallet(activeForCreate.keystore, PW_X); // 不应抛出

    // 创建新钱包
    const mnemonicWallet = ethers.Wallet.createRandom();
    const newMnemonicKeystore = await encryptWallet(mnemonicWallet, PW_X);
    saveWallet({ name: "Wallet 3", network: "ethereum", address: mnemonicWallet.address, keystore: newMnemonicKeystore });

    // 验证最终状态：所有 imported 钱包的 keystore 均可用 PW_X 解密
    const finalWallets = getStoredWallets().filter(w => w.type !== 'external' && !!w.keystore);
    for (const w of finalWallets) {
      await decryptWallet(w.keystore, PW_X); // 应全部成功
    }
  });

  // ======== 结果汇总 ========
  console.log(`\n\n${"=".repeat(50)}`);
  console.log(`测试结果: ${passed}/${total} 通过`);

  const failedTests = results.filter(r => r.status === "FAIL");
  if (failedTests.length > 0) {
    console.log("\n❌ 失败的测试:");
    failedTests.forEach(t => {
      console.log(`  - ${t.name}`);
      console.log(`    错误: ${t.error}`);
    });
  } else {
    console.log("✅ 所有测试通过！");
  }
  console.log("=".repeat(50));

  if (failed > 0) process.exit(1);
}

runTests().catch(e => {
  console.error("\n测试运行错误:", e.message);
  process.exit(1);
});
