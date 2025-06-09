# CF-Webhook

[English](README.md) | [中文文档](README_CN.md)

基于 Cloudflare Workers 和 Next.js 构建的现代化 Webhook 管理平台。

## ✨ 功能特性

- **🚀 实时 Webhook 接收** - 支持所有 HTTP 方法（GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS）
- **📊 实时请求监控** - 基于轮询的实时请求展示和监控
- **🔍 智能搜索过滤** - 多维度过滤：方法类型、内容类型、IP 地址等
- **📱 响应式设计** - 完美适配桌面端和移动端设备
- **🔔 实时通知** - 浏览器通知、声音提醒、Toast 消息
- **💾 本地存储** - 基于 localStorage 的数据持久化
- **⚡ 高性能** - 基于 Cloudflare Workers 的全球分布式部署

## 🚀 快速开始

### 一键部署（推荐）

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yingca1/cf-webhook) 

**准备要求：**
- Cloudflare 账户（免费版即可）
- GitHub 账户

部署完成后，您的 Webhook 服务将在 `https://your-app-name.your-subdomain.workers.dev` 上线。

### 手动部署（可选）

```bash
# 克隆仓库
git clone https://github.com/yingca1/cf-webhook.git
cd cf-webhook

# 安装依赖
pnpm install

# 登录 Cloudflare
wrangler login

# 本地开发
pnpm run dev

# 部署到生产环境
pnpm run deploy
```

## 📋 使用方法

1. **创建 Webhook**：访问应用首页，系统会自动创建新的 Webhook 并跳转到监控页面
2. **Webhook URL**：每个 Webhook 都有唯一的 URL：`https://your-domain.workers.dev/w/{webhookId}`
3. **监控请求**：在监控页面查看实时请求
4. **自动轮询**：支持自动轮询（默认 10 秒间隔）
5. **请求详情**：点击任意请求查看详细信息


## 📝 开源协议

本项目基于 MIT 协议开源
