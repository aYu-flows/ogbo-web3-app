# Frontend 开发规范

## 技术栈
- Next.js 16 + React 19 + TypeScript
- 状态管理：Zustand (store.ts)
- 后端：Supabase (supabaseClient.ts)
- Web3：wagmi + viem + @reown/appkit
- 移动端：Capacitor (Android/iOS)
- UI：Tailwind CSS + Radix UI (shadcn/ui)
- 测试：Jest + ts-jest

## 代码-规范映射表
修改以下文件前，必须先阅读对应 Steering 文档章节：

| 代码文件/目录 | 必读规范 |
|--------------|----------|
| lib/chat.ts | product.md §1 聊天, §2 好友, §3 群聊 |
| lib/store.ts | product.md §1-§11 对应状态; tech.md §3 状态管理 |
| lib/supabaseClient.ts | tech.md §2 数据模型, §4 API |
| lib/walletCrypto.ts | product.md §4 钱包; tech.md §5 安全 |
| lib/wagmi.ts | product.md §4 钱包; tech.md §3 Web3 |
| lib/i18n.ts | structure.md §5 国际化 |
| lib/soundPlayer.ts | product.md §1.3 通知 |
| lib/profile.ts | product.md §2 个人资料; tech.md §2 数据模型 |
| lib/debugLogger.ts | tech.md §8 测试与调试 |
| lib/utils.ts | structure.md §3 编码规范 |
| components/pages/ChatPage.tsx | product.md §1 聊天 |
| components/pages/HomePage.tsx | product.md §11 首页 |
| components/pages/AssetsPage.tsx | product.md §4 钱包 |
| components/pages/MarketPage.tsx | product.md §5 行情 |
| components/pages/DiscoverPage.tsx | product.md §6 发现 |
| lib/chat-media.ts | product.md §1.2 消息类型; tech.md §2 数据模型 |
| lib/voice-recorder.ts | product.md §1.2 消息类型 |
| components/chat/ImageMessageBubble.tsx | product.md §1.2 消息类型 |
| components/chat/FileMessageBubble.tsx | product.md §1.2 消息类型 |
| components/chat/VoiceMessagePlayer.tsx | product.md §1.2 消息类型 |
| components/chat/VoiceRecordButton.tsx | product.md §1.2 消息类型 |
| components/chat/ChatMediaPicker.tsx | product.md §1.2 消息类型 |
| components/chat/ImagePreviewModal.tsx | product.md §1.2 消息类型 |
| lib/message-delete.ts | product.md §1.5 消息删除 |
| components/chat/MessageContextMenu.tsx | product.md §1.5 消息删除 |
| lib/group-management.ts | product.md §3 群聊; tech.md §2 数据模型 |
| lib/group-qrcode.ts | product.md §3 群聊 |
| components/chat/GroupInfoPanel.tsx | product.md §3 群聊 |
| components/chat/GroupMemberList.tsx | product.md §3 群聊 |
| components/chat/GroupSettingsPanel.tsx | product.md §3 群聊 |
| components/chat/GroupAnnouncementModal.tsx | product.md §3 群聊 |
| components/chat/GroupInviteModal.tsx | product.md §3 群聊 |
| components/chat/GroupJoinRequestList.tsx | product.md §3 群聊 |
| components/chat/InviteFriendsToGroupModal.tsx | product.md §3 群聊 |
| components/chat/MuteMemberModal.tsx | product.md §3 群聊 |
| components/chat/TransferOwnerModal.tsx | product.md §3 群聊 |
| components/chat/JoinGroupModal.tsx | product.md §3 群聊 |
| app/group/join/page.tsx | product.md §3 群聊 |
| components/chat/ | product.md §1-§3 聊天/好友/群聊 |
| components/login/ | product.md §7 登录; tech.md §5 安全 |
| components/ui/ | structure.md §4 原子组件库 |
| components/TopBar.tsx | structure.md §4 布局组件 |
| components/BottomNav.tsx | structure.md §4 布局组件 |
| components/WalletProvider.tsx | tech.md §3.3 Web3 连接 |
| lib/ota-version.ts | tech.md §6.5 OTA 热更新 |
| lib/use-ota-updater.ts | tech.md §6.5 OTA 热更新 |
| components/StatusBarConfig.tsx | tech.md §6 跨平台适配 |
| components/AppDownloadBanner.tsx | structure.md §4 布局组件 |
| components/SidebarNav.tsx | structure.md §4 布局组件 |
| components/UserAvatar.tsx | product.md §2 个人资料; structure.md §4 |
| components/AvatarPreviewModal.tsx | product.md §2 个人资料; structure.md §4 |
| components/ProfileEditModal.tsx | product.md §2 个人资料; structure.md §4 |
| components/theme-provider.tsx | structure.md §4 主题系统 |
| hooks/use-ime-composition.ts | structure.md §3 编码规范 |
| hooks/use-mobile.tsx | tech.md §6 跨平台适配 |
| hooks/use-toast.ts | structure.md §4 UI 反馈 |
| app/login/page.tsx | product.md §7 登录 |
| capacitor.config.ts | tech.md §6 跨平台适配 |

## 关键约束
- 所有页面组件在 components/pages/ 中，app/ 只做路由入口
- 聊天使用 Supabase Realtime (WebSocket)
- 钱包连接通过 @reown/appkit + wagmi
- 多语言：i18n.ts（中/英，默认中文）
- 移动端特殊处理：Capacitor Keyboard plugin 处理键盘遮挡
- 音频通知：soundPlayer.ts（msg.wav）
- 剪贴板：Capacitor Clipboard plugin（WebView 兼容）

## 状态管理 (Zustand store.ts)
- 钱包状态（wallets, currentWalletId, walletAddress, isLoggedIn）
- 聊天状态（chats, chatRequests, chatReady, chatChannel, unreadChatCount）
- 行情数据（coins, marketLoading, marketError）
- DApp 数据（dapps）
- UI 状态（activeTab, locale, isBalanceVisible）
- 个人资料状态（myProfile, profileCache）
