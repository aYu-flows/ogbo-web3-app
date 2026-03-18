# OGBOX 变更日志

所有 Steering 文档（product.md、tech.md、structure.md）的变更记录。

---

## Task95 — Fix Cursor Jumping to End on Controlled Inputs (2026-03-18)

### Fixed
- Tapping in the middle of text in controlled inputs (group name, nickname, announcement, search, profile edit) caused new input to appear at the end instead of at the cursor position. Root cause: `useIMEInput` hook's `setValue()` calls (from onChange, polling, compositionEnd) triggered React re-renders that reset cursor position on Android WebView. Fix: save `selectionStart`/`selectionEnd` before every `setValue`, restore via `useLayoutEffect` after React re-render.

### Files Modified
- `hooks/use-ime-input.ts` — Added `cursorRef` + `useLayoutEffect` cursor restore; save cursor in `handleChange`, `getInputProps` onChange, polling callback, and `onCompositionEnd`

---

## Task94 — Fix Dissolved Group Send Guard, Message Shake, Owner Leave (2026-03-18)

### Fixed
- Dissolved group send guard had race condition — `removedAlert` state was set async via `useEffect`, allowing sends in the gap. Added real-time `useStore.getState().chats` check in `handleSend` to block sends immediately.
- Dissolved group detection failed when Supabase Realtime DELETE event was blocked by RLS — added fallback detection via system message "群聊已解散" content in `chat.messages`.
- Message shake/jitter persisted after Task93 fix — root cause was `y: 10` initial offset conflicting with smooth scroll, plus `exit` height-collapse animation. Removed all `y` transforms and `exit` animation, added `AnimatePresence initial={false}`, reduced transition to 0.15s.
- Group owner could leave their own group via swipe-to-delete — added owner check in `leaveGroupAction` (checks `activeGroupDetail` cache, falls back to `fetchGroupDetail`). Shows toast: "群主无法退出群聊，如需退出，请通过解散群聊来退出。"

### Files Modified
- `components/pages/ChatPage.tsx` — handleSend real-time guard, dissolution system message detection, AnimatePresence initial={false}, motion.div simplified animation
- `lib/store.ts` — Owner guard in leaveGroupAction
- `lib/i18n.ts` — Updated ownerCannotLeave text (zh + en)

---

## Task93 — Fix Dissolved Group Send, Message Shake, Friend Chat Navigation (2026-03-17)

### Fixed
- Dissolved group members could still send messages — added guard in `handleSend` to block sending when `removedAlert` is set
- Dissolved group chat would auto-close before showing the "This group has been dissolved" notice — cached last chat data and prevented auto-deselect for dissolved groups
- Chat messages (private/group) would shake/jitter on send due to framer-motion `layout` prop causing layout shift animations — removed `layout` prop from message `motion.div`
- Clicking "Send Message" on an existing friend in AddFriendModal only closed the modal without navigating to the chat — added `pendingOpenChatId` store field for cross-component navigation

### Files Modified
- `components/pages/ChatPage.tsx` — handleSend guard, removed `layout` prop, cached dissolved chat, pending chat navigation
- `components/chat/AddFriendModal.tsx` — fallback navigation via `switchTab` + `setPendingOpenChatId`
- `lib/store.ts` — Added `pendingOpenChatId` and `setPendingOpenChatId`

---

## Task92 — Fix All IME Chinese Input Issues (2026-03-17)

### Fixed
- All user-facing text inputs now detect IME candidate taps on Android WebView via 300ms polling fallback
- Chat message input: mic/send icon now toggles correctly after Chinese input
- Profile nickname: Chinese text no longer disappears on save
- Group name/nickname inline edit: Chinese text persists correctly
- Group announcement: Chinese text no longer reverts
- Group member search: Chinese input now detected
- Join group modal: input now uses polling for consistency

### New
- `setupInputPolling()` exported utility in `hooks/use-ime-input.ts` — reusable native input + polling for any DOM element
- `useIMEInput` hook now includes `inputCallbackRef` and `elRef` — auto-attaches polling when spread via `getInputProps()`

### Steering Doc Updates
- tech.md §6.3: Added "IME Input (Android WebView)" subsection
- structure.md §3.6: Added IME input coding rule

### Files Modified
- `hooks/use-ime-input.ts` — Added `setupInputPolling` + callback ref with polling
- `components/pages/ChatPage.tsx` — Message input uses polling callback ref
- `components/ProfileEditModal.tsx` — Switched to `useIMEInput` from `useIMEComposition`
- `components/chat/AddFriendModal.tsx` — Refactored inline polling to shared utility
- `components/chat/JoinGroupModal.tsx` — Switched to uncontrolled + polling
- `components/chat/GroupInfoPanel.tsx` — Uses hook's callback ref + elRef
- `components/chat/CreateGroupModal.tsx` — Uses hook's elRef instead of separate ref

---

## Task91 — Dissolved Group Input Disable + Join Request Red Dot Notifications (2026-03-17)

### Fixed
- Members in dissolved groups could still type and send messages — input bar now shows "This group has been dissolved" notice when `removedAlert` is triggered (`ChatPage.tsx`)
- Same disabled notice applied for removed members ("You have been removed from the group")

### New
- **Join request approval red dot notifications** (admin/owner only):
  - Red dot on group avatar in chat list when pending join requests exist
  - Red dot on group chat header avatar when pending requests exist
  - Existing red badge on "Join Requests" row in group management panel (already implemented, no change)
- `fetchAllPendingRequestCounts()` batch-loads pending counts during `initChat()` (`group-management.ts`)
- `myAdminGroupIds` store field tracks groups where user is admin/owner, updated via Realtime
- `admins` field added to `GroupRow` interface for proper typing (`chat.ts`)

### Steering Doc Updates
- product.md §3.2.16: Added dissolved group input disabled behavior
- product.md §3.2.9: Added join request notification red dot feature description

---

## Task90 — IME Chinese Input Fix: Add Friend Search (2026-03-17)

### Fixed
- Chinese (CJK) input in Add Friend search not triggering nickname search on Android/Capacitor — switched from `deferredValue` (composition-gated) to live `searchInput` value with 500ms debounce (`AddFriendModal.tsx`)

### Root Cause
- `useIMEInput` hook's deferred value pattern relies on `compositionEnd` event, which some Android IMEs never fire when selecting a candidate by tapping
- Without `compositionEnd`, `deferredValue` never updates and search effect never triggers

### New
- `tasks/task90_ime_debug.md` — IME input debugging document for tracking this systemic issue

---

## Task89 — 10 Chat & Group Management Bug Fixes (2026-03-16)

### Fixed
- Duplicate announcement popup on edit/Realtime re-trigger — module-level dedup Set + cooldown guard + `useStore.getState()` to avoid stale closure (`ChatPage.tsx`)
- Announcement edit cancel only exiting edit mode, not closing modal — cancel button now calls `handleClose()` (`GroupAnnouncementModal.tsx`)
- Drawer card position jump on input focus — switched from `translateY` to `paddingBottom` to avoid vaul transform conflict (`drawer.tsx`)
- Paste invite link not triggering search — added `onPaste` handler with `setTimeout(0)` for DOM sync (`JoinGroupModal.tsx`)
- Toast messages stacking up and never auto-dismissing — migrated 3 components from non-functional shadcn toast to react-hot-toast, unified global duration to 1000ms (`GroupSettingsPanel.tsx`, `TransferOwnerModal.tsx`, `GroupAnnouncementModal.tsx`, `page.tsx`, `LoginApp.tsx`, `TopBar.tsx`, `SidebarNav.tsx`)
- Wallet switch state inconsistency after app restart — wagmi sync guard checks wallet type before overriding (`page.tsx`), removed "Connected" label (`AssetsPage.tsx`)
- Chat page showing previous wallet data after switch — `switchWallet` now resets all group-related state (`store.ts`)

### Changed
- `setAnnouncementAction` no longer patches `announcement_at` locally to prevent dedup key mismatch (`store.ts`)
- `JoinGroupModal` uses delayed programmatic focus instead of `autoFocus` to prevent drawer snap point jump
- All toast calls across the app now use react-hot-toast with 1000ms global duration

---

## Task87 — Group Management & IME Debug Fixes (2026-03-16)

### Fixed
- Group name/nickname Chinese IME input disappearing on save (`GroupInfoPanel.tsx` — applied `useIMEInput` props to inputs, added `rAF` + `isComposingRef` guard on `onBlur`, switched to controlled `value`)
- Invited friend still appearing in invitable list after auto-join (`store.ts` — `await` added to `refreshGroupDetail` in `inviteFriendsToGroupAction`)
- Group member nicknames showing truncated addresses instead of real names (`GroupInfoPanel.tsx` — `await loadProfiles` before `setLoading(false)`, added second `cancelled` check)

### Verified (no fix needed — already resolved in Task80/84/85/86)
- 10 of 13 originally reported issues confirmed fixed by previous tasks

---

## Task86 — Group Announcement & Join Group UI Bugs (2026-03-16)

### Fixed
- Duplicate announcement popup after editing (Realtime re-trigger with different timestamp caused popup to re-open)
- New group member seeing announcement popup twice (same Realtime re-trigger root cause)
- Double `markAnnouncementRead` DB write when clicking "Confirm" in announcement modal
- Keyboard blocking inputs in Drawer components (JoinGroupModal, GroupAnnouncementModal) on Capacitor

### New
- `hooks/use-drawer-keyboard.ts` — reusable hook for Drawer keyboard avoidance (Capacitor + visualViewport)
- Invite link preview card in JoinGroupModal (group name, member count, avatar shown when pasting invite link)
- System-wide keyboard avoidance in DrawerContent component (all Drawers benefit)

### Modified
- `components/ui/drawer.tsx` — DrawerContent now auto-adjusts with `translateY` when keyboard opens
- `components/pages/ChatPage.tsx` — `announcementShownRef` changed from Set to Map for de-duplication; added author-skip guard
- `components/chat/GroupAnnouncementModal.tsx` — "Confirm" button uses `handleClose()` to prevent double markAnnouncementRead; removed scrollIntoView workaround
- `components/chat/JoinGroupModal.tsx` — added invite preview logic with debounce + preview card UI; removed scrollIntoView workaround
- `specs/structure.md` — added `use-drawer-keyboard.ts` to file tree and mapping table
- `frontend/CLAUDE.md` — added `use-drawer-keyboard.ts` to code-spec mapping table

---

## Task85 — Dissolve Group Blank Page + IME Input Detection Fix (2026-03-15)

### Fixed
- Dissolve/leave/kick group causing blank chat list page on mobile (auto-deselect `selectedChat` when chat no longer exists)
- Chinese IME input not detected across all input fields — microphone icon not switching to send, search not triggering, nickname/group name not updating after composition (replaced `setTimeout(0)` with `requestAnimationFrame` + added native DOM `input` listener)

### Modified
- `components/pages/ChatPage.tsx` — added auto-deselect useEffect for stale selectedChat; added native DOM input listener for IME reliability; changed compositionEnd from setTimeout to requestAnimationFrame
- `hooks/use-ime-input.ts` — onCompositionEnd now uses requestAnimationFrame for DOM value reading (synchronous isComposingRef reset preserved for Android onChange ordering)

---

## Task84 — Chat & Group Management 18 Bug Fixes (2026-03-15)

### Fixed
- Duplicate announcement toast (removed duplicate from GroupAnnouncementModal)
- Announcement popup showing twice on re-enter (ref now keyed by chat.id + announcement_at, so new announcements trigger popup)
- Keyboard blocking Drawer inputs (added scrollIntoView on focus)
- Group invite link copy failure on native (switched to copyToClipboard utility)
- Chat state not reset on wallet switch (added missing state resets in login())
- Group member nicknames not loading (added loadProfiles on GroupInfoPanel open)
- Group nickname/name IME composition conflict (switched to uncontrolled inputs)
- Join request badge not clearing after approval (added pendingRequestCounts decrement)
- Dissolve group showing blank popup (close panels before dissolution)
- Dissolved group persisting after reload (made system message non-blocking)
- Full group mute not immediate (Realtime handler now creates activeGroupDetail if missing)
- Individual mute delayed (added UPDATE handler for group_mutes)
- Send button stuck on microphone (added onChange + onCompositionEnd handleInput call)
- Unread badge persisting in active chat (skip increment for active chat)
- Mute broken after ownership transfer (added creator field to Realtime handler)
- mute_all not enforced server-side in sendGroupPushMessage
- App resume from background showing stale data (added visibilitychange listener in page.tsx)
- Pending request badge not syncing across multiple admins (added decrement in Realtime group_join_requests UPDATE handler)

### New
- Message copy option in context menu and batch copy in multi-select toolbar
- Group preview card when pasting invite link in search box (fetchGroupPreviewByToken)
- `chat.msg.copy` i18n key (zh/en)

### Modified
- `store.ts` — Realtime groups UPDATE handler now creates activeGroupDetail entry even when missing; added creator/announcement_by fields; added group_mutes UPDATE subscription; login() resets all group state; group_join_requests UPDATE handler now decrements pendingRequestCounts
- `page.tsx` — added visibilitychange listener for app resume data refresh
- `ChatPage.tsx` — invite link detection in search, copy handlers, announcement ref keyed by chatId
- `MessageContextMenu.tsx` — added Copy option
- `GroupInfoPanel.tsx` — uncontrolled inputs for name/nickname, loadProfiles on open
- `GroupAnnouncementModal.tsx` — removed duplicate toast, added scrollIntoView
- `GroupInviteModal.tsx` — switched to copyToClipboard utility
- `GroupJoinRequestList.tsx` — passes groupId to handleJoinRequestAction
- `JoinGroupModal.tsx` — added scrollIntoView on input focus
- `group-management.ts` — added fetchGroupPreviewByToken function
- `i18n.ts` — added chat.msg.copy key

---

## Task80 — 群管理功能16项Bug修复与优化 (2026-03-13)
- 新增 `useIMEInput` hook 系统性修复全项目中文输入法(IME)兼容问题
- 修复群名/群昵称/群公告中文输入消失问题
- 修复添加好友中文搜索不触发问题(Android Chrome事件竞态)
- 普通成员可邀请好友入群(根据群设置走审批流程)
- 群聊头部标题/头像可点击打开群信息面板
- 群公告添加"确认"按钮,未读公告自动弹出一次
- 群邀请链接有效期选择器UI优化(RadioGroup替换原生select)
- 好友入群后可邀请列表实时刷新
- GroupInfoPanel浅色主题适配
- 去除群聊电话图标
- 新增群头像设置功能(groups表avatar_url字段 + group-avatars Storage bucket)
- 修复全员禁言开关状态不更新(本地state + store双向同步)
- 新增activeGroupDetail store状态,统一群详情数据源
- Realtime groups UPDATE handler扩展,同步所有字段
- 全项目搜索输入框IME兼容(ChatPage/MarketPage/DiscoverPage等)

---

## 2026-03-12 Task77: 聊天消息删除功能

### 新增
- `lib/message-delete.ts` — 本地删除存储层（localStorage，按钱包地址隔离）
- `components/chat/MessageContextMenu.tsx` — 长按上下文菜单组件（删除/多选）
- `lib/__tests__/message-delete.test.ts` — 12 项单元测试

### 修改
- `lib/store.ts` — 新增 `deleteMessages` action；`loadChatHistory`/Realtime INSERT/`initChat` 过滤已删除消息
- `components/pages/ChatPage.tsx` — 长按菜单、多选模式（手动勾选+拖拽批量选中）、删除动画、多选工具栏
- `lib/i18n.ts` — 新增 `chat.msg.delete/multiSelect/selected/cancel` 中英文键值
- `specs/product.md` — 新增 §1.5 消息删除
- `specs/structure.md` — 新增文件到项目结构
- `frontend/CLAUDE.md` — 新增文件到映射表

---

## 2026-03-12 Task79: 语音录制取消 & 输入框非受控模式修复

### 修复
- `VoiceRecordButton.tsx` — 新增显式取消按钮：Web 端录制中显示取消(X)+停止按钮，原生端全屏遮罩显示取消(X)+发送按钮
- `ChatPage.tsx` — 输入框从 React 受控模式改为非受控模式，修复移动端 speech-to-text 导致发送/话筒切换异常及光标位置被重置的问题

---

## 2026-03-12 Task78: 中文输入法(IME)兼容性修复

### 新增
- `hooks/use-ime-composition.ts` — IME composition 状态跟踪 Hook

### 修复
- ProfileEditModal 中文昵称输入后保存按钮不响应问题（添加 compositionEnd 事件同步 + DOM ref 兜底读取）
- AddFriendModal 中文昵称搜索不触发问题（composition 期间跳过 debounce 搜索 + compositionEnd 同步 state）
- GroupInfoPanel 群名/群昵称中文编辑兼容性（添加 compositionEnd 事件同步 + DOM ref 兜底读取）

### 修改
- `structure.md` 新增 `hooks/use-ime-composition.ts` 文件映射
- `frontend/CLAUDE.md` 新增文件映射条目

---

## 2026-03-12 Task76: 群管理功能

### 新增
- 三级角色体系：群主(owner) > 管理员(admin) > 普通成员(member)
- 禁言功能：个人定时禁言（5档）+ 全群禁言
- 群成员管理：设置/取消管理员、移除成员
- 入群控制：入群方式设置（自由/审批/禁止）、成员邀请审批开关
- 群邀请链接/二维码：生成、分享、撤销、过期设置
- 群公告：发布、自动弹窗提醒、已读标记
- 群设置：修改群名、我的群昵称、置顶群聊、消息免打扰
- 群主转让、解散群聊、退出群聊
- Web 端邀请链接落地页 (app/group/join/page.tsx)

### 修改
- groups 表新增 7 个字段（admins, announcement, announcement_at, announcement_by, join_mode, invite_approval, mute_all）
- 新增 4 张数据库表（group_members, group_mutes, group_invites, group_join_requests）
- store.ts 新增 25+ 群管理 actions 和 6 个 Realtime 订阅
- ChatPage.tsx 增加群管理面板集成、禁言输入框、未读公告弹窗
- i18n.ts 新增 100+ 群管理国际化键值
- chat.ts fetchMessages 支持 sinceTimestamp、createGroup 创建 group_members 行

### 新增文件
- lib/group-management.ts (572行)
- lib/group-qrcode.ts (43行)
- 10 个新 UI 组件 (components/chat/Group*.tsx 等)
- app/group/join/page.tsx

---

## 2026-03-10

### feat: 实现多媒体聊天消息(图片/文件/语音) - Task75

- **新增** `lib/chat-media.ts` — 多媒体消息上传/发送逻辑
- **新增** `lib/voice-recorder.ts` — 语音录制工具
- **新增** `components/chat/ImageMessageBubble.tsx` — 图片消息气泡
- **新增** `components/chat/FileMessageBubble.tsx` — 文件消息气泡
- **新增** `components/chat/VoiceMessagePlayer.tsx` — 语音消息播放器
- **新增** `components/chat/VoiceRecordButton.tsx` — 语音录制按钮
- **新增** `components/chat/ChatMediaPicker.tsx` — 媒体选择器
- **新增** `components/chat/ImagePreviewModal.tsx` — 图片全屏预览弹窗
- **更新** `specs/product.md` §1.2 — 图片/文件/语音消息标记为已实现
- **更新** `specs/tech.md` §2 — messages 表新增 file_url/file_name/file_size/duration/thumbnail_url 字段
- **更新** `specs/structure.md` — 新增 8 个文件到项目结构和映射表

---

## 2026-03-08

### 好友搜索支持昵称搜索（Task73）

- **新增** `lib/profile.ts` — `searchByNickname()` 函数，Supabase ilike 模糊匹配 profiles.nickname
- **修改** `lib/store.ts` — 新增 `searchUserByNickname` action
- **修改** `components/chat/AddFriendModal.tsx` — 搜索逻辑支持地址/昵称双模式自动判断，多结果列表显示
- **修改** `lib/i18n.ts` — 更新搜索 placeholder 文案，新增 nicknameSearchNoResult key
- **更新** `specs/product.md` §2.1 — 添加昵称搜索说明

### Task71 审计问题修复

- **修改** `lib/store.ts` — `updateNickname`/`updateAvatar` 增加乐观更新+失败回滚机制
- **修改** `lib/chat.ts` — `sendFriendRequest` 增加重复好友请求检测（ALREADY_FRIENDS/ALREADY_PENDING）
- **修改** `lib/profile.ts` — `upsertProfile` 空字符串 nickname 转 null；`uploadAvatar` 旧文件删除加 try-catch 容错
- **修改** `lib/i18n.ts` — 新增 6 个 i18n keys（friend.alreadyFriends/alreadyPending/sendFailed/requestSent, profile.saveFailed/uploadFailed）
- **修改** `components/ProfileEditModal.tsx` — 硬编码错误 toast 替换为 i18n `t()` 调用
- **修改** `components/chat/AddFriendModal.tsx` — 重复请求错误处理 + 硬编码 toast 替换为 i18n
- **修改** `components/pages/ChatPage.tsx` — 群聊非己方消息前增加 24px 发送者头像

### 头像点击预览放大功能（Task72）

- **新建** `components/AvatarPreviewModal.tsx` — 全屏头像预览弹窗（遮罩+大图+fade/scale 动画+ESC/点击关闭）
- **修改** `components/UserAvatar.tsx` — 新增可选 `onPreview` prop，仅真实头像时可点击（stopPropagation）
- **修改** `components/pages/ChatPage.tsx` — 聊天列表和聊天详情顶栏头像支持点击预览
- **修改** `components/chat/ChatRequestCard.tsx` — 好友请求卡片头像支持点击预览
- **更新** `specs/structure.md` — 新增 AvatarPreviewModal.tsx 文件条目
- **更新** `frontend/CLAUDE.md` — 映射表新增 AvatarPreviewModal

### OTA 热更新实现（Task70）

- **新建** `lib/ota-version.ts` — 导出 `BUNDLE_VERSION` 常量，OTA 版本比对用
- **新建** `lib/use-ota-updater.ts` — OTA 热更新核心逻辑（`runOtaUpdate` + `useOtaUpdater` hook），支持平台门控、3次重试、bundle 验证、回滚保护
- **修改** `lib/store.ts` — 新增 `otaProgress`/`otaDone` 状态及 `setOtaProgress`/`setOtaDone` actions
- **修改** `app/page.tsx` — 顶部集成 `useOtaUpdater()` hook
- **更新** `specs/tech.md` §6.5 — 新增 OTA 热更新说明
- **更新** `specs/structure.md` — 新增 `ota-version.ts`、`use-ota-updater.ts`、`use-ota-updater.test.ts` 文件
- **更新** `frontend/CLAUDE.md` — 代码-规范映射表新增 OTA 文件条目

### 好友权限功能实现（Task68/69）

- **修改** `lib/profile.ts` — 新增 `FriendPermission` 类型、`parseFriendPermission()` 辅助函数、`fetchFriendPermission()` 函数；`ProfileData` 接口新增 `friendPermission` 字段；`fetchProfile/fetchProfiles` 返回 `friendPermission`；`upsertProfile` 支持 `friend_permission` 参数
- **修改** `lib/chat.ts` — 新增 `FriendPermissionError` 自定义错误类；`sendFriendRequest()` 增加权限检查逻辑（reject_all 抛错、allow_all 直接 accepted、approve_required 保持 pending）
- **修改** `lib/store.ts` — 新增 `updateFriendPermission` action；`sendFriendRequest` 处理 `{ mode }` 返回值；Realtime contacts INSERT handler 支持 `accepted` 状态分支；Realtime profiles UPDATE handler 传递 `friendPermission`；所有 `myProfile` 构造处补充 `friendPermission` 字段
- **修改** `components/ProfileEditModal.tsx` — 新增隐私设置 Radio 选择区块（选中即保存）
- **修改** `components/chat/AddFriendModal.tsx` — `handleSend` 区分权限拦截（FriendPermissionError）和网络错误
- **修改** `lib/i18n.ts` — 新增 8 个国际化 key（profile.privacySettings, profile.allowAll 等）
- **更新** `specs/product.md` §2.3 — 标记【已实现】
- **更新** `specs/tech.md` §2.1 — 新增 profiles 表文档

### 个人资料功能实现（Task67）

- **新建** `lib/profile.ts` — Profile CRUD + avatar upload（fetchProfile, fetchProfiles, upsertProfile, uploadAvatar, validateAvatarFile）
- **修改** `lib/store.ts` — 新增 myProfile/profileCache 状态 + loadMyProfile/updateNickname/updateAvatar/loadProfiles/getDisplayName/getAvatarUrl actions；initChat 中加载 profile；logout 清空 profile 状态；Realtime 订阅增加 profiles 表 UPDATE 监听
- **新建** `components/UserAvatar.tsx` — 通用头像组件（支持 sm/md/lg 尺寸，有图片显示图片，无图片显示 addressToColor 色块+首字母）
- **新建** `components/ProfileEditModal.tsx` — 个人资料编辑弹窗（头像上传 + 昵称修改 + 钱包地址展示）
- **修改** `components/SidebarNav.tsx` — 底部用户区域使用 UserAvatar + getDisplayName，点击打开 ProfileEditModal
- **修改** `components/TopBar.tsx` — 移动端左侧添加头像按钮，点击打开 ProfileEditModal
- **修改** `components/pages/ChatPage.tsx` — 聊天列表和详情页使用 UserAvatar + getDisplayName 替换硬编码截断地址
- **修改** `components/chat/ChatRequestCard.tsx` — 好友请求卡片使用 UserAvatar + getDisplayName
- **修改** `lib/i18n.ts` — 新增 profile.* 国际化 key（中/英各 13 条）
- **新建** `lib/__tests__/profile.test.ts` — Profile 模块单元测试

**Supabase Dashboard 手动操作（需用户执行）**：
- 创建 `profiles` 表（见 plans/task66-profile-feature-plan.md §7.1）
- 配置 RLS 策略（见 §7.2）
- 创建 `avatars` Storage bucket（public，2MB 限制，见 §7.3）

### 文档体系初始化（Task65）

- **新建** `specs/product.md` — 产品功能全书（§1-§11 全部章节）
- **新建** `specs/tech.md` — 技术架构规范（§1-§8 全部章节）
- **新建** `specs/structure.md` — 项目结构规范（§1-§6 全部章节）
- **新建** `specs/CHANGELOG.md` — 本文件

**信息来源**：代码溯源（优先级最高）+ V1.0 需求文档 + 旧 specs 文档参考

**溯源代码文件**：
- `lib/chat.ts`, `lib/store.ts`, `lib/walletCrypto.ts`, `lib/wagmi.ts`
- `lib/supabaseClient.ts`, `lib/soundPlayer.ts`, `lib/i18n.ts`, `lib/debugLogger.ts`
- `components/pages/*.tsx` (5 pages), `components/chat/*.tsx` (5 files)
- `components/login/LoginApp.tsx`, `app/login/page.tsx`
- `hooks/use-mobile.tsx`, `hooks/use-toast.ts`
