# OGBOX 产品功能全书

> **版本**: 0.9-beta
> **最后更新**: 2026-03-08
> **维护者**: OGBOX Team
> **定位**: 本文档为 OGBOX 产品功能的权威描述，以代码实现为准。

---

## 项目概览

OGBOX 是一款 Web3 社交钱包应用，融合即时通讯、数字资产管理、行情查看与 DApp 发现于一体。

| 层级 | 技术栈 |
|------|--------|
| 前端 | Next.js 16 + React 19 + TypeScript |
| 后端 | Supabase (BaaS) |
| 移动端 | Capacitor (Android / iOS) |
| Web 部署 | Vercel |

---

## §1 聊天功能 (Chat)

### §1.1 单聊 【已实现】

**消息发送与存储**

- 消息写入 Supabase `messages` 表，字段包括：`chat_id`、`sender`、`content`、`msg_type`（默认 `'text'`）、`created_at`
- `chat_id` 采用确定性生成规则：将通信双方钱包地址转为小写后排序，以 `_` 拼接（见 `getChatId()`）
- 乐观发送机制：消息即时渲染（ID 前缀为 `opt-{timestamp}`），发送失败时回滚
- 去重逻辑：数据库确认本人消息后，通过匹配 `content` + `opt-` 前缀替换乐观消息

**实时通信**

- 基于 Supabase `postgres_changes` 实现实时推送，监听 `messages` 表的 `INSERT` 事件

**消息历史**

- 打开聊天时加载历史消息，调用 `fetchMessages(chatId, limit=50)`

**聊天列表**

- 按最新消息时间戳排序，置顶聊天优先显示
- 聊天操作：置顶/取消置顶、标记已读、删除、搜索
- 列表项支持滑动操作（移动端长按触发）
- 聊天详情页支持左边缘滑动返回手势

> **相关代码**: `lib/chat.ts`, `lib/store.ts`, `components/pages/ChatPage.tsx`, `components/chat/`

### §1.2 消息类型

**已支持类型 【已实现】**

- **文本消息** (`msg_type: 'text'`)：纯文本内容
- **系统消息** (`msg_type: 'system'`)：系统通知类消息
- **表情选择器**：提供 40 个常用 Emoji，8 列网格布局
- **IME 输入兼容**：通过 `isComposing` 状态处理中日韩输入法组合输入，防止回车误发

**V1.0 规划类型 【已实现】**

- **图片消息** (`msg_type: 'image'`)：支持拍照/相册选取，发送前预览确认，客户端压缩(max 1920px)，全屏查看
- **文件消息** (`msg_type: 'file'`)：支持任意文件(max 50MB)，显示文件名/大小/类型图标
- **语音消息** (`msg_type: 'voice'`)：移动端长按录音/Web端点击录音，max 60s/5MB，单例播放

> **相关代码**: `components/pages/ChatPage.tsx`, `components/chat/`

### §1.3 通知与提醒 【已实现】

**音频通知**

- 通知音文件：`/sounds/msg.wav`
- 播放方式：HTML5 Audio API（`soundPlayer.ts`）
- 音量设置：`0.7`
- 自动播放解锁：通过用户交互事件（`click` / `touchstart`）解锁浏览器 Autoplay 限制

**通知抑制规则**

- 当用户正在查看同一聊天时不播放通知音（`activeChatId` 匹配检查）
- 当 `activeTab === 'chat'` 且 `activeChatId` 匹配当前聊天时同样抑制
- Autoplay 被浏览器阻止时静默失败，不抛出异常

> **相关代码**: `lib/soundPlayer.ts`

### §1.4 消息搜索与历史 【已实现】

- 聊天列表搜索：按联系人名称和最后一条消息内容进行模糊匹配
- 消息历史加载：`fetchMessages(chatId, limit=50)` 从 Supabase 获取

> **相关代码**: `lib/chat.ts`, `components/pages/ChatPage.tsx`

### §1.5 消息删除 【已实现】

**删除方式**
- 长按任意消息弹出上下文菜单，菜单包含「删除」和「多选」两个选项
- 点击「删除」直接删除该条消息
- 点击「多选」进入多选模式，支持手动勾选 + 长按拖拽批量选中（上下双向），底部工具栏显示已选数量和删除/取消按钮

**删除范围与可见性**
- 删除为"仅自己不可见"，不影响对方聊天记录
- 可删除自己和对方/群成员的任何消息（包括系统消息）
- 群聊中所有角色（群主/管理员/普通成员/被禁言成员）操作一致，无额外权限

**本地存储**
- 删除记录仅存本地 localStorage，不持久化到服务器
- 按用户钱包地址隔离，key 为 `ogbox_deleted_msgs_{walletAddress}`
- 换设备/清除数据后，已删除的消息恢复显示

**无撤回功能**
- 不支持"撤回消息"功能（删除 ≠ 撤回）

> **相关代码**: `lib/message-delete.ts`, `components/chat/MessageContextMenu.tsx`, `components/pages/ChatPage.tsx`

### §1 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |
| 2026-03-10 | §1.2 多媒体消息(图片/文件/语音)标记为已实现 | `lib/chat-media.ts`, `lib/voice-recorder.ts`, `components/chat/ImageMessageBubble.tsx`, `components/chat/FileMessageBubble.tsx`, `components/chat/VoiceMessagePlayer.tsx`, `components/chat/VoiceRecordButton.tsx`, `components/chat/ChatMediaPicker.tsx`, `components/chat/ImagePreviewModal.tsx` |
| 2026-03-12 | §1.5 消息删除功能实现 | `lib/message-delete.ts`, `components/chat/MessageContextMenu.tsx`, `components/pages/ChatPage.tsx`, `lib/store.ts` |

---

## §2 好友系统 (Friends)

### §2.1 添加好友 【已实现】

**搜索方式**

搜索输入框支持两种搜索模式，系统根据输入内容自动判断：

- **地址搜索**：输入符合 EVM 钱包地址格式（`0x` + 40 位 hex）→ 地址验证 + EIP-55 校验和标准化
- **昵称搜索**：输入非地址格式文本 → 查询 `profiles` 表进行昵称模糊匹配（case-insensitive），返回最多 10 条结果，排除自己
- 防抖搜索：300ms 延迟去抖
- 昵称搜索结果显示头像 + 昵称 + 缩略地址，点击选中后可发送好友请求

**便捷操作**

- 打开添加好友弹窗时自动读取剪贴板内容填充（Capacitor Clipboard API + Web Clipboard API 降级方案）
- 提供粘贴按钮和粘贴事件处理

**校验规则**

- 不允许添加自己为好友
- 已发送请求检测（避免重复请求）

> **相关代码**: `components/chat/AddFriendModal.tsx`

### §2.2 好友请求 【已实现】

**发送请求**

- `sendFriendRequest(myAddress, targetAddress, optionalMessage)`
- 写入 `contacts` 表：`wallet_a`=发送方, `wallet_b`=接收方, `status='pending'`, `request_msg`=附言

**接收请求**

- 实时订阅 `contacts` 表的 `INSERT` 事件，筛选 `wallet_b=当前用户` 且 `status='pending'`

**处理请求**

- 接受：`acceptFriendRequest()` → 更新 `status` 为 `'accepted'`，刷新聊天列表
- 拒绝：`rejectFriendRequest()` → 更新 `status` 为 `'rejected'`

**UI 展示**

- 好友请求列表 UI，聊天页面显示请求数量角标

> **相关代码**: `lib/chat.ts` (`sendFriendRequest`, `acceptFriendRequest`, `rejectFriendRequest`, `fetchContacts`, `fetchPendingRequests`, `areFriends`), `components/chat/AddFriendModal.tsx`, `components/chat/ChatRequestCard.tsx`, `components/chat/ChatRequestList.tsx`

### §2.3 好友权限 【已实现】

三种权限模式（`profiles.friend_permission` 字段，默认 `confirm`）：

1. **允许任何人添加** (`anyone`) — 发送方无需等待审批，contacts 表直接写入 `status='accepted'`
2. **加我好友需要确认** (`confirm`) — 需经过请求-审批流程（系统默认值）
3. **拒绝任何人添加** (`reject`) — 发送方收到权限拒绝错误，不写入 contacts 表

**UI 入口**：`ProfileEditModal` 隐私设置区块，Radio 单选，选中即保存

**权限检查时机**：`sendFriendRequest()` 发送前查询目标用户 `friend_permission`

> **相关代码**: `lib/profile.ts` (`fetchFriendPermission`, `FriendPermission` 类型), `lib/chat.ts` (`sendFriendRequest`, `FriendPermissionError`), `components/ProfileEditModal.tsx`, `lib/store.ts` (`updateFriendPermission`)

### §2.4 通讯录管理 【已实现】

- 已添加的好友显示在 `AddFriendModal` 中，支持快速打开聊天
- 联系人数据存储在 Supabase `contacts` 表

> **相关代码**: `lib/chat.ts` (`fetchContacts`), `components/chat/AddFriendModal.tsx`

### §2 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | §2.3 好友权限功能实现 | `lib/profile.ts`, `lib/chat.ts`, `lib/store.ts`, `ProfileEditModal.tsx`, `AddFriendModal.tsx`, `i18n.ts` |
| 2026-03-08 | 初始化创建 | - |

---

## §3 群聊功能 (Group Chat)

### §3.1 创建群聊 【已实现】

**创建流程**

- `CreateGroupModal`：多选好友列表，好友数量 > 4 时显示搜索框
- 群名输入：最大 50 字符，未输入时自动生成默认名称 `"群聊(N人)"` / `"Group (N)"`
- 数据写入 Supabase `groups` 表，字段：`id`(UUID)、`name`、`creator`、`members[]`、`avatar_url`、`created_at`

**群头像设置**

- 群主和管理员可上传群头像
- 支持格式：jpg/png/gif/webp，最大 2MB
- 群头像存储于 Supabase Storage `group-avatars` bucket（public）
- 群头像 URL 存储于 `groups.avatar_url` 字段

**实时订阅**

- 订阅 `groups` 表的 `INSERT` 事件，客户端侧过滤当前用户是否为成员

> **相关代码**: `lib/chat.ts` (`createGroup`, `fetchGroups`), `components/chat/CreateGroupModal.tsx`

### §3.2 群管理 【已实现】

#### §3.2.1 三级角色体系

群成员分为三级角色，权限由高到低：

| 角色 | 英文标识 | 说明 |
|------|---------|------|
| 群主 | owner | 群创建者，拥有最高权限，唯一 |
| 管理员 | admin | 由群主指定，存储于 `groups.admins[]`，最多 10 人 |
| 普通成员 | member | 默认角色 |

#### §3.2.2 设置/取消管理员

- 仅群主可操作
- 设置管理员：将成员地址加入 `groups.admins[]`
- 取消管理员：将成员地址从 `groups.admins[]` 移除
- 管理员上限为 10 人

#### §3.2.3 禁言成员

- 群主可禁言任何非群主成员（包括管理员）
- 管理员可禁言普通成员（不可禁言群主和其他管理员）
- 禁言时长 5 档：10 分钟、1 小时、12 小时、24 小时、永久
- 禁言数据存储于 `group_members` 表（`muted_until` 字段）
- 被禁言成员在禁言期间无法发送消息

#### §3.2.4 全体禁言

- 群主和管理员可开启/关闭全体禁言
- 全体禁言开启后，群主和管理员不受限制，仅普通成员被禁言
- 状态存储于 `groups.mute_all` 字段

#### §3.2.5 邀请好友入群

- 所有群成员（包括普通成员）均可邀请好友加入群聊
- 普通成员邀请好友时，根据群设置走审批流程
- 若群设置 `invite_approval=true`，邀请需经管理员或群主审批后生效
- 若 `invite_approval=false`，邀请即时生效

#### §3.2.6 移除群成员

- 群主可移除任何非群主成员（包括管理员）
- 管理员可移除普通成员（不可移除群主和其他管理员）

#### §3.2.7 群公告

- 群主和管理员可发布群公告
- 群公告存储于 `groups.announcement` 和 `groups.announcement_at` 字段
- 未读公告弹窗提示：成员打开群聊时，若有未读公告则自动弹出一次（每个版本仅弹出一次）
- 所有成员可点击公告弹窗中的"确认"按钮标记已读
- 已读标记：每位成员的已读状态持久化存储于 `group_members.announcement_read_at` 字段

#### §3.2.8 入群方式设置

- 群主和管理员可设置入群方式，存储于 `groups.join_mode` 字段
- 三种模式：

| 模式 | 值 | 说明 |
|------|-----|------|
| 自由加入 | `free` | 任何人可通过链接/二维码直接加入 |
| 需要审批 | `approval` | 申请后需群主或管理员审批 |
| 禁止加入 | `disabled` | 关闭所有主动加入渠道 |

#### §3.2.9 成员邀请审批开关

- 群主和管理员可开启/关闭邀请审批（`groups.invite_approval` 字段）
- 开启后，成员邀请好友入群需经管理员或群主审批

#### §3.2.10 置顶群聊

- 群成员可置顶/取消置顶群聊
- 置顶状态持久化存储于 `group_members.pinned` 字段（per-member）
- 置顶群聊在聊天列表中优先显示

#### §3.2.11 群消息免打扰

- 群成员可开启/关闭群消息免打扰
- 免打扰状态存储于 `group_members.muted_notifications` 字段（per-member）
- 开启后不接收该群的消息通知

#### §3.2.12 我的群昵称

- 群成员可设置在该群内的显示昵称
- 群昵称存储于 `group_members.group_nickname` 字段（per-member）
- 群昵称优先于全局昵称在群消息中展示

#### §3.2.13 修改群名称

- 仅群主和管理员可修改群名称
- 更新 `groups.name` 字段

#### §3.2.14 群邀请链接与二维码

- 群主和管理员可生成群邀请链接
- 邀请链接包含过期时间，可由群主/管理员撤销
- 支持生成邀请链接对应的二维码，供扫码加入
- 加入行为遵循 §3.2.8 入群方式设置（free 模式直接加入，approval 模式需审批）

#### §3.2.15 转让群主

- 仅群主可操作
- 可将群主身份转让给群内任意成员（包括管理员和普通成员）
- 转让后原群主变为普通成员

#### §3.2.16 解散群聊与退出群聊

- **解散群聊**：仅群主可操作，解散后群聊对所有成员不可见
- **退出群聊**：非群主成员可主动退出群聊

#### §3.2.17 新成员消息可见性

- 新成员加入群聊后，无法查看其加入时间之前的历史消息
- 消息可见性基于成员的 `joined_at` 时间戳过滤

### §3.3 群消息 【已实现】

- 复用单聊消息系统，以 `group.id` 作为 `chat_id`
- 群消息显示发送者地址末尾 4 位（非本人消息）
- `sendGroupPushMessage()` 支持乐观更新 + 失败回滚

> **相关代码**: `lib/chat.ts`, `components/pages/ChatPage.tsx`

### §3 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-13 | Task80: 群头像设置功能；普通成员可邀请好友入群；群公告确认按钮+未读自动弹出优化 | - |
| 2026-03-12 | Task76: 新增 15 项群管理功能（角色体系、禁言、入群方式、邀请链接/二维码、群公告、群主转让、解散群聊等） | - |
| 2026-03-08 | 初始化创建 | - |

---

## §4 钱包功能 (Wallet)

### §4.1 登录方式 【已实现】

支持以下四种钱包接入方式：

| 方式 | 实现 | 说明 |
|------|------|------|
| 私钥导入 | `walletFromPrivateKey()` | 自动补充 `0x` 前缀 |
| 助记词导入 | `walletFromMnemonic()` | 支持 BIP39 12/24 词 |
| 新建钱包 | `generateEVMWallet()` | BIP39 助记词生成 |
| 外部钱包连接 | `@reown/appkit` + `wagmi` | WalletConnect 协议 |
| 密码登录 | 解密已有 Keystore | 适用于回归用户 |

- 登录流程由 `LoginApp.tsx` 中的 13 状态认证状态机驱动

> **相关代码**: `lib/walletCrypto.ts`, `lib/wagmi.ts`, `components/login/LoginApp.tsx`

### §4.2 资产管理 【已实现】

**多钱包支持**

- 钱包列表存储于 `localStorage`（键 `ogbo_wallets`，JSON 数组）
- 当前活跃钱包追踪（键 `ogbo_active_wallet`）
- 切换钱包时自动重新初始化聊天订阅

**资产展示**

- 总资产显示（CNY + USD 双币种），支持余额可见性切换
- 代币列表：`symbol`、`name`、`amount`、`value`、`change24h`、`icon`
- NFT 收藏品展示，支持详情弹窗查看
- 交易记录展示（发送/接收/兑换），支持详情弹窗

**钱包选择器**

- 下拉菜单切换钱包，提供导入/创建入口

> **相关代码**: `components/pages/AssetsPage.tsx`, `components/pages/HomePage.tsx`, `lib/store.ts`

### §4.3 钱包安全 【已实现】

**加密存储**

- 采用 ethers.js Keystore JSON 格式
- scrypt 参数：`N=8192`（轻量化，适配移动端性能）
- 提供 `migrateKeystoreScrypt()` 迁移函数（重型→轻型 scrypt 参数）

**数据结构 (StoredWallet)**

```typescript
{
  id: string;
  name: string;
  network: string;
  address: string;
  keystore: string;    // 加密的 JSON Keystore
  createdAt: number;
  type: 'imported' | 'external';
}
```

**会话管理**

- 会话私钥存于 `sessionStorage`（键 `ogbo_session_pk`），关闭标签页即清除
- 外部钱包：不存储 Keystore 和私钥

> **相关代码**: `lib/walletCrypto.ts`

### §4.4 钱包操作 【未实现】

UI 已就绪，核心功能待实现：

| 操作 | 弹窗组件 | 当前状态 |
|------|---------|---------|
| 发送 | `SendModal` | 含地址/资产/金额输入，点击提交显示 toast 占位提示 |
| 接收 | `ReceiveModal` | 含二维码占位 + 复制地址功能 |
| 兑换 | `SwapModal` | 含代币对选择，点击提交显示 toast 占位提示 |

> **相关代码**: `components/pages/HomePage.tsx`, `components/pages/AssetsPage.tsx`

### §4 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §5 行情功能 (Market)

### §5.1 行情数据 【已实现】

**覆盖币种（16 种）**

BTC, ETH, XRP, BNB, SOL, TRX, DOGE, BCH, ADA, HYPE, WBTC, LEO, XMR, LINK, XLM, HBAR

**数据字段**

- 价格、24h 涨跌幅、成交量、市值
- 24h 最高/最低价、流通量、最大供应量
- 图表数据（小时粒度，24 个数据点）

**刷新策略**

- 行情页面：每 60 秒自动刷新
- 首页：每 3 秒自动刷新

**列表分类**

- 热门 (Trending)
- 收藏 (Favorites)
- 涨幅榜 (Gainers)
- 跌幅榜 (Losers)

**币种详情**

- 面积图展示价格走势
- 时间范围选择器：1H / 1D / 1W / 1M / 1Y
- 买入/卖出按钮（占位，未实现交易功能）

**收藏系统**

- 支持按币种切换收藏状态

> **相关代码**: `lib/store.ts` (`initMarketData`, `updatePrices`), `components/pages/MarketPage.tsx`, `components/pages/HomePage.tsx`

### §5.2 行情源与缓存 【已实现】

**数据源**

- CoinGecko API v3：`https://api.coingecko.com/api/v3`

**三级降级策略**

1. **localStorage 缓存**（键 `ogbo_market_data_cache`）— API 请求失败时使用
2. **内置快照** — 2026-02-23 的静态行情数据，缓存也不可用时使用
3. **骨架屏加载** — 所有数据源均不可用时展示加载占位

### §5.3 国内访问优化 【未实现】

- V1.0 规划项，用于解决 CoinGecko API 在中国大陆的访问问题
- 可能方案：代理中继、备选数据源

### §5 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §6 发现页 (Discover)

### §6.1 DApp 展示与导航 【已实现】

**DApp 列表（12 个 Mock DApp）**

| DApp | 类别 |
|------|------|
| Uniswap | DeFi |
| OpenSea | NFT |
| AAVE | DeFi |
| Curve | DeFi |
| PancakeSwap | DeFi |
| Rarible | NFT |
| Compound | DeFi |
| Axie Infinity | GameFi |
| Snapshot | DAO |
| 1inch | DeFi |
| Decentraland | Metaverse |
| Mirror | Social |

**分类筛选**

- 全部 (All)、DeFi、NFT、GameFi、Social、Tools、DAO、Metaverse

**Banner 轮播**

- 3 张 Banner，3 秒自动轮转

**DApp 详情**

- 详情浮层展示：评分、截图占位、开发者信息
- 操作按钮：收藏 / 打开应用

**搜索与收藏**

- 按名称和描述搜索 DApp
- 收藏系统：按 DApp 切换收藏状态

**打开应用**

- 当前点击 "Open App" 显示 toast 占位提示，待集成 WebView 或外部跳转

> **相关代码**: `lib/store.ts` (`mockDApps`, `dapps`), `components/pages/DiscoverPage.tsx`

### §6 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §7 登录与认证 (Login & Auth)

### §7.1 登录流程 【已实现】

**认证检查**

- 应用挂载时检查 `localStorage` 中 `ogbo_logged_in` 和 `ogbo_wallet_address`
- 已登录用户直接跳转至首页（使用 `window.location.replace` 以兼容 Capacitor）

**登录状态机**

- `LoginApp.tsx` 中实现 13 状态视图状态机，覆盖完整的登录/注册/导入流程

**UI 功能**

- 语言切换器（中文 / English）
- 多步骤流程进度条
- 网络选择（Ethereum / BNB Smart Chain）
- 密码强度校验（弱 / 中 / 强）
- 助记词生成，支持复制与显示/隐藏切换
- 助记词备份验证（按顺序选词确认）
- App 下载引导横幅（仅 Web 端展示）

> **相关代码**: `app/login/page.tsx`, `components/login/LoginApp.tsx`, `lib/walletCrypto.ts`

### §7.2 会话管理 【已实现】

**登录态存储**

| 存储位置 | 键名 | 用途 |
|---------|------|------|
| localStorage | `ogbo_logged_in` | 登录标记（`'true'`） |
| localStorage | `ogbo_wallet_address` | 当前钱包地址 |
| sessionStorage | `ogbo_session_pk` | 会话私钥（关闭标签页清除） |

**登出流程**

- 清除 `localStorage` 登录标记
- 清除 `sessionStorage` 会话数据
- 取消所有聊天实时订阅

> **相关代码**: `lib/store.ts` (`login`, `logout`, `checkAuthStatus`)

### §7 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §8 个人资料 (Profile) 【未实现】

V1.0 规划功能：

- **昵称修改** — 用户可设置显示名称，替代钱包地址展示
- **头像设置** — 用户可上传或选择头像

当前代码中尚未找到相关实现。

### §8 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §9 OTA 热更新 (Over-The-Air Update) 【未实现】

V1.0 规划附带功能，用于 Android App 的热更新能力。

**现有相关代码**

- `hooks/use-mobile.tsx` — 移动端检测工具 Hook
- `hooks/use-toast.ts` — Toast 通知工具 Hook

以上为通用工具，非 OTA 专用实现。OTA 核心逻辑（版本检查、增量下载、热替换）尚未实现。

### §9 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §10 V1.0 完整版路线图

### §10.1 第一阶段功能清单

| 序号 | 功能 | 状态 |
|------|------|------|
| 1 | 群管理功能（角色体系/禁言/邀请/删除成员/群公告/入群方式/置顶/免打扰/群昵称/修改群名/群链接二维码/群主转让/解散群聊） | 【已实现】 |
| 2 | 个人资料（昵称修改 + 头像设置） | 【未实现】 |
| 3 | 好友权限（允许任何人/需确认/拒绝任何人） | 【已实现】 |
| 4 | 多模态消息（图片/文件/语音，不含视频和通话） | 【已实现】 |
| 5 | 安卓 App 热更新 (OTA) | 【未实现】 |

### §10.2 后续阶段规划

**V1.0 第二阶段**

- 好友通讯录完善
- 扫一扫加好友

**V1.0 第三阶段**

- 行情国内访问优化

**暂不纳入**

- 登录邀请码
- 语音通话
- 视频通话

### §10 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §11 首页 (Home)

### §11.1 页面布局 【已实现】

**Hero 卡片**

- 展示用户总资产（CNY + USD 双币种）
- 余额可见性切换按钮

**快捷操作**

- 发送 (Send) → 打开 `SendModal`
- 接收 (Receive) → 打开 `ReceiveModal`
- 兑换 (Swap) → 打开 `SwapModal`

**功能卡片（2x2 网格）**

| 卡片 | 状态 |
|------|------|
| 社区 (Community) | Coming Soon |
| 交易 (Trade) | 可点击 |
| DApps | 可点击 |
| 会议 (OGBOX Meeting) | Beta 标签 |

**精选 DApp**

- 水平滚动展示前 5 个 DApp

**行情概览**

- 展示前 5 个币种及迷你价格图表

**安全提示**

- 底部安全提示横幅

### §11.2 OGBOX Meeting 弹窗 【未实现】

弹窗 UI 已就绪，展示功能说明（占位）：

- 端到端加密
- 支持 50 人参会
- 屏幕共享

实际会议功能尚未实现。

> **相关代码**: `components/pages/HomePage.tsx`

### §11 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## 附录 A：数据表结构概览

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `messages` | 聊天消息 | `chat_id`, `sender`, `content`, `msg_type`, `created_at` |
| `contacts` | 好友关系 | `wallet_a`, `wallet_b`, `status`, `request_msg` |
| `groups` | 群组 | `id`, `name`, `creator`, `members[]`, `created_at` |

## 附录 B：本地存储键名一览

| 键名 | 存储位置 | 用途 |
|------|---------|------|
| `ogbo_wallets` | localStorage | 钱包列表（JSON 数组） |
| `ogbo_active_wallet` | localStorage | 当前活跃钱包 |
| `ogbo_logged_in` | localStorage | 登录状态标记 |
| `ogbo_wallet_address` | localStorage | 当前钱包地址 |
| `ogbo_market_data_cache` | localStorage | 行情数据缓存 |
| `ogbo_session_pk` | sessionStorage | 会话私钥 |

## 附录 C：功能实现状态总览

| 模块 | 已实现 | 未实现 |
|------|--------|--------|
| §1 聊天 | 单聊、文本消息、通知、搜索 | 图片/文件/语音消息 |
| §2 好友 | 添加好友、好友请求、通讯录、好友权限设置 | — |
| §3 群聊 | 创建群聊、群消息、群管理（角色体系、禁言、邀请、移除成员、群公告、入群方式、置顶、免打扰、群昵称、修改群名、邀请链接/二维码、转让群主、解散/退出群聊） | — |
| §4 钱包 | 登录方式、资产展示、安全存储 | 发送/接收/兑换实际执行 |
| §5 行情 | 行情数据、缓存策略 | 国内访问优化 |
| §6 发现 | DApp 展示、搜索、收藏 | DApp 内嵌打开 |
| §7 认证 | 完整登录流程、会话管理 | — |
| §8 资料 | — | 昵称、头像 |
| §9 OTA | — | 热更新全部功能 |
| §11 首页 | 页面布局、数据展示 | Meeting 功能 |
