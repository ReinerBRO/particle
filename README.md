# 🌟 Particle Skeleton Visualization

一个基于 **Three.js** 和 **MediaPipe** 的实时多人骨骼粒子可视化艺术项目。通过摄像头捕捉人体姿态，并将其转化为梦幻般的粒子效果。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Three.js](https://img.shields.io/badge/Three.js-0.160.0-green.svg)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Tasks--Vision-orange.svg)

## ✨ 核心特性

### 已实现功能

- 🎥 **实时多人姿态检测**：使用 MediaPipe PoseLandmarker 同时追踪最多 2 人的 33 个关键点
- 🌈 **独立颜色系统**：每个人拥有独特的粒子颜色（红色、黄色），一眼识别
- 🌌 **智能粒子系统**：每人 2000+ 粒子动态渲染，形成流动的人体轮廓
- 💫 **高级辉光效果**：使用 Unreal Bloom 后处理实现梦幻科幻氛围
- 🎨 **体积填充技术**：躯干区域使用三角形重心坐标实现 3D 体积感
- 👁️ **骨骼显示切换**：一键控制骨骼结构显示/隐藏，专注粒子效果
- 🔄 **实时交互控制**：支持鼠标视角旋转（OrbitControls）
- 📱 **响应式设计**：自适应不同屏幕尺寸

## 🎬 效果预览

项目运行后，你将看到：
- 左上角显示摄像头实时画面
- 主画面展示由粒子构成的多人骨骼
- 每个人的粒子颜色不同（第1人：红色，第2人：黄色）
- 粒子会跟随多人动作实时变化
- 可通过左下角按钮切换骨骼显示

## 🚀 快速开始

### 前置要求

- 现代浏览器（支持 WebGL 2.0 和摄像头访问）
- Node.js & npm
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

打开浏览器访问：`http://localhost:8080/skeleton.html`

5. **允许摄像头权限**

首次访问时，浏览器会请求摄像头权限，点击"允许"即可。

## 📁 项目结构

```
particle/
├── frontend/
│   └── particle/
│       ├── skeleton.html       # 主页面
│       └── js/
│           └── skeleton.js     # 核心逻辑（多人检测）
├── node_modules/               # 依赖包
├── package.json                # 项目配置
├── package-lock.json
├── .gitignore
└── README.md
```

## 🛠️ 技术栈

### 前端框架
- **Three.js** (v0.160.0) - 3D 渲染引擎
  - OrbitControls - 相机控制
  - EffectComposer - 后处理管线
  - UnrealBloomPass - 辉光效果

### AI/CV 库
- **MediaPipe Tasks Vision** (v0.10.0) - Google 的姿态检测库
  - PoseLandmarker - 多人姿态检测
  - 实时检测最多 5 人（当前配置为 2 人）
  - 高精度追踪算法

### 开发工具
- Python HTTP Server - 本地开发服务器
- ES6 Modules - 模块化开发

## 🎨 核心技术实现

### 1. 多人姿态检测
使用 MediaPipe PoseLandmarker 检测每人 33 个关键点：
- 面部特征点（眼睛、鼻子、嘴巴）
- 上肢关键点（肩膀、肘部、手腕、手指）
- 躯干关键点（肩部、臀部）
- 下肢关键点（膝盖、脚踝、脚趾）

### 2. AuraCharacter 类系统
```javascript
class AuraCharacter {
    - 每人独立的粒子系统
    - 唯一颜色标识（colorIndex）
    - 骨骼可见性控制
    - 动态粒子更新
}
```

### 3. 智能粒子分布
- **2000 个粒子/人**（性能优化）
- **50% 粒子**分布在骨骼连接线上
- **50% 粒子**填充躯干三角形区域
- 使用**重心坐标**实现三角形内部粒子分布
- 动态噪声产生自然飘动效果

### 4. 颜色系统
```javascript
// 色相均匀分布
const baseHue = (colorIndex * 0.2) % 1.0;
// 人物 0: 红色 (hue ≈ 0.0)
// 人物 1: 黄色 (hue ≈ 0.2)
```

### 5. 渲染优化
- **自定义 GLSL Shader**：粒子渐变透明度
- **加法混合模式**：粒子叠加发光
- **Bloom 后处理**：梦幻辉光效果
- **动态显示控制**：按需渲染骨骼

## 🎮 使用说明

1. **启动应用**后，站在摄像头前（可多人）
2. **保持全身可见**以获得最佳效果
3. **移动身体**，粒子会实时跟随
4. **点击左下角按钮**切换骨骼显示
5. **鼠标拖拽**旋转视角
6. **滚轮缩放**调整观察距离

## ⚙️ 配置参数

在 `skeleton.js` 中可调整：

```javascript
// 最大人数（当前限制为2人）
const MAX_CHARACTERS = 2;

// 每人粒子数量
const particleCount = 2000;

// Bloom 辉光强度
bloomPass.strength = 2.0;

// 粒子大小范围
sizes[i] = Math.random() * 0.15;

// 躯干体积厚度
const thicknessZ = 0.8;
```

## 🐛 常见问题

### Q: 摄像头无法启动
**A**: 
- 检查浏览器是否允许摄像头权限
- 确保使用 localhost 或 HTTPS
- 尝试刷新页面重新授权

### Q: 只检测到一个人
**A**:
- 确保两人都在摄像头视野内
- 保持适当距离，避免重叠
- 光线充足有助于检测

### Q: 粒子不跟随动作
**A**:
- 确保全身可见
- 检查浏览器控制台错误
- 刷新页面重新加载模型

### Q: 性能卡顿
**A**:
- 降低 `MAX_CHARACTERS` 至 1
- 减小 `particleCount`
- 降低 `bloomPass.strength`
- 关闭其他 GPU 占用应用

## 📝 未来实现计划

### 🎯 高优先级

- [ ] **粒子交互系统**
  - [ ] 两人接近时粒子互相吸引
  - [ ] 接触区域颜色混合效果
  - [ ] 粒子在两人间流动/交换
  - [ ] 多层次交互（轻度/中度/深度接触）

- [ ] **视觉增强**
  - [ ] 接触瞬间能量波扩散效果
  - [ ] 粒子脉冲动画
  - [ ] 粒子拖尾轨迹
  - [ ] 颜色混合生成第三种颜色

- [ ] **性能优化**
  - [ ] 空间分区加速粒子检测
  - [ ] WebGPU 支持
  - [ ] 自适应粒子数量

### 🎨 视觉效果

- [ ] 更多预设颜色方案
- [ ] 粒子形状自定义（星形、心形等）
- [ ] 背景音乐可视化联动
- [ ] 动态光源系统

### 🛠️ 功能扩展

- [ ] 支持更多人（3-5人）
- [ ] 录制功能（导出视频/GIF）
- [ ] 截图分享功能
- [ ] 移动端优化
- [ ] VR/AR 模式支持

### 🎛️ 交互控制

- [ ] UI 控制面板
  - 粒子数量滑块
  - 辉光强度调节
  - 颜色选择器
  - 交互强度控制
- [ ] 手势控制（如挥手切换效果）
- [ ] 语音命令支持

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

- [Three.js](https://threejs.org/) - 强大的 3D 渲染库
- [MediaPipe](https://google.github.io/mediapipe/) - Google 的机器学习解决方案
- [Unreal Bloom](https://threejs.org/examples/#webgl_postprocessing_unreal_bloom) - 辉光效果参考

## 📧 联系方式

- GitHub: [@ReinerBRO](https://github.com/ReinerBRO)
- 项目链接: [https://github.com/ReinerBRO/particle](https://github.com/ReinerBRO/particle)

---

⭐ 如果这个项目对你有帮助，请给个 Star！
