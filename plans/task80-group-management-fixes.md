# Task80: 群管理功能Bug修复与优化

## 一、任务描述

修复群管理功能的 16 个已知问题，并彻底解决项目中系统性的中文输入法(IME)兼容性问题。同时设计群管理功能的全面自动化测试方案。

### 问题清单

| # | 问题 | 严重性 | 类别 |
|---|------|--------|------|
| 1 | 普通成员无法邀请好友入群（UI层未开放） | 功能缺失 | 权限 |
| 2 | 昵称输入中文后保存会先删除框内中文内容 | 体验严重 | IME |
| 3 | 添加好友输入中文不触发搜索 | 功能缺陷 | IME |
| 4 | 群聊详情页应支持点击群标题/群头像唤起 | 体验缺陷 | UI |
| 5 | 群昵称输入中文默认会消失不保存 | 功能缺陷 | IME |
| 6 | 群公告输入中文内容会退回消失 | 功能缺陷 | IME |
| 7 | 群公告保存后仍显示"暂无公告"需重新进入 | 功能缺陷 | 状态同步 |
| 8 | 群邀请链接有效期选择器UI太丑 | 体验缺陷 | UI |
| 9 | 好友入群后仍在可邀请列表中 | 状态同步 | 数据 |
| 10 | 群管理页面UI应沿用项目浅色主题 | 视觉不一致 | UI |
| 11 | 群公告弹出窗缺少确认关闭按钮 | 体验缺陷 | UI |
| 12 | 群公告未修改时应一天只弹出一次 | 体验缺陷 | 逻辑 |
| 13 | 群聊右上方"拨打电话"图标应去除 | 冗余UI | UI |
| 14 | 群头像设置功能（管理员及群主） | 功能缺失 | 新功能 |
| 15 | 搜索群成员中文输入感知问题 | 功能缺陷 | IME |
| 16 | 全员禁言开关状态不更新 | 功能缺陷 | 状态同步 |

---

## 二、实现 Checklist

> 执行主体标注：🤖 = AI 执行，👤 = 用户手动执行
> 并行提示：标注 `[可并行]` 的项可与同阶段其他 `[可并行]` 项同时执行

---

### 阶段 1：Supabase 数据库 & Storage 变更 🤖

- [x] 1.1 🤖 通过 Supabase REST API（service_role key）执行 `ALTER TABLE groups ADD COLUMN avatar_url text;`
- [x] 1.2 🤖 通过 Supabase Management API（access_token）创建 `group-avatars` Storage bucket（public，2MB 限制，允许 image/* 类型）

---

### 阶段 2：核心 Hook & 工具模块 🤖

- [x] 2.1 🤖 `[可并行]` 新建 `hooks/use-ime-input.ts`：增强版 IME 输入 Hook（§3.1）
  - 封装 `isComposingRef` 状态跟踪（onCompositionStart/End）
  - 提供 `compositionEndCount` state 强制触发 effect（解决 Android Chrome 竞态）
  - 提供 `getInputProps({ onEnter?, onChange? })` 返回统一事件 handlers
  - Enter 键自动 composition guard
  - 导出 `deferredValue`（composition 结束后才更新的值）用于搜索场景
  - 单元测试：`hooks/__tests__/use-ime-input.test.ts`

- [x] 2.2 🤖 `[可并行]` 修改 `lib/group-management.ts`：群头像功能（§3.11）
  - 新增 `uploadGroupAvatar(groupId, file)` 函数（上传到 `group-avatars` bucket，UUID 文件名）
  - 新增 `updateGroupAvatar(groupId, avatarUrl)` 函数（更新 groups.avatar_url）
  - 新增文件验证：类型白名单（jpg/png/gif/webp）、大小 ≤ 2MB
  - `GroupDetail` 接口新增 `avatar_url: string | null`
  - `fetchGroupDetail` 查询新增 `avatar_url` 字段

- [x] 2.3 🤖 `[可并行]` 修改 `lib/i18n.ts`：新增所有 i18n key
  - 群头像相关：`group.avatar`、`group.changeAvatar`、`group.avatarUpdated`、`group.avatarError`
  - 公告确认按钮：`group.confirmAnnouncement`（确认/Confirm）
  - 邀请（成员）：`group.invitePending`（邀请已提交，等待审批）

---

### 阶段 3：Store 状态管理修复 🤖

> 依赖阶段 2 完成

- [x] 3.1 🤖 修改 `lib/store.ts`：新增 `activeGroupDetail` 状态与管理
  - 新增 state 字段 `activeGroupDetail: Record<string, GroupDetail>`，初始值 `{}`
  - 修改 `openGroupManagement`：fetch 后同时存入 `activeGroupDetail[groupId]`
  - 新增 `patchActiveGroupDetail(groupId, patch)` 辅助 action：局部更新缓存
  - 修改 `refreshGroupDetail`：fetch 后更新 `activeGroupDetail[groupId]` + `chats[]`

- [x] 3.2 🤖 修改 `lib/store.ts`：所有群管理 action 更新 activeGroupDetail
  - `updateGroupNameAction`：成功后 patch `activeGroupDetail[id].name`
  - `setAnnouncementAction`：成功后 patch `activeGroupDetail[id].announcement/announcement_at/announcement_by`
  - `toggleMuteAll`：成功后 patch `activeGroupDetail[id].mute_all` + 添加 `set()` 调用
  - `toggleInviteApproval`：成功后 patch + 批量 approve 后重置 `pendingRequestCounts[id] = 0`
  - `updateJoinMode`：成功后 patch `activeGroupDetail[id].join_mode`
  - `setAdmin`/`unsetAdmin`：成功后 patch `activeGroupDetail[id].admins`
  - `kickMember`：成功后 patch `activeGroupDetail[id].members`
  - `inviteFriendsToGroupAction`：成功后 refresh `activeGroupDetail[id]`（成员可能变化）
  - `transferGroupOwnership`：成功后 refresh `activeGroupDetail[id]`
  - `dissolveGroupAction`：成功后删除 `activeGroupDetail[id]`
  - `leaveGroupAction`：成功后删除 `activeGroupDetail[id]`

- [x] 3.3 🤖 修改 `lib/store.ts`：新增 `updateGroupAvatarAction`
  - 调用 `uploadGroupAvatar` + `updateGroupAvatar`
  - 成功后 patch `activeGroupDetail[id].avatar_url`
  - 更新 `chats[].groupAvatarUrl`

- [x] 3.4 🤖 修改 `lib/store.ts`：Realtime groups UPDATE handler 扩展
  - 除更新 `chats[].name` 和 `members` 外，新增更新 `chats[].groupAvatarUrl`
  - 同步更新 `activeGroupDetail[id]` 中所有字段（name, members, admins, announcement, mute_all, join_mode, invite_approval, avatar_url）

- [x] 3.5 🤖 修改 `lib/store.ts`：Chat 接口新增 `groupAvatarUrl`
  - `Chat` 类型新增可选字段 `groupAvatarUrl?: string`
  - `groupToChat` 函数从 groups 表读取 `avatar_url` 写入 `Chat.groupAvatarUrl`

- [x] 3.6 🤖 修改 `lib/store.ts`：修复 `markAnnouncementRead`
  - 确保同时更新 Supabase DB + Zustand `myGroupSettings[groupId].last_read_announcement_at`

---

### 阶段 4：UI 组件修复 🤖

> 依赖阶段 3 完成，4A-4I 之间无依赖可并行

#### 4A. GroupInfoPanel.tsx 全面修复 `[可并行]`
- [x] 4A.1 🤖 **浅色主题**（#10）：替换所有硬编码深色样式为主题变量
  - `bg-[#1a1a2e]` → `bg-card`
  - `border-white/10` → `border-border`
  - `text-white` → `text-foreground`
  - `text-white/60`、`text-white/50` → `text-muted-foreground`
  - `bg-white/5`、`bg-white/10` → `bg-muted`
  - `hover:bg-white/10` → `hover:bg-muted`
  - 保留固定颜色：群主金色皇冠、管理员蓝色盾牌、退出/解散红色按钮
- [x] 4A.2 🤖 **群头像上传**（#14）：管理员/群主可点击群头像 → 弹出文件选择 → 上传 → 显示
  - 有 avatar_url 时显示 `<img>`，否则 fallback 首字母+颜色
  - 添加 loading 态 + onError fallback
- [x] 4A.3 🤖 **群名 IME 修复**（#2）：使用 `useIMEInput` hook
  - 添加完整 `onCompositionStart`/`onCompositionEnd`
  - Enter handler 添加 composition guard
  - onBlur 保存使用 DOM ref 兜底读取值
- [x] 4A.4 🤖 **群昵称 IME 修复**（#5）：同群名修复
- [x] 4A.5 🤖 **邀请好友按钮开放给所有成员**（#1）：将按钮从 isAdminOrOwner 块移到所有角色可见区域
- [x] 4A.6 🤖 **读取 groupDetail 从 store**：改为 `useStore(s => s.activeGroupDetail[groupId])`，删除独立的 `useState` + `useEffect` fetch

#### 4B. GroupAnnouncementModal.tsx 修复 `[可并行]`
- [x] 4B.1 🤖 **添加确认按钮**（#11）：查看模式底部添加"确认"按钮（所有角色可见），管理员/群主同时显示"编辑"+"确认"
- [x] 4B.2 🤖 **确认按钮点击**：关闭弹窗 + 调用 store `markAnnouncementRead(groupId)`
- [x] 4B.3 🤖 **公告 textarea IME 修复**（#6）：使用 `useIMEInput`，maxLength 仅在非 composition 期间检查
- [x] 4B.4 🤖 **公告保存后状态同步**（#7）：handleSave 成功后调用 `patchActiveGroupDetail` 更新公告字段

#### 4C. ChatPage.tsx 修复 `[可并行]`
- [x] 4C.1 🤖 **去除电话图标**（#13）：移除群聊头部 `<Phone>` 图标按钮
- [x] 4C.2 🤖 **群标题/头像点击唤起群信息**（#4）：为群头像和标题添加 onClick → setGroupInfoOpen(true)
- [x] 4C.3 🤖 **公告自动弹出**（#12）：进入群聊时自动加载 groupDetail（从 store cache 或 fetch）→ 检查 isUnread → 弹出
- [x] 4C.4 🤖 **传递 isUnread prop 给 GroupAnnouncementModal**：计算 `isUnread = announcement_at > last_read_announcement_at`
- [x] 4C.5 🤖 **群头像显示**（#14）：聊天列表 + 聊天头部使用 `chat.groupAvatarUrl`（有值显示图片，否则 fallback）
- [x] 4C.6 🤖 **聊天列表搜索 IME 修复**：使用 `useIMEInput` 的 `deferredValue`
- [x] 4C.7 🤖 **读取 groupDetail 从 store**：删除本地 `useState<GroupDetail>`，改为 `useStore(s => s.activeGroupDetail[chat.id])`

#### 4D. GroupSettingsPanel.tsx 修复 `[可并行]`
- [x] 4D.1 🤖 **mute_all Switch 修复**（#16）：使用本地 state `localMuteAll`（初始从 groupDetail 读取）
- [x] 4D.2 🤖 **Switch checked 绑定 localMuteAll**：toggle 成功后 `setLocalMuteAll(checked)` + 调用 store `toggleMuteAll`
- [x] 4D.3 🤖 同理修复 join_mode、invite_approval 使用本地 state 管理（避免同类问题）

#### 4E. GroupInviteModal.tsx 修复 `[可并行]`
- [x] 4E.1 🤖 **有效期选择器 UI 优化**（#8）：替换 `<select>` 为自定义 RadioGroup（圆角卡片垂直单选列表）
- [x] 4E.2 🤖 选项：1天 / 7天 / 30天 / 永不过期，默认 7天
- [x] 4E.3 🤖 样式使用 `bg-card`/`border-border`/主题色，与 MuteMemberModal 风格一致

#### 4F. InviteFriendsToGroupModal.tsx 修复 `[可并行]`
- [x] 4F.1 🤖 **搜索框 IME 修复**（#15 关联）：使用 `useIMEInput` 的 `deferredValue`
- [x] 4F.2 🤖 **成员列表实时刷新**（#9）：邀请成功后调用 `refreshGroupDetail` → 下次打开 modal 自动排除新成员

#### 4G. GroupMemberList.tsx 修复 `[可并行]`
- [x] 4G.1 🤖 **搜索框 IME 修复**（#15）：使用 `useIMEInput` 的 `deferredValue`

#### 4H. CreateGroupModal.tsx 修复 `[可并行]`
- [x] 4H.1 🤖 **群名输入 IME 修复**：使用 `useIMEInput` + Enter guard
- [x] 4H.2 🤖 **好友搜索 IME 修复**：使用 `deferredValue`

#### 4I. AddFriendModal.tsx 修复 `[可并行]`
- [x] 4I.1 🤖 **Android 竞态修复**（#3）：替换 `useIMEComposition` 为 `useIMEInput`
- [x] 4I.2 🤖 搜索 `useEffect` 依赖改为 `[deferredValue, compositionEndCount]`，解决 Android 上 compositionEnd 后 state 相同导致 effect 不触发的问题

#### 4J. MarketPage.tsx + DiscoverPage.tsx IME 修复 `[可并行]`
- [x] 4J.1 🤖 `MarketPage.tsx` 行情搜索框：使用 `useIMEInput` 的 `deferredValue`
- [x] 4J.2 🤖 `DiscoverPage.tsx` DApp 搜索框：使用 `useIMEInput` 的 `deferredValue`

---

### 阶段 5：类型检查与验证 🤖

- [x] 5.1 🤖 执行 `cd frontend && npx tsc --noEmit` 确认无 TypeScript 编译错误
- [x] 5.2 🤖 执行 `cd frontend && npx jest --passWithNoTests` 确认单元测试通过
- [x] 5.3 🤖 执行 `git diff --stat` 确认所有变更文件与 checklist 一致

---

### 阶段 6：Steering 文档更新 🤖

- [x] 6.1 🤖 `[可并行]` 更新 `specs/product.md`：群头像设置功能、普通成员邀请、公告确认按钮
- [x] 6.2 🤖 `[可并行]` 更新 `specs/tech.md`：groups 表 avatar_url 字段
- [x] 6.3 🤖 `[可并行]` 更新 `specs/structure.md`：新增 use-ime-input.ts 文件
- [x] 6.4 🤖 `[可并行]` 更新 `frontend/CLAUDE.md`：新增文件映射
- [x] 6.5 🤖 更新 `specs/CHANGELOG.md`：记录 Task80 变更

---

## 三、根因分析与修复方案

### 3.1 IME中文输入系统性修复（问题 #2, #3, #5, #6, #15 + 全局）

**根因分析：**

项目中存在两类 IME 问题模式：

**模式A — Enter 键在 composition 期间误触发操作（高严重性）**
- `GroupInfoPanel.tsx` 群名和群昵称输入的 `onKeyDown` handler 在 Enter 时调用 save 函数，但未检查 `isComposing` 状态
- 中文拼音输入时用户按 Enter 选择候选字，会误触发保存，保存不完整的文本
- 涉及文件：`GroupInfoPanel.tsx`

**模式B — 实时过滤在 composition 期间产生错误结果（中严重性）**
- 搜索输入框直接用 `onChange` 更新 state 驱动 `useMemo` 过滤
- composition 期间的拼音中间态字符导致过滤结果闪烁/清空
- 涉及文件：`GroupMemberList.tsx`、`InviteFriendsToGroupModal.tsx`、`CreateGroupModal.tsx`、`GroupAnnouncementModal.tsx`、`ChatPage.tsx`(聊天列表搜索)

**模式C — maxLength 在 composition 期间阻止输入（低-中严重性）**
- `GroupAnnouncementModal.tsx` 在 `onChange` 中检查 `length <= MAX_ANNOUNCEMENT_LENGTH`
- composition 期间浏览器插入的占位字符计入长度，可能在接近限制时错误阻止输入

**模式D — Android Chrome compositionEnd 事件顺序竞态（高严重性，AddFriendModal #3）**
- Task78 已为 `AddFriendModal.tsx` 添加了 `useIMEComposition` hook + `isComposingRef` guard
- 但在 Android Chrome（即 Capacitor WebView）中事件顺序为：`onChange` → `compositionEnd`（桌面端为 `compositionEnd` → `onChange`）
- 导致竞态：onChange 先触发 → setSearchInput → useEffect 调度 300ms timer → timer 内检查 isComposingRef 仍为 true（compositionEnd 尚未触发）→ 搜索被阻止
- 然后 compositionEnd 触发 → ref 设为 false → setSearchInput(同一值) → React 跳过相同值的 state 更新 → useEffect 不重新执行 → 新 timer 永远不被调度 → **搜索永远不触发**
- 涉及文件：`AddFriendModal.tsx`

**系统性修复方案：**

1. 创建增强版 IME Hook `hooks/use-ime-input.ts`，统一处理所有 IME 相关逻辑：
   - 封装 `isComposing` ref 状态跟踪
   - 提供 `getInputProps(options)` 返回统一的 `onCompositionStart`、`onCompositionEnd`、`onKeyDown` 包装
   - 对 Enter 键自动添加 composition guard
   - 对 search 输入提供 deferred 值（composition 结束后才更新搜索关键词）
   - **关键设计**：`onCompositionEnd` 中使用强制触发机制（composition 结束计数器 `compositionEndCount` state），确保即使 value 相同也能触发下游 effect。解决 Android Chrome 事件顺序问题

2. 为**所有**项目中需要 IME 兼容的输入使用 `useIMEInput` hook（全局修复，不仅限于群管理）：
   - **GroupInfoPanel.tsx** 群名输入 + 群昵称输入：添加 composition 完整处理 + Enter guard
   - **GroupMemberList.tsx** 搜索框：使用 deferredSearchQuery（composition 完成后才过滤）
   - **InviteFriendsToGroupModal.tsx** 搜索框：同上
   - **GroupAnnouncementModal.tsx** 公告 textarea：添加 composition 处理 + maxLength 仅在非 composition 期间检查
   - **CreateGroupModal.tsx** 群名输入 + 好友搜索：同上
   - **ChatPage.tsx** 聊天列表搜索框：同上
   - **AddFriendModal.tsx** 搜索框：替换现有 useIMEComposition 为 useIMEInput，彻底修复 Android 竞态
   - **MarketPage.tsx** 行情搜索框：添加 IME 处理
   - **DiscoverPage.tsx** DApp 搜索框：添加 IME 处理

3. 旧 hook `hooks/use-ime-composition.ts` 保留但标记为 deprecated（ProfileEditModal 和 ChatPage 主输入可后续迁移）

### 3.2 普通成员邀请好友入群（问题 #1）

**根因：** `GroupInfoPanel.tsx` 中"邀请好友"按钮仅在 `isAdminOrOwner` 代码块中渲染，普通成员在 UI 层看不到此按钮。后端 `inviteFriendsToGroupAction` 已实现成员邀请（带审批流程），但 UI 层未开放。

**修复方案：**
1. 将"邀请好友"按钮从 `isAdminOrOwner` 块移到所有角色可见区域
2. 按权限差异化处理：
   - 群主/管理员邀请：needApproval = false，直接加入
   - 普通成员邀请：needApproval = detail.invite_approval（根据群设置）
3. 当普通成员邀请且群设置需审批时，toast 提示"邀请已提交，等待审批"

### 3.3 群聊详情页标题/头像点击唤起（问题 #4）

**根因：** `ChatPage.tsx` 中群聊头部的头像 `<div>` 和标题 `<div>` 没有 `onClick` handler，仅三点按钮触发 `setGroupInfoOpen(true)`。

**修复方案：**
1. 为群聊头部的头像区域和标题区域添加 `onClick` → 触发 `setGroupInfoOpen(true)` + `openGroupManagement`
2. 添加 `cursor-pointer` 样式提示可点击
3. 仅群聊类型时生效（个人聊天保持头像预览功能不变）

### 3.4 群公告状态同步问题（问题 #7）+ 公告弹出修复（问题 #11, #12）

**根因分析（3个独立bug叠加）：**

**Bug A — groupDetail 从不在进入群聊时加载：**
- `ChatPage.ChatDetail` 中 `groupDetail` 是 `useState<GroupDetail | null>(null)` 本地状态
- 仅在点击三点按钮时通过 `openGroupManagement(chat.id).then(d => setGroupDetail(d))` 填充
- 进入群聊时 `groupDetail === null`，公告弹出 useEffect 的 guard 直接 return
- 结果：公告永远不会在进入群聊时自动弹出

**Bug B — isUnread prop 从未传递给 GroupAnnouncementModal：**
- ChatPage 渲染 `<GroupAnnouncementModal .../>` 时完全省略了 `isUnread` prop（始终为 undefined/falsy）
- 导致 modal 内部的"新公告"角标永远不显示
- `handleClose` 中的 `updateMyGroupSettings`（标记已读）永远不执行（被 `if (isUnread && ...)` guard 阻止）

**Bug C — handleClose 绕过 store 直接调用 updateMyGroupSettings：**
- 即使 isUnread 被正确传递，`handleClose` 直接调用 `updateMyGroupSettings`（从 group-management.ts），不通过 store 的 `markAnnouncementRead` action
- 结果：Supabase DB 更新了，但 Zustand store 中 `myGroupSettings[groupId].last_read_announcement_at` 未更新
- 同一会话内再次检查 isUnread 仍然为 true

**Bug D — 公告保存后 groupDetail 不刷新（问题 #7 具体根因）：**
- 保存公告调用 `setGroupAnnouncement` → DB 更新成功
- 但 `GroupAnnouncementModal` 关闭编辑模式后，显示的 `groupDetail.announcement` 仍是旧值
- `GroupInfoPanel` 公告预览也是旧值
- 因为 groupDetail 是 ChatPage 的 stale 本地 state

**系统性修复方案：**

1. **在 store 中新增 `activeGroupDetail: Record<string, GroupDetail>` 缓存**：
   - 所有群管理操作（公告保存、设置变更、成员变更等）成功后同步更新此缓存
   - Realtime groups UPDATE handler 也更新此缓存
   - 所有引用 groupDetail 的 UI 组件从 store 读取

2. **进入群聊时自动加载 groupDetail：**
   - ChatDetail 新增 useEffect：当 `chat.type === 'group'` 时自动调用 `openGroupManagement(chat.id)` 并存入 store cache
   - 使用 store cache 避免重复请求（缓存存在且非 stale 时跳过网络请求）

3. **修复 isUnread 传递：**
   - ChatPage 计算 `isUnread = groupDetail.announcement_at > myGroupSettings[chat.id].last_read_announcement_at` 并传递给 GroupAnnouncementModal

4. **修复 handleClose 使用 store action：**
   - GroupAnnouncementModal 的 `handleClose` 改为调用 store 的 `markAnnouncementRead(groupId)`
   - 同时更新 DB + Zustand state

5. **公告保存后刷新 groupDetail：**
   - `handleSave` 成功后调用 store 的 `refreshGroupDetailCache(groupId)` 更新缓存
   - 或直接 patch store 中对应 groupDetail 的 announcement 字段（更快，无网络请求）

### 3.5 群邀请链接有效期选择器 UI 优化（问题 #8）

**根因：** 使用原生 `<select>` HTML 元素，在 Android WebView/Capacitor 中渲染为系统原生下拉，与项目自定义 UI 组件（RadioGroup/Switch）风格不一致。

**修复方案：**
将 `<select>` 替换为自定义 RadioGroup 组件（与 `MuteMemberModal.tsx` 的禁言时长选择器风格一致）：
- 圆角卡片内的垂直单选列表
- 选项：1天 / 7天 / 30天 / 永不过期
- 默认选中 7天
- 使用项目主题色（`bg-card`、`border-border`）

### 3.6 好友入群后仍在可邀请列表（问题 #9）

**根因：** `InviteFriendsToGroupModal` 的 `existingMembers` prop 来自 ChatPage 的 `groupDetail?.members`，这是在打开群信息面板时获取的快照。邀请成功后 `groupDetail` 未刷新，导致新成员未从列表中过滤。

**修复方案：**
1. `inviteFriendsToGroupAction` 成功后，刷新 `groupDetail`（调用 `refreshGroupDetail`）
2. `InviteFriendsToGroupModal` 在 `open` 时重新获取最新成员列表（而非依赖 stale prop）
3. 成功邀请后关闭弹窗，下次打开自动获取最新数据

### 3.7 群管理页面 UI 浅色主题（问题 #10）

**根因：** `GroupInfoPanel.tsx` 使用硬编码的深色背景 `bg-[#1a1a2e]`、`border-white/10`、`text-white` 等，而其他子面板（GroupSettingsPanel、GroupAnnouncementModal 等）使用 `bg-card`/`border-border` 跟随系统主题。

**修复方案：**
将 `GroupInfoPanel.tsx` 中所有硬编码深色样式替换为项目主题变量：
- `bg-[#1a1a2e]` → `bg-card` / `bg-background`
- `border-white/10` → `border-border`
- `text-white` → `text-foreground`
- `text-white/60` → `text-muted-foreground`
- `text-white/50` → `text-muted-foreground`
- `text-white/30` → `text-muted-foreground/50`
- `bg-white/5` → `bg-muted`
- `bg-white/10` → `bg-muted`
- `hover:bg-white/10` → `hover:bg-muted`
保持与子面板一致的浅色主题风格，同时保留高质量和细节质感（圆角、间距、分隔线等）。

### 3.8 群公告确认按钮（问题 #11）

**根因：** `GroupAnnouncementModal` 在查看模式只有"编辑"按钮（仅管理员/群主可见），普通成员和管理员阅读公告后只能通过点击非当前区域关闭弹窗。

**修复方案：**
1. 在查看模式底部添加"确认"按钮（所有角色可见）
2. 点击"确认"关闭弹窗 + 调用 `markAnnouncementRead` 标记已读
3. 管理员/群主同时显示"确认"和"编辑"两个按钮（编辑在左，确认在右）

### 3.9 群公告仅未读时弹出一次（问题 #12）

**根因：** 当前公告弹出逻辑仅检查 `last_read_announcement_at < announcement_at`，但依赖 `groupDetail` 加载（需先点击三点按钮），无法在进入群聊时自动弹出。另外 `isUnread` prop 从未传递给 `GroupAnnouncementModal`，导致已读标记逻辑是死代码。

**用户明确要求：** 相同的群公告只在未读时弹出**唯一一次**（用户点击"确认"后标记为已读，此后不再自动弹出）。用户可以在群资料详情页面手动点击公告再次查看。

**修复方案：**
1. 进入群聊详情时自动加载 groupDetail（不仅限于点击三点按钮时）
2. 公告自动弹出条件：
   - `groupDetail.announcement` 存在
   - `groupDetail.announcement_at > myGroupSettings[groupId].last_read_announcement_at`（即用户未读过此版本的公告）
   - 弹出一次后用户点击"确认"→ 调用 `markAnnouncementRead` 更新 `last_read_announcement_at` 为当前时间
   - 此后同版本公告不再自动弹出
3. 如果公告被管理员更新（`announcement_at` 变化）→ 再次触发弹出（因为 `announcement_at > last_read_announcement_at`）
4. 正确传递 `isUnread` prop 给 `GroupAnnouncementModal`，激活已有的已读标记逻辑

### 3.10 去除群聊电话图标（问题 #13）

**根因：** `ChatPage.tsx` 群聊头部有一个 `<Phone>` 图标按钮，没有 `onClick` handler，是冗余 UI。

**修复方案：**
移除群聊时的电话图标按钮。仅在群聊类型时隐藏（若个人聊天需要保留则保留，根据当前代码分析个人聊天也没有电话功能，一并移除）。

### 3.11 群头像设置功能（问题 #14）

**根因：** 群头像功能完全未实现。`groups` 表无 `avatar_url` 字段，UI 仅显示基于群名首字母/颜色的默认头像。

**修复方案：**

1. **数据库变更**（AI 通过 Supabase REST API 使用 service_role key 执行）：
   - `ALTER TABLE groups ADD COLUMN avatar_url text;`

2. **lib/group-management.ts 新增函数：**
   - `uploadGroupAvatar(groupId: string, file: File): Promise<string>` — 上传群头像到 Supabase Storage `group-avatars` bucket，返回 public URL
   - `updateGroupAvatar(groupId: string, avatarUrl: string): Promise<void>` — 更新 `groups.avatar_url`
   - 验证：文件类型（jpg/png/gif/webp）、大小（≤2MB）

3. **store.ts 新增 action：**
   - `updateGroupAvatarAction(groupId: string, file: File)` — 上传 + 更新 + 刷新本地状态

4. **GroupDetail 类型扩展：**
   - 新增 `avatar_url: string | null` 字段

5. **UI 变更：**
   - `GroupInfoPanel.tsx` 群头像区域：管理员/群主可点击更换
   - 点击后弹出文件选择（图片）
   - 上传成功后立即更新显示
   - 聊天列表 + 聊天头部也使用群头像（若有）

6. **Supabase Storage 配置**（AI 通过 Supabase Management API 执行）：
   - 创建 `group-avatars` bucket（public，2MB限制）

### 3.12 全员禁言开关状态不更新（问题 #16）

**根因分析（精确溯源）：**
1. `GroupSettingsPanel` 的 Switch 的 `checked` 值读取 `currentMuteAll = groupDetail?.mute_all ?? false`（直接从 prop 派生的常量，**无本地 useState**）
2. `handleMuteAllToggle` 直接调用 `updateGroupSettings(groupId, { mute_all: checked })`（从 group-management.ts，**不通过 store**）
3. DB 更新成功后，仅显示 toast 和清除 loading。**没有任何状态更新操作**
4. `groupDetail` prop 来自 ChatPage 的 `useState`，在三点按钮点击时获取的快照，**永远不刷新**
5. Switch 在下次 render 时仍读取 `groupDetail?.mute_all`（旧值），**视觉上 Switch 弹回原位**
6. store.ts 中 `toggleMuteAll` action 存在但**从未被 GroupSettingsPanel 调用**（该 action 也不更新 store state）

**修复方案（结合 3.4 的系统性方案）：**
1. `GroupSettingsPanel` 改用本地 state：`const [localMuteAll, setLocalMuteAll] = useState(groupDetail?.mute_all ?? false)`
2. Switch 的 `checked` 绑定到 `localMuteAll`
3. `handleMuteAllToggle` 成功后：
   - 更新 `setLocalMuteAll(checked)`（立即视觉反馈）
   - 调用 store 的 `toggleMuteAll(groupId)` 发送系统消息
   - 更新 store 中 `activeGroupDetail[groupId].mute_all`（让其他组件也能读取最新值）
4. 同时修复 store 的 `toggleMuteAll` action：添加 `set()` 调用更新 `activeGroupDetail` 缓存

---

## 四、隐性需求审计（第1轮 — 问题视角）

### 4.1 体验闭环与状态反馈 (UX & Flow)

**【P0】关键体验闭环**

1. **IME 修复后的保存反馈**：群名/群昵称修改成功后应有 toast 反馈（当前已有），但需确保 IME 修复不影响此反馈流程
2. **群公告保存后状态实时更新**：保存 → 退出编辑模式 → 查看模式立即显示新公告内容 → GroupInfoPanel 公告预览也同步更新
3. **邀请好友后的列表刷新**：成功邀请 → 关闭弹窗 → 下次打开弹窗自动排除已邀请成员
4. **全员禁言开关即时反馈**：toggle 切换 → 显示 loading → 成功后 Switch 状态更新 → toast 提示

**【P1】体验增强**

5. **群头像上传进度**：大图上传时显示进度/loading 态
6. **群头像裁剪**：考虑到 V1.0 scope，暂不做裁剪，直接上传（与个人头像一致）
7. **公告弹出的过渡动画**：公告弹窗应有平滑的入场动画（当前 Drawer 已有）

### 4.2 异常拦截与边界防御 (Edge Cases)

**【P0】关键防御**

1. **群头像上传失败回退**：上传/更新失败时恢复原头像显示，不显示损坏图标
2. **群头像文件验证**：严格检查文件类型和大小，超限时清晰提示用户
3. **IME composition 异步竞态**：composition 结束后的 setTimeout(0) 延迟处理需确保不会与后续 Enter 事件冲突
4. **公告弹出 localStorage 损坏**：localStorage 读写异常时 fallback 为"每次弹出"（不阻塞功能）

**【P1】次要防御**

5. **群头像 URL 加载失败**：头像 URL 404 时 fallback 到首字母+颜色默认头像（`onError` handler）
6. **公告超长文本渲染性能**：500字公告在弹窗中渲染无性能问题（已有 maxLength 限制）

### 4.3 全局系统联动 (System Interaction)

**【P0】必要联动**

1. **群头像 → 聊天列表联动**：群头像更新后，聊天列表中该群的头像需同步更新（通过 Realtime groups UPDATE）
2. **群头像 → 群消息气泡联动**：群聊中群头像的展示（目前群消息不显示群头像，只显示发送者头像，无需联动）
3. **IME 修复 → 全项目联动**：创建增强版 Hook 后，确保不影响已正确工作的输入框（ChatPage 主输入、ProfileEditModal、AddFriendModal）
4. **groupDetail 刷新 → 所有子组件联动**：refreshGroupDetail 后所有引用 groupDetail 的子组件都应获取最新数据

**【P1】可选联动**

5. **群头像 → 系统消息**：管理员更换群头像时是否需要发送系统消息？建议暂不需要（与修改群名保持差异化）

### 4.4 安全、合规与风控 (Security)

**【P0】必要安全措施**

1. **群头像上传安全**：
   - 文件类型白名单验证（客户端 + Storage policy）
   - 文件大小限制 2MB
   - 文件名重命名为 UUID（防注入）
2. **IME 修复不引入 XSS**：确保所有输入值经过 React 默认转义，不使用 dangerouslySetInnerHTML

### 4.5 跨端兼容性 (Cross-Platform)

**【P0】关键兼容**

1. **IME composition 事件在 Android WebView 中的行为**：Android WebView (Capacitor) 中 compositionEnd 可能晚于 keydown Enter 事件，需要 setTimeout(0) 延迟处理
2. **群头像文件选择 Capacitor 兼容**：在原生端使用 `<input type="file" accept="image/*">` 可以触发相机/相册选择（与个人头像一致）
3. **有效期选择器 RadioGroup 触控兼容**：确保在移动端触控交互正常（使用已验证的 RadioGroup 组件）

---

## 五、隐性需求审计（第2轮 — 变更视角）

### 5.1 IME Hook 变更影响分析

**变更描述：** 创建新的 `useIMEInput` hook，在多个组件中引入 IME 处理

**影响范围搜索：**
- 被修改的组件：GroupInfoPanel, GroupMemberList, InviteFriendsToGroupModal, GroupAnnouncementModal, CreateGroupModal, ChatPage(聊天列表搜索)
- 不应影响的组件：ChatPage(主输入框 - 已有独立 IME 处理), ProfileEditModal(已修复), AddFriendModal(已修复)
- 现有 `useIMEComposition` hook：保留不修改，已使用它的组件不受影响

**逐一评估：**
1. `GroupInfoPanel` 群名/昵称输入 — 添加 composition guard 到 Enter handler → 不影响非 CJK 用户（Enter 在非 composition 期间行为不变）
2. `GroupMemberList` 搜索 — 使用 deferred search → 非 CJK 用户搜索行为不变（无 composition，值直接更新）
3. `GroupAnnouncementModal` textarea — 添加 composition handlers → 非 CJK 用户无感知
4. `CreateGroupModal` — 同上
5. `InviteFriendsToGroupModal` — 同上

**结论：** 变更对非 CJK 用户无感知影响，风险低。

### 5.2 GroupInfoPanel 主题变更影响分析

**变更描述：** 将硬编码深色样式替换为项目主题变量

**影响范围：**
- GroupInfoPanel 本身的所有 UI 元素（标题、按钮、分隔线、开关等）
- 子组件不受影响（已使用主题变量）

**风险点：**
1. 暗色模式兼容：使用 `bg-card`/`text-foreground` 等主题变量在暗色模式下也能正确显示（项目当前是否支持暗色模式需确认）
2. 角色标签颜色：群主金色皇冠、管理员蓝色盾牌 — 这些是固定颜色不应受主题影响
3. 退出/解散按钮红色 — 保持固定红色不受主题影响

### 5.3 群头像功能变更影响分析

**变更描述：** 新增 groups.avatar_url 字段 + Storage bucket + 上传/显示逻辑

**影响范围搜索需覆盖所有显示群头像的位置：**
1. `ChatPage.tsx` 聊天列表群头像 — 需修改：有 avatar_url 时显示图片，否则 fallback
2. `ChatPage.tsx` 聊天头部群头像 — 需修改：同上
3. `GroupInfoPanel.tsx` 群头像 — 需修改：显示图片 + 管理员/群主可点击更换
4. `GroupMemberList.tsx` — 不需要修改（显示的是成员个人头像，不是群头像）
5. `CreateGroupModal.tsx` — 暂不修改（创建时暂不设置群头像，可后续在群设置中上传）

**Realtime 联动：**
- groups UPDATE 事件中 `avatar_url` 字段变更 → 需在 Realtime handler 中更新 Chat 对象的头像

### 5.4 groupDetail 状态管理变更影响分析

**变更描述：** 新增 store 字段 `activeGroupDetail: Record<string, GroupDetail>`，替代 ChatPage 本地 state

**精确影响分析（经代码溯源确认）：**

| 组件 | 当前数据源 | 迁移策略 |
|------|-----------|---------|
| ChatPage.tsx | `useState<GroupDetail \| null>(null)` 本地 state | 删除本地 state，改为 `useStore(s => s.activeGroupDetail[chat.id])` |
| GroupInfoPanel.tsx | **独立的本地 useState**（自行 fetch，不接收 prop） | 改为读/写 store `activeGroupDetail[groupId]`，包括优化性 name patch |
| GroupSettingsPanel.tsx | 接收 `groupDetail` prop | 不变（ChatPage 传入的 prop 来源变为 store） |
| GroupAnnouncementModal.tsx | 接收 `groupDetail` prop | 不变 |
| GroupMemberList.tsx | 接收 `groupDetail` prop + 独立 fetch members/mutes | 不变（groupDetail prop 仍从 ChatPage 传入，独立 fetch 保持不变） |
| InviteFriendsToGroupModal.tsx | 接收 `existingMembers: string[]`（提取自 groupDetail） | 不变（数据来源改为 store 中的 `activeGroupDetail[id].members`） |
| TransferOwnerModal.tsx | 接收 `members`/`currentOwner` + 操作前独立 safety fetch | 不变（safety fetch 保留） |

**风险点与缓解：**
- ~~store 中 groupDetail 切换聊天时清除~~ → 不需要清除，`Record<string, GroupDetail>` 按 groupId 索引，切换聊天自动读不同 key
- ~~多面板一致性~~ → GroupInfoPanel 和 ChatPage 读同一 store key，天然一致
- 新风险：内存占用 → 群数量有限（V1.0 规模），每个 GroupDetail 约 1KB，忽略不计

### 5.5 公告弹出逻辑变更影响分析

**变更描述：** 添加每日弹出限制 + 进入群聊时自动加载 groupDetail

**影响范围：**
1. 进入群聊 → 自动加载 groupDetail → 可能增加 API 请求量
2. localStorage 新增 key `announcement_popup_{groupId}` — 群数量多时 localStorage 条目增加
3. 公告弹出时机从"打开群信息后才弹"变为"进入群聊即弹" — 体验变化较大但符合用户预期

**优化措施：**
- groupDetail 加载可以使用 store cache，避免重复请求（同一会话内缓存）
- localStorage key 过期后自动清理（可选，V1.0 暂不实现清理）

---

## 五B、运行视角审计发现（第3轮优化）

### 5B.1 Realtime groups UPDATE handler 丢弃关键字段

**发现**：store.ts 的 groups UPDATE handler（约 line 1121-1145）仅将 `name` 和 `members` 写入 `chats[]`，**丢弃** payload 中的 `avatar_url`、`mute_all`、`announcement`、`announcement_at`、`join_mode`、`invite_approval`、`admins` 等字段。

**影响**：
- 群头像更新后，其他客户端聊天列表不显示新头像
- 管理员开启全群禁言后，其他客户端的禁言 UI 不生效（仅当前管理员客户端本地有感知）
- 公告更新后，其他客户端无法自动弹出新公告

**修复**：Realtime groups UPDATE handler 需同步更新 `activeGroupDetail` 缓存中对应群的所有字段。对于 `avatar_url`，还需更新 `chats[]` 中的头像显示数据。

### 5B.2 group_members 表无 Realtime 订阅

**发现**：`group_members` 表已在 Supabase 启用 Realtime，但 store.ts 未注册任何 `group_members` 表的订阅。

**影响**：`last_read_announcement_at`、`group_nickname`、`pinned`、`muted_notifications` 的变更无法被其他客户端感知。这在 V1.0 可接受（这些都是用户个人设置，不需要跨客户端同步），但需确认不影响本次修复。

**结论**：本次修复不需要添加 `group_members` Realtime 订阅（个人设置不需跨客户端同步）。

### 5B.3 toggleInviteApproval 批量审批后 pendingRequestCounts 未更新

**发现**：当从"需审批"切换到"免审批"时，`toggleInviteApproval` 正确自动批准所有 invite 类型的 pending 请求，但不更新 store 中的 `pendingRequestCounts[groupId]`，导致 UI 角标仍显示旧数量。

**修复**：在 `toggleInviteApproval` 的批量 approve 循环结束后，设置 `pendingRequestCounts[groupId] = 0`（或重新获取计数）。

### 5B.4 Realtime groups UPDATE handler 需同步 activeGroupDetail

**修复要求**：handler 中添加：
```
if (s.activeGroupDetail[updatedGroup.id]) {
  activeGroupDetail: { ...s.activeGroupDetail, [updatedGroup.id]: { ...s.activeGroupDetail[updatedGroup.id], ...relevantFields } }
}
```
确保所有字段（name, members, admins, announcement, announcement_at, join_mode, invite_approval, mute_all, avatar_url）同步更新。

---

## 五C、全面视角审计发现（第4-5轮优化）

### 5C.1 群头像在 Chat 对象中的存储

**发现**：当前 `Chat` 类型没有 `avatarUrl` 字段用于群头像。群聊在聊天列表中使用 `avatarColor`（颜色 + Users 图标）。

**修复**：
- `Chat` 接口新增可选字段 `groupAvatarUrl?: string`
- `groupToChat` 函数从 groups 表读取 `avatar_url` 写入 `Chat.groupAvatarUrl`
- 聊天列表和聊天头部渲染时：`groupAvatarUrl` 有值则显示图片，否则 fallback 到 Users 图标 + 颜色
- Realtime groups UPDATE handler 同步更新 `chats[].groupAvatarUrl`

### 5C.2 IME Hook 命名避免与现有 hook 冲突

**发现**：现有 `hooks/use-ime-composition.ts` 导出 `useIMEComposition`。新 hook 命名 `useIMEInput` 足够区分。

### 5C.3 GroupInfoPanel 浅色主题下需检查 Switch/Toggle 组件可见性

**发现**：`GroupInfoPanel` 中的 Pin Switch 和 DND Switch 使用 shadcn/ui Switch 组件。该组件已通过 CSS 变量适配主题，不需要额外修改。

### 5C.4 有效期选择器替换后需保持功能等价

**验证**：当前 `<select>` 的值编码使用 `'null'` 字符串代表"永不过期"。替换为 RadioGroup 后需保持相同的值映射：`1 | 7 | 30 | null`。

---

## 六、需求2：群管理功能全面测试方案

### 6.1 自动化测试设计

为群管理功能创建全面的单元测试套件 `lib/__tests__/group-management-fixes.test.ts`：

**IME 相关测试：**
1. `useIMEInput` hook 基本功能：composition 开始/结束状态跟踪
2. composition 期间 Enter 键不触发回调
3. composition 结束后 Enter 键正常触发回调
4. deferred search query 在 composition 期间不更新
5. deferred search query 在 composition 结束后更新

**状态同步测试：**
6. 群公告保存后 groupDetail 立即更新
7. 群设置修改后 groupDetail 立即更新
8. 成员邀请后 groupDetail.members 立即更新
9. mute_all toggle 后 groupDetail.mute_all 立即更新

**权限测试：**
10. 普通成员可以看到邀请好友按钮
11. 普通成员邀请时走审批流程（当 invite_approval=true）
12. 普通成员邀请时直接加入（当 invite_approval=false）
13. 管理员/群主邀请时始终直接加入

**公告弹出测试：**
14. 未读公告在进入群聊时自动弹出一次
15. 用户点击"确认"后标记已读，同版本公告不再自动弹出
16. 公告被管理员更新后（announcement_at 变化），再次触发自动弹出
17. 用户可通过群资料详情页手动查看已读公告（不受自动弹出限制）

**群头像测试：**
18. 上传有效图片成功
19. 上传超大文件被拒绝
20. 上传非图片文件被拒绝
21. 头像 URL 加载失败时显示默认头像

---

## 七、Supabase 操作清单（AI 通过 API 执行）

> 项目 .env 已提供 SUPABASE_SERVICE_ROLE_KEY、SUPABASE_DB_URL、SUPABASE_ACCESS_TOKEN，AI 将通过 Supabase REST API / Management API 执行以下操作。

1. 通过 SQL（使用 service_role key + REST /rest/v1/rpc 或直接 DB URL）：`ALTER TABLE groups ADD COLUMN avatar_url text;`
2. 通过 Management API（使用 SUPABASE_ACCESS_TOKEN）：创建 `group-avatars` Storage bucket（public，2MB限制，仅允许 image/* 类型）

---

## 八、文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `hooks/use-ime-input.ts` | 新增 | 增强版 IME 输入 Hook（解决 Android Chrome 竞态） |
| `lib/group-management.ts` | 修改 | 新增 uploadGroupAvatar、updateGroupAvatar；GroupDetail 新增 avatar_url |
| `lib/store.ts` | 修改 | 新增 activeGroupDetail 状态、updateGroupAvatarAction；修改公告弹出逻辑；修改 groupDetail 管理 |
| `components/chat/GroupInfoPanel.tsx` | 修改 | 浅色主题、群头像上传、IME修复、群名/昵称输入修复、邀请好友按钮开放给所有成员 |
| `components/chat/GroupMemberList.tsx` | 修改 | 搜索框 IME 修复 |
| `components/chat/GroupAnnouncementModal.tsx` | 修改 | IME修复、添加确认按钮、公告保存后状态同步、isUnread 传递修复 |
| `components/chat/GroupInviteModal.tsx` | 修改 | 有效期选择器 UI 优化（select → RadioGroup） |
| `components/chat/GroupSettingsPanel.tsx` | 修改 | mute_all Switch 状态管理修复 |
| `components/chat/InviteFriendsToGroupModal.tsx` | 修改 | 搜索框 IME 修复、成员列表实时刷新 |
| `components/chat/CreateGroupModal.tsx` | 修改 | 群名输入 IME 修复、搜索框 IME 修复 |
| `components/chat/AddFriendModal.tsx` | 修改 | 替换 useIMEComposition 为 useIMEInput，修复 Android 竞态 |
| `components/pages/ChatPage.tsx` | 修改 | 去除电话图标、群标题/头像点击、公告自动弹出、群头像显示、聊天列表搜索 IME 修复 |
| `components/pages/MarketPage.tsx` | 修改 | 行情搜索框 IME 修复 |
| `components/pages/DiscoverPage.tsx` | 修改 | DApp搜索框 IME 修复 |
| `lib/i18n.ts` | 修改 | 新增群头像相关 i18n key、公告确认按钮 key |
| `specs/product.md` | 修改 | 更新群管理功能描述 |
| `specs/tech.md` | 修改 | 更新 groups 表 avatar_url 字段 |
| `specs/structure.md` | 修改 | 新增 use-ime-input.ts 文件映射 |
| `frontend/CLAUDE.md` | 修改 | 新增文件映射 |
| `specs/CHANGELOG.md` | 修改 | 记录 Task80 变更 |
