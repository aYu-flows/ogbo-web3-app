# OGBOX 变更日志

所有 Steering 文档（product.md、tech.md、structure.md）的变更记录。

---

## 2026-03-08

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
