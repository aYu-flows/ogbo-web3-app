
# APK 编译与 OTA 热更新发布规范

## 编译环境

- 编译 APK 需调用用户已安装的 Android Studio
- Android Studio JBR 路径：`C:\Program Files\Android\Android Studio\jbr`

---

## 发布方式概览

本项目有 **两种** 发布方式，根据变更类型选择：

| 变更类型 | 发布方式 | 说明 |
|---------|---------|------|
| 前端代码（JS/CSS/HTML/逻辑） | **OTA 热更新**（推荐） | 无需重装，用户下次打开 App 自动生效 |
| Capacitor 插件增删 | APK 重新编译 | 必须重装 |
| 原生代码（Android） | APK 重新编译 | 必须重装 |
| `capacitor.config.ts` 配置变更 | APK 重新编译 | 必须重装 |

> **优先使用 OTA**：绝大多数前端改动（功能开发、bug 修复、UI 调整）都应通过 OTA 发布，速度快且用户无感。只有涉及原生层变更时才需要重新编译 APK。

---

## 一、OTA 热更新发布（常用）

### 前置条件

- 项目根目录 `.env` 文件中需包含 `SUPABASE_SERVICE_ROLE_KEY` 和 `SUPABASE_URL`
- Supabase Storage 已创建 public bucket `ota-updates`（一次性，已完成）
- Node.js 依赖 `adm-zip` 已安装（`devDependencies`，已完成）

### 发布流程

> **注意**：此流程仅在用户明确要求发布 OTA 时执行，不要主动执行。

```bash
# 1. 更新版本号（递增 patch）
#    修改 frontend/lib/ota-version.ts 中的 BUNDLE_VERSION
#    例如 "1.0.5" → "1.0.6"

# 2. 同步更新版本标志
#    修改 frontend/components/pages/HomePage.tsx 安全提示卡片中的标志
#    搜索 select-none">X.XX</span>，将数字改为新版本（如 "1.06"）

# 3. 一键发布（构建 + 打包 + 上传 + 更新 manifest，全自动）
cd frontend
ota-deploy.bat 1.0.6
```

**脚本自动执行的步骤：**
1. 校验 `ota-version.ts` 中的版本号是否与参数一致
2. `BUILD_TARGET=capacitor pnpm build` 构建 Next.js 静态导出（**必须**带 `BUILD_TARGET=capacitor`，生成相对路径 `./_next/...`）
3. 用 `adm-zip`（Node.js）打包 `out/` 为 `ota-bundle-{version}.zip`（**必须**使用正斜杠路径，不能用 PowerShell `Compress-Archive`）
4. 上传 zip 到 Supabase Storage `ota-updates/bundles/`
5. 更新 `ota-manifest.json` 版本号和下载 URL
6. 验证 manifest 内容

**完成后**：已安装 App 的用户下次打开时自动后台下载新版本，关闭再打开即生效。

### AI 执行 OTA 发布的完整命令序列

当 AI 需要执行 OTA 发布时，按以下步骤操作：

```bash
# Step 1: 更新 frontend/lib/ota-version.ts 中 BUNDLE_VERSION 为目标版本
# Step 2: 更新 frontend/components/pages/HomePage.tsx 中安全提示卡片版本标志

# Step 3: 读取 .env 获取 Supabase 凭据
#   SUPABASE_SERVICE_ROLE_KEY=<from .env>
#   SUPABASE_URL=<from .env>

# Step 4: 构建（⚠️ 必须带 BUILD_TARGET=capacitor！否则生成绝对路径导致白屏）
cd frontend
BUILD_TARGET=capacitor pnpm build

# Step 5: 打包（⚠️ 必须用 adm-zip！PowerShell Compress-Archive 产生反斜杠路径导致 Android 白屏）
node -e "const z=require('adm-zip');const a=new z();a.addLocalFolder('./out','');a.writeZip('./ota-bundle-VERSION.zip');"

# Step 6: 上传 bundle（POST 新建，若 409 冲突则改 PUT 覆盖）
curl -s -X POST "$SUPABASE_URL/storage/v1/object/ota-updates/bundles/bundle-VERSION.zip" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/zip" \
  --data-binary @ota-bundle-VERSION.zip

# Step 7: 更新 manifest
curl -s -X PUT "$SUPABASE_URL/storage/v1/object/ota-updates/ota-manifest.json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"version":"VERSION","url":"SUPABASE_URL/storage/v1/object/public/ota-updates/bundles/bundle-VERSION.zip"}'

# Step 8: 验证
curl -s "$SUPABASE_URL/storage/v1/object/public/ota-updates/ota-manifest.json?t=$(date +%s)"
```

### ⚠️ 致命陷阱（曾导致反复白屏）

| 陷阱 | 后果 | 正确做法 |
|------|------|----------|
| 构建时缺少 `BUILD_TARGET=capacitor` | HTML 中 JS/CSS 引用为绝对路径 `/_next/...`，OTA bundle 加载时 404 → 白屏 | 始终 `BUILD_TARGET=capacitor pnpm build` |
| 用 PowerShell `Compress-Archive` 打包 | zip 内路径为 `_next\static\...`（反斜杠），Android 解压后目录结构错误 → 白屏 | 用 `adm-zip`（Node.js）或任何生成正斜杠的工具 |
| 只改 `ota-version.ts` 忘改 HomePage 标志 | 用户无法通过视觉确认 OTA 是否生效 | 两处同步修改 |

### 版本号规则

- 格式：`major.minor.patch`（如 `1.0.6`）
- OTA 发布时递增 `patch`
- 版本号需同步维护两处：
  - `frontend/lib/ota-version.ts` → `BUNDLE_VERSION` 常量（OTA 比对用）
  - `frontend/components/pages/HomePage.tsx` → 安全提示卡片右下角标志（肉眼验证用，格式 `X.0Y`）

---

## 二、APK 编译发布（仅原生层变更时使用）

### 发布流程

> **注意**：此流程仅在用户明确要求编译 APK 时执行，不要主动执行。
> **编译即发布**：编译完成后必须自动上传到 GitHub Releases，无需额外确认。

```bash
# 1. 构建 web bundle（APK 内置用，不需要 BUILD_TARGET=capacitor）
cd frontend
pnpm build
# 输出：frontend/out/

# 2. 同步原生代码
npx cap sync android

# 3. 编译 APK（需设置 JAVA_HOME）
cd android
JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew assembleDebug
# 输出：frontend/android/app/build/outputs/apk/debug/app-debug.apk

# 4. 复制到项目根目录 + 上传到 GitHub Releases（覆盖旧版本）
cp app/build/outputs/apk/debug/app-debug.apk ../../OGBOX-v1.0.apk
cd ../..
gh release upload v1.0 OGBOX-v1.0.apk --clobber
```

**文件命名规则**：固定为 `OGBOX-v1.0.apk`，永不改变。
**下载链接（固定）**：`https://github.com/aYu-flows/ogbo-web3-app/releases/download/v1.0/OGBOX-v1.0.apk`

---

## 重要说明

- `.env` 文件包含 Supabase Service Role Key，被 `.gitignore` 忽略，永不提交
- `frontend/public/download/OGBOX-v1.0.apk` 被 .gitignore 忽略，永不提交
- `ota-bundle-*.zip` 为构建产物，无需提交
- APK 上传后可通过固定链接立即验证是否更新成功
- 编译和上传属于 GitHub 操作，需用户明确要求才执行（参见根 `CLAUDE.md` 开发规范）
