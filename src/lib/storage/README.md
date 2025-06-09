# Storage Architecture

这个存储系统设计为支持多种存储后端的抽象架构，主要分为两个层面：

## 架构概览

```
浏览器端 (Browser)
└── browser-storage.ts (localStorage)

服务端 (Server)  
└── storage/
    ├── storage-manager.ts    (统一管理器)
    ├── d1-provider.ts        (Cloudflare D1 数据库)
    ├── r2-provider.ts        (Cloudflare R2 对象存储)
    ├── memory-provider.ts    (内存存储)
    └── env-helper.ts         (环境检测)
```

## 数据流

```
Webhook 请求 → StorageManager → [D1|R2|Memory]Provider (统一接口)
                     ↓
浏览器轮询 → /api/poll/ → StorageManager → [D1|R2|Memory]Provider (统一接口)
                     ↓
localStorage 同步 → UI 显示
```

## 存储层说明

### 浏览器端存储
- **文件**: `src/lib/browser-storage.ts`
- **目的**: 为浏览器客户端提供localStorage基础的数据持久化
- **特点**: 
  - 仅在客户端工作
  - 支持SSR的服务端fallback
  - 数据导入/导出功能
  - 自动清理过期数据

### 服务端存储系统

#### StorageManager (存储管理器)
- **文件**: `storage-manager.ts`
- **目的**: 统一的存储接口，根据环境自动选择最佳的存储提供者
- **特点**:
  - 自动环境检测
  - Provider切换逻辑
  - 统一的API接口

#### D1 Provider (Cloudflare D1)
- **文件**: `d1-provider.ts`
- **目的**: Cloudflare D1 数据库存储实现
- **特点**:
  - SQL数据库存储
  - 结构化数据查询
  - 事务支持

#### R2 Provider (Cloudflare R2)
- **文件**: `r2-provider.ts`
- **目的**: Cloudflare R2 对象存储实现
- **特点**:
  - 对象存储
  - 大容量数据存储
  - 高可用性

#### Memory Provider (内存存储)
- **文件**: `memory-provider.ts`
- **目的**: 内存中的临时存储实现
- **特点**:
  - 开发/测试环境使用
  - 无持久化
  - 快速读写

#### Environment Helper (环境助手)
- **文件**: `env-helper.ts`
- **目的**: 检测运行环境和可用的存储选项
- **特点**:
  - 自动检测Cloudflare环境
  - 存储能力探测
  - 配置验证

## 使用方式

### 浏览器端
```typescript
import { getBrowserWebhookStorage } from '@/lib/browser-storage';

const storage = getBrowserWebhookStorage();
const webhooks = storage.getWebhooks();
```

### 服务端
```typescript
import { getStorageManager } from '@/lib/storage/storage-manager';

const storage = await getStorageManager();
const webhooks = await storage.getWebhooks();
```

## 环境支持

| 环境 | 浏览器存储 | 服务端存储 |
|------|-----------|-----------|
| 开发环境 | localStorage | Memory Provider |
| Cloudflare Workers | N/A | D1/R2 Provider |
| 其他部署环境 | localStorage | Memory Provider |

## 迁移注意事项

- 从旧的 `@/lib/storage` 迁移到 `@/lib/browser-storage`
- 服务端代码使用 `@/lib/storage/storage-manager`
- 接口保持向后兼容，函数名称未变化 