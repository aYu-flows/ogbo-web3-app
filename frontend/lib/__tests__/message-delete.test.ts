import {
  getDeletedMessageIds,
  getAllDeletedMessageIds,
  addDeletedMessages,
  filterDeletedMessages,
} from '../message-delete'

// Mock localStorage following project convention
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value }),
    removeItem: jest.fn((key: string) => { delete store[key] }),
    clear: jest.fn(() => { store = {} }),
    get _store() { return store },
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true })

beforeEach(() => {
  localStorageMock.clear()
  jest.clearAllMocks()
})

describe('message-delete', () => {
  const wallet = '0xABC123'
  const chatId = '0xabc_0xdef'

  describe('getDeletedMessageIds', () => {
    it('returns empty set when no data', () => {
      const ids = getDeletedMessageIds(wallet, chatId)
      expect(ids.size).toBe(0)
    })

    it('returns correct IDs after adding', () => {
      addDeletedMessages(wallet, chatId, ['db-1', 'db-2'])
      const ids = getDeletedMessageIds(wallet, chatId)
      expect(ids.has('db-1')).toBe(true)
      expect(ids.has('db-2')).toBe(true)
      expect(ids.size).toBe(2)
    })
  })

  describe('addDeletedMessages', () => {
    it('appends new IDs', () => {
      addDeletedMessages(wallet, chatId, ['db-1'])
      addDeletedMessages(wallet, chatId, ['db-2', 'db-3'])
      const ids = getDeletedMessageIds(wallet, chatId)
      expect(ids.size).toBe(3)
    })

    it('deduplicates on repeated add', () => {
      addDeletedMessages(wallet, chatId, ['db-1', 'db-2'])
      addDeletedMessages(wallet, chatId, ['db-2', 'db-3'])
      const ids = getDeletedMessageIds(wallet, chatId)
      expect(ids.size).toBe(3)
    })
  })

  describe('chatId isolation', () => {
    it('different chatIds have independent delete records', () => {
      const chat1 = 'chat-1'
      const chat2 = 'chat-2'
      addDeletedMessages(wallet, chat1, ['db-1'])
      addDeletedMessages(wallet, chat2, ['db-2'])
      expect(getDeletedMessageIds(wallet, chat1).has('db-1')).toBe(true)
      expect(getDeletedMessageIds(wallet, chat1).has('db-2')).toBe(false)
      expect(getDeletedMessageIds(wallet, chat2).has('db-2')).toBe(true)
      expect(getDeletedMessageIds(wallet, chat2).has('db-1')).toBe(false)
    })
  })

  describe('wallet isolation', () => {
    it('different wallets have independent delete records', () => {
      const wallet1 = '0xWALLET1'
      const wallet2 = '0xWALLET2'
      addDeletedMessages(wallet1, chatId, ['db-1'])
      addDeletedMessages(wallet2, chatId, ['db-2'])
      expect(getDeletedMessageIds(wallet1, chatId).has('db-1')).toBe(true)
      expect(getDeletedMessageIds(wallet1, chatId).has('db-2')).toBe(false)
      expect(getDeletedMessageIds(wallet2, chatId).has('db-2')).toBe(true)
      expect(getDeletedMessageIds(wallet2, chatId).has('db-1')).toBe(false)
    })
  })

  describe('getAllDeletedMessageIds', () => {
    it('returns all chats delete records', () => {
      addDeletedMessages(wallet, 'chat-a', ['db-1'])
      addDeletedMessages(wallet, 'chat-b', ['db-2', 'db-3'])
      const all = getAllDeletedMessageIds(wallet)
      expect(all['chat-a']).toEqual(['db-1'])
      expect(all['chat-b']).toEqual(expect.arrayContaining(['db-2', 'db-3']))
    })

    it('returns empty object when no data', () => {
      const all = getAllDeletedMessageIds(wallet)
      expect(all).toEqual({})
    })
  })

  describe('filterDeletedMessages', () => {
    it('filters out deleted messages', () => {
      addDeletedMessages(wallet, chatId, ['db-1', 'db-3'])
      const messages = [
        { id: 'db-1', content: 'hello' },
        { id: 'db-2', content: 'world' },
        { id: 'db-3', content: 'foo' },
        { id: 'db-4', content: 'bar' },
      ]
      const filtered = filterDeletedMessages(wallet, chatId, messages)
      expect(filtered).toHaveLength(2)
      expect(filtered.map(m => m.id)).toEqual(['db-2', 'db-4'])
    })

    it('returns all messages when nothing deleted', () => {
      const messages = [
        { id: 'db-1', content: 'hello' },
        { id: 'db-2', content: 'world' },
      ]
      const filtered = filterDeletedMessages(wallet, chatId, messages)
      expect(filtered).toHaveLength(2)
    })

    it('returns empty array when all deleted', () => {
      addDeletedMessages(wallet, chatId, ['db-1', 'db-2'])
      const messages = [
        { id: 'db-1', content: 'hello' },
        { id: 'db-2', content: 'world' },
      ]
      const filtered = filterDeletedMessages(wallet, chatId, messages)
      expect(filtered).toHaveLength(0)
    })
  })

  describe('corrupted localStorage', () => {
    it('returns empty set on invalid JSON', () => {
      localStorageMock.setItem('ogbox_deleted_msgs_0xcorrupt', 'not-json')
      const ids = getDeletedMessageIds('0xcorrupt', chatId)
      expect(ids.size).toBe(0)
    })
  })
})
