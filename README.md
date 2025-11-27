# 🌟 Particle Skeleton Visualization

一个基于 **Three.js** 和 **MediaPipe** 的实时人体骨骼粒子可视化艺术项目。通过摄像头捕捉人体姿态，并将其转化为梦幻般的粒子效果。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Three.js](https://img.shields.io/badge/Three.js-0.163.0-green.svg)

## ✨ 特性

- 🎥 **实时姿态检测**：使用 MediaPipe Pose 实时追踪人体 33 个关键点
- 🌌 **粒子系统**：5000+ 粒子动态渲染，形成流动的人体轮廓
- 💫 **辉光效果**：使用 Unreal Bloom 后处理实现梦幻辉光
- 🎨 **体积填充**：躯干区域使用三角形重心坐标实现体积感
- 🔄 **实时交互**：支持鼠标控制视角（OrbitControls）
- 📱 **响应式设计**：自适应不同屏幕尺寸

## 🎬 效果预览

项目运行后，你将看到：
- 左上角显示摄像头实时画面
- 主画面展示由粒子构成的人体骨骼
- 粒子会跟随你的动作实时变化
- 青绿色辉光效果营造科幻氛围

## 🚀 快速开始

### 前置要求

- 现代浏览器（支持 WebGL 和摄像头访问）
- Python 3.x（用于本地服务器）
- 摄像头设备

### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/ReinerBRO/particle.git
cd particle
```

2. **安装依赖**
```bash
npm install
```

3. **启动本地服务器**
```bash
npm run serve
```

4. **访问应用**

打开浏览器访问：`http://localhost:8080/particle/`

5. **允许摄像头权限**

首次访问时，浏览器会请求摄像头权限，点击"允许"即可。

## 📁 项目结构

```
particle/
├── frontend/
│   └── particle/
│       ├── index.html          # 主页面
│       └── js/
│           └── skeleton.js     # 核心逻辑
├── node_modules/               # 依赖包
├── package.json                # 项目配置
├── package-lock.json
├── .gitignore
└── README.md
```

## 🛠️ 技术栈

### 前端框架
- **Three.js** (v0.163.0) - 3D 渲染引擎
  - OrbitControls - 相机控制
  - EffectComposer - 后处理管线
  - UnrealBloomPass - 辉光效果

### AI/CV 库
- **MediaPipe Pose** - Google 的姿态检测库
  - 实时检测 33 个人体关键点
  - 高精度追踪算法

### 开发工具
- Python HTTP Server - 本地开发服务器
- ES6 Modules - 模块化开发

## 🎨 核心实现

### 1. 姿态检测
使用 MediaPipe Pose 检测 33 个人体关键点，包括：
- 面部特征点（眼睛、鼻子、嘴巴）
- 上肢关键点（肩膀、肘部、手腕、手指）
- 躯干关键点（肩部、臀部）
- 下肢关键点（膝盖、脚踝、脚趾）

### 2. 粒子系统
- **5000 个粒子**分布在骨骼连接和躯干区域
- **50% 粒子**分布在骨骼连接线上
- **50% 粒子**填充躯干三角形区域（形成体积感）
- 使用**重心坐标**实现三角形内部粒子分布
- 动态噪声让粒子产生自然飘动效果

### 3. 渲染优化
- **自定义 Shader**：粒子使用 GLSL 着色器实现渐变透明度
- **加法混合**：`AdditiveBlending` 实现粒子叠加发光
- **Bloom 后处理**：增强辉光效果，营造梦幻氛围

### 4. 坐标转换
```javascript
// MediaPipe 坐标 (0-1) → Three.js 世界坐标
const x = (0.5 - landmark.x) * 2;  // 居中并缩放
const y = (1 - landmark.y) * 2;     // Y 轴翻转
const z = -landmark.z;              // Z 轴翻转
```

## 🎮 使用说明

1. **启动应用**后，站在摄像头前
2. **保持全身可见**以获得最佳效果
3. **移动身体**，粒子会实时跟随你的动作
4. **鼠标拖拽**可旋转视角
5. **滚轮缩放**可调整观察距离

## ⚙️ 配置参数

在 `skeleton.js` 中可调整以下参数：

```javascript
// 粒子数量
const particleCount = 5000;

// Bloom 强度
bloomPass.strength = 2.0;

// 粒子大小
sizes[i] = Math.random() * 0.15;

// 躯干体积厚度
const thicknessZ = 0.8;
```

## 🐛 常见问题

### Q: 页面显示"Repository not found"
**A**: 确保已在 GitHub 创建同名仓库，并检查用户名是否正确。

### Q: 摄像头无法启动
**A**: 
- 检查浏览器是否允许摄像头权限
- 确保使用 HTTPS 或 localhost
- 尝试刷新页面重新授权

### Q: 粒子不跟随动作
**A**:
- 确保光线充足
- 保持全身在摄像头视野内
- 检查浏览器控制台是否有错误

### Q: 性能卡顿
**A**:
- 降低 `particleCount` 数量
- 减小 `bloomPass.strength` 值
- 关闭其他占用 GPU 的应用

## 📝 开发计划

- [ ] 添加多人检测支持
- [ ] 实现粒子颜色自定义
- [ ] 添加录制功能
- [ ] 支持背景音乐可视化
- [ ] 优化移动端性能

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Three.js](https://threejs.org/) - 强大的 3D 库
- [MediaPipe](https://google.github.io/mediapipe/) - Google 的机器学习解决方案
- [Unreal Bloom](https://threejs.org/examples/#webgl_postprocessing_unreal_bloom) - 辉光效果实现

## 📧 联系方式

- GitHub: [@ReinerBRO](https://github.com/ReinerBRO)
- 项目链接: [https://github.com/ReinerBRO/particle](https://github.com/ReinerBRO/particle)

---

⭐ 如果这个项目对你有帮助，请给个 Star！
