# OGBOX 项目结构规范

> 版本：v1.0
> 维护者：OGBOX Team
> 最后更新：2026-03-08

---

## §1 目录结构

$(printf '```')
OGBO-Project-quick-test/
├── frontend/                          # 主代码目录（Next.js + Capacitor）
│   ├── app/                           # Next.js App Router
│   │   ├── layout.tsx                 # 根布局
│   │   ├── page.tsx                   # 首页入口
│   │   ├── globals.css                # 全局样式 & CSS 变量
│   │   ├── login/
│   │   │   └── page.tsx               # 登录页路由
│   │   └── group/
│   │       └── join/
│   │           └── page.tsx           # Web 端群邀请链接落地页
│   │
│   ├── components/                    # 组件目录
│   │   ├── pages/                     # 页面级组件（5 个主页面）
│   │   │   ├── HomePage.tsx           # 首页
│   │   │   ├── ChatPage.tsx           # 聊天页
│   │   │   ├── MarketPage.tsx         # 市场页
│   │   │   ├── DiscoverPage.tsx       # 发现页
│   │   │   └── AssetsPage.tsx         # 资产页
│   │   │
│   │   ├── chat/                      # 聊天功能组件（24 个）
│   │   │   ├── AddFriendModal.tsx     # 添加好友弹窗
│   │   │   ├── ChatMediaPicker.tsx    # 媒体选择器（图片/文件/语音入口）
│   │   │   ├── ChatRequestCard.tsx    # 聊天请求卡片
│   │   │   ├── ChatRequestList.tsx    # 聊天请求列表
│   │   │   ├── CreateGroupModal.tsx   # 创建群聊弹窗
│   │   │   ├── FileMessageBubble.tsx  # 文件消息气泡
│   │   │   ├── GroupAnnouncementModal.tsx # 群公告查看/编辑弹窗
│   │   │   ├── GroupInfoPanel.tsx     # 群信息主面板
│   │   │   ├── GroupInviteModal.tsx   # 邀请链接+二维码生成弹窗
│   │   │   ├── GroupJoinRequestList.tsx # 入群申请审批列表
│   │   │   ├── GroupMemberList.tsx    # 群成员列表（含角色管理）
│   │   │   ├── GroupSettingsPanel.tsx # 群设置（入群方式/邀请审批/全群禁言）
│   │   │   ├── ImageMessageBubble.tsx # 图片消息气泡
│   │   │   ├── ImagePreviewModal.tsx  # 图片全屏预览弹窗
│   │   │   ├── InviteFriendsToGroupModal.tsx # 邀请好友多选弹窗
│   │   │   ├── JoinGroupModal.tsx     # 通过 token/链接加入群聊弹窗
│   │   │   ├── MessageContextMenu.tsx # 消息长按上下文菜单（删除/多选）
│   │   │   ├── MuteMemberModal.tsx    # 禁言时长选择弹窗
│   │   │   ├── TransferOwnerModal.tsx # 群主转让弹窗
│   │   │   ├── VoiceMessagePlayer.tsx # 语音消息播放器
│   │   │   ├── VoiceRecordButton.tsx  # 语音录制按钮
│   │   │   └── WalletAddress.tsx      # 钱包地址展示
│   │   │
│   │   ├── login/
│   │   │   └── LoginApp.tsx           # 完整认证流程（~2292 行）
│   │   │
│   │   ├── ui/                        # shadcn/ui 原子组件
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ...                    # 其余 shadcn 组件
│   │   │
│   │   ├── TopBar.tsx                 # 顶部导航栏
│   │   ├── BottomNav.tsx              # 底部导航栏
│   │   └── ...                        # 其他共享组件
│   │
│   ├── lib/                           # 核心逻辑库
│   │   ├── store.ts                   # Zustand 全局状态管理
│   │   ├── chat.ts                    # 聊天核心逻辑
│   │   ├── chat-media.ts              # 多媒体消息上传/发送
│   │   ├── voice-recorder.ts          # 语音录制工具
│   │   ├── profile.ts                 # 个人资料 CRUD + 头像上传
│   │   ├── walletCrypto.ts            # 钱包加密工具
│   │   ├── wagmi.ts                   # Web3 钱包连接配置
│   │   ├── supabaseClient.ts          # Supabase 客户端初始化
│   │   ├── soundPlayer.ts            # 消息提示音播放
│   │   ├── i18n.ts                    # 国际化核心（zh/en）
│   │   ├── debugLogger.ts            # 调试日志工具
│   │   ├── group-management.ts        # 群管理功能（25 个函数）、类型、错误类
│   │   ├── group-qrcode.ts            # 二维码/邀请链接辅助函数
│   │   ├── message-delete.ts          # 消息删除本地存储层（localStorage）
│   │   ├── utils.ts                   # 通用工具函数
│   │   ├── ota-version.ts             # OTA Bundle 版本号常量
│   │   ├── use-ota-updater.ts         # OTA 热更新核心逻辑（Android）
│   │   └── __tests__/                 # 单元测试
│   │       ├── soundPlayer.test.ts
│   │       ├── profile.test.ts
│   │       └── use-ota-updater.test.ts
│   │
│   ├── hooks/                         # 自定义 React Hooks
│   │   ├── use-ime-composition.ts     # IME 中文输入法兼容 Hook
│   │   ├── use-ime-input.ts           # 增强版 IME 输入 Hook（CJK 输入法全兼容）
│   │   ├── use-mobile.tsx             # 移动端检测
│   │   └── use-toast.ts              # Toast 通知
│   │
│   ├── public/                        # 静态资源
│   │   └── sounds/                    # 音效文件
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── capacitor.config.ts            # Capacitor 移动端配置
│
├── specs/                             # 项目规范与引导文档
│   ├── structure.md                   # 本文件：项目结构规范
│   └── _archive/                      # 归档文档
│
├── .claude/                           # Claude AI 配置
│   ├── settings.json                  # Claude Code 配置
│   └── commands/                      # 自定义命令
│
├── prompts/                           # 提示词与规范引用
│   └── specs/                         # 规范文件集
│
└── README.md
$(printf '```')

### §1 变更日志

| 日期 | 变更内容 | 关联代码文件 |
|------|----------|-------------|
| 2026-03-12 | Task76: 新增群管理相关 13 个文件（2 lib + 10 组件 + 1 页面） | lib/group-management.ts, lib/group-qrcode.ts, components/chat/Group*.tsx 等, app/group/join/page.tsx |
| 2026-03-08 | 初始化创建 | - |

---

## §2 代码-与规范映射总表

| 代码文件 | 所属规范章节 | 说明 |
|----------|-------------|------|
| $(printf '`')app/page.tsx$(printf '`') | §1 目录结构 | Next.js 首页路由入口 |
| $(printf '`')app/login/page.tsx$(printf '`') | §1 目录结构 | 登录页路由 |
| $(printf '`')app/globals.css$(printf '`') | §4 UI 原子组件体系 | CSS 变量定义、全局样式 |
| $(printf '`')components/pages/HomePage.tsx$(printf '`') | §1, §4 | 首页页面组件 |
| $(printf '`')components/pages/ChatPage.tsx$(printf '`') | §1, §4 | 聊天页面组件 |
| $(printf '`')components/pages/MarketPage.tsx$(printf '`') | §1, §4 | 市场页面组件 |
| $(printf '`')components/pages/DiscoverPage.tsx$(printf '`') | §1, §4 | 发现页面组件 |
| $(printf '`')components/pages/AssetsPage.tsx$(printf '`') | §1, §4 | 资产页面组件 |
| $(printf '`')components/chat/AddFriendModal.tsx$(printf '`') | §3, §4 | 添加好友弹窗组件 |
| $(printf '`')components/chat/ChatRequestCard.tsx$(printf '`') | §3, §4 | 聊天请求卡片 |
| $(printf '`')components/chat/ChatRequestList.tsx$(printf '`') | §3, §4 | 聊天请求列表 |
| $(printf '`')components/chat/CreateGroupModal.tsx$(printf '`') | §3, §4 | 创建群聊弹窗 |
| $(printf '`')components/chat/WalletAddress.tsx$(printf '`') | §3, §4 | 钱包地址组件 |
| $(printf '`')components/chat/ImageMessageBubble.tsx$(printf '`') | §1.2, §4 | 图片消息气泡 |
| $(printf '`')components/chat/FileMessageBubble.tsx$(printf '`') | §1.2, §4 | 文件消息气泡 |
| $(printf '`')components/chat/VoiceMessagePlayer.tsx$(printf '`') | §1.2, §4 | 语音消息播放器 |
| $(printf '`')components/chat/VoiceRecordButton.tsx$(printf '`') | §1.2, §4 | 语音录制按钮 |
| $(printf '`')components/chat/ChatMediaPicker.tsx$(printf '`') | §1.2, §4 | 媒体选择器 |
| $(printf '`')components/chat/ImagePreviewModal.tsx$(printf '`') | §1.2, §4 | 图片全屏预览弹窗 |
| $(printf '`')components/chat/GroupInfoPanel.tsx$(printf '`') | §3, §4 | 群信息主面板 |
| $(printf '`')components/chat/GroupMemberList.tsx$(printf '`') | §3, §4 | 群成员列表（含角色管理） |
| $(printf '`')components/chat/GroupSettingsPanel.tsx$(printf '`') | §3, §4 | 群设置（入群方式/邀请审批/全群禁言） |
| $(printf '`')components/chat/GroupAnnouncementModal.tsx$(printf '`') | §3, §4 | 群公告查看/编辑弹窗 |
| $(printf '`')components/chat/GroupInviteModal.tsx$(printf '`') | §3, §4 | 邀请链接+二维码生成弹窗 |
| $(printf '`')components/chat/GroupJoinRequestList.tsx$(printf '`') | §3, §4 | 入群申请审批列表 |
| $(printf '`')components/chat/InviteFriendsToGroupModal.tsx$(printf '`') | §3, §4 | 邀请好友多选弹窗 |
| $(printf '`')components/chat/MuteMemberModal.tsx$(printf '`') | §3, §4 | 禁言时长选择弹窗 |
| $(printf '`')components/chat/TransferOwnerModal.tsx$(printf '`') | §3, §4 | 群主转让弹窗 |
| $(printf '`')components/chat/JoinGroupModal.tsx$(printf '`') | §3, §4 | 通过 token/链接加入群聊弹窗 |
| $(printf '`')app/group/join/page.tsx$(printf '`') | §1 目录结构 | Web 端群邀请链接落地页 |
| $(printf '`')lib/group-management.ts$(printf '`') | §3 编码规范 | 群管理功能（25 函数）、类型、错误类 |
| $(printf '`')lib/group-qrcode.ts$(printf '`') | §3 编码规范 | 二维码/邀请链接辅助函数 |
| $(printf '`')lib/message-delete.ts$(printf '`') | §3 编码规范 | 消息删除本地存储层 |
| $(printf '`')components/chat/MessageContextMenu.tsx$(printf '`') | §3, §4 | 消息长按上下文菜单（删除/多选） |
| $(printf '`')components/UserAvatar.tsx$(printf '`') | §3, §4 | 通用头像组件 |
| $(printf '`')components/AvatarPreviewModal.tsx$(printf '`') | §3, §4 | 头像点击预览放大弹窗 |
| $(printf '`')components/ProfileEditModal.tsx$(printf '`') | §3, §4 | 个人资料编辑弹窗 |
| $(printf '`')components/login/LoginApp.tsx$(printf '`') | §3 | 完整登录认证流程 |
| $(printf '`')components/ui/*$(printf '`') | §4 UI 原子组件体系 | shadcn/ui 原子组件 |
| $(printf '`')lib/profile.ts$(printf '`') | §3 编码规范 | 个人资料 CRUD |
| $(printf '`')lib/store.ts$(printf '`') | §3 编码规范 | Zustand 状态管理 |
| $(printf '`')lib/chat.ts$(printf '`') | §3 编码规范 | 聊天核心逻辑 |
| $(printf '`')lib/chat-media.ts$(printf '`') | §3 编码规范 | 多媒体消息上传/发送 |
| $(printf '`')lib/voice-recorder.ts$(printf '`') | §3 编码规范 | 语音录制工具 |
| $(printf '`')lib/walletCrypto.ts$(printf '`') | §3 编码规范 | 钱包加密工具 |
| $(printf '`')lib/wagmi.ts$(printf '`') | §3 编码规范 | Web3 连接配置 |
| $(printf '`')lib/supabaseClient.ts$(printf '`') | §3 编码规范 | Supabase 客户端 |
| $(printf '`')lib/soundPlayer.ts$(printf '`') | §3 编码规范 | 音效播放器 |
| $(printf '`')lib/i18n.ts$(printf '`') | §5 国际化规范 | 国际化核心模块 |
| $(printf '`')lib/debugLogger.ts$(printf '`') | §3 编码规范 | 调试日志 |
| $(printf '`')lib/utils.ts$(printf '`') | §3 编码规范 | 通用工具 |
| $(printf '`')hooks/use-ime-composition.ts$(printf '`') | §3 编码规范 | IME 中文输入法兼容 Hook |
| $(printf '`')hooks/use-ime-input.ts$(printf '`') | §3 编码规范 | 增强版 IME 输入 Hook（CJK 输入法全兼容） |
|  | §3 编码规范 | 增强版 IME 输入 Hook（CJK 输入法全兼容） |
| $(printf '`')hooks/use-mobile.tsx$(printf '`') | §3 编码规范 | 移动端检测 Hook |
| $(printf '`')hooks/use-toast.ts$(printf '`') | §3 编码规范 | Toast Hook |

### §2 变更日志

| 日期 | 变更内容 | 关联代码文件 |
|------|----------|-------------|
| 2026-03-12 | Task76: 新增 14 个群管理文件到映射表 | lib/group-management.ts, lib/group-qrcode.ts, Group*.tsx 等 |
| 2026-03-08 | 初始化创建 | - |

---


## §3 编码规范

### §3.1 TypeScript 命名约定

| 类别 | 风格 | 示例 |
|------|------|------|
| 组件 | PascalCase | ${BT}ChatPage${BT}, ${BT}AddFriendModal${BT} |
| 函数/变量 | camelCase | ${BT}sendMessage${BT}, ${BT}walletAddress${BT} |
| 常量 | UPPER_SNAKE_CASE | ${BT}COINGECKO_BASE${BT}, ${BT}MARKET_CACHE_KEY${BT} |
| 类型/接口 | PascalCase | ${BT}Chat${BT}, ${BT}Message${BT}, ${BT}Wallet${BT}, ${BT}StoredWallet${BT} |
| lib 文件 | camelCase | ${BT}store.ts${BT}, ${BT}chat.ts${BT}, ${BT}walletCrypto.ts${BT} |
| 组件文件 | PascalCase | ${BT}ChatPage.tsx${BT}, ${BT}AddFriendModal.tsx${BT} |

### §3.2 组件编写规范

- **函数组件 + hooks**：不使用 class components
- **"use client" 指令**：所有页面/组件文件顶部必须声明
- **Props 解构**：在函数签名中直接解构 props
- **内部子组件**：允许在同一文件内定义（如 ${BT}ChatDetail${BT} 在 ${BT}ChatPage.tsx${BT} 中）
- **单文件上限**：建议不超过 800 行，超出应拆分子组件

### §3.3 导入顺序

${BT3}typescript
"use client"                           // 1. 客户端指令
import { useState } from "react"       // 2. React 导入
import { motion } from "framer-motion" // 3. 第三方库
import { useAppStore } from "@/lib/store" // 4. 内部模块
import type { Chat } from "@/lib/store"   // 5. 类型导入
${BT3}

### §3.4 错误处理模式

| 场景 | 处理方式 |
|------|---------|
| 用户操作失败 | try/catch + toast 通知用户 |
| 异步状态更新 | 乐观更新 + 失败回滚 |
| 非关键操作（音频、剪贴板） | 静默失败，不阻断流程 |
| 调试信息 | ${BT}console.error${BT} 输出日志 |

### §3.5 新增文件规则

- **lib/ 新文件**：必须为独立功能模块，导出纯函数或 hooks
- **components/pages/ 新文件**：需在 ${BT}app/page.tsx${BT} 的 Tab 系统中注册
- **components/chat/ 新文件**：聊天子组件，由 ${BT}ChatPage.tsx${BT} 导入
- **components/ui/ 新文件**：仅通过 ${BT}npx shadcn@latest add <component>${BT} 添加
- **测试文件**：放在对应模块的 ${BT}__tests__/${BT} 目录下

### 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §4 UI 原子组件体系

### §4.1 组件库（shadcn/ui）

已安装的 shadcn/ui 组件完整清单（共 49 个）：

| 组件 | 文件 | 用途 |
|------|------|------|
| accordion | ${BT}accordion.tsx${BT} | 手风琴折叠面板 |
| alert | ${BT}alert.tsx${BT} | 警告提示 |
| alert-dialog | ${BT}alert-dialog.tsx${BT} | 确认对话框 |
| aspect-ratio | ${BT}aspect-ratio.tsx${BT} | 宽高比容器 |
| avatar | ${BT}avatar.tsx${BT} | 用户头像 |
| badge | ${BT}badge.tsx${BT} | 标签徽章 |
| breadcrumb | ${BT}breadcrumb.tsx${BT} | 面包屑导航 |
| button | ${BT}button.tsx${BT} | 按钮 |
| calendar | ${BT}calendar.tsx${BT} | 日历选择器 |
| card | ${BT}card.tsx${BT} | 卡片容器 |
| carousel | ${BT}carousel.tsx${BT} | 轮播组件 |
| chart | ${BT}chart.tsx${BT} | 图表组件 |
| checkbox | ${BT}checkbox.tsx${BT} | 复选框 |
| collapsible | ${BT}collapsible.tsx${BT} | 可折叠区域 |
| command | ${BT}command.tsx${BT} | 命令面板 |
| context-menu | ${BT}context-menu.tsx${BT} | 右键菜单 |
| dialog | ${BT}dialog.tsx${BT} | 对话框 |
| drawer | ${BT}drawer.tsx${BT} | 抽屉面板 |
| dropdown-menu | ${BT}dropdown-menu.tsx${BT} | 下拉菜单 |
| form | ${BT}form.tsx${BT} | 表单组件 |
| hover-card | ${BT}hover-card.tsx${BT} | 悬浮卡片 |
| input | ${BT}input.tsx${BT} | 输入框 |
| input-otp | ${BT}input-otp.tsx${BT} | OTP 验证码输入 |
| label | ${BT}label.tsx${BT} | 标签 |
| menubar | ${BT}menubar.tsx${BT} | 菜单栏 |
| navigation-menu | ${BT}navigation-menu.tsx${BT} | 导航菜单 |
| pagination | ${BT}pagination.tsx${BT} | 分页 |
| popover | ${BT}popover.tsx${BT} | 弹出层 |
| progress | ${BT}progress.tsx${BT} | 进度条 |
| radio-group | ${BT}radio-group.tsx${BT} | 单选组 |
| resizable | ${BT}resizable.tsx${BT} | 可调整大小面板 |
| scroll-area | ${BT}scroll-area.tsx${BT} | 滚动区域 |
| select | ${BT}select.tsx${BT} | 下拉选择 |
| separator | ${BT}separator.tsx${BT} | 分隔线 |
| sheet | ${BT}sheet.tsx${BT} | 侧边抽屉 |
| sidebar | ${BT}sidebar.tsx${BT} | 侧边栏 |
| skeleton | ${BT}skeleton.tsx${BT} | 骨架屏加载 |
| slider | ${BT}slider.tsx${BT} | 滑块 |
| sonner | ${BT}sonner.tsx${BT} | Sonner 通知 |
| switch | ${BT}switch.tsx${BT} | 开关 |
| table | ${BT}table.tsx${BT} | 表格 |
| tabs | ${BT}tabs.tsx${BT} | 标签页 |
| textarea | ${BT}textarea.tsx${BT} | 多行文本框 |
| toast | ${BT}toast.tsx${BT} | Toast 通知 |
| toaster | ${BT}toaster.tsx${BT} | Toast 容器 |
| toggle | ${BT}toggle.tsx${BT} | 切换按钮 |
| toggle-group | ${BT}toggle-group.tsx${BT} | 切换按钮组 |
| tooltip | ${BT}tooltip.tsx${BT} | 工具提示 |
| use-mobile | ${BT}use-mobile.tsx${BT} | 移动端检测 hook |

> **规则**：不手动创建 ui/ 文件，统一通过 ${BT}npx shadcn@latest add <component>${BT} 安装。

### §4.2 颜色规范（CSS 变量）

颜色定义在 ${BT}app/globals.css${BT} 中，通过 CSS 变量实现亮/暗模式切换。

| 变量名 | 色值 | 用途 |
|--------|------|------|
| ${BT}--ogbo-blue${BT} | ${BT}#0066FF${BT} | 主色调、主按钮、链接 |
| ${BT}--ogbo-blue-hover${BT} | ${BT}#0052CC${BT} | 主色 hover 态 |
| ${BT}--ogbo-blue-active${BT} | ${BT}#0044AA${BT} | 主色 active 态 |
| ${BT}--ogbo-green${BT} | ${BT}#10B981${BT} | 成功状态、价格上涨 |
| ${BT}--ogbo-red${BT} | ${BT}#EF4444${BT} | 错误状态、价格下跌 |
| ${BT}--ogbo-orange${BT} | ${BT}#F59E0B${BT} | 警告、收藏标记 |
| ${BT}--ogbo-purple${BT} | ${BT}#7C3AED${BT} | 辅助色 |

> 支持 dark mode，通过 CSS 变量在 ${BT}:root${BT} 和 ${BT}.dark${BT} 下分别定义。

### §4.3 布局模板

| 规则 | 说明 |
|------|------|
| 响应式策略 | Mobile-first，移动端优先设计 |
| 底部导航 | BottomNav 包含 5 个 Tab：首页/聊天/行情/发现/资产 |
| 顶部栏 | TopBar 显示 logo + 操作按钮 |
| 内容区域 | ${BT}flex-1 overflow-y-auto${BT}，撑满可用高度 |
| 桌面端约束 | ${BT}lg:max-w-5xl lg:mx-auto${BT} 居中限宽 |
| 弹窗策略 | 移动端用 bottom sheet，桌面端用居中 modal |

### §4.4 动画规范

- **动画库**：Framer Motion
- **进出场**：${BT}AnimatePresence${BT} 管理组件挂载/卸载动画
- **交互反馈**：${BT}motion.button${BT} 使用 ${BT}whileTap${BT}、${BT}whileHover${BT}
- **页面切换**：slide 动画过渡
- **手势操作**：spring 弹性动画用于滑动手势

### 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §5 国际化规范

### §5.1 i18n 架构

- 使用自定义 ${BT}lib/i18n.ts${BT}，非第三方国际化库
- 支持语言：${BT}zh${BT}（中文）、${BT}en${BT}（英文），默认 ${BT}zh${BT}
- 翻译函数签名：${BT}t(key: string, locale?: string) → string${BT}

### §5.2 Key 命名约定

按功能模块组织，使用点号分隔嵌套：

| 前缀 | 模块 | 示例 |
|------|------|------|
| ${BT}nav.*${BT} | 导航 | ${BT}nav.home${BT}, ${BT}nav.chat${BT} |
| ${BT}home.*${BT} | 首页 | ${BT}home.totalAssets${BT} |
| ${BT}chat.*${BT} | 聊天 | ${BT}chat.searchPlaceholder${BT} |
| ${BT}market.*${BT} | 行情 | ${BT}market.trending${BT} |
| ${BT}assets.*${BT} | 资产 | ${BT}assets.send${BT} |
| ${BT}discover.*${BT} | 发现 | ${BT}discover.categories${BT} |
| ${BT}common.*${BT} | 通用 | ${BT}common.cancel${BT}, ${BT}common.confirm${BT}, ${BT}common.comingSoon${BT} |

### §5.3 语言切换

- 切换方法：${BT}store.switchLocale()${BT} 在 ${BT}zh${BT} 和 ${BT}en${BT} 之间切换
- 切换入口：${BT}LoginApp${BT} 内置 ${BT}LangSwitcher${BT} 组件
- 持久化：语言偏好随 Store 状态持久化

### §5.4 新增翻译规则

1. 在 ${BT}lib/i18n.ts${BT} 的翻译对象中同时添加 ${BT}zh${BT} 和 ${BT}en${BT} 条目
2. Key 遵循 §5.2 命名约定
3. 组件中通过 ${BT}t(key, locale)${BT} 调用，${BT}locale${BT} 从 Store 获取

### 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |

---

## §6 Git 提交与部署规范

### §6.1 提交规范

- 遵循 ${BT}prompts/specs/github_push_specs.md${BT} 中的提交消息格式
- AI 不主动提交代码，除非用户明确要求
- 提交前确保 TypeScript 编译通过、测试通过

### §6.2 APK 编译规范

- 遵循 ${BT}prompts/specs/apk_compilation_spec.md${BT}
- Capacitor 配置文件：${BT}frontend/capacitor.config.ts${BT}
- 编译产物不提交至 Git（.gitignore 已排除）

### §6.3 .gitignore 策略

| 排除项 | 说明 |
|--------|------|
| ${BT}node_modules/${BT}, ${BT}.next/${BT}, ${BT}out/${BT}, ${BT}dist/${BT} | 构建产物 |
| ${BT}.env*${BT}, ${BT}.env.local${BT} | 环境变量（含密钥） |
| ${BT}*.apk${BT} | APK 编译产物（已提交的 ${BT}OGBOX-v1.0.apk${BT} 除外） |
| ${BT}android/${BT}, ${BT}ios/${BT} 构建产物 | 平台原生编译缓存 |

### §6.4 分支策略

- ${BT}master${BT}：主分支，保持可部署状态
- 功能开发直接在 ${BT}master${BT} 上进行（当前阶段）

### 变更记录

| 日期 | 变更内容 | 关联代码文件 |
|------|---------|-------------|
| 2026-03-08 | 初始化创建 | - |
