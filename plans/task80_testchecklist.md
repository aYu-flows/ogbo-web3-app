# Task80 测试验证检查项 — 群管理功能Bug修复与优化

## 说明

本文档为 Task80（群管理功能16项Bug修复与优化 + 系统性IME兼容修复）的测试验证检查项。每个检查项包含两个 checkbox：

- **第一个 checkbox `[ ]`**：实现文档撰写完成后，AI 逐项复核该项是否在实现文档中被正确覆盖（文档审查）
- **第二个 checkbox `[ ]`**：实际代码实现完成后，AI 逐项复核该功能是否正确实现（代码审查）

格式：`[ ] [ ] 检查项描述`
含义：`[文档审查] [代码审查] 检查项描述`

---

## A. IME中文输入系统性修复（问题 #2, #3, #5, #6, #15 + 全局）

### A1. useIMEInput Hook 核心功能

- [x] [x] 新建 `hooks/use-ime-input.ts`，提供增强版 IME 输入 Hook
- [x] [x] Hook 封装 `isComposingRef` 状态跟踪（监听 onCompositionStart/onCompositionEnd）
- [x] [x] Hook 提供 `compositionEndCount` state，每次 compositionEnd 时递增，用于强制触发下游 effect（解决 Android Chrome 竞态）
- [x] [x] Hook 提供 `getInputProps({ onEnter?, onChange? })` 返回统一的事件 handlers（onCompositionStart、onCompositionEnd、onKeyDown、onChange）
- [x] [x] Enter 键在 composition 进行中（isComposing = true）不触发 `onEnter` 回调
- [x] [x] Enter 键在 composition 结束后（isComposing = false）正常触发 `onEnter` 回调
- [x] [x] Hook 导出 `deferredValue`：composition 进行中不更新，composition 结束后才同步最新值
- [x] [x] `deferredValue` 在非 CJK 用户场景下行为等同于即时值（无 composition 事件时直接同步）
- [x] [x] 旧 hook `hooks/use-ime-composition.ts` 保留不删除（ProfileEditModal 和 ChatPage 主输入仍使用）

### A2. GroupInfoPanel 群名输入 IME 修复（问题 #2）

- [x] [x] 群名编辑输入框使用 `useIMEInput` hook 绑定 composition 事件
- [x] [x] 中文拼音输入过程中，按 Enter 选择候选字**不会**误触发保存操作
- [x] [x] 中文拼音输入完成后，按 Enter **正常**触发保存操作
- [x] [x] 输入中文后 onBlur（点击其他区域）能正确保存已输入内容，不丢失
- [x] [x] onBlur 保存时使用 DOM ref 兜底读取值，确保 composition 结束时值已同步
- [x] [x] 英文/数字输入行为不受影响，Enter 保存和 Blur 保存均正常

### A3. GroupInfoPanel 群昵称输入 IME 修复（问题 #5）

- [x] [x] 群昵称编辑输入框使用 `useIMEInput` hook 绑定 composition 事件
- [x] [x] 中文拼音输入过程中，按 Enter 选择候选字**不会**误触发保存
- [x] [x] 中文输入完成后内容**不会**消失，正确保存到 Supabase
- [x] [x] onBlur 保存时使用 DOM ref 兜底读取值
- [x] [x] 英文/数字输入行为不受影响

### A4. GroupAnnouncementModal 公告内容 IME 修复（问题 #6）

- [x] [x] 公告 textarea 使用 `useIMEInput` hook 绑定 composition 事件
- [x] [x] 中文拼音输入过程中，已输入内容**不会**退回消失
- [x] [x] maxLength（500字符）限制仅在非 composition 期间生效，composition 期间不截断输入
- [x] [x] 接近 maxLength 边界时，中文 composition 完成后正确截断到限制长度
- [x] [x] 英文/数字输入行为不受影响

### A5. AddFriendModal 搜索 Android 竞态修复（问题 #3）

- [x] [x] 替换现有 `useIMEComposition` 为 `useIMEInput` hook
- [x] [x] 搜索 `useEffect` 依赖改为 `[deferredValue, compositionEndCount]`
- [x] [x] Android Chrome (Capacitor WebView) 中 compositionEnd 后搜索**能正确触发**（解决事件顺序竞态：onChange → compositionEnd）
- [x] [x] 桌面浏览器中文输入搜索行为正常（compositionEnd → onChange 顺序）
- [x] [x] composition 进行中不触发 debounce 搜索请求
- [x] [x] composition 结束后，即使 state 值与之前相同，也能通过 `compositionEndCount` 强制触发搜索 effect

### A6. GroupMemberList 搜索框 IME 修复（问题 #15）

- [x] [x] 成员搜索输入框使用 `useIMEInput` 的 `deferredValue` 驱动过滤
- [x] [x] 中文拼音输入过程中，成员列表**不会**因中间态字符闪烁/清空
- [x] [x] composition 完成后，列表按最终中文字符正确过滤
- [x] [x] 英文搜索即时过滤行为不受影响

### A7. InviteFriendsToGroupModal 搜索框 IME 修复

- [x] [x] 邀请好友搜索框使用 `useIMEInput` 的 `deferredValue` 驱动过滤
- [x] [x] 中文拼音输入过程中，好友列表**不会**因中间态闪烁
- [x] [x] composition 完成后按最终中文字符正确过滤

### A8. CreateGroupModal IME 修复

- [x] [x] 群名输入框使用 `useIMEInput` + Enter guard，中文输入不误触发创建
- [x] [x] 好友搜索框使用 `deferredValue`，中文输入不导致列表闪烁

### A9. ChatPage 聊天列表搜索 IME 修复

- [x] [x] 聊天列表搜索框使用 `useIMEInput` 的 `deferredValue` 驱动过滤
- [x] [x] 中文拼音输入过程中，聊天列表不因中间态字符闪烁

### A10. MarketPage 行情搜索框 IME 修复

- [x] [x] 行情搜索框使用 `useIMEInput` 的 `deferredValue`
- [x] [x] 中文拼音输入过程中搜索结果不闪烁

### A11. DiscoverPage DApp 搜索框 IME 修复

- [x] [x] DApp 搜索框使用 `useIMEInput` 的 `deferredValue`
- [x] [x] 中文拼音输入过程中搜索结果不闪烁

### A12. IME 修复不影响现有已正常工作的输入

- [x] [x] ChatPage 主输入框（已有独立 IME 处理）功能不受影响
- [x] [x] ProfileEditModal 昵称输入（已使用 useIMEComposition）功能不受影响
- [x] [x] 所有使用 `useIMEInput` 的输入框对非 CJK 用户完全无感知影响
- [x] [x] IME 修复不引入 XSS 漏洞（所有输入值经过 React 默认转义，不使用 dangerouslySetInnerHTML）

---

## B. 普通成员邀请好友入群（问题 #1）

### B1. 按钮可见性

- [x] [x] 群主可以看到"邀请好友"按钮
- [x] [x] 管理员可以看到"邀请好友"按钮
- [x] [x] **普通成员**可以看到"邀请好友"按钮（此前仅 isAdminOrOwner 可见）
- [x] [x] 按钮从 isAdminOrOwner 代码块移到所有角色可见区域

### B2. 权限差异化处理

- [x] [x] 群主邀请好友：needApproval = false，被邀请人直接加入群
- [x] [x] 管理员邀请好友：needApproval = false，被邀请人直接加入群
- [x] [x] 普通成员邀请好友（群设置 invite_approval=false）：被邀请人直接加入群
- [x] [x] 普通成员邀请好友（群设置 invite_approval=true）：走审批流程，被邀请人不立即加入
- [x] [x] 普通成员邀请需审批时，toast 提示"邀请已提交，等待审批"（i18n key: `group.invitePending`）

---

## C. 群聊详情页标题/头像点击唤起（问题 #4）

- [x] [x] 群聊头部的**群头像**区域可点击，点击后打开群信息面板（GroupInfoPanel）
- [x] [x] 群聊头部的**群名标题**区域可点击，点击后打开群信息面板
- [x] [x] 头像和标题区域添加 `cursor-pointer` 样式提示可点击
- [x] [x] 仅群聊类型时生效，个人聊天头部的头像/标题点击行为不变
- [x] [x] 三点按钮仍然可以正常打开群信息面板（原有功能不受影响）

---

## D. 群公告完整修复（问题 #7, #11, #12）

### D1. 公告保存后状态实时更新（问题 #7）

- [x] [x] 管理员/群主编辑公告并保存后，弹窗立即切换到查看模式并显示**新公告内容**（无需关闭重开）
- [x] [x] 保存后 GroupInfoPanel 的公告预览也同步显示新内容
- [x] [x] 保存后 store 中 `activeGroupDetail[groupId].announcement` 立即更新
- [x] [x] 保存后 store 中 `activeGroupDetail[groupId].announcement_at` 立即更新
- [x] [x] 保存后 store 中 `activeGroupDetail[groupId].announcement_by` 立即更新

### D2. 公告确认按钮（问题 #11）

- [x] [x] 查看模式底部显示"确认"按钮（i18n key: `group.confirmAnnouncement`），**所有角色**可见
- [x] [x] 管理员/群主在查看模式同时显示"编辑"按钮和"确认"按钮（编辑在左，确认在右）
- [x] [x] 普通成员在查看模式**仅**显示"确认"按钮（无编辑权限）
- [x] [x] 点击"确认"按钮：关闭弹窗 + 调用 store `markAnnouncementRead(groupId)` 标记已读
- [x] [x] 标记已读同时更新 Supabase DB 和 Zustand store 中的 `myGroupSettings[groupId].last_read_announcement_at`

### D3. 公告自动弹出与频率控制（问题 #12）

- [x] [x] 进入群聊时自动加载 groupDetail（不限于点击三点按钮时）
- [x] [x] **未读公告**（`announcement_at > last_read_announcement_at`）在进入群聊时**自动弹出一次**
- [x] [x] 用户点击"确认"后标记已读，**同一版本公告不再自动弹出**
- [x] [x] 管理员更新公告后（`announcement_at` 变化），其他成员再次进入群聊时**自动弹出新公告**
- [x] [x] 已读过的公告，用户可通过群信息面板手动点击查看（不受自动弹出限制）
- [x] [x] 公告为空（`announcement` 不存在）时，不触发自动弹出
- [x] [x] `isUnread` prop 被正确传递给 `GroupAnnouncementModal`

### D4. GroupAnnouncementModal handleClose 修复

- [x] [x] handleClose 改为调用 store 的 `markAnnouncementRead(groupId)`（而非直接调用 `updateMyGroupSettings`）
- [x] [x] 关闭弹窗后 Zustand store 中 `myGroupSettings[groupId].last_read_announcement_at` 已更新
- [x] [x] 同一会话内再次检查 isUnread 结果为 false（不重复弹出）

---

## E. 群邀请链接有效期选择器UI优化（问题 #8）

- [x] [x] 原生 `<select>` 替换为自定义 RadioGroup 组件（圆角卡片内的垂直单选列表）
- [x] [x] 选项包含：1天 / 7天 / 30天 / 永不过期，共4个选项
- [x] [x] 默认选中"7天"
- [x] [x] "永不过期"选项的值映射为 `null`（保持与原 `<select>` 中 `'null'` 字符串等价的功能）
- [x] [x] RadioGroup 样式使用 `bg-card`/`border-border`/主题色，与 MuteMemberModal 禁言时长选择器风格一致
- [x] [x] 移动端触控交互正常（选项可正确点击切换）
- [x] [x] 生成的邀请链接有效期与选择的选项匹配

---

## F. 好友入群后可邀请列表刷新（问题 #9）

- [x] [x] 邀请好友成功后，调用 `refreshGroupDetail` 刷新 store 中的成员列表
- [x] [x] 邀请好友成功后关闭弹窗，下次打开 InviteFriendsToGroupModal 时**已入群好友不再显示**在可邀请列表中
- [x] [x] 已入群好友的过滤基于最新的 `activeGroupDetail[groupId].members`（而非打开弹窗时的快照）

---

## G. 群管理页面UI浅色主题（问题 #10）

### G1. 深色硬编码样式替换

- [x] [x] `bg-[#1a1a2e]` 替换为 `bg-card` 或 `bg-background`
- [x] [x] `border-white/10` 替换为 `border-border`
- [x] [x] `text-white` 替换为 `text-foreground`
- [x] [x] `text-white/60`、`text-white/50` 替换为 `text-muted-foreground`
- [x] [x] `bg-white/5`、`bg-white/10` 替换为 `bg-muted`
- [x] [x] `hover:bg-white/10` 替换为 `hover:bg-muted`

### G2. 保留固定颜色

- [x] [x] 群主金色皇冠图标颜色保持不变（不跟随主题）
- [x] [x] 管理员蓝色盾牌图标颜色保持不变
- [x] [x] 退出群聊/解散群聊红色按钮颜色保持不变

### G3. 整体视觉一致性

- [x] [x] GroupInfoPanel 整体风格与子面板（GroupSettingsPanel、GroupAnnouncementModal 等）一致
- [x] [x] Switch/Toggle 组件在浅色主题下可见性正常（shadcn/ui Switch 已适配主题）
- [x] [x] 所有圆角、间距、分隔线等细节风格保持原有质感

---

## H. 去除群聊电话图标（问题 #13）

- [x] [x] 群聊头部移除 `<Phone>` 图标按钮
- [x] [x] 移除后头部布局不受影响，无错位或空白
- [x] [x] 如果个人聊天也有电话图标且无实际功能，一并移除

---

## I. 群头像设置功能（问题 #14）

### I1. 数据库与存储

- [x] [x] `groups` 表新增 `avatar_url text` 字段
- [x] [x] Supabase Storage 创建 `group-avatars` bucket（public 访问，2MB 文件大小限制，仅允许 image/* 类型）
- [x] [x] `GroupDetail` 接口新增 `avatar_url: string | null` 字段
- [x] [x] `fetchGroupDetail` 查询包含 `avatar_url` 字段

### I2. 上传功能

- [x] [x] `lib/group-management.ts` 新增 `uploadGroupAvatar(groupId, file)` 函数
- [x] [x] 上传文件名使用 UUID 重命名（防注入攻击）
- [x] [x] 文件类型白名单验证：仅允许 jpg/png/gif/webp
- [x] [x] 文件大小限制验证：最大 2MB，超限时提示用户
- [x] [x] 上传到 `group-avatars` bucket 后返回 public URL
- [x] [x] `lib/group-management.ts` 新增 `updateGroupAvatar(groupId, avatarUrl)` 函数更新 `groups.avatar_url`

### I3. UI交互

- [x] [x] GroupInfoPanel 中群头像区域：有 `avatar_url` 时显示 `<img>`，否则 fallback 为首字母+颜色默认头像
- [x] [x] **管理员/群主**可点击群头像区域触发文件选择（`<input type="file" accept="image/*">`）
- [x] [x] **普通成员**点击群头像区域**不触发**上传（无权限）
- [x] [x] 上传中显示 loading 态
- [x] [x] 上传成功后立即更新 GroupInfoPanel 中的头像显示
- [x] [x] 上传失败时恢复原头像显示，不显示损坏图标，toast 提示错误
- [x] [x] 头像 `<img>` 添加 `onError` handler，URL 404 时 fallback 到首字母+颜色默认头像

### I4. 聊天列表/头部联动

- [x] [x] `Chat` 类型新增可选字段 `groupAvatarUrl?: string`
- [x] [x] `groupToChat` 函数从 groups 表读取 `avatar_url` 写入 `Chat.groupAvatarUrl`
- [x] [x] 聊天列表中群聊头像：`groupAvatarUrl` 有值时显示图片，否则 fallback 到 Users 图标+颜色
- [x] [x] 聊天头部群头像：`groupAvatarUrl` 有值时显示图片，否则 fallback
- [x] [x] 群头像更新后，聊天列表和聊天头部的头像同步更新

### I5. Store action

- [x] [x] `store.ts` 新增 `updateGroupAvatarAction(groupId, file)` 调用上传+更新+刷新本地状态
- [x] [x] 成功后 patch `activeGroupDetail[groupId].avatar_url`
- [x] [x] 成功后更新 `chats[].groupAvatarUrl`

### I6. Capacitor 兼容

- [x] [x] 原生端（Android/iOS）`<input type="file" accept="image/*">` 能触发相机/相册选择（与个人头像行为一致）

---

## J. 全员禁言开关状态不更新（问题 #16）

- [x] [x] GroupSettingsPanel 的 mute_all Switch 使用本地 state `localMuteAll`（初始从 `groupDetail?.mute_all` 读取）
- [x] [x] Switch 的 `checked` 绑定到 `localMuteAll`（而非直接读 prop）
- [x] [x] toggle 切换时显示 loading 状态
- [x] [x] DB 更新成功后：`setLocalMuteAll(checked)` 立即更新 Switch 视觉状态
- [x] [x] DB 更新成功后：调用 store 的 `toggleMuteAll(groupId)` 发送系统消息
- [x] [x] DB 更新成功后：更新 store 中 `activeGroupDetail[groupId].mute_all`
- [x] [x] Switch 切换后**不再弹回原位**（此前的核心bug）
- [x] [x] 同理修复 `join_mode`、`invite_approval` 使用本地 state 管理（避免同类问题）
- [x] [x] toast 提示操作结果

---

## K. Store 状态管理 — activeGroupDetail 系统

### K1. 新增 activeGroupDetail 状态

- [x] [x] `store.ts` 新增 state 字段 `activeGroupDetail: Record<string, GroupDetail>`，初始值 `{}`
- [x] [x] `openGroupManagement` 成功后将结果存入 `activeGroupDetail[groupId]`
- [x] [x] `refreshGroupDetail` 成功后更新 `activeGroupDetail[groupId]` + `chats[]`
- [x] [x] 新增 `patchActiveGroupDetail(groupId, patch)` 辅助 action 支持局部更新

### K2. 群管理 action 更新 activeGroupDetail

- [x] [x] `updateGroupNameAction` 成功后 patch `activeGroupDetail[id].name`
- [x] [x] `setAnnouncementAction` 成功后 patch `announcement`/`announcement_at`/`announcement_by`
- [x] [x] `toggleMuteAll` 成功后 patch `mute_all` + 添加 `set()` 调用
- [x] [x] `toggleInviteApproval` 成功后 patch + 批量 approve 后重置 `pendingRequestCounts[id] = 0`
- [x] [x] `updateJoinMode` 成功后 patch `join_mode`
- [x] [x] `setAdmin`/`unsetAdmin` 成功后 patch `admins`
- [x] [x] `kickMember` 成功后 patch `members`
- [x] [x] `inviteFriendsToGroupAction` 成功后 refresh `activeGroupDetail[id]`
- [x] [x] `transferGroupOwnership` 成功后 refresh `activeGroupDetail[id]`
- [x] [x] `dissolveGroupAction` 成功后删除 `activeGroupDetail[id]`
- [x] [x] `leaveGroupAction` 成功后删除 `activeGroupDetail[id]`

### K3. Realtime groups UPDATE handler 扩展

- [x] [x] handler 同步更新 `chats[].name` 和 `chats[].groupAvatarUrl`
- [x] [x] handler 同步更新 `activeGroupDetail[id]` 中所有字段：name, members, admins, announcement, announcement_at, join_mode, invite_approval, mute_all, avatar_url
- [x] [x] 其他客户端修改群信息后，当前客户端的 GroupInfoPanel 能实时反映变更

### K4. UI 组件数据源迁移

- [x] [x] ChatPage 删除本地 `useState<GroupDetail | null>`，改为 `useStore(s => s.activeGroupDetail[chat.id])`
- [x] [x] GroupInfoPanel 删除独立的 `useState` + `useEffect` fetch，改为读/写 store `activeGroupDetail[groupId]`
- [x] [x] 切换不同群聊时，`activeGroupDetail` 按 groupId 索引自动读取对应数据（无需清除）

### K5. markAnnouncementRead 修复

- [x] [x] `markAnnouncementRead` 同时更新 Supabase DB 和 Zustand store 中的 `myGroupSettings[groupId].last_read_announcement_at`

---

## L. i18n 国际化

- [x] [x] 新增 `group.avatar` 中英文 key
- [x] [x] 新增 `group.changeAvatar` 中英文 key
- [x] [x] 新增 `group.avatarUpdated` 中英文 key
- [x] [x] 新增 `group.avatarError` 中英文 key
- [x] [x] 新增 `group.confirmAnnouncement` 中英文 key（确认/Confirm）
- [x] [x] 新增 `group.invitePending` 中英文 key（邀请已提交，等待审批）

---

## M. 端到端冒烟验证项

### M1. 外部资源可达性

- [x] [x] Supabase `groups` 表 `avatar_url` 字段已成功添加（通过 REST API 验证 `SELECT avatar_url FROM groups LIMIT 1` 不报错）
- [x] [x] Supabase Storage `group-avatars` bucket 已创建且配置为 public 访问
- [x] [x] `group-avatars` bucket 文件大小限制为 2MB
- [x] [x] `group-avatars` bucket 仅允许 image/* 类型
- [x] [x] 使用普通用户权限（非 service_role）能正常上传文件到 `group-avatars` bucket
- [x] [x] 使用普通用户权限能正常读取 `group-avatars` bucket 中的文件（public URL 可访问）
- [x] [x] `group-avatars` bucket 的 RLS/Policy 配置与项目中已正常运行的 `avatars` bucket 对齐

### M2. 数据链路一致性 — 群头像

- [x] [x] 上传群头像 → Storage 存储 → 返回 URL → 写入 groups.avatar_url → 回读 GroupDetail.avatar_url → UI 显示：全链路数据值一致
- [x] [x] 群头像 URL 写入 `groups.avatar_url` 的值与 Storage 返回的 public URL 格式完全一致（无额外变换/清洗）
- [x] [x] Realtime groups UPDATE 推送的 `avatar_url` 值与 DB 中存储的值一致
- [x] [x] `Chat.groupAvatarUrl` 的值与 `GroupDetail.avatar_url` 的值一致（groupToChat 未做格式变换）

### M3. 数据链路一致性 — 群公告

- [x] [x] 保存公告 → 写入 DB → patch store `activeGroupDetail` → UI 显示：全链路数据一致
- [x] [x] `markAnnouncementRead` 写入 DB 的 `last_read_announcement_at` 与 store 中的值一致
- [x] [x] 公告 `isUnread` 判断（`announcement_at > last_read_announcement_at`）基于同一时间基准

### M4. 数据链路一致性 — 状态同步

- [x] [x] mute_all toggle: localState → DB → store activeGroupDetail → Realtime → 其他客户端：全链路一致
- [x] [x] invite_approval toggle: 同上
- [x] [x] join_mode 变更: 同上
- [x] [x] 群名变更: 同上

### M5. 权限与角色边界

- [x] [x] **群主**可上传群头像 → 成功
- [x] [x] **管理员**可上传群头像 → 成功
- [x] [x] **普通成员**尝试上传群头像 → UI 层阻止（无上传入口），不触发 API 调用
- [x] [x] **群主**邀请好友 → 直接加入（无审批）
- [x] [x] **管理员**邀请好友 → 直接加入（无审批）
- [x] [x] **普通成员**邀请好友（invite_approval=true）→ 走审批流程
- [x] [x] **普通成员**邀请好友（invite_approval=false）→ 直接加入
- [x] [x] **群主**可编辑公告 → "编辑"按钮可见
- [x] [x] **管理员**可编辑公告 → "编辑"按钮可见
- [x] [x] **普通成员**查看公告 → 仅"确认"按钮可见，无"编辑"按钮

---

## N. 交互质量验证项

### N1. 输入交互兼容性

- [x] [x] 所有使用 `useIMEInput` 的输入框在中文 IME 输入过程中，中间状态（拼音/候选字）不触发业务逻辑（保存/搜索/过滤）
- [x] [x] 所有输入框的 composition 结束后，值正确同步到 state
- [x] [x] 输入框 focus/blur 切换不导致已输入内容丢失（特别是 IME composition 进行中 blur 的场景）
- [x] [x] 粘贴中文内容到输入框：内容正确显示且触发对应业务逻辑（搜索/保存）
- [x] [x] Android Capacitor WebView 中所有 IME 相关功能正常（重点验证 compositionEnd 事件顺序）
- [x] [x] iOS Capacitor WebView 中所有 IME 相关功能正常

### N2. 操作后即时反馈

- [x] [x] 群名修改成功后：GroupInfoPanel 标题立即更新 + toast 提示
- [x] [x] 群昵称修改成功后：GroupInfoPanel 昵称显示立即更新 + toast 提示
- [x] [x] 群公告保存成功后：弹窗查看模式立即显示新内容 + GroupInfoPanel 公告预览更新
- [x] [x] 群头像上传成功后：GroupInfoPanel 头像立即更新 + 聊天列表头像更新
- [x] [x] mute_all toggle 成功后：Switch 状态立即更新 + toast 提示
- [x] [x] invite_approval toggle 成功后：Switch 状态立即更新
- [x] [x] 邀请好友成功后：toast 提示 + 弹窗关闭（下次打开已邀请好友不在列表中）
- [x] [x] 其他在线用户通过 Realtime 机制接收到群信息变更（群名、群头像、公告、设置等）

### N3. 视觉一致性

- [x] [x] GroupInfoPanel 浅色主题样式与 GroupSettingsPanel、GroupAnnouncementModal 等子面板一致
- [x] [x] 有效期选择器 RadioGroup 样式与 MuteMemberModal 禁言时长选择器风格一致
- [x] [x] 群头像上传 loading 态与个人头像上传 loading 态风格一致
- [x] [x] 公告"确认"按钮样式与项目中其他确认类按钮一致
- [x] [x] 所有新增/修改的 UI 组件使用项目主题变量（bg-card、text-foreground 等），适配项目主题系统

### N4. 交互入口与关闭模式

- [x] [x] 群信息面板可通过以下路径到达：(1) 群聊头部三点按钮 (2) 群聊头部群头像点击 (3) 群聊头部群名点击
- [x] [x] 公告弹窗有明确的"确认"关闭按钮（不仅依赖点击外部区域关闭）
- [x] [x] 公告自动弹出频率合理：同一版本公告仅自动弹出一次，用户确认后不再弹出
- [x] [x] 群头像上传通过点击头像区域触发（管理员/群主），交互直觉且明确

### N5. 冗余元素审计

- [x] [x] 群聊头部 `<Phone>` 图标已移除（无对应后端实现的占位按钮）
- [x] [x] 确认移除电话图标后头部无其他无功能占位按钮
- [x] [x] 移除电话图标后头部布局正常，无空白间隙

---

## O. TypeScript 编译与测试

- [x] [x] `cd frontend && npx tsc --noEmit` 执行无 TypeScript 编译错误
- [x] [x] `cd frontend && npx jest --passWithNoTests` 单元测试全部通过
- [x] [x] `useIMEInput` hook 单元测试覆盖核心场景（composition 状态跟踪、Enter guard、deferredValue、compositionEndCount 强制触发）
- [x] [x] `git diff --stat` 确认变更文件列表与计划一致

---

## P. Steering 文档更新

- [x] [x] `specs/product.md` 更新：群头像设置功能描述、普通成员邀请权限、公告确认按钮
- [x] [x] `specs/tech.md` 更新：groups 表新增 `avatar_url text` 字段、`group-avatars` Storage bucket
- [x] [x] `specs/structure.md` 更新：新增 `hooks/use-ime-input.ts` 文件映射
- [x] [x] `frontend/CLAUDE.md` 更新：新增文件到映射表
- [x] [x] `specs/CHANGELOG.md` 更新：记录 Task80 全部变更
