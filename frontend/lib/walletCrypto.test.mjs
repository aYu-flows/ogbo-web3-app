/**
 * walletCrypto 单元测试脚本（Node.js ESM，模拟 localStorage）
 * 运行方式: node --experimental-vm-modules lib/walletCrypto.test.mjs
 * 测试范围: saveExternalWallet, removeExternalWallet, generateWalletName, saveWallet 升级路径
 */

// ======== Mock window / localStorage ========
const store = {};
const mockLocalStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
};
global.window = { localStorage: mockLocalStorage };
// Node 20 has built-in crypto.randomUUID, use it directly
function _generateId() {
  return `uuid-${Math.random().toString(36).slice(2)}`;
}

// ======== Inline the core logic (mirrors walletCrypto.ts logic) ========
// (We test the logic directly since we can't easily import TS with ethers in Node without bundling)

const LS_WALLETS_KEY = "ogbo_wallets";
const LS_ACTIVE_KEY = "ogbo_active_wallet";

function _ls() { return global.window?.localStorage ?? null; }

function getStoredWallets() {
  const ls = _ls();
  if (!ls) return [];
  try {
    const raw = ls.getItem(LS_WALLETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

function setActiveWalletId(id) { _ls()?.setItem(LS_ACTIVE_KEY, id); }

function saveWallet(data) {
  const ls = _ls();
  const wallets = getStoredWallets();
  const existingIdx = wallets.findIndex(w => w.address.toLowerCase() === data.address.toLowerCase());
  let savedWallet;
  if (existingIdx >= 0) {
    savedWallet = {
      ...wallets[existingIdx],
      keystore: data.keystore,
      network: data.network,
      type: data.keystore ? 'imported' : (wallets[existingIdx].type ?? 'imported'),
    };
    wallets[existingIdx] = savedWallet;
  } else {
    savedWallet = { ...data, id: _generateId(), createdAt: Date.now(), type: data.type ?? 'imported' };
    wallets.push(savedWallet);
  }
  ls?.setItem(LS_WALLETS_KEY, JSON.stringify(wallets));
  setActiveWalletId(savedWallet.id);
  return savedWallet;
}

function saveExternalWallet(address, network = 'ethereum') {
  const wallets = getStoredWallets();
  const existing = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
  if (existing) return existing;
  const savedWallet = { id: `external-${address.toLowerCase()}`, name: 'Connected Wallet', network, address, keystore: '', createdAt: Date.now(), type: 'external' };
  wallets.push(savedWallet);
  try { _ls()?.setItem(LS_WALLETS_KEY, JSON.stringify(wallets)); } catch {}
  return savedWallet;
}

function removeExternalWallet(address) {
  const ls = _ls();
  if (!ls) return;
  const targetId = `external-${address.toLowerCase()}`;
  const wallets = getStoredWallets();
  const filtered = wallets.filter(w => !(w.type === 'external' && w.address.toLowerCase() === address.toLowerCase()));
  try { ls.setItem(LS_WALLETS_KEY, JSON.stringify(filtered)); } catch { return; }
  const activeId = ls.getItem(LS_ACTIVE_KEY);
  if (activeId === targetId) {
    const firstImported = filtered.find(w => w.type !== 'external' && w.keystore);
    if (firstImported) { setActiveWalletId(firstImported.id); }
    else { ls.removeItem(LS_ACTIVE_KEY); }
  }
}

function generateWalletName() {
  const wallets = getStoredWallets().filter(w => w.type !== 'external');
  return `Wallet ${wallets.length + 1}`;
}

// ======== Test Runner ========
let passed = 0; let failed = 0;
function reset() { Object.keys(store).forEach(k => delete store[k]); }
function assert(condition, msg) {
  if (condition) { console.log(`  ✓ ${msg}`); passed++; }
  else { console.error(`  ✗ ${msg}`); failed++; }
}

// ======== 6-1: saveExternalWallet ========
console.log('\n[6-1] saveExternalWallet');
reset();
const ext = saveExternalWallet('0xABC', 'ethereum');
assert(ext.type === 'external', 'type = external');
assert(ext.keystore === '', 'keystore 为空字符串');
assert(ext.id === 'external-0xabc', 'id 格式正确');
const wallets1 = getStoredWallets();
assert(wallets1.length === 1, '写入 localStorage 1 条记录');
assert(_ls().getItem(LS_ACTIVE_KEY) === null, 'saveExternalWallet 不设置 activeWalletId');
// 重复写入
const ext2 = saveExternalWallet('0xABC');
const wallets1b = getStoredWallets();
assert(wallets1b.length === 1, '重复写入不增加记录数');
assert(ext2.id === ext.id, '返回已有记录');

// ======== 6-2: removeExternalWallet ========
console.log('\n[6-2] removeExternalWallet');
reset();
saveExternalWallet('0xABC');
const imported1 = saveWallet({ name: 'Wallet 1', network: 'ethereum', address: '0xDEF', keystore: 'ks1' });
const wallets2 = getStoredWallets();
assert(wallets2.length === 2, '初始：external + imported 共 2 条');
removeExternalWallet('0xABC');
const wallets2b = getStoredWallets();
assert(wallets2b.length === 1, 'removeExternalWallet 后只剩 1 条');
assert(wallets2b[0].type !== 'external', 'remaining 记录不是 external');
assert(wallets2b[0].address === '0xDEF', 'imported 钱包保留');
// 不删除同地址的 imported
reset();
saveExternalWallet('0xSAME');
saveWallet({ name: 'W1', network: 'ethereum', address: '0xSAME', keystore: 'ks2' });
removeExternalWallet('0xSAME');
const wallets2c = getStoredWallets();
assert(wallets2c.length === 1 && wallets2c[0].type === 'imported', '同地址 imported 不被 removeExternalWallet 删除');
// active wallet 清理
reset();
saveExternalWallet('0xONLY');
_ls().setItem(LS_ACTIVE_KEY, 'external-0xonly');
removeExternalWallet('0xONLY');
assert(_ls().getItem(LS_ACTIVE_KEY) === null, '无 imported 时清除 active key');

// ======== 6-3: saveWallet 地址升级 ========
console.log('\n[6-3] saveWallet external → imported 升级');
reset();
saveExternalWallet('0xABC');
let wallets3 = getStoredWallets();
assert(wallets3.length === 1 && wallets3[0].type === 'external', '前提：已有 external 记录');
saveWallet({ name: 'Connected Wallet', network: 'ethereum', address: '0xABC', keystore: 'encrypted-ks' });
const wallets3b = getStoredWallets();
assert(wallets3b.length === 1, '升级后仍只有 1 条记录（不新增）');
assert(wallets3b[0].type === 'imported', '升级后 type = imported');
assert(wallets3b[0].keystore === 'encrypted-ks', 'keystore 正确写入');

// ======== 6-4: generateWalletName 排除外部钱包 ========
console.log('\n[6-4] generateWalletName 排除外部钱包');
reset();
saveExternalWallet('0xEXT1');
saveWallet({ name: 'Wallet 1', network: 'ethereum', address: '0xIMP1', keystore: 'ks1' });
saveWallet({ name: 'Wallet 2', network: 'ethereum', address: '0xIMP2', keystore: 'ks2' });
const name = generateWalletName();
assert(name === 'Wallet 3', `名称为 "Wallet 3"（实际: "${name}"），外部钱包不占编号`);

// ======== 6-5: login() 持久化场景（逻辑层面验证） ========
console.log('\n[6-5] login() 持久化场景（逻辑验证）');
reset();
// 模拟 login(wagmiAddress)：外部地址不在 localStorage → 调用 saveExternalWallet
const wagmiAddr = '0xWAGMI';
let s5 = getStoredWallets();
if (!s5.some(w => w.address.toLowerCase() === wagmiAddr.toLowerCase())) {
  saveExternalWallet(wagmiAddr);
  s5 = getStoredWallets();
}
assert(s5.length === 1 && s5[0].type === 'external', 'login(wagmi) 后 localStorage 有 external 记录');
// 模拟 login(importedAddress) 之后 getStoredWallets 包含两者
saveWallet({ name: 'Wallet 1', network: 'ethereum', address: '0xIMPORTED', keystore: 'ks-imp' });
const s5b = getStoredWallets();
assert(s5b.length === 2, '导入钱包后 localStorage 同时含 external + imported');
assert(s5b.some(w => w.address === '0xWAGMI'), 'external 钱包仍在列表中');
assert(s5b.some(w => w.address === '0xIMPORTED'), 'imported 钱包在列表中');

// ======== 6-6: 地址升级端到端 ========
console.log('\n[6-6] 地址升级端到端');
reset();
saveExternalWallet('0xSHARED');
let s6 = getStoredWallets();
assert(s6.length === 1 && s6[0].type === 'external', '前提：external 记录');
saveWallet({ name: 'Wallet 1', network: 'ethereum', address: '0xSHARED', keystore: 'real-ks' });
const s6b = getStoredWallets();
assert(s6b.length === 1, '升级后 localStorage 仍只有 1 条记录');
assert(s6b[0].type === 'imported', 'type 升级为 imported');
assert(s6b[0].keystore === 'real-ks', 'keystore 正确');

// ======== Summary ========
console.log(`\n==============================`);
console.log(`测试结果：${passed} 通过，${failed} 失败`);
if (failed > 0) process.exit(1);
