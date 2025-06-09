# CF-Webhook

[English](README.md) | [中文文档](README_CN.md)

A modern webhook management platform built with Cloudflare Workers and Next.js.

## ✨ Features

- **🚀 Real-time Webhook Reception** - Support for all HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
- **📊 Live Request Monitoring** - Real-time request display and monitoring with polling-based updates
- **🔍 Smart Search & Filtering** - Multi-dimensional filtering: method type, content type, IP address, and more
- **📱 Responsive Design** - Perfect adaptation for both desktop and mobile devices
- **🔔 Real-time Notifications** - Browser notifications, sound alerts, and toast messages
- **💾 Local Storage** - Data persistence based on localStorage
- **⚡ High Performance** - Global distributed deployment powered by Cloudflare Workers

## 🚀 Quick Start

### One-Click Deploy (Recommended)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yingca1/cf-webhook) 

**Requirements:**
- Cloudflare account (free tier available)
- GitHub account

After deployment, your webhook service will be live at `https://your-app-name.your-subdomain.workers.dev`.

### Manual Deployment

```bash
# Clone the repository
git clone https://github.com/yingca1/cf-webhook.git
cd cf-webhook

# Install dependencies
pnpm install

# Login to Cloudflare
wrangler login

# Local development
pnpm run dev

# Deploy to production
pnpm run deploy
```

## 📋 Usage

1. **Create Webhook**: Visit the app homepage - a new webhook will be automatically created and you'll be redirected to the monitoring page
2. **Webhook URL**: Each webhook has a unique URL: `https://your-domain.workers.dev/w/{webhookId}`
3. **Monitor Requests**: View real-time requests on the monitoring page
4. **Auto-Polling**: Automatic polling enabled (default 10-second interval)
5. **Request Details**: Click any request to view detailed information

## 📝 License

This project is licensed under the MIT License
