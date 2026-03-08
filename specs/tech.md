# OGBOX 技术架构规范

> **文档版本**: v1.0
> **最后更新**: 2026-03-08
> **文档性质**: 技术架构规范（Technical Architecture Spec）
> **项目定位**: Web3 社交钱包应用，纯前端架构 + Supabase BaaS

---

## §1 系统架构

### §1.1 整体架构

OGBOX 采用纯前端 + BaaS 架构，无自建后端服务器：

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端框架 | Next.js 16.1 + React 19.2 + TypeScript 5.7 | SPA 模式，所有页面均为客户端渲染 |
| 后端服务 | Supabase (PostgreSQL + Realtime + Auth + Storage) | 托管型 BaaS，客户端直连 |
| 移动端 | Capacitor 7.5 (Android / iOS) | Edge-to-Edge 模式，原生插件桥接 |
| Web 端 | Vercel 部署 | 静态导出 (next export → `out/`) |

架构特点：
- **无服务器端逻辑**：所有业务逻辑在客户端完成
- **Supabase 直连**：客户端使用 anon key 直接操作数据库
- **双端同构**：同一代码库通过 Capacitor 打包为原生应用

### §1.2 部署架构

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  用户浏览器   │────▶│  Vercel (Web)     │     │  Supabase 云端   │
│  / WebView   │     │  静态资源托管      │     │  PostgreSQL      │
└─────────────┘     └──────────────────┘     │  Realtime WS     │
                                              │  REST API        │
┌─────────────┐                               └─────────────────┘
│  Android APK │─── Capacitor WebView ──────────────▲
│  iOS App     │     加载本地 out/ 目录               │
└─────────────┘     直连 Supabase                    │
```

- **Web 端**: Vercel 托管，域名 `ogbox-web3-app.vercel.app`
- **移动端**: Capacitor 将 `out/` 目录打包为原生应用
  - Android: `OGBOX-v1.0.apk`（项目根目录）
  - App ID: `com.ogbo.app`
  - WebView scheme: `https://localhost`
- **后端**: Supabase 托管实例，通过环境变量配置连接

### §1.3 技术栈清单

基于 `frontend/package.json` 实际依赖分析：

#### 核心框架

| 库 | 版本 | 用途 |
|----|------|------|
| next | 16.1.6 | 应用框架 |
| react / react-dom | 19.2.3 | UI 渲染 |
| typescript | 5.7.3 | 类型系统 |

#### 状态管理

| 库 | 版本 | 用途 |
|----|------|------|
| zustand | 5.0.3 | 全局状态管理，单一 store (`lib/store.ts`, ~1226 行) |

#### UI 与样式

| 库 | 版本 | 用途 |
|----|------|------|
| tailwindcss | 3.4.17 | 原子化 CSS |
| @radix-ui/* | 各组件独立版本 | shadcn/ui 底层组件库 |
| framer-motion | 11.15.0 | 动画效果 |
| lucide-react | 0.544.0 | 图标库 |
| recharts | 2.15.0 | 图表 (LineChart, AreaChart) |
| react-hot-toast | 2.4.1 | Toast 通知 |
| sonner | 1.7.1 | 通知组件 |
| cmdk | 1.1.1 | 命令面板 |
| vaul | 1.1.2 | 抽屉组件 |

#### Web3

| 库 | 版本 | 用途 |
|----|------|------|
| wagmi | 3.5.0 | React Web3 hooks |
| viem | 2.46.2 | 以太坊客户端 |
| @reown/appkit | 1.8.18 | WalletConnect 钱包连接 UI |
| @reown/appkit-adapter-wagmi | 1.8.18 | wagmi 适配器 |
| ethers | 5.8.0 | Keystore JSON 加密、BIP39 助记词、签名 |

#### 后端与数据

| 库 | 版本 | 用途 |
|----|------|------|
| @supabase/supabase-js | 2.97.0 | Supabase 客户端 (REST + Realtime) |
| @tanstack/react-query | 5.90.21 | 异步数据管理 |

#### 移动端

| 库 | 版本 | 用途 |
|----|------|------|
| @capacitor/core | 7.5.0 | Capacitor 核心运行时 |
| @capacitor/android | 7.5.0 | Android 平台 |
| @capacitor/ios | 7.5.0 | iOS 平台 |
| @capacitor/keyboard | 7.0.0 | 键盘事件监听 |
| @capacitor/clipboard | 8.0.1 | 剪贴板读写 |
| @capacitor/status-bar | 8.0.0 | 状态栏控制 |
| @capgo/capacitor-updater | 7.43.3 | OTA 热更新 |

#### 表单与验证

| 库 | 版本 | 用途 |
|----|------|------|
| react-hook-form | 7.54.1 | 表单管理 |
| @hookform/resolvers | 3.9.1 | 验证解析器 |
| zod | 3.24.1 | Schema 验证 |

#### 开发与测试

| 库 | 版本 | 用途 |
|----|------|------|
| jest | 30.2.0 | 测试框架 |
| ts-jest | 29.4.6 | TypeScript Jest 转换器 |
| sharp | 0.34.5 | 图片处理 |

### §1.3 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §2 数据模型 (Supabase)

### §2.1 数据库表结构

#### contacts 表 — 好友关系

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial | 自增主键 |
| wallet_a | text | 发起方钱包地址 |
| wallet_b | text | 接收方钱包地址 |
| status | text | 状态：`'pending'` / `'accepted'` / `'rejected'` |
| request_msg | text | 好友请求附言（可选） |
| created_at | timestamptz | 创建时间 |

#### messages 表 — 聊天消息

| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial | 自增主键 |
| chat_id | text | 会话标识（确定性生成：两个地址小写排序后以 `_` 连接） |
| sender | text | 发送方钱包地址 |
| content | text | 消息内容 |
| msg_type | text | 消息类型：`'text'` / `'system'` |
| created_at | timestamptz | 创建时间 |

chat_id 生成规则（`lib/chat.ts` 中 `getChatId` 函数）：
```
[addressA, addressB].sort().join('_')  // 均为小写
```

#### groups 表 — 群组

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | text | 群组名称 |
| creator | text | 创建者钱包地址 |
| members | text[] | 成员钱包地址数组 |
| created_at | timestamptz | 创建时间 |

#### profiles 表 — 用户资料

| 字段 | 类型 | 说明 |
|------|------|------|
| wallet_address | text | 主键，钱包地址（小写） |
| nickname | text | 用户昵称（最长 20 字符） |
| avatar_url | text | 头像 URL（Supabase Storage） |
| friend_permission | text | 好友添加权限：`'allow_all'` / `'approve_required'`（默认） / `'reject_all'` |
| updated_at | timestamptz | 最后更新时间 |

#### push_debug_logs 表 — 远程调试日志

| 字段 | 类型 | 说明 |
|------|------|------|
| - | - | 由 `debugLogger.ts` 通过 REST API fire-and-forget 写入 |

### §2.2 RLS 策略

- RLS（Row Level Security）策略在 Supabase Dashboard 中管理
- 客户端使用 anon key 进行所有操作
- 具体策略无法从客户端代码中推断，需查阅 Supabase 后台配置

### §2.3 实时订阅配置

频道命名规则：`chat-{walletAddress}-{timestamp}`

订阅的 postgres_changes 事件：

| # | 表 | 事件 | 过滤条件 | 用途 |
|---|---|------|---------|------|
| 1 | messages | INSERT | 无（客户端过滤） | 接收新消息 |
| 2 | contacts | INSERT | `wallet_b=eq.{myAddress}` | 接收好友请求 |
| 3 | contacts | UPDATE | `wallet_a=eq.{myAddress}` | 发出的请求被接受/拒绝 |
| 4 | groups | INSERT | 无（客户端过滤成员关系） | 被拉入新群组 |

防护机制：
- **过期检查模式**：异步操作完成后验证 `walletAddress` 是否已变更，防止跨钱包数据泄露
- **防御性频道清理**：重新初始化前先移除已有频道

### §2 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §3 状态管理与 Web3

### §3.1 Zustand Store 结构

全局状态集中在 `lib/store.ts`（约 1226 行），使用 Zustand v5 的 `create` 函数创建单一 store。

#### UI 状态

| 字段 | 类型 | 说明 |
|------|------|------|
| activeTab | `TabType` | 当前标签页：`'home'`/`'chat'`/`'market'`/`'discover'`/`'assets'` |
| locale | `'zh'`/`'en'` | 界面语言 |
| isBalanceVisible | boolean | 余额是否可见 |

#### 钱包状态

| 字段 | 类型 | 说明 |
|------|------|------|
| currentWalletId | string | 当前激活钱包 ID |
| wallets | `Wallet[]` | 钱包列表 |
| isLoggedIn | boolean | 登录状态 |
| walletAddress | `string \| null` | 当前钱包地址 |

#### 聊天状态

| 字段 | 类型 | 说明 |
|------|------|------|
| chats | `Chat[]` | 会话列表 |
| chatReady | boolean | 聊天系统就绪标志 |
| isConnectingChat | boolean | 正在连接中 |
| chatChannel | `RealtimeChannel \| null` | Supabase 实时频道引用 |
| chatRequests | `ChatRequest[]` | 待处理好友请求 |
| unreadChatCount | number | 未读消息计数 |

#### 行情状态

| 字段 | 类型 | 说明 |
|------|------|------|
| coins | `Coin[]` | 币种列表（16 个币种） |
| marketLoading | boolean | 加载状态 |
| marketError | `string \| null` | 错误信息 |

#### DApp 状态

| 字段 | 类型 | 说明 |
|------|------|------|
| dapps | `DApp[]` | DApp 列表（12 个 mock DApp） |

### §3.2 关键类型定义

```typescript
// 会话
Chat: {
  id, name, avatarColor, lastMessage, timestamp, unread, online, typing,
  type: 'personal' | 'group',
  members?: string[],
  pinned?: boolean,
  messages: Message[],
  walletAddress?: string
}

// 消息
Message: {
  id, sender: 'me' | string, content, timestamp,
  status: 'sent' | 'delivered' | 'read'
}

// 钱包
Wallet: {
  id, name, address,
  balance: { cny, usd },
  tokens: Token[], nfts: NFT[], transactions: Transaction[],
  type?: 'imported' | 'external'
}

// 币种行情
Coin: {
  id, symbol, name, price, change24h, volume, marketCap,
  high24h, low24h, supply, maxSupply, icon,
  chartData: { time, price }[],
  favorited: boolean
}
```

### §3.3 wagmi 配置

配置文件：`lib/wagmi.ts`

| 配置项 | 值 |
|--------|---|
| 适配器 | `@reown/appkit` + `WagmiAdapter` |
| 支持链 | Ethereum Mainnet, BSC, Polygon |
| Project ID | 环境变量 `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` |
| 推荐钱包 | OKX Wallet, TokenPocket, MetaMask, Binance Wallet |

`walletClientToSigner` 工具函数：将 viem `WalletClient` 转换为 ethers.js v5 `Signer`，用于兼容需要 ethers v5 签名器的 SDK。

### §3.4 @reown/appkit 钱包连接流程

1. 用户点击连接钱包 → 打开 `@reown/appkit` 弹窗
2. 选择钱包并授权 → 获取 `WalletClient`
3. 外部钱包信息通过 `saveExternalWallet()` 存入 localStorage
4. 断开连接时通过 `removeExternalWallet()` 清理

### §3 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §4 API 与通信

### §4.1 Supabase REST API

客户端初始化（`lib/supabaseClient.ts`）：
```typescript
createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
```

操作模式：
- **查询**: `supabase.from('table').select()`
- **插入**: `supabase.from('table').insert()`
- **更新**: `supabase.from('table').update().eq()`
- 未观察到自定义 RPC 函数调用

### §4.2 Supabase Realtime (WebSocket)

- 事件类型：`postgres_changes`
- 频道创建：每个钱包地址动态创建专属频道
- 频道生命周期：
  1. 登录 / 切换钱包 → 创建新频道并订阅
  2. 登出 / 切换钱包 → 先移除旧频道再创建新的
  3. 异步回调中检查 `walletAddress` 是否过期

### §4.3 外部 API

#### CoinGecko API v3

| 端点 | 用途 | 说明 |
|------|------|------|
| `/coins/markets` | 批量获取 16 个币种的价格/统计 | 参数: `vs_currency=usd`, 币种 ID 列表 |
| `/coins/{id}/market_chart` | 单币种小时级图表数据 | 24 个数据点 |

降级策略：
- HTTP 429（限流）→ 回退到随机生成的图表数据
- 本地缓存：`localStorage` key `ogbo_market_data_cache`

#### 调试日志 API

- `debugLogger.ts` 通过 Supabase REST API 向 `push_debug_logs` 表写入日志
- Fire-and-forget 模式，不等待响应

### §4 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §5 安全

### §5.1 钱包加密存储

加密模块：`lib/walletCrypto.ts`

#### 加密方案

| 项目 | 规格 |
|------|------|
| 格式 | ethers.js Keystore JSON (Web3 Secret Storage) |
| KDF | scrypt, N=8192 (2^13) |
| 加密耗时 | ~100-300ms（轻量参数） |
| 存储位置 | `localStorage` key `ogbo_wallets` |
| 数据格式 | JSON 数组 `StoredWallet[]` |

#### StoredWallet 结构

```typescript
interface StoredWallet {
  id: string          // crypto.randomUUID()
  name: string        // "Wallet 1", "Wallet 2"...
  network: string     // "ethereum" | "bsc" | "polygon"
  address: string     // EIP-55 校验和地址（明文，非敏感）
  keystore: string    // Keystore JSON（已加密）；外部钱包为空字符串
  createdAt: number   // 时间戳
  type?: 'imported' | 'external'  // 默认 'imported'
}
```

#### 钱包类型

| 类型 | keystore | 来源 | 说明 |
|------|----------|------|------|
| imported | 有（加密） | 助记词 / 私钥导入 | 完整控制权 |
| external | 空字符串 | WalletConnect 连接 | 仅地址记录，无私钥 |

#### Keystore 迁移

`migrateKeystoreScrypt(password)` 函数：
- 将重量级 keystore（scrypt N > 8192）异步迁移到轻量级
- 登录成功后后台执行，不阻塞主流程

### §5.2 会话密钥

| 项目 | 规格 |
|------|------|
| 存储 | `sessionStorage` key `ogbo_session_pk` |
| 生命周期 | 标签页关闭时自动清除 |
| 用途 | 页面刷新后重建 ethers.Wallet signer |
| 清理 | 登出时主动调用 `clearSessionKey()` |

### §5.3 安全实践清单

1. **无明文私钥持久化**：私钥仅存于 `sessionStorage`（标签页级别），Keystore 加密后才写入 `localStorage`
2. **EIP-55 校验和地址验证**：地址操作使用大小写不敏感比较
3. **自我添加防护**：好友请求禁止添加自己的地址
4. **过期检查模式**：异步操作中验证当前钱包是否已切换，防止跨钱包数据污染
5. **私钥格式兼容**：支持带/不带 `0x` 前缀的 64 位 hex 私钥
6. **存储配额保护**：`localStorage` 写入失败时抛出明确错误或静默降级

### §5 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §6 跨平台适配

### §6.1 Capacitor 配置

配置文件：`frontend/capacitor.config.ts`

```typescript
{
  appId: 'com.ogbo.app',
  appName: 'OGBOX',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    cleartext: true,
    allowNavigation: ['*']
  },
  plugins: {
    CapacitorUpdater: { autoUpdate: false }  // 手动模式，由 useOtaUpdater() 控制
  }
}
```

### §6.2 Capacitor 插件使用

| 插件 | 用途 | 备注 |
|------|------|------|
| @capacitor/core | 平台检测 (`Capacitor.isNativePlatform()`) | 条件加载原生功能 |
| @capacitor/keyboard | `keyboardWillShow` / `keyboardDidHide` 事件 | Edge-to-Edge 模式下 Visual Viewport API 不可用 |
| @capacitor/clipboard | 剪贴板读写 | WebView 中 Web Clipboard API 静默失败 |
| @capacitor/status-bar | 状态栏样式控制 | 登录页使用 |
| @capgo/capacitor-updater | OTA 热更新 | 手动更新模式 |

### §6.3 平台特殊处理

#### 键盘适配

- **问题**：Edge-to-Edge 模式下 Visual Viewport API 返回不准确的高度
- **方案**：使用 Capacitor Keyboard 插件监听原生键盘事件
- **计算**：键盘遮挡高度 = `keyboardHeight - spaceBelow`（BottomNav 占据的空间）

#### 剪贴板

- **问题**：Capacitor WebView 中 `navigator.clipboard.writeText()` 静默失败
- **方案**：优先使用 Capacitor Clipboard 插件，Web 端回退到浏览器 API

#### 导航

- **问题**：Capacitor 中 Next.js Router 导航不完全兼容
- **方案**：使用 `window.location.replace()` 替代 Next.js router 跳转

#### 返回手势

- **实现**：监听左边缘触摸（x <= 30px）实现滑动返回导航

### §6.4 APK 构建

- 构建规范参见 `prompts/specs/apk_compilation_spec.md`
- 输出文件：项目根目录 `OGBOX-v1.0.apk`
- webDir 目录：`out/`（Next.js 静态导出产物）

### §6.5 OTA 热更新（Android）

采用 `@capgo/capacitor-updater` 自托管模式实现前端代码 OTA 热更新：

- **更新模式**：手动模式（`autoUpdate: false`），代码控制全部逻辑
- **托管方式**：Supabase Storage public bucket `ota-updates`，manifest + bundle zip
- **核心文件**：`lib/use-ota-updater.ts`（更新逻辑）、`lib/ota-version.ts`（版本号）
- **集成点**：`app/page.tsx` 顶部调用 `useOtaUpdater()` hook
- **详细设计**：参见 `plans/task70-ota-v1-complete-impl.md`

### §6 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 新增 §6.5 OTA 热更新 | lib/use-ota-updater.ts, lib/ota-version.ts |
| 2026-03-08 | 初始化创建 | - |

---

## §7 部署与运维

### §7.1 环境变量

| 变量名 | 用途 | 使用位置 |
|--------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | `lib/supabaseClient.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | `lib/supabaseClient.ts` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect / Reown 项目 ID | `lib/wagmi.ts` |

### §7.2 Vercel 部署

- 域名：`ogbox-web3-app.vercel.app`
- 构建命令：`next build`（或 `next export` 用于静态导出）
- 环境变量在 Vercel Dashboard 中配置

### §7.3 Supabase 项目配置

| 功能 | 状态 |
|------|------|
| PostgreSQL 数据库 | 启用，表：contacts, messages, groups, push_debug_logs |
| Realtime | 启用，监听：messages, contacts, groups |
| Auth | 未使用（钱包地址作为身份标识） |
| Storage | 未观察到使用 |

### §7.4 OTA 热更新

- 使用 `@capgo/capacitor-updater` 插件
- 配置为手动模式（`autoUpdate: false`）
- 更新逻辑由 `useOtaUpdater()` hook 控制
- V1.0 阶段已集成插件，更新服务端尚未完全部署

### §7 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §8 测试

### §8.1 测试框架配置

| 项目 | 规格 |
|------|------|
| 框架 | Jest 30.2 + ts-jest 29.4 |
| 测试目录 | `frontend/lib/__tests__/` |
| 语言 | TypeScript (`.test.ts`) + JavaScript (`.test.js`) |

### §8.2 现有测试文件

| 测试文件 | 覆盖模块 |
|---------|---------|
| `chat.test.ts` | 聊天工具函数 |
| `copyToClipboard.test.ts` | 剪贴板操作 |
| `debugLogger.test.ts` | 调试日志 |
| `market-realdata.test.ts` | 行情真实数据 |
| `marketCache.test.ts` | 行情缓存 |
| `passwordChain.test.js` | 密码链 |
| `push.test.js` | 推送功能 |
| `soundPlayer.test.ts` | 消息提示音 |
| `store-wallet-switch.test.ts` | 钱包切换 |
| `use-ota-updater.test.ts` | OTA 更新 |
| `walletCrypto.test.js` | 钱包加密 |

### §8.3 测试覆盖要求

- 项目约定采用 TDD 工作流
- 流程：编写测试 → 实现功能 → 验证通过
- 所有 `lib/` 下的核心模块均应有对应测试

### §8.4 i18n 国际化

- 自定义实现：`lib/i18n.ts`
- 支持语言：中文 (`zh`)、英文 (`en`)
- 通过 Zustand store 的 `locale` 字段控制切换
- 无第三方 i18n 库依赖

### §8 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## 附录：关键文件索引

| 文件路径 | 职责 |
|---------|------|
| `frontend/lib/store.ts` | Zustand 全局 store（~1226 行） |
| `frontend/lib/wagmi.ts` | wagmi + @reown/appkit 配置 |
| `frontend/lib/walletCrypto.ts` | 钱包加密/解密/存储 |
| `frontend/lib/supabaseClient.ts` | Supabase 客户端初始化 |
| `frontend/lib/chat.ts` | 聊天工具函数（getChatId, addressToColor） |
| `frontend/lib/soundPlayer.ts` | 消息提示音播放 |
| `frontend/lib/debugLogger.ts` | 远程调试日志 |
| `frontend/lib/i18n.ts` | 国际化翻译 |
| `frontend/capacitor.config.ts` | Capacitor 原生应用配置 |
| `frontend/package.json` | 依赖清单 |
