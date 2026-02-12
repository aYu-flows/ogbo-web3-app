# OGBOX Web3 Social App

A next-generation Web3 social wallet application combining decentralized finance with social networking features.

## 🚀 Features

- **Multi-chain Wallet**: Support for Ethereum, BSC, Polygon, and more
- **Social Chat**: Built-in messaging with Web3 contacts
- **DeFi Integration**: Swap, stake, and manage crypto assets
- **NFT Gallery**: View and manage your NFT collection
- **DApp Browser**: Explore decentralized applications
- **Real-time Market Data**: Track cryptocurrency prices and trends

## 🛠 Tech Stack

- **Frontend**: Next.js 16 + React 19 + TypeScript
- **Styling**: Tailwind CSS + Framer Motion
- **State Management**: Zustand
- **Mobile**: Capacitor (iOS + Android)
- **Deployment**: Vercel (Web)

## 📱 Platforms

- 🌐 Web: [https://ogbox-web3-app.vercel.app](https://ogbox-web3-app.vercel.app)
- 📱 Android: Available as APK
- 🍎 iOS: Coming soon

## 🔧 Development

```bash
cd frontend
pnpm install
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 📦 Build

### Web
```bash
pnpm build
```

### Android
```bash
npx cap sync android
cd android && ./gradlew assembleDebug
```

---

## 🌐 Web 端访问 / Web Access

### 访问地址 / URL

**生产环境 URL / Production**: https://ogbo-web3-app.vercel.app

### 使用方式 / Usage

1. 在任何现代浏览器中打开上述 URL
2. 支持桌面端和移动端浏览器
3. 建议使用 Chrome、Safari、Edge 浏览器以获得最佳体验

---

## 📱 Android App 安装 / Installation

### 获取安装包 / Download

**APK 文件名**: `OGBOX-v1.0.apk`
**文件大小**: 约 4 - 5 MB
**支持系统**: Android 7.0 及以上版本

### 安装步骤 / Installation Steps

#### 方法一: 直接安装（推荐）/ Direct Installation (Recommended)

1. **下载 APK**
   - 从提供的链接下载 APK 文件到您的 Android 设备
   - 或通过 USB 将 APK 复制到设备

2. **允许安装未知应用**
   - **Android 8.0+**:
     1. 点击 APK 文件开始安装
     2. 如果提示"不允许安装未知应用"
     3. 点击"设置" → 启用"允许来自此来源的应用"
     4. 返回继续安装

   - **Android 7.x**:
     1. 进入"设置" → "安全"
     2. 启用"未知来源"
     3. 点击 APK 文件安装

3. **完成安装**
   - 点击"安装"按钮
   - 等待安装完成（约 10-30 秒）
   - 点击"打开"启动 App

#### 方法二: 通过 ADB 安装（技术用户）/ ADB Installation

```bash
adb install OGBOX-v1.0.apk
```

---

## ❓ 常见问题 / FAQ

### Web 端

**Q: 为什么点击"连接钱包"没有反应？**
A: 当前版本为 UI 交互展示版，钱包连接功能会展示 UI 流程，但不会实际连接 Web3 钱包。实际功能将在下一版本实现。

**Q: 可以在手机浏览器访问吗？**
A: 可以。Web 端采用响应式设计，支持在移动端浏览器访问。

### Android App

**Q: 为什么安装时显示"此应用可能有风险"？**
A: 这是正常提示。因为 APK 不是从 Google Play 下载的，Android 会显示此警告。这是内部测试版本，可以安全安装。

**Q: App 需要联网吗？**
A: 不需要。当前版本的 UI 和资源都打包在 APK 中，可以离线体验。

---

## 📄 License

Proprietary - All rights reserved

---

Built with ❤️ by the OGBOX Team

**文档版本**: 1.1
**更新日期**: 2026-02-12
