# Task75: 聊天多模态消息支持（图片/文件/语音）

## 一、任务描述

为 OGBOX V1.0 聊天系统（单聊 + 群聊）添加多模态消息支持，包括：
- **图片消息**：从相册/文件选择或移动端拍照，客户端压缩，预览确认后发送，气泡内缩略图，点击全屏查看
- **文件消息**：选择任意文件发送，气泡显示文件名/大小/类型图标，点击下载
- **语音消息**：移动端长按录音、Web 端点击录音，气泡显示时长+波形+播放按钮

不包括：视频消息、语音通话、视频通话。

---

## 二、实现 Checklist

> 标注：[AI] = AI 执行，[用户] = 需用户手动操作

### 阶段 1：数据模型与基础设施

- [ ] **1.1** [用户] Supabase Dashboard：messages 表添加 `file_url`(text null)、`file_name`(text null)、`file_size`(bigint null)、`duration`(int null)、`thumbnail_url`(text null) 字段
- [ ] **1.2** [用户] Supabase Dashboard：修改 messages 表 `msg_type` CHECK 约束（如有），允许 `'image'`、`'file'`、`'voice'`
- [ ] **1.3** [用户] Supabase Dashboard：创建 `chat-files` Storage bucket（public，50MB 限制），配置 RLS 允许 anon key 上传和读取

### 阶段 2：核心库模块（可并行）

以下 3 个模块相互独立，可并行开发：

- [ ] **2.1** [AI] 新建 `lib/chat-media.ts` — 文件验证（validateImageFile, validateFile, validateVoiceFile）、图片压缩（compressImage）、文件名清理（sanitizeFileName）、文件上传（uploadChatFile）、工具函数（getFileTypeIcon, formatFileSize）
  - [ ] **2.1.1** [AI] 单元测试 `lib/__tests__/chat-media.test.ts` — 验证函数、压缩逻辑、formatFileSize、getFileTypeIcon
- [ ] **2.2** [AI] 新建 `lib/voice-recorder.ts` — VoiceRecorder class（start/stop/cancel/getDuration）、MediaRecorder 格式嗅探、60 秒自动停止、权限错误处理
  - [ ] **2.2.1** [AI] 单元测试 `lib/__tests__/voice-recorder.test.ts` — mock MediaRecorder 测试录音流程
- [ ] **2.3** [AI] 修改 `lib/chat.ts` — 扩展 MessageRow 接口（新增 file_url/file_name/file_size/duration/thumbnail_url）、扩展 sendMessage 函数签名（添加 msgType + mediaFields 参数）

### 阶段 3：状态管理扩展

- [ ] **3.1** [AI] 修改 `lib/store.ts` — 扩展 Message 接口（添加 msgType/fileUrl/fileName/fileSize/duration/thumbnailUrl/uploadProgress 字段，status 增加 'failed'）
- [ ] **3.2** [AI] 修改 `lib/store.ts` — 新增 `getMessageSummary()` 辅助函数
- [ ] **3.3** [AI] 修改 `lib/store.ts` — 更新 `contactToChat()` 和 `groupToChat()` 的 lastMessage 逻辑使用 getMessageSummary
- [ ] **3.4** [AI] 修改 `lib/store.ts` — 新增 `sendMediaMessage` action（乐观更新+上传+DB写入+失败标记）
- [ ] **3.5** [AI] 修改 `lib/store.ts` — 新增 `retryMediaMessage` action
- [ ] **3.6** [AI] 修改 `lib/store.ts` — Realtime INSERT handler 适配：从 payload 读取媒体字段、构建扩展 Message 对象、媒体消息去重逻辑、lastMessage 摘要
- [ ] **3.7** [AI] 修改 `lib/store.ts` — `loadChatHistory` 适配：MessageRow→Message 映射增加媒体字段
  - [ ] **3.7.1** [AI] 集成测试 `lib/__tests__/chat-multimodal-integration.test.ts` — sendMessage 媒体写入、Realtime 映射、去重逻辑、摘要生成

### 阶段 4：UI 组件（可并行）

以下组件相互独立，可并行开发：

- [ ] **4.1** [AI] 新建 `components/chat/ImageMessageBubble.tsx` — 图片缩略图（200px 限制）、骨架屏加载、上传进度遮罩、失败重试按钮、点击全屏（调用 AvatarPreviewModal）
- [ ] **4.2** [AI] 新建 `components/chat/FileMessageBubble.tsx` — 文件类型图标、文件名截断、大小格式化、上传进度条、点击下载
- [ ] **4.3** [AI] 新建 `components/chat/VoiceMessagePlayer.tsx` — 播放/暂停按钮、时长显示、进度条、全局单例播放管理
- [ ] **4.4** [AI] 新建 `components/chat/VoiceRecordButton.tsx` — 移动端长按录音+上滑取消、Web 端点击录音、最小时长检查、录音 UI（时长+波形动画）
- [ ] **4.5** [AI] 新建 `components/chat/ChatMediaPicker.tsx` — "+" 按钮、弹出面板（图片/文件/拍照）、`<input type="file">` 触发、拍照 capture 属性
- [ ] **4.6** [AI] 新建 `components/chat/ImagePreviewModal.tsx` — 图片预览（object-fit: contain）、文件名和大小显示、取消/发送按钮

### 阶段 5：聊天页面集成

- [ ] **5.1** [AI] 修改 `components/pages/ChatPage.tsx` — 输入栏改造：添加 "+" 附件按钮、输入空时发送键切换为麦克风、集成 ChatMediaPicker 和 VoiceRecordButton
- [ ] **5.2** [AI] 修改 `components/pages/ChatPage.tsx` — 消息气泡改造：根据 msgType 分支渲染（text/image/file/voice），向后兼容 undefined msgType
- [ ] **5.3** [AI] 修改 `components/pages/ChatPage.tsx` — 媒体发送逻辑：调用 sendMediaMessage、File 缓存（useRef<Map>）、重试调用
- [ ] **5.4** [AI] 修改 `components/pages/ChatPage.tsx` — 防连点 debounce（附件选择 + 发送按钮）

### 阶段 6：国际化（与阶段 4 并行）

- [ ] **6.1** [AI] 修改 `lib/i18n.ts` — 新增 18 个多模态相关 i18n keys（中/英）

### 阶段 7：规范文档更新（与阶段 5 并行）

- [ ] **7.1** [AI] 更新 `specs/product.md` §1.2 — 标记图片/文件/语音消息为【已实现】，更新变更记录
- [ ] **7.2** [AI] 更新 `specs/tech.md` §2.1 — messages 表新增字段文档，新增 chat-files bucket 说明
- [ ] **7.3** [AI] 更新 `specs/structure.md` §1, §2 — 新增文件条目和映射表
- [ ] **7.4** [AI] 更新 `frontend/CLAUDE.md` — 映射表新增多模态文件条目
- [ ] **7.5** [AI] 更新 `specs/CHANGELOG.md` — 记录本次变更

---

## 三、数据模型变更

### 3.1 messages 表扩展

现有字段保持不变，新增以下字段：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `file_url` | text | null | 媒体文件的 Supabase Storage 公共 URL |
| `file_name` | text | null | 原始文件名（含扩展名） |
| `file_size` | bigint | null | 文件大小（字节） |
| `duration` | integer | null | 语音时长（秒），仅 voice 类型使用 |
| `thumbnail_url` | text | null | 图片缩略图 URL（可选，用于大图优化） |

`msg_type` 字段扩展：`'text'` | `'system'` | `'image'` | `'file'` | `'voice'`

**Supabase Dashboard 需手动操作：**
1. ALTER TABLE messages 添加 `file_url`、`file_name`、`file_size`、`duration`、`thumbnail_url` 字段（均 nullable）
2. 修改 `msg_type` 的 CHECK 约束（如有），允许 `'image'`、`'file'`、`'voice'`
3. 为 `file_url` 字段建索引（可选，优化查询）

### 3.2 Supabase Storage 新建 bucket

**bucket 名称**：`chat-files`
- 公共读（public）：消息接收方可直接通过 URL 访问
- 上传限制：50MB（与文件最大限制一致）
- 文件路径规则：`{chat_id}/{timestamp}_{sanitized_filename}`

**Supabase Dashboard 手动操作：**
1. 创建 `chat-files` Storage bucket（public）
2. 配置 RLS：允许 anon key 上传和读取（与 avatars bucket 策略一致）
3. 设置文件大小限制 50MB

### 3.3 前端类型扩展

**MessageRow（chat.ts）扩展：**
```typescript
export interface MessageRow {
  id: number
  created_at: string
  chat_id: string
  sender: string
  content: string
  msg_type: 'text' | 'system' | 'image' | 'file' | 'voice'
  file_url: string | null
  file_name: string | null
  file_size: number | null
  duration: number | null
  thumbnail_url: string | null
}
```

**Message（store.ts）扩展：**
```typescript
export interface Message {
  id: string
  sender: 'me' | string
  content: string
  timestamp: number
  status: 'sent' | 'delivered' | 'read' | 'failed'  // failed: 媒体上传失败，可重试
  msgType?: 'text' | 'image' | 'file' | 'voice'  // 默认 'text'
  fileUrl?: string
  fileName?: string
  fileSize?: number
  duration?: number
  thumbnailUrl?: string
  uploadProgress?: number  // 0-100, 仅本地使用，上传中显示进度
}
```

---

## 四、核心模块设计

### 4.1 新建 `lib/chat-media.ts` — 聊天媒体工具模块

**职责**：文件上传、图片压缩、格式验证、URL 生成

```typescript
// 常量
const IMAGE_MAX_SIZE = 10 * 1024 * 1024      // 10MB
const FILE_MAX_SIZE = 50 * 1024 * 1024        // 50MB
const VOICE_MAX_SIZE = 5 * 1024 * 1024        // 5MB
const VOICE_MAX_DURATION = 60                  // 60秒
const IMAGE_MAX_DIMENSION = 1920              // 最大边1920px
const CHAT_FILES_BUCKET = 'chat-files'

const IMAGE_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const VOICE_ALLOWED_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/m4a', 'audio/mpeg']
// 文件消息：不限制类型，仅限制大小

// 函数
validateImageFile(file: File): string | null
validateFile(file: File): string | null
validateVoiceFile(file: File, duration: number): string | null
compressImage(file: File, maxDimension: number): Promise<File>
sanitizeFileName(name: string): string      // 去除 ../ 和特殊字符，保留扩展名，最长 100 字符
uploadChatFile(chatId: string, file: File, onProgress?: (pct: number) => void): Promise<{ url: string; fileName: string; fileSize: number }>
getFileTypeIcon(fileName: string): string   // 返回图标类型标识
formatFileSize(bytes: number): string       // 人类可读的文件大小
```

**图片压缩实现**：使用 Canvas API 缩放 + `canvas.toBlob()` 输出 JPEG/WebP。仅在原图尺寸超过 `IMAGE_MAX_DIMENSION` 时压缩。

**上传流程**：
1. 验证文件（类型/大小）
2. 若为图片且超尺寸→客户端压缩
3. 生成文件路径：`{chatId}/{Date.now()}_{sanitizedFileName}`
4. 上传到 Supabase Storage `chat-files` bucket
5. 获取 public URL 返回

### 4.2 新建 `lib/voice-recorder.ts` — 语音录制模块

**职责**：封装 MediaRecorder API，提供录音开始/停止/取消

```typescript
interface VoiceRecorderState {
  isRecording: boolean
  duration: number        // 当前录音时长（秒）
  cancelled: boolean
}

class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null
  private chunks: Blob[]
  private startTime: number
  private timerInterval: number | null
  private onDurationUpdate: (seconds: number) => void

  async start(): Promise<void>           // 请求麦克风权限并开始录制
  stop(): Promise<{ blob: Blob; duration: number }>  // 停止录制，返回音频 Blob + 时长
  cancel(): void                          // 取消录制，丢弃数据
  getDuration(): number                   // 获取当前录音时长
  isRecording(): boolean
}
```

**录音格式**：优先 `audio/webm;codecs=opus`（WebView 通用支持），回退 `audio/mp4`
**时长限制**：达到 60 秒自动停止
**权限处理**：`navigator.mediaDevices.getUserMedia({ audio: true })` 失败时抛出友好错误

### 4.3 新建 `components/chat/ChatMediaPicker.tsx` — 附件选择器组件

**职责**：聊天输入栏的 "+" 按钮及弹出的附件选择面板

**UI 设计**：
- 点击 "+" 图标按钮，弹出底部面板（移动端 bottom sheet）或上方气泡菜单（桌面端）
- 选项列表：
  - 📷 拍照（仅移动端 Capacitor 显示）
  - 🖼️ 图片（从相册/文件选择图片）
  - 📎 文件（选择任意文件）
- 点击选项触发 `<input type="file">` 的对应 accept 属性

**拍照（Capacitor）**：使用 `<input type="file" accept="image/*" capture="environment">` HTML 属性触发系统相机。无需额外 Capacitor 插件。

### 4.4 新建 `components/chat/ImagePreviewModal.tsx` — 图片预览确认弹窗

**职责**：选择图片后显示预览，用户确认发送或取消

**UI**：
- 全屏/半屏遮罩
- 图片预览（contain 模式，不超出屏幕）
- 底部操作栏：取消按钮 + 发送按钮
- 显示文件名和压缩后大小

### 4.5 新建 `components/chat/VoiceRecordButton.tsx` — 语音录制按钮组件

**职责**：聊天输入栏的语音录制交互

**交互模式**：
- **移动端（Capacitor）**：长按开始录音，松手发送，上滑取消
  - 按住时显示录音 UI（时长计数 + 红色波形动画）
  - 手指上滑超过阈值（80px）显示"松手取消"提示
  - 松手时根据位置决定发送/取消
- **Web 端**：点击切换录音状态
  - 点击麦克风图标→开始录音，图标变为红色停止按钮
  - 再次点击→停止录音并发送
  - 点击取消按钮→取消录音

**最小时长**：录音低于 1 秒不发送，提示"录音太短"

### 4.6 新建 `components/chat/VoiceMessagePlayer.tsx` — 语音消息播放组件

**职责**：语音消息气泡内的播放器

**UI**：
- 播放/暂停按钮
- 时长显示（如 "0:12"）
- 简易进度条（已播放/总时长比例）
- 播放中动画效果

**行为**：
- 使用 HTML5 Audio API 播放
- 全局单例：播放新语音自动暂停之前正在播放的语音
- 播放完毕自动重置为未播放状态

### 4.7 新建 `components/chat/FileMessageBubble.tsx` — 文件消息气泡组件

**职责**：文件消息的气泡渲染

**UI**：
- 文件类型图标（根据扩展名选择：PDF红色、Word蓝色、Excel绿色、ZIP黄色、默认灰色）
- 文件名（超长截断，中间省略）
- 文件大小（格式化显示：KB/MB）
- 点击触发下载（`window.open(url, '_blank')`）
- 上传中：显示进度条替代下载图标

### 4.8 修改 `components/pages/ChatPage.tsx` — 聊天页面集成

**输入栏改造**：
- 在 emoji 按钮左侧添加 "+" 附件按钮 → 打开 `ChatMediaPicker`
- 在发送按钮右侧（或替代位置）添加麦克风图标 → 触发 `VoiceRecordButton`
- 输入框为空时，发送按钮切换为麦克风按钮（微信风格）

**消息气泡改造**：
- 根据 `msg.msgType` 分支渲染：
  - `'text'`（默认）| `'system'`：现有逻辑不变
  - `'image'`：显示图片缩略图，点击打开全屏预览（复用 `AvatarPreviewModal` 或新建 `ImageViewModal`）
  - `'file'`：使用 `FileMessageBubble` 组件
  - `'voice'`：使用 `VoiceMessagePlayer` 组件

**聊天列表摘要**：
- `lastMessage` 根据消息类型显示：
  - image → `"[图片]"` / `"[Image]"`
  - file → `"[文件] xxx.pdf"` / `"[File] xxx.pdf"`
  - voice → `"[语音]"` / `"[Voice]"`
  - text → 原文内容

### 4.9 修改 `lib/chat.ts` — 发送函数扩展

**扩展 `sendMessage` 函数**：

```typescript
export async function sendMessage(
  chatId: string,
  sender: string,
  content: string,
  msgType: 'text' | 'system' | 'image' | 'file' | 'voice' = 'text',
  mediaFields?: {
    file_url?: string
    file_name?: string
    file_size?: number
    duration?: number
    thumbnail_url?: string
  }
): Promise<MessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender: sender.toLowerCase(),
      content,
      msg_type: msgType,
      ...mediaFields,
    })
    .select()
    .single()
  if (error) throw error
  return data as MessageRow
}
```

**扩展 `fetchMessages` 函数**：select 查询增加新字段

### 4.10 修改 `lib/store.ts` — 状态管理扩展

**新增 store actions：**

```typescript
sendMediaMessage: async (
  chatId: string,           // 已计算的 chatId（personal: getChatId 结果, group: group.id）
  file: File,
  msgType: 'image' | 'file' | 'voice',
  duration?: number         // 仅 voice 类型
) => {
  const state = get()
  if (!state.walletAddress) return
  const me = state.walletAddress.toLowerCase()

  // 验证 chat 存在
  if (!state.chats.some(c => c.id === chatId)) {
    throw new Error('Chat session mismatch')
  }

  // 生成摘要文本
  const summary = getMessageSummary(msgType, file.name)

  // 1. 创建乐观消息
  const optimisticId = `opt-${Date.now()}`
  const optimisticMsg: Message = {
    id: optimisticId,
    sender: 'me',
    content: summary,
    timestamp: Date.now(),
    status: 'sent',
    msgType,
    fileName: file.name,
    fileSize: file.size,
    duration,
    uploadProgress: 0,
  }
  set(s => ({
    chats: s.chats.map(c =>
      c.id === chatId
        ? { ...c, lastMessage: summary, timestamp: Date.now(), messages: [...c.messages, optimisticMsg] }
        : c
    ),
  }))

  try {
    // 2. 上传文件
    const { uploadChatFile } = await import('@/lib/chat-media')
    const { url, fileName, fileSize } = await uploadChatFile(chatId, file, (pct) => {
      // 更新上传进度
      set(s => ({
        chats: s.chats.map(c =>
          c.id === chatId
            ? { ...c, messages: c.messages.map(m => m.id === optimisticId ? { ...m, uploadProgress: pct, fileUrl: pct === 100 ? url : undefined } : m) }
            : c
        ),
      }))
    })

    // 3. DB 写入
    const { sendMessage: supabaseSend } = await import('@/lib/chat')
    await supabaseSend(chatId, me, summary, msgType, {
      file_url: url,
      file_name: fileName,
      file_size: fileSize,
      duration: duration ?? null,
    })
  } catch (error) {
    // 标记乐观消息为失败状态（不删除，允许重试）
    set(s => ({
      chats: s.chats.map(c =>
        c.id === chatId
          ? { ...c, messages: c.messages.map(m => m.id === optimisticId ? { ...m, status: 'failed' as any, uploadProgress: undefined } : m) }
          : c
      ),
    }))
    throw error
  }
}
```

**`getMessageSummary` 辅助函数**（定义在 store.ts 顶部）：

```typescript
function getMessageSummary(
  msgType: string | undefined,
  fileName?: string | null,
  locale?: string
): string {
  const isZh = (locale || 'zh') === 'zh'
  switch (msgType) {
    case 'image': return isZh ? '[图片]' : '[Image]'
    case 'voice': return isZh ? '[语音]' : '[Voice]'
    case 'file': return `[${isZh ? '文件' : 'File'}] ${fileName || ''}`
    default: return ''  // text 类型不经过此函数
  }
}
```

**新增 retryMediaMessage action**：

```typescript
retryMediaMessage: async (chatId: string, messageId: string, file: File, msgType: 'image' | 'file' | 'voice', duration?: number) => {
  // 1. 将失败消息状态改回 'sent' + uploadProgress=0
  // 2. 重新执行上传 + DB 写入流程
  // 3. 成功：替换消息；失败：再次标记为 'failed'
}
```

> **注意**：重试时需要原始 File 对象。File 对象在 JS 中是引用类型，需要在 ChatPage 组件层缓存 pending 的 File 引用（用 `useRef<Map<string, File>>`），当消息失败时可用该 File 重试。消息确认发送成功后从缓存中清除。

> **注意**：locale 从 store.getState().locale 获取。contactToChat/groupToChat 中使用 MessageRow 版本时需传入 msgType 和 file_name。

**Realtime 接收适配**：
- `postgres_changes` INSERT 回调中，从 payload 中读取新增字段
- 构建 Message 对象时填充 `msgType`、`fileUrl`、`fileName`、`fileSize`、`duration`
- 去重逻辑：文件消息用 `file_name` + `sender` + 时间窗口（±5s）匹配，替代纯 content 匹配

**lastMessage 摘要**：
- set `lastMessage` 时根据 msg_type 生成摘要文本

### 4.11 修改 `lib/i18n.ts` — 国际化扩展

新增 keys（中/英）：

```
chat.image             图片 / Image
chat.file              文件 / File
chat.voice             语音 / Voice
chat.takePhoto         拍照 / Take Photo
chat.selectImage       图片 / Photo
chat.selectFile        文件 / File
chat.sendImage         发送图片 / Send Image
chat.cancel            取消 / Cancel
chat.recording         录音中... / Recording...
chat.slideToCancel     上滑取消 / Slide up to cancel
chat.recordTooShort    录音太短 / Recording too short
chat.uploadFailed      上传失败 / Upload failed
chat.fileTooLarge      文件过大 / File too large
chat.imageFormatError  不支持的图片格式 / Unsupported image format
chat.micPermissionDenied 请允许麦克风权限 / Please allow microphone access
chat.downloading       下载中... / Downloading...
chat.unsupportedMsg    [不支持的消息类型] / [Unsupported message]
chat.voiceDuration     语音时长 / Voice duration
```

---

## 五、消息发送完整流程

### 5.1 图片消息发送流程

1. 用户点击 "+" → 选择"图片"或"拍照"
2. 系统弹出文件选择器（`<input type="file" accept="image/*">`，拍照加 `capture`）
3. 用户选择/拍摄图片
4. 验证文件格式和大小（≤10MB）
5. 若图片超过 1920px → 客户端 Canvas 压缩
6. 弹出 `ImagePreviewModal` 显示预览 + 压缩后大小
7. 用户确认发送
8. 创建乐观消息（`msgType: 'image'`，`uploadProgress: 0`，`content: '[图片]'`）
9. 上传到 `chat-files` bucket，过程中更新 `uploadProgress`
10. 上传完成 → 调用 `sendMessage(chatId, sender, '[图片]', 'image', { file_url, file_name, file_size })`
11. Realtime 推送到接收方 → 去重替换乐观消息

### 5.2 文件消息发送流程

1. 用户点击 "+" → 选择"文件"
2. 系统弹出文件选择器（`<input type="file">`，无 accept 限制）
3. 验证文件大小（≤50MB）
4. 直接开始上传（无预览确认，文件类型多样无法预览）
5. 创建乐观消息（`msgType: 'file'`，`content: '[文件] xxx.pdf'`）
6. 上传 + DB 写入 + Realtime 去重（同图片流程）

### 5.3 语音消息发送流程

1. 用户触发录音（移动端长按 / Web 端点击麦克风）
2. 请求麦克风权限（首次）
3. 开始 MediaRecorder 录制
4. UI 显示录音时长 + 波形动画
5. 达到 60 秒自动停止 / 用户手动停止
6. 校验时长 ≥ 1 秒
7. 获取音频 Blob → 构造 File 对象
8. 验证文件大小（≤5MB）
9. 创建乐观消息（`msgType: 'voice'`，`content: '[语音]'`，`duration`）
10. 上传 + DB 写入 + Realtime 去重

---

## 六、消息渲染规则

### 6.1 图片消息气泡

- 显示图片缩略图（max-width: 200px, max-height: 200px, object-fit: cover, 圆角）
- 上传中：半透明遮罩 + 圆形进度指示器
- 上传失败：显示失败图标 + "重试"按钮
- 点击已发送图片：全屏查看（复用已有 `AvatarPreviewModal` 组件，传入 imageUrl）
- 图片加载中：骨架屏占位（与缩略图同尺寸）

### 6.2 文件消息气泡

- 固定宽度卡片样式（区别于普通文本气泡）
- 左侧：文件类型图标（40x40，根据扩展名着色）
- 右侧上方：文件名（单行截断，最多 20 字符，中间省略）
- 右侧下方：文件大小（格式化）
- 上传中：底部进度条
- 点击：`window.open(fileUrl, '_blank')` 触发浏览器下载

### 6.3 语音消息气泡

- 固定宽度（约 180px）
- 左侧：播放/暂停按钮（三角/双竖线图标）
- 中间：简易波形条（静态装饰条或播放进度条）
- 右侧：时长显示（"0:12"格式）
- 播放中：按钮变为暂停，进度条推进
- 自己发送的语音：蓝色背景（与文本消息一致）
- 收到的语音：卡片背景

### 6.4 向后兼容

- 当 `msgType` 为 undefined 或未知值时，按文本消息渲染
- 渲染 fallback：`content` 字段始终包含可读的摘要文本（如"[图片]"），即使气泡组件加载失败也有文字可看

---

## 七、Realtime 订阅适配

当前 messages 表 INSERT 监听逻辑（store.ts）需适配：

1. **payload 字段读取**：从 `payload.new` 中额外读取 `file_url`、`file_name`、`file_size`、`duration`、`thumbnail_url`、`msg_type`
2. **Message 对象构建**：将 DB 字段映射到前端 Message interface
3. **去重逻辑扩展**：
   - 文本消息：保持原逻辑（content 匹配 + opt- 前缀）
   - 媒体消息：用 `file_name` + `sender` + 时间窗口（乐观消息 timestamp ±10s 内的同 file_name 消息）匹配
4. **lastMessage 摘要**：根据 msg_type 生成本地化摘要

---

## 八、单元测试设计

### 8.1 `lib/__tests__/chat-media.test.ts`

- `validateImageFile`：正常图片通过、超大文件拒绝、非图片格式拒绝
- `validateFile`：50MB 以内通过、超大拒绝
- `validateVoiceFile`：正常语音通过、超时长拒绝、超大拒绝
- `compressImage`：大图压缩后尺寸 ≤ 1920px、小图不压缩直接返回
- `formatFileSize`：1024→"1.0 KB"、1048576→"1.0 MB"、500→"500 B"
- `getFileTypeIcon`：pdf→'pdf'、docx→'word'、xlsx→'excel'、zip→'zip'、unknown→'default'

### 8.2 `lib/__tests__/voice-recorder.test.ts`

- 录音开始/停止流程（mock MediaRecorder）
- 时长计时准确性
- 取消录制后不返回数据
- 60 秒自动停止
- 麦克风权限拒绝时的错误处理

### 8.3 `lib/__tests__/chat-multimodal-integration.test.ts`

- sendMessage 带媒体字段的 DB 写入（mock Supabase）
- Realtime payload 正确映射为 Message 对象
- 媒体消息去重逻辑
- lastMessage 摘要生成（各类型）

---

## 九、隐性需求与体验性闭环（审计发现）

### 【P0】核心功能与致命异常防御

1. 上传失败重试：乐观消息保留，显示重试按钮，点击重新上传
2. 弱网处理：上传超时（30s）后提示失败，不自动重试
3. 防连点：发送按钮 + 附件选择器均加 debounce（300ms）
4. 麦克风权限拒绝：显示友好 toast 提示，引导用户打开权限
5. 文件格式/大小校验前置，上传前即拦截

### 【P1】体验性闭环与系统联动

1. 聊天列表摘要适配多媒体类型
2. 聊天搜索：多媒体消息按 content 摘要参与搜索
3. 全局单例语音播放器（一次只播一个）
4. 图片加载骨架屏
5. 超长文件名截断显示
6. 录音时长低于 1 秒不发送

### 【P2】锦上添花

1. 图片消息长按保存
2. 批量选图
3. 语音消息转文字
4. 文件消息在线预览（PDF等）
5. 拖拽发送文件（Web端）

> 本次实现范围：P0 全部 + P1 全部。P2 不纳入本次迭代。

---

## 十、跨端适配要点

### 10.1 文件选择

- **Web 端**：标准 `<input type="file">` API
- **Capacitor 端**：`<input type="file">` 在 Android WebView 中可用
- **拍照**：`<input type="file" accept="image/*" capture="environment">`，Capacitor WebView 自动调起系统相机

### 10.2 语音录制

- **Web 端 + Capacitor WebView**：`navigator.mediaDevices.getUserMedia({ audio: true })` + `MediaRecorder`
- **录音格式**：优先 `audio/webm;codecs=opus`，不支持时回退 `audio/mp4`（Safari/iOS WebView）
- **格式嗅探**：`MediaRecorder.isTypeSupported()` 检测

### 10.3 文件下载

- **Web 端**：`window.open(url, '_blank')` 或 `<a download>` 链接
- **Capacitor 端**：同样使用 `window.open`，系统浏览器/下载管理器处理

---

## 十一、变更传播完整性（grep 验证）

以下为通过 grep 搜索确认的所有需要修改的消费者位置：

### 11.1 Message 对象构建点（共 5 处，全部需扩展媒体字段）

| # | 位置 | 行号 | 场景 | 必须添加的字段 |
|---|------|------|------|---------------|
| 1 | `store.ts` | ~502 | `sendMessage` 本地回退 | msgType（默认'text'） |
| 2 | `store.ts` | ~1173 | `sendPushMessage` 乐观消息 | msgType, fileUrl, fileName, fileSize, duration, uploadProgress |
| 3 | `store.ts` | ~1218 | `sendGroupPushMessage` 乐观消息 | 同上 |
| 4 | `store.ts` | ~823 | Realtime INSERT handler | 从 payload.new 读取 msg_type→msgType, file_url→fileUrl 等 |
| 5 | `store.ts` | ~1270 | `loadChatHistory` | 从 fetchMessages 返回的 MessageRow 映射 |

### 11.2 lastMessage 摘要点（共 4 处，全部需 msg_type 感知）

| # | 位置 | 行号 | 当前逻辑 | 需改为 |
|---|------|------|---------|--------|
| 1 | `store.ts` `contactToChat()` | ~281 | `lastMsg?.content \|\| ''` | `getMessageSummary(lastMsg)` |
| 2 | `store.ts` `groupToChat()` | ~297 | `lastMsg?.content \|\| ''` | `getMessageSummary(lastMsg)` |
| 3 | `store.ts` sendPushMessage 乐观 | ~1183 | `lastMessage: content` | `lastMessage: getMessageSummary(msgType, content, fileName)` |
| 4 | `store.ts` Realtime handler | ~851 | `lastMessage: msg.content` | `lastMessage: getMessageSummary(msg)` |

需新增辅助函数 `getMessageSummary(msg)`：根据 msg_type 返回本地化摘要。

### 11.3 去重逻辑变更（1 处）

| 位置 | 行号 | 当前逻辑 | 需改为 |
|------|------|---------|--------|
| `store.ts` Realtime handler | ~839 | `m.content === msg.content && m.id.startsWith('opt-')` | 文本：保持原逻辑；媒体：`m.id.startsWith('opt-') && m.sender === 'me' && m.fileName === msg.file_name && Math.abs(m.timestamp - new Date(msg.created_at).getTime()) < 60000`（60s窗口防止同名文件误匹配） |

### 11.4 fetchMessages 返回字段扩展

`chat.ts` `fetchMessages()` 已使用 `.select('*')`，新增字段会自动包含在返回中。只需更新 `MessageRow` TypeScript 类型定义即可。`sendMessage()` 的 `.select()` 同理。

### 11.5 ChatPage.tsx 渲染（1 处，~line 311-349）

当前只访问 `msg.content` 做文本渲染。需增加 `msg.msgType` 分支：
- undefined / 'text' / 'system' → 现有渲染
- 'image' → ImageMessageBubble
- 'file' → FileMessageBubble
- 'voice' → VoiceMessagePlayer

---

## 十二、对现有功能的影响评估

| 现有功能 | 影响 | 处理 |
|---------|------|------|
| 文本消息发送/接收 | 无影响 | msgType 默认 'text'，现有逻辑不变 |
| 系统消息 | 无影响 | msg_type='system' 渲染路径不变 |
| 乐观更新+去重 | 需扩展 | 媒体消息增加 file_name 去重路径 |
| 聊天列表排序 | 无影响 | 按 timestamp 排序，与消息类型无关 |
| 聊天搜索 | 兼容 | 摘要文本参与搜索 |
| 消息通知音 | 无影响 | 不区分消息类型 |
| 表情选择器 | 无影响 | 表情仍为文本消息 |
| 好友系统 | 无影响 | 不涉及 |
| 群聊功能 | 需适配 | 群消息气泡增加媒体渲染分支 |

---

## 十二、新增/修改文件清单

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 新建 | `lib/chat-media.ts` | 聊天媒体工具（上传/压缩/验证） |
| 新建 | `lib/voice-recorder.ts` | 语音录制封装 |
| 新建 | `components/chat/ChatMediaPicker.tsx` | 附件选择器 |
| 新建 | `components/chat/ImagePreviewModal.tsx` | 图片预览确认弹窗 |
| 新建 | `components/chat/VoiceRecordButton.tsx` | 语音录制按钮 |
| 新建 | `components/chat/VoiceMessagePlayer.tsx` | 语音消息播放器 |
| 新建 | `components/chat/FileMessageBubble.tsx` | 文件消息气泡 |
| 新建 | `components/chat/ImageMessageBubble.tsx` | 图片消息气泡 |
| 新建 | `lib/__tests__/chat-media.test.ts` | 媒体工具测试 |
| 新建 | `lib/__tests__/voice-recorder.test.ts` | 语音录制测试 |
| 新建 | `lib/__tests__/chat-multimodal-integration.test.ts` | 多模态集成测试 |
| 修改 | `lib/chat.ts` | 扩展 MessageRow、sendMessage、fetchMessages |
| 修改 | `lib/store.ts` | 扩展 Message 类型、新增 sendMediaMessage、Realtime 适配 |
| 修改 | `lib/i18n.ts` | 新增多模态相关 i18n keys |
| 修改 | `components/pages/ChatPage.tsx` | 输入栏+消息气泡渲染改造 |
| 更新 | `specs/product.md` §1.2 | 更新消息类型为已实现 |
| 更新 | `specs/tech.md` §2.1 | messages 表新字段文档 |
| 更新 | `specs/structure.md` | 新增文件条目 |
| 更新 | `frontend/CLAUDE.md` | 映射表新增条目 |
