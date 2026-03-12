/**
 * 消息删除本地存储层
 *
 * 删除记录仅存 localStorage，按用户钱包地址隔离。
 * key: ogbox_deleted_msgs_{walletAddress}
 * value: Record<chatId, string[]>  (已删除消息的 store ID 列表)
 */

const STORAGE_KEY_PREFIX = 'ogbox_deleted_msgs_'

function getStorageKey(walletAddress: string): string {
  return `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`
}

function readStore(walletAddress: string): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(getStorageKey(walletAddress))
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, string[]>
  } catch {
    return {}
  }
}

function writeStore(walletAddress: string, data: Record<string, string[]>): void {
  try {
    localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(data))
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/** 读取指定聊天的已删除消息 ID 集合 */
export function getDeletedMessageIds(walletAddress: string, chatId: string): Set<string> {
  const store = readStore(walletAddress)
  return new Set(store[chatId] || [])
}

/** 读取所有聊天的已删除消息 ID */
export function getAllDeletedMessageIds(walletAddress: string): Record<string, string[]> {
  return readStore(walletAddress)
}

/** 追加删除记录到 localStorage（自动去重） */
export function addDeletedMessages(walletAddress: string, chatId: string, messageIds: string[]): void {
  const store = readStore(walletAddress)
  const existing = new Set(store[chatId] || [])
  for (const id of messageIds) {
    existing.add(id)
  }
  store[chatId] = Array.from(existing)
  writeStore(walletAddress, store)
}

/** 从消息列表中过滤掉已删除的消息 */
export function filterDeletedMessages<T extends { id: string }>(
  walletAddress: string,
  chatId: string,
  messages: T[]
): T[] {
  const deletedIds = getDeletedMessageIds(walletAddress, chatId)
  if (deletedIds.size === 0) return messages
  return messages.filter(m => !deletedIds.has(m.id))
}
