# 🌟 Particle Skeleton Visualization & Storyteller

一个基于 **Three.js**、**MediaPipe** 和 **Generative AI** 的沉浸式交互艺术项目。通过摄像头捕捉人体姿态，结合语音交互，生成个性化的诗歌与视觉故事。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Three.js](https://img.shields.io/badge/Three.js-0.160.0-green.svg)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks--Vision-orange.svg)
![Flask](https://img.shields.io/badge/Backend-Flask-lightgrey.svg)
![DashScope](https://img.shields.io/badge/AI-DashScope-purple.svg)

## ✨ 核心特性

### 🎨 视觉与交互
- **实时多人姿态检测**：使用 MediaPipe 同时追踪多人骨骼关键点。
- **3D 角色与粒子系统**：支持 3D 模型（如圣诞老人、姜饼人）与粒子特效的无缝切换。
- **手势交互控制**：通过特定的手势控制故事播放、角色切换和特效触发。
- **故事碎片系统**：围绕场景飞旋的四芒星碎片，承载着生成的诗歌与画作。

### 🤖 生成式 AI 能力
- **语音转诗歌**：录制语音，通过 Qwen-Plus 大模型生成意境优美的诗歌。
- **文生图 (T2I)**：基于生成的诗歌，自动调用 Wan2.1 模型生成唯美配图。
- **本地持久化**：生成的故事和图片会自动保存到本地，构建你的专属回忆录。

## 🎮 交互指南 (手势与操作)

| 动作/手势 | 触发效果 | 说明 |
| :--- | :--- | :--- |
| **双手举过头顶** | 🔄 **切换角色** | 随机切换当前的 3D 角色模型 |
| **单指伸出** (食指) | 📖 **阅读故事** | 选中并展开当前的故事碎片，显示诗歌与配图 |
| **双指伸出** (食指+拇指/中指) | ↔️ **滑动切换** | 进入滑动模式，左右移动手部可像转盘一样切换故事卡片 |
| **气功波姿势** (双手推掌) | ⚡ **能量波** | 双手在胸前聚气推出，触发炫酷的能量波束特效 |
| **点击麦克风** | 🎤 **语音创作** | 录制一段话，AI 将为你生成一首诗和一张画 |

## 🚀 快速开始

### 1. 环境准备

确保你的电脑已安装以下工具：
- **Node.js** & **npm**
- **Python 3.8+**
- **FFmpeg** (音频格式转换必备)
  - Windows: 下载并配置环境变量，或确保 `imageio-ffmpeg` 库已安装。
  - Mac/Linux: `brew install ffmpeg` or `apt install ffmpeg`

### 2. 后端设置 (Python)

进入项目根目录，安装 Python 依赖：

```bash
# 推荐创建虚拟环境
python -m venv venv
# Windows 激活
.\venv\Scripts\activate
# Mac/Linux 激活
source venv/bin/activate

# 安装依赖库
pip install -r backend/requirements.txt
# 补充依赖 (如果 requirements.txt 不完整)
pip install flask flask-cors dashscope python-dotenv imageio-ffmpeg
```

**配置 API Key**:
在项目根目录创建 `.env` 文件，填入你的阿里云 DashScope API Key：
```env
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

启动后端服务器：
```bash
python backend/app.py
```
*后端默认运行在 `http://localhost:3000`*

### 3. 前端设置

前端使用简单的 HTTP 服务器即可运行。

```bash
# 安装依赖 (如果有 package.json)
npm install

# 启动前端 (或使用 Live Server)
npm run serve
# 或者直接使用 python 启动简单服务
python -m http.server 8080
```

访问：`http://localhost:8080/skeleton.html` (确保端口与后端 CORS 配置一致)

## 📦 依赖列表 (Requirements)

### Python (Backend)
请确保安装以下库 (`backend/requirements.txt`)：
```txt
flask
flask-cors
dashscope
python-dotenv
imageio-ffmpeg
```

### 工具软件
- **FFmpeg**: 用于后端将浏览器录制的 WebM 音频转换为 WAV 格式以进行语音识别。

## 📁 项目结构

```
particle/
├── backend/
│   ├── app.py              # Flask 后端，处理 API 请求
│   ├── stories.json        # 故事数据存储
│   └── requirements.txt    # Python 依赖
├── frontend/
│   └── particle/
│       ├── skeleton.html   # 主页面
│       ├── js/
│       │   ├── skeleton.js      # 核心逻辑 & 手势识别
│       │   ├── storyFragments.js # 故事碎片 3D 系统
│       │   ├── audioManager.js   # 音频录制与 API 调用
│       │   └── ...
│       └── story_images/   # 生成的图片保存目录
├── models/                 # 3D 模型文件 (GLTF/GLB)
└── README.md
```

## 🛠️ 技术栈

- **Frontend**: Three.js, MediaPipe, HTML5 Audio API
- **Backend**: Flask
- **AI Models**: 
  - LLM: Qwen-Plus (通义千问)
  - ASR: Gummy (语音识别)
  - T2I: Wan2.1-T2I-Flash (通义万相)

---
*Created by ReinerBRO*
