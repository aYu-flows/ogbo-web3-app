/**
 * walletCrypto.ts
 * OGBO 钱包加密工具模块（EVM 三链）
 * 封装所有钱包生成、加密、解密、存储操作
 */

import { ethers } from "ethers";

// ======== 类型定义 ========

export interface StoredWallet {
  id: string;       // crypto.randomUUID()
  name: string;     // "Wallet 1", "Wallet 2" ...
  network: string;  // "ethereum" | "bsc" | "polygon"
  address: string;  // 钱包地址，明文（非敏感）
  keystore: string; // ethers 加密的 Keystore JSON（含私钥，已加密）
  createdAt: number;
}

// ======== localStorage 键 ========
const LS_WALLETS_KEY = "ogbo_wallets";
const LS_ACTIVE_KEY = "ogbo_active_wallet";

// ======== sessionStorage 键 ========
const SS_SESSION_PK_KEY = "ogbo_session_pk";

// ======== 工具：安全访问 storage ========
function _ls(): Storage | null {
  if (typeof window !== "undefined") return window.localStorage;
  return null;
}
function _ss(): Storage | null {
  if (typeof window !== "undefined") return window.sessionStorage;
  return null;
}

// ======== 钱包创建 ========

/**
 * 生成随机 EVM 钱包（BIP39 助记词）
 * @returns { mnemonic, address, wallet }
 */
export function generateEVMWallet(): {
  mnemonic: string;
  address: string;
  wallet: ethers.Wallet;
} {
  const wallet = ethers.Wallet.createRandom();
  const mnemonic = wallet.mnemonic.phrase;
  return { mnemonic, address: wallet.address, wallet };
}

// ======== 钱包推导 ========

/**
 * 从 BIP39 助记词推导 EVM 钱包
 * @throws Error 若助记词无效
 */
export function walletFromMnemonic(mnemonic: string): ethers.Wallet {
  const trimmed = mnemonic.trim();
  if (!ethers.utils.isValidMnemonic(trimmed)) {
    throw new Error("Invalid mnemonic phrase");
  }
  return ethers.Wallet.fromMnemonic(trimmed);
}

/**
 * 从私钥创建 EVM 钱包
 * 自动补全 0x 前缀（兼容用户粘贴不带前缀的 64 位 hex 私钥）
 * @throws Error 若私钥格式无效
 */
export function walletFromPrivateKey(privateKey: string): ethers.Wallet {
  let trimmed = privateKey.trim();
  // 64 位纯 hex 自动补 0x（兼容用户粘贴不带前缀的私钥）
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    trimmed = '0x' + trimmed;
  }
  if (!isValidPrivateKey(trimmed)) {
    throw new Error("Invalid private key format");
  }
  return new ethers.Wallet(trimmed);
}

// ======== 加密 / 解密 ========

/**
 * 用密码将 Wallet 加密为 Keystore JSON 字符串
 * 使用轻量 scrypt 参数（N=8192，2^13），加密约 0.1–0.3s；移动端本地存储安全性足够
 */
export async function encryptWallet(
  wallet: ethers.Wallet,
  password: string
): Promise<string> {
  return wallet.encrypt(password, { scrypt: { N: 1 << 13 } });
}

/**
 * 用密码解密 Keystore，返回 ethers.Wallet
 * @throws Error 若密码错误或 keystore 格式无效
 */
export async function decryptWallet(
  keystore: string,
  password: string
): Promise<ethers.Wallet> {
  return ethers.Wallet.fromEncryptedJson(keystore, password);
}

// ======== localStorage 存储管理 ========

/** 获取所有已存储的钱包列表 */
export function getStoredWallets(): StoredWallet[] {
  const ls = _ls();
  if (!ls) return [];
  try {
    const raw = ls.getItem(LS_WALLETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredWallet[];
  } catch {
    return [];
  }
}

/**
 * 保存钱包到 localStorage。
 * 若相同 address 已存在则更新（避免重复），否则新增。
 * 自动设置新增 wallet 为 active wallet。
 */
export function saveWallet(
  data: Omit<StoredWallet, "id" | "createdAt">
): StoredWallet {
  const ls = _ls();
  const wallets = getStoredWallets();

  // 检查是否已存在相同地址（大小写不敏感）
  const existingIdx = wallets.findIndex(
    (w) => w.address.toLowerCase() === data.address.toLowerCase()
  );

  let savedWallet: StoredWallet;

  if (existingIdx >= 0) {
    // 更新已有钱包的 keystore（密码可能不同）
    savedWallet = {
      ...wallets[existingIdx],
      keystore: data.keystore,
      network: data.network,
    };
    wallets[existingIdx] = savedWallet;
  } else {
    // 新增钱包
    savedWallet = {
      ...data,
      id: _generateId(),
      createdAt: Date.now(),
    };
    wallets.push(savedWallet);
  }

  try {
    ls?.setItem(LS_WALLETS_KEY, JSON.stringify(wallets));
  } catch (e) {
    // localStorage 配额超限
    throw new Error("Storage quota exceeded. Please clear browser data and try again.");
  }

  // 自动将此钱包设为 active
  setActiveWalletId(savedWallet.id);

  return savedWallet;
}

/** 获取当前 active 钱包 */
export function getActiveWallet(): StoredWallet | null {
  const ls = _ls();
  if (!ls) return null;
  const wallets = getStoredWallets();
  if (wallets.length === 0) return null;

  const activeId = ls.getItem(LS_ACTIVE_KEY);
  if (activeId) {
    const found = wallets.find((w) => w.id === activeId);
    if (found) return found;
  }
  // 若无 active 或 active 不存在，返回最后一个
  return wallets[wallets.length - 1];
}

/** 设置 active 钱包 */
export function setActiveWalletId(id: string): void {
  _ls()?.setItem(LS_ACTIVE_KEY, id);
}

/** 清除所有钱包数据（用于重置）*/
export function clearAllWallets(): void {
  const ls = _ls();
  ls?.removeItem(LS_WALLETS_KEY);
  ls?.removeItem(LS_ACTIVE_KEY);
}

/** 生成钱包显示名（"Wallet 1", "Wallet 2"...）*/
export function generateWalletName(): string {
  const wallets = getStoredWallets();
  return `Wallet ${wallets.length + 1}`;
}

// ======== sessionStorage Session Key 管理 ========

/**
 * 将明文私钥存入 sessionStorage（tab 关闭时自动清除）
 * 用于页面刷新后重建 ethers.Wallet signer，以便 Push Protocol 初始化
 */
export function storeSessionKey(privateKey: string): void {
  _ss()?.setItem(SS_SESSION_PK_KEY, privateKey);
}

/**
 * 从 sessionStorage 读取私钥，重建 ethers.Wallet
 * 若 tab 已关闭（sessionStorage 被清除）则返回 null
 */
export function getSessionWallet(): ethers.Wallet | null {
  const ss = _ss();
  if (!ss) return null;
  const pk = ss.getItem(SS_SESSION_PK_KEY);
  if (!pk) return null;
  try {
    return new ethers.Wallet(pk);
  } catch {
    return null;
  }
}

/** 主动清除 sessionStorage 中的 session key（logout 时调用）*/
export function clearSessionKey(): void {
  _ss()?.removeItem(SS_SESSION_PK_KEY);
}

// ======== 格式验证工具 ========

/**
 * 验证 BIP39 助记词格式（使用 ethers 完整 BIP39 词表）
 * @param mnemonic 空格分隔的单词序列
 */
export function isValidMnemonic(mnemonic: string): boolean {
  if (!mnemonic || typeof mnemonic !== "string") return false;
  return ethers.utils.isValidMnemonic(mnemonic.trim());
}

/**
 * 验证私钥格式（支持 "0x" + 64 hex 字符，或纯 64 hex 字符无前缀两种格式）
 */
export function isValidPrivateKey(privateKey: string): boolean {
  if (!privateKey || typeof privateKey !== "string") return false;
  const trimmed = privateKey.trim();
  return /^(0x)?[0-9a-fA-F]{64}$/.test(trimmed);
}

// ======== 内部工具 ========

function _generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // fallback（Node.js 环境）
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ======== Keystore 迁移工具 ========

/**
 * 将所有重量级 keystore（scrypt N > 8192）异步迁移到轻量级（N=8192）。
 * 调用时机：密码验证成功后，后台异步执行，不阻塞登录。
 * 注意：仅在浏览器端调用（依赖 localStorage）。
 */
export async function migrateKeystoreScrypt(password: string): Promise<void> {
  const wallets = getStoredWallets();
  for (const stored of wallets) {
    try {
      // 解析 keystore，检查 scrypt N 值（兼容大小写两种 key 路径）
      const ks = JSON.parse(stored.keystore);
      const n = ks?.crypto?.kdfparams?.n ?? ks?.Crypto?.kdfparams?.n;
      if (n && n <= 8192) continue; // 已是轻量，跳过
      // 用当前密码重新加密并保存（saveWallet 会更新已有地址的 keystore）
      const w = await decryptWallet(stored.keystore, password);
      const newKeystore = await encryptWallet(w, password);
      saveWallet({ ...stored, keystore: newKeystore });
    } catch {
      // 单条失败（keystore 损坏或密码不匹配）不影响其他钱包，静默跳过
      console.warn('[migrateKeystoreScrypt] skipped wallet', stored.id);
    }
  }
}
