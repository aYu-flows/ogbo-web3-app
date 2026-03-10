# OGBOX 变更日志

所有 Steering 文档（product.md、tech.md、structure.md）的变更记录。

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
