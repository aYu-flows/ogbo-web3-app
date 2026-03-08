# Task70 - V1.0 完整版 Android OTA 热更新实现

## 一、任务描述

基于现有项目基础设施（`@capgo/capacitor-updater` 已安装、`capacitor.config.ts` 已配置、测试套件已编写、部署脚本已就绪），**完成 OTA 热更新核心实现并补齐生产级能力**。

当前状态：OTA 基础设施已搭建（task47），但核心运行时文件（`use-ota-updater.ts`、`ota-version.ts`）缺失，store 中 OTA 状态未定义，hook 未集成到 `page.tsx`。本任务将补齐所有缺失实现，并新增 V1.0 完整版所需的生产级增强。

**核心约束：**
- 仅限 Android 平台（iOS 不在范围内）
- 自托管：Supabase Storage public bucket `ota-updates`
- 手动更新模式（`autoUpdate: false`）
- 使用 `set()` 激活新 bundle，激活后下次冷启动加载新版本
- 零影响：不破坏任何现有功能和 UI

---

## 二、实现 Checklist

### 阶段一：新增核心文件

- [x] **[AI]** 创建 `frontend/lib/ota-version.ts`
  - 导出 `export const BUNDLE_VERSION = "1.0.0"`
  - 自检：TS 语法正确，导出与测试 mock `{ BUNDLE_VERSION: '1.0.0' }` 一致

- [x] **[AI]** 创建 `frontend/lib/use-ota-updater.ts`
  - 实现模块级 `_otaRunning` 防重入标志
  - 实现 `_resetOtaRunningForTest()` 导出（重置 `_otaRunning = false`）
  - 实现 `runOtaUpdate()` 异步函数，完整逻辑见§四 4.1.2（步骤1-11）
  - 实现 `useOtaUpdater()` React hook（`useEffect(() => { runOtaUpdate() }, [])`）
  - 自检：TS 类型检查通过；导出与测试 `import { runOtaUpdate, _resetOtaRunningForTest }` 一致
  - **单元测试**：执行 `pnpm jest use-ota-updater`，11/11 全部通过
    - [x] **[AI]** 测试1：非 Android 环境跳过
    - [x] **[AI]** 测试1b：iOS 平台跳过
    - [x] **[AI]** 测试2：版本相同不下载
    - [x] **[AI]** 测试3：版本不同 → download + set
    - [x] **[AI]** 测试4：fetch 网络错误静默
    - [x] **[AI]** 测试5：manifest JSON 非法静默
    - [x] **[AI]** 测试6：manifest.version 缺失不下载
    - [x] **[AI]** 测试7：notifyAppReady 失败后继续
    - [x] **[AI]** 测试8：download 3次失败不调 set
    - [x] **[AI]** 测试9：http URL 被拒绝
    - [x] **[AI]** 测试10：set 失败重置状态
    - [x] **[AI]** 测试11：list 未找到 fallback

### 阶段二：修改现有文件

- [x] **[AI]** 修改 `frontend/lib/store.ts`
  - 在 AppState 接口中新增 `otaProgress: number | null` 和 `otaDone: boolean`
  - 在 AppState 接口中新增 `setOtaProgress: (progress: number | null) => void` 和 `setOtaDone: (done: boolean) => void`
  - 在 store 初始值中新增 `otaProgress: null, otaDone: false`
  - 在 store actions 中新增 setter 实现
  - 自检：TS 类型检查通过；现有测试不受影响

- [x] **[AI]** 修改 `frontend/app/page.tsx`
  - 顶部添加 `import { useOtaUpdater } from "@/lib/use-ota-updater"`
  - 在 `Page` 函数体第一行（所有 `useStore`/`useState` 之前）添加 `useOtaUpdater()`
  - 自检：hook 位于所有条件 return 之前；无 React Hook 规则违规

### 阶段三：文档驱动闭环更新

- [x] **[AI]** 更新 `specs/structure.md`：新增 `lib/ota-version.ts` 和 `lib/use-ota-updater.ts` 文件说明
- [x] **[AI]** 更新 `frontend/CLAUDE.md`：代码-规范映射表新增 OTA 相关文件条目
- [x] **[AI]** 更新 `specs/tech.md` §6：新增 OTA 热更新简要说明
- [x] **[AI]** 更新 `specs/CHANGELOG.md`：记录本次变更

### 阶段四：用户手动操作（非 AI 任务）

- [ ] **[用户]** Supabase 控制台创建 public bucket `ota-updates`
- [ ] **[用户]** 上传初始 `ota-manifest.json` 至 bucket 根目录
- [ ] **[用户]** 运行 `ota-deploy.bat 1.0.0` 生成 zip 并上传至 `ota-updates/bundles/`
- [ ] **[用户]** 重编译 APK（`npx cap sync android` → Android Studio 编译 → GitHub Releases）

---

## 三、现有基础设施盘点

| 组件 | 状态 | 文件路径 |
|------|------|----------|
| `@capgo/capacitor-updater` 依赖 | ✅ 已安装 v7.43.3 | `package.json` |
| Capacitor 插件配置 | ✅ 已配置 `autoUpdate: false` | `capacitor.config.ts` |
| 单元测试（11 用例） | ✅ 已编写 | `lib/__tests__/use-ota-updater.test.ts` |
| 部署脚本 | ✅ 已创建 | `ota-deploy.bat` |
| 初始 bundle | ✅ 已生成 | `ota-bundle-1.0.0.zip` (74.8 MB) |
| `lib/ota-version.ts` | ❌ 缺失 | — |
| `lib/use-ota-updater.ts` | ❌ 缺失 | — |
| Store OTA 状态 | ❌ 缺失（`setOtaProgress`/`setOtaDone`） | `lib/store.ts` |
| `page.tsx` 集成 | ❌ 未调用 `useOtaUpdater()` | `app/page.tsx` |
| Supabase Storage bucket | ❌ 需用户手动创建 | Supabase 控制台 |

---

## 四、需实现的文件清单

### 4.1 新增文件

#### 4.1.1 `frontend/lib/ota-version.ts`

导出当前 bundle 版本号常量，每次 OTA 发布时更新。

```typescript
export const BUNDLE_VERSION = "1.0.0";
```

#### 4.1.2 `frontend/lib/use-ota-updater.ts`

核心 OTA 更新逻辑模块。导出：
- `runOtaUpdate()` — 纯异步函数，封装完整更新流程（测试友好，不依赖 React）
- `useOtaUpdater()` — React hook 包装，在 `useEffect([], [])` 中调用 `runOtaUpdate()`
- `_resetOtaRunningForTest()` — 仅测试用，重置模块级防重入标志

**`runOtaUpdate()` 完整逻辑：**

1. **防重入检查**：模块级 `_otaRunning` 标志，防止多次调用
2. **平台门控**：`window.Capacitor?.getPlatform?.()` 不为 `'android'` 时直接 return
3. **动态 import**：`await import('@capgo/capacitor-updater')` 获取 `CapacitorUpdater`
4. **notifyAppReady()**：独立 try/catch，失败不中断后续流程，`console.warn` 记录
5. **拉取 manifest**：`fetch(MANIFEST_URL + '?t=' + Date.now())` 破缓存
   - MANIFEST_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ota-updates/ota-manifest.json`
   - 检查 `response.ok`，非 200 时 warn 并 return
6. **防御性校验 manifest**：
   - `manifest.version` 必须为非空字符串
   - `manifest.url` 必须以 `https://` 开头
   - 校验失败 → `console.warn('[OTA] Invalid manifest:', manifest)` + return
7. **版本比对**：`manifest.version === BUNDLE_VERSION` 时跳过（已是最新）
8. **下载 bundle**：`const bundle = await CapacitorUpdater.download({ url: manifest.url, version: manifest.version })`
   - 返回值类型 `{ id: string, version: string, ... }`，后续步骤使用 `bundle.id`
   - 带重试机制：最多 3 次，指数退避（2s → 4s → 8s），使用 `setTimeout` + `Promise` 包装延迟
   - 每次失败 `console.warn('[OTA] Download attempt N failed:', error)` 记录
   - 3 次全部失败后 return，不调用 `set()`
   - 下载进度通过 `useStore.getState().setOtaProgress(percent)` 更新（供 UI 可选展示）
9. **验证 bundle 完整性**：`CapacitorUpdater.list()` 确认 bundle 存在
   - 找到 → 使用 list 中的 bundle id
   - 未找到 → fallback 使用 download 返回的 id
10. **调度激活**：`CapacitorUpdater.set({ id: bundleId })`
    - 使用 `set()` 而非 `next()`（与测试一致）
    - 成功后 `setOtaDone(true)` 通知 store
    - 失败 → `setOtaProgress(null)` + `setOtaDone(false)` 重置状态
11. **全流程外层 try/catch**：任何未预期错误 `console.warn('[OTA] ...', error)` 静默处理

**OTA 日志上报（fire-and-forget）：**
- 关键节点（下载开始、下载成功、激活成功、各类失败）向 Supabase `ota_logs` 表插入记录
- 使用 `supabase.from('ota_logs').insert(...)` 不 await，不影响主流程
- 此功能为可选增强，如不建 `ota_logs` 表则插入静默失败，无影响

### 4.2 修改文件

#### 4.2.1 `frontend/lib/store.ts`

在 Zustand store 中新增 OTA 相关状态和 actions：

```typescript
// State
otaProgress: number | null;   // 下载进度 0-100，null 表示未在更新
otaDone: boolean;              // 是否有新版本已就绪（下次重启生效）

// Actions
setOtaProgress: (progress: number | null) => void;
setOtaDone: (done: boolean) => void;
```

- 初始值：`otaProgress: null, otaDone: false`
- 这些状态供 UI 层可选消费（如显示更新进度条、"新版本已就绪"提示）
- `logout` action 中无需重置（OTA 与登录状态无关）
- **访问方式**：`use-ota-updater.ts` 中通过 `useStore.getState().setOtaProgress()` / `useStore.getState().setOtaDone()` 调用（非 hook 方式，因 `runOtaUpdate()` 是纯异步函数）

#### 4.2.2 `frontend/app/page.tsx`

在 `Page` 组件函数体最顶部（所有 `useStore`、`useState` 之前）添加：

```typescript
import { useOtaUpdater } from "@/lib/use-ota-updater";

export default function Page() {
  useOtaUpdater(); // 必须在所有条件 return 之前
  // ...existing code
}
```

**原因**：`page.tsx` 存在 `isChecking` 和 `!isLoggedIn` 的提前 return。若 hook 放在条件之后，未登录时 `notifyAppReady()` 无法执行，导致插件误判为崩溃触发回滚。

---

## 五、技术架构

### 5.1 更新流程

```
App 冷启动
    ↓
Page mount → useOtaUpdater() → runOtaUpdate()
    ↓
平台检查：是 Android Capacitor？
    ├─ 否 → return（Web/iOS 跳过）
    └─ 是 ↓
        notifyAppReady()          ← 声明当前 bundle 健康
            ↓
        fetch(ota-manifest.json)  ← 从 Supabase Storage 读取版本清单
            ↓
        manifest.version === BUNDLE_VERSION？
            ├─ 是 → 已最新，return
            └─ 否 ↓
                download({ url, version })  ← 后台下载新 bundle（支持 3 次重试）
                    ↓
                list() 验证 bundle 完整性
                    ↓
                set({ id })  ← 调度激活（下次冷启动/后台恢复生效）
                    ↓
                store.setOtaDone(true)
```

### 5.2 存储结构（Supabase Storage）

```
Bucket: ota-updates  (public, 无需鉴权)
├── ota-manifest.json          ← 版本清单
└── bundles/
    ├── bundle-1.0.0.zip       ← 初始包
    ├── bundle-1.0.1.zip       ← OTA 增量包
    └── ...
```

**ota-manifest.json 格式：**
```json
{
  "version": "1.0.1",
  "url": "https://vbkudlbzfzmzuzpzhlox.supabase.co/storage/v1/object/public/ota-updates/bundles/bundle-1.0.1.zip"
}
```

### 5.3 版本号体系

| 版本类型 | 位置 | 用途 | 修改时机 |
|---|---|---|---|
| App 原生版本 | `android/app/build.gradle` → `versionCode`/`versionName` | APK 分发标识 | 重新编译 APK 时 |
| Bundle 版本 | `frontend/lib/ota-version.ts` → `BUNDLE_VERSION` | OTA 版本比对 | 每次 OTA 发布时 |

版本号格式：`major.minor.patch`，OTA 发布递增 `patch`。

### 5.4 变更类型与更新方式

| 变更类型 | 更新方式 | 说明 |
|---|---|---|
| 前端代码（JS/CSS/HTML） | OTA 推送 | 无需重装 |
| Capacitor 插件增删 | APK 重编译 | 需 GitHub Releases |
| 原生代码（Android） | APK 重编译 | 需 GitHub Releases |
| `capacitor.config.ts` 原生配置 | APK 重编译 | 需 GitHub Releases |

### 5.5 回滚保护机制

`@capgo/capacitor-updater` 内置回滚：新 bundle 激活后若 `notifyAppReady()` 从未被调用（崩溃/白屏），插件自动回滚至上一健康 bundle。本实现在 `runOtaUpdate()` 最早阶段调用 `notifyAppReady()`，确保正常运行时始终声明健康。

### 5.6 Manifest URL 构造

基于现有环境变量 `NEXT_PUBLIC_SUPABASE_URL`，无需新增配置：

```typescript
const MANIFEST_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ota-updates/ota-manifest.json`;
```

附加 `?t=Date.now()` 时间戳破 CDN/浏览器缓存。

### 5.7 CORS

Supabase Storage public bucket 默认允许所有来源 CORS。Capacitor WebView 内 fetch 可直接访问 manifest 和 bundle 下载地址，无需额外配置。

---

## 六、OTA 日常发布流程

```
1. 修改前端代码
2. 更新 frontend/lib/ota-version.ts 中的 BUNDLE_VERSION（如 "1.0.1"）
3. 运行 frontend/ota-deploy.bat 1.0.1
   └── 自动 build + 生成 ota-bundle-1.0.1.zip
4. Supabase 控制台上传 bundle-1.0.1.zip 至 ota-updates/bundles/
5. 更新 ota-updates/ota-manifest.json 中 version 和 url
6. 完成 ✅ —— 用户下次打开 App 自动获取更新
```

---

## 七、用户手动操作（一次性初始化）

以下步骤在首次部署时完成一次：

1. **Supabase Storage 创建 Bucket**：新建 public bucket `ota-updates`
2. **上传初始 manifest**：`ota-manifest.json`（version: "1.0.0"，url 指向 bundle-1.0.0.zip）
3. **上传初始 bundle**：`ota-deploy.bat 1.0.0` 生成 zip → 上传至 `ota-updates/bundles/`
4. **重编译 APK**（一次性）：`npx cap sync android` → Android Studio 编译 → GitHub Releases 发布

---

## 八、单元测试

测试文件已存在：`frontend/lib/__tests__/use-ota-updater.test.ts`（11 个用例）

| # | 测试用例 | 预期结果 |
|---|---|---|
| 1 | 非 Android 环境（无 window.Capacitor） | 所有插件方法不被调用 |
| 1b | iOS 平台 | 所有插件方法不被调用 |
| 2 | Android + manifest 版本 === BUNDLE_VERSION | `notifyAppReady` 调用，`download` 不调用 |
| 3 | Android + manifest 版本 !== BUNDLE_VERSION | `notifyAppReady` + `download` + `set` 均调用 |
| 4 | fetch 网络错误 | 静默处理，`console.warn` 记录 |
| 5 | manifest JSON 非法 | 静默处理，不下载 |
| 6 | manifest.version 为 null/undefined | 不触发下载，`console.warn` 记录 |
| 7 | `notifyAppReady()` 失败 | 后续逻辑继续，`download` 仍执行 |
| 8 | `download()` 3 次均失败 | `set()` 不被调用 |
| 9 | manifest.url 为 http（非 https） | 拒绝下载 |
| 10 | `set()` 失败 | 进度状态重置（`setOtaProgress(null)` + `setOtaDone(false)`） |
| 11 | `list()` 未找到 bundle | fallback 使用 download 返回的 bundle id |

实现代码必须确保以上 11 个已有测试全部通过。

---

## 九、边界情况与错误处理

| 情况 | 处理方式 |
|---|---|
| 无网络 | fetch 异常被 catch 静默处理，App 正常运行 |
| Supabase Storage 不可达 | 同上 |
| manifest.url 非 HTTPS | 跳过下载，warn 记录 |
| manifest 字段缺失/格式错误 | 校验不通过，跳过更新 |
| 新 bundle 损坏/加载失败 | 插件回滚机制自动恢复 |
| 下载超时/中断 | 重试 3 次（指数退避），全部失败则放弃本次更新 |
| `set()` 失败（bundle 不存在） | 重置 store 状态，warn 记录 |
| iOS / Web 环境 | 平台检查直接跳过所有逻辑 |
| 多次 mount（React StrictMode） | 防重入标志 `_otaRunning` 保证只执行一次 |
| CDN 缓存旧 manifest | URL 附加时间戳 `?t=Date.now()` |
| 用户在更新下载中切换 App | download 继续后台运行，set 在下次启动时生效 |

---

## 十、对现有系统的影响评估

| 影响项 | 评估 |
|---|---|
| `lib/store.ts` | 新增 2 个状态 + 2 个 actions，不影响现有状态和逻辑 |
| `app/page.tsx` | 顶部新增一行 hook 调用，不影响渲染逻辑和条件分支 |
| 构建产物 | `ota-version.ts` 被 bundle 但体积极小（< 100 bytes） |
| 启动性能 | `runOtaUpdate()` 全异步执行，不阻塞渲染。动态 import 仅在 Android 环境加载插件 |
| 现有测试 | 不影响。OTA 测试独立运行 |
| Web 端 / Vercel 部署 | 平台检查直接跳过，零影响 |
| 现有 APK 编译流程 | 无需修改 `build_android.bat`。首次需重编译以集成原生插件 |

---

## 十一、文档驱动闭环更新

按照 CLAUDE.md 闭环协议，本次实现需同步更新以下文档：

| 文档 | 更新内容 |
|------|----------|
| `specs/structure.md` | 新增 `lib/ota-version.ts` 和 `lib/use-ota-updater.ts` 文件说明 |
| `frontend/CLAUDE.md` | 代码-规范映射表新增 `lib/ota-version.ts` 和 `lib/use-ota-updater.ts` 条目（对应 tech.md §6 跨平台适配） |
| `specs/tech.md` | §6 跨平台适配章节新增 OTA 热更新说明（简要描述，指向实现文档） |
| `specs/CHANGELOG.md` | 记录本次 OTA 热更新实现变更 |

---

## [已确认决策]

| 编号 | 决策项 | 确认方案 |
|---|---|---|
| D1 | 激活策略 | **`set()` 立即激活** — 遵循已有测试，使用 `set()` 方法激活新 bundle |
| D2 | OTA 日志表 | **暂不建表** — 代码保留 `supabase.from('ota_logs').insert()` 调用，静默失败无影响，日后需要分析时再建表 |
