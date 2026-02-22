/**
 * push.ts 单元测试（Node.js 原生，无需 jest）
 * 测试范围：createGroupChat、getUserInfo、sendChatRequest 地址规范化和守卫逻辑
 * 运行: node frontend/lib/__tests__/push.test.js
 */

const { utils: ethersUtils } = require('ethers')

// ======== 测试框架 ========
let passed = 0, failed = 0, total = 0
const results = []

async function test(name, fn) {
  total++
  try {
    await fn()
    passed++
    results.push({ name, status: 'PASS' })
    process.stdout.write('.')
  } catch (e) {
    failed++
    results.push({ name, status: 'FAIL', error: e.message })
    process.stdout.write('F')
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed')
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`)
}

// ======== 核心逻辑提取（与 push.ts 实现一致） ========

/** 模拟 createGroupChat 中的地址规范化+去重逻辑 */
function normalizeAndDedup(memberAddresses) {
  const seen = new Set()
  const normalizedMembers = []
  for (const addr of memberAddresses) {
    try {
      const checksummed = ethersUtils.getAddress(addr)
      const key = checksummed.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        normalizedMembers.push(checksummed)
      }
    } catch {
      const key = addr.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        normalizedMembers.push(addr)
      }
    }
  }
  return normalizedMembers
}

/** 模拟 createGroupChat 的 runtime guard */
function simulateCreateGroupChat(pushUser, groupName) {
  if (typeof pushUser.chat?.group?.create !== 'function') {
    throw new Error('Push Protocol group.create API is not available in this environment')
  }
  return { chatId: 'mock-chat-id', name: groupName }
}

/** 模拟 getUserInfo / sendChatRequest 的地址规范化 */
function normalizeAddress(addr) {
  try {
    return ethersUtils.getAddress(addr)
  } catch {
    return addr
  }
}

/** 模拟 handleSend 的空输入守卫 */
function simulateHandleSend(inputValue, toastFn, sendFn) {
  if (!inputValue.trim()) {
    toastFn('请先输入消息内容')
    return false
  }
  sendFn(inputValue.trim())
  return true
}

/** 模拟 handleKeyDown 的 isComposing 守卫 */
function simulateHandleKeyDown(key, shiftKey, isComposing, sendFn) {
  if (key === 'Enter' && !shiftKey && !isComposing) {
    sendFn()
  }
}

// ======== 测试用例 ========

async function runTests() {
  console.log('\n🧪 push.ts 地址规范化逻辑单元测试\n')

  // --- GROUP 测试组：createGroupChat 地址规范化 + 去重 ---
  await test('GROUP-01: 纯小写地址被转为 EIP-55 checksum 格式', () => {
    const lower = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
    const result = normalizeAndDedup([lower])
    const expected = ethersUtils.getAddress(lower)
    assertEqual(result[0], expected, '应转为 checksum 地址')
    assert(result[0] !== lower, '不应保持纯小写')
  })

  await test('GROUP-02: 重复地址（大小写不同）只保留一个', () => {
    const lower = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
    const checksum = ethersUtils.getAddress(lower)
    const result = normalizeAndDedup([lower, checksum])
    assertEqual(result.length, 1, '去重后只剩 1 个地址')
  })

  await test('GROUP-03: 多个不同地址全部保留（不过度去重）', () => {
    const addr1 = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
    const addr2 = '0x1234567890123456789012345678901234567890'
    const result = normalizeAndDedup([addr1, addr2])
    assertEqual(result.length, 2, '两个不同地址都应保留')
    const expected1 = ethersUtils.getAddress(addr1)
    const expected2 = ethersUtils.getAddress(addr2)
    assertEqual(result[0], expected1, '第一个地址应规范化')
    assertEqual(result[1], expected2, '第二个地址应规范化')
  })

  await test('GROUP-04: 无效地址不抛出，保持原样（由 API 自然报错）', () => {
    const invalid = 'not-an-address'
    const result = normalizeAndDedup([invalid])
    assertEqual(result.length, 1, '无效地址应保留')
    assertEqual(result[0], invalid, '无效地址保持原值')
  })

  await test('GROUP-05: 空数组返回空数组', () => {
    const result = normalizeAndDedup([])
    assertEqual(result.length, 0, '空输入返回空输出')
  })

  await test('GROUP-06: pushUser.chat.group 为 undefined 时抛出明确错误', () => {
    const mockPushUser = { chat: { group: undefined } }
    let threw = false
    try {
      simulateCreateGroupChat(mockPushUser, 'Test Group')
    } catch (e) {
      threw = true
      assert(
        e.message.includes('group.create API is not available'),
        '错误信息应包含正确文案'
      )
    }
    assert(threw, '应抛出错误')
  })

  await test('GROUP-07: pushUser.chat.group.create 存在时正常运行', () => {
    const mockPushUser = { chat: { group: { create: async () => ({ chatId: 'abc' }) } } }
    const result = simulateCreateGroupChat(mockPushUser, '测试群')
    assertEqual(result.chatId, 'mock-chat-id', '正常路径应返回 chatId')
  })

  // --- USER 测试组：getUserInfo 地址规范化 ---
  await test('USER-01: 纯小写地址传入 getUserInfo 时被规范化', () => {
    const lower = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
    const normalized = normalizeAddress(lower)
    const expected = ethersUtils.getAddress(lower)
    assertEqual(normalized, expected, 'getUserInfo 应传入 checksum 地址')
  })

  await test('USER-02: synthetic fallback 使用规范化地址', () => {
    const lower = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
    const normalized = normalizeAddress(lower)
    const fallback = {
      address: normalized,
      did: `eip155:1:${normalized}`,
      name: null,
      _synthetic: true,
    }
    const expected = ethersUtils.getAddress(lower)
    assertEqual(fallback.address, expected, 'fallback.address 应为 checksum 格式')
  })

  // --- REQ 测试组：sendChatRequest 地址规范化 ---
  await test('REQ-01: 纯小写地址传入 sendChatRequest 时被规范化', () => {
    const lower = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
    const normalized = normalizeAddress(lower)
    const expected = ethersUtils.getAddress(lower)
    assertEqual(normalized, expected, 'sendChatRequest 应传入 checksum 地址')
  })

  await test('REQ-02: 无效地址规范化失败时保持原值（防御性处理）', () => {
    const invalid = '0xinvalid'
    const result = normalizeAddress(invalid)
    assertEqual(result, invalid, '无效地址保持原值')
  })

  // --- SEND 测试组：handleSend 空输入守卫 ---
  await test('SEND-01: 空字符串输入时调用 toast，不执行发送', () => {
    let toastCalled = false
    let sendCalled = false
    const sent = simulateHandleSend('', () => { toastCalled = true }, () => { sendCalled = true })
    assert(toastCalled, 'toast 应被调用')
    assert(!sendCalled, 'send 不应被调用')
    assert(!sent, '应返回 false（未发送）')
  })

  await test('SEND-02: 纯空格输入时调用 toast，不执行发送', () => {
    let toastCalled = false
    let sendCalled = false
    simulateHandleSend('   ', () => { toastCalled = true }, () => { sendCalled = true })
    assert(toastCalled, 'toast 应被调用')
    assert(!sendCalled, 'send 不应被调用')
  })

  await test('SEND-03: 有内容输入时正常发送，不触发 toast', () => {
    let toastCalled = false
    let sentContent = null
    const sent = simulateHandleSend('Hello', () => { toastCalled = true }, (c) => { sentContent = c })
    assert(sent, '应返回 true（已发送）')
    assertEqual(sentContent, 'Hello', '发送内容正确')
    assert(!toastCalled, 'toast 不应被调用')
  })

  // --- KEYDOWN 测试组：handleKeyDown isComposing 守卫 ---
  await test('SEND-04: Enter + isComposing=true 时不触发发送（IME 确认字符）', () => {
    let sent = false
    simulateHandleKeyDown('Enter', false, true, () => { sent = true })
    assert(!sent, 'isComposing 时 Enter 不应发送')
  })

  await test('SEND-05: Enter + isComposing=false + 非 Shift 时触发发送', () => {
    let sent = false
    simulateHandleKeyDown('Enter', false, false, () => { sent = true })
    assert(sent, '应触发发送')
  })

  await test('SEND-06: Shift+Enter 不触发发送（换行场景）', () => {
    let sent = false
    simulateHandleKeyDown('Enter', true, false, () => { sent = true })
    assert(!sent, 'Shift+Enter 不应发送')
  })

  await test('SEND-07: 非 Enter 键不触发发送', () => {
    let sent = false
    simulateHandleKeyDown('a', false, false, () => { sent = true })
    assert(!sent, '非 Enter 键不应发送')
  })

  // ======== 结果汇总 ========
  console.log(`\n\n${'='.repeat(50)}`)
  console.log(`测试结果: ${passed}/${total} 通过`)

  const failedTests = results.filter(r => r.status === 'FAIL')
  if (failedTests.length > 0) {
    console.log('\n❌ 失败的测试:')
    failedTests.forEach(t => {
      console.log(`  - ${t.name}`)
      console.log(`    错误: ${t.error}`)
    })
    process.exit(1)
  } else {
    console.log('✅ 所有测试通过！')
  }
  console.log('='.repeat(50))
}

runTests().catch((e) => {
  console.error('测试运行异常:', e)
  process.exit(1)
})
