# Super Clipboard

“超级剪贴板”。专注云端直链文本与文件中转，配合自动销毁、设备绑定与访问凭证，让跨设备搬运内容不再痛苦。

## ✨ 核心能力

- **云端文本片段**：快速输入或从系统剪贴板导入文本，生成 5 位短码或 ≥7 位持久 Token，在受限环境下也能访问。
- **云端文件中转**：上传体积 ≤50MB 的文件，支持短码 / Token 双通道授权，满足配置包、脚本等资源的多设备传输。
- **环境设置持久化**：在设置栏配置持久 Token，创建片段时自动复用，方便后台鉴权与审计。
- **自动销毁机制**：可配置 1–120 小时有效期，并可设置 1–500 次访问上限；达到任一阈值后自动销毁并在列表中即时刷新状态。

## 🛠 技术栈

- **构建工具**：Vite 5 + TypeScript 5
- **前端框架**：React 18（函数式组件 + Hooks）
- **状态管理**：Zustand，自定义复合数据结构（云端片段 + 环境设置缓存）
- **后端服务**：FastAPI + SQLite（内置自动清理任务，支持下载次数上限）
- **代码质量**：ESLint（Flat Config）+ TypeScript 严格模式；后端使用 Pytest 回归用例
- **样式**：原子化 CSS 组件，兼顾桌面和窄屏体验

## 🚀 如何使用

```bash
# 安装依赖
npm install

# 本地开发（默认 http://localhost:5173）
npm run dev

# 生产构建与预览
npm run build
npm run preview

# 代码质量检查
npm run lint
npm run typecheck
```

1. **配置环境**：点击右上角“环境设置”，填写（或自动生成）持久 Token，保存后全局复用；该 Token 若 720 小时未使用会被自动销毁。
2. **创建云端片段**：选择文本或文件类型（≤50MB），设置 1–120 小时的自动销毁时间与访问次数上限，并在“访问凭证”中二选一使用 5 位短码或持久 Token。
3. **导入与分享**：文本可一键读取系统剪贴板，创建后点击徽章复制相应凭证；文件支持直接下载并记录次数。

## 🖥️ 快速启动后端（FastAPI）

```bash
# 基于 Miniconda 创建环境
conda env create -f environment.yml
conda activate super-clipboard

# 开发时建议将后端监听到 5174（避免与 Vite 冲突）
export SUPER_CLIPBOARD_APP_PORT=5174   # Windows 请使用 `set`
python -m backend

# 执行后端回归用例
pytest backend/tests
```

> 生产部署时，先执行 `npm run build` 生成 `dist/` 静态资源，再启动后端（默认监听 `0.0.0.0:5173`），此时只需对外暴露 5173 端口即可完成前后端一体化部署。若保持 Vite 开发服务器运行，请在启动前设置 `BACKEND_PORT=5174 npm run dev` 以便代理到新的后端端口。
