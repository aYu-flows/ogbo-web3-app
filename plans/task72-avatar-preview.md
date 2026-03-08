# Task 72: 头像点击预览放大功能

## 一、任务描述

为 OGBOX 应用添加头像点击预览放大功能。用户点击有真实头像的 UserAvatar 时，弹出全屏遮罩层展示头像大图；无头像用户（使用 default-avatar.svg 的 fallback）不触发预览。

## 二、实现 Checklist

- [ ] **1. 创建 `AvatarPreviewModal.tsx` 组件**（AI）
  - 新建 `frontend/components/AvatarPreviewModal.tsx`
  - 实现全屏遮罩 + 居中大图 + fade/scale 动画 + ESC/点击关闭 + 图片加载失败处理
  - [ ] 1.1 单元测试：open/close 渲染、遮罩点击关闭、ESC 关闭、avatarUrl 为 null 不渲染图片
- [ ] **2. 修改 `UserAvatar.tsx` 增加 `onPreview` prop**（AI）
  - 新增可选 `onPreview` prop，仅在 showImage 为 true 时响应点击
  - [ ] 2.1 单元测试：有头像时 onPreview 触发、fallback 时不触发
- [ ] **3. 聊天列表集成头像预览**（AI）
  - 修改 `ChatPage.tsx` chat list 中 UserAvatar，传入 onPreview + stopPropagation
  - 在 ChatPage 中引入 AvatarPreviewModal，管理 previewAddress 状态
- [ ] **4. 聊天详情顶栏集成头像预览**（AI）
  - 修改 `ChatPage.tsx` ChatDetail header 中 UserAvatar，传入 onPreview
  - 在 ChatDetail 中引入 AvatarPreviewModal，管理 previewAddress 状态
- [ ] **5. 好友请求卡片集成头像预览**（AI）
  - 修改 `ChatRequestCard.tsx` 中 UserAvatar，传入 onPreview
  - 引入 AvatarPreviewModal，管理 previewAddress 状态
- [ ] **6. 更新 Steering 文档**（AI）
  - 更新 `specs/structure.md` 新增 AvatarPreviewModal.tsx 文件条目
  - 更新 `frontend/CLAUDE.md` 映射表新增 AvatarPreviewModal
  - 更新 `specs/CHANGELOG.md` 记录本次变更

## 三、技术方案

### 3.1 新建组件：`AvatarPreviewModal.tsx`

创建一个全屏头像预览遮罩组件，位于 `frontend/components/AvatarPreviewModal.tsx`。

**功能要求：**
- 接收 props：`avatarUrl: string | null`、`displayName: string`、`open: boolean`、`onClose: () => void`
- 全屏半透明黑色遮罩（`bg-black/80`），z-index 足够高（z-50）
- 居中展示头像大图，最大宽高不超过视口 80%，保持比例
- 点击遮罩任意位置关闭
- 按 ESC 键关闭
- 使用 framer-motion 的 fade + scale 进出动画（与项目风格一致）
- 右上角显示关闭按钮（X 图标）
- 图片加载失败时自动关闭预览（调用 onClose）

### 3.2 修改 `UserAvatar.tsx`

**增加可点击预览能力：**
- 新增可选 prop `onPreview?: () => void`
- 当 `onPreview` 存在且当前显示的是真实头像（`showImage === true`）时，为容器添加 `cursor-pointer` 和 `onClick={onPreview}`
- 无真实头像时（fallback default-avatar.svg），即使传了 `onPreview` 也不触发

### 3.3 各使用场景集成

需要在以下位置启用头像预览（每个位置独立管理自己的 preview state）：

#### 3.3.1 聊天列表（ChatPage — chat list items）
- 位置：`ChatPage.tsx` 第 573-590 行附近，chat list 中的 UserAvatar
- 点击头像 → 弹出预览，**不触发 handleOpenChat**（需 stopPropagation）
- 仅对有 `chat.walletAddress` 且有真实头像的用户启用

#### 3.3.2 聊天详情顶栏（ChatDetail header）
- 位置：`ChatPage.tsx` 第 274-285 行附近，ChatDetail 头部的 UserAvatar
- 点击头像 → 弹出预览

#### 3.3.3 好友请求卡片（ChatRequestCard）
- 位置：`ChatRequestCard.tsx` 第 47 行，UserAvatar
- 点击头像 → 弹出预览

#### 3.3.4 不启用预览的位置
- **SidebarNav / TopBar**：点击头像已有"打开 ProfileEditModal"的功能，不覆盖
- **CreateGroupModal**：头像仅作展示用，空间紧凑，不启用预览
- **群聊图标**（Users icon 色块）：非个人头像，不启用

### 3.4 预览状态管理

每个使用点用局部 `useState` 管理预览状态（`previewAddress`），不引入全局 store 状态。预览弹窗内通过 `getAvatarUrl(address)` 获取完整头像 URL。

### 3.5 事件冒泡处理

聊天列表中头像预览点击需要 `e.stopPropagation()` 阻止冒泡到外层的 `handleOpenChat`。

### 3.6 国际化

无需新增 i18n key。关闭按钮使用图标无文字。

## 四、单元测试

### 4.1 AvatarPreviewModal 测试
- 测试 `open=true` 时渲染遮罩和图片
- 测试 `open=false` 时不渲染
- 测试点击遮罩调用 `onClose`
- 测试按 ESC 调用 `onClose`
- 测试 `avatarUrl` 为 null 时不渲染图片

### 4.2 UserAvatar 预览集成测试
- 测试有真实头像时，传入 `onPreview` 后点击触发回调
- 测试 fallback 状态时，传入 `onPreview` 后点击不触发回调
