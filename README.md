# 🦅 Emoji Delta - 2D 网页端"搜打撤"游戏

基于 HTML5 Canvas 和纯原生 ES Modules 开发的硬核 2D "搜打撤"（Extraction Shooter）游戏。严格遵循 `CLAUDE.md` 与 `Master.md` 设计规格。

## 📁 项目结构

```
Emoji Delta/
├── client/                  # 前端客户端
│   ├── index.html          # 主页面（含开始画面 + HUD）
│   ├── style.css           # Glassmorphism UI（Google Fonts）
│   ├── maps/
│   │   └── factory_01.json # JSON 固定地图（数据驱动）
│   ├── data/
│   │   ├── loot.json       # 战利品定义（20 种，与代码解耦）
│   │   ├── operators.json  # 特工角色定义（3 种，属性/武器）
│   │   └── bots.json       # Bot 类型定义（7 种，属性/AI参数）
│   └── js/
│       ├── main.js         # 入口、游戏主循环、世界初始化
│       ├── constants.js    # 世界常量、配置
│       ├── entities.js     # Player, Bot, Loot, Wall 等实体类
│       ├── input.js        # 键盘/鼠标输入管理
│       ├── physics.js      # AABB 碰撞、射线检测、玩家移动
│       ├── ai.js           # Bot AI 状态机（数据驱动参数）
│       ├── maploader.js    # JSON 地图加载与解析
│       ├── lootdata.js     # 战利品数据加载器
│       ├── operatordata.js # 特工数据加载器
│       ├── botdata.js      # Bot 数据加载器（加权随机生成）
│       ├── sound.js        # Web Audio API 程序化音效（try-catch）
│       ├── renderer.js     # Canvas 渲染（棋盘格背景、实体、准星）
│       ├── hud.js          # HUD 更新、背包、通知
│       └── ui.js           # 开始画面、结算弹窗
├── server/                  # C# 权威服务器 (Phase 2)
│   ├── EmojiDelta.Server.csproj
│   ├── Program.cs          # 入口
│   ├── GameServer.cs       # WebSocket 服务、60Hz 游戏循环
│   ├── GameWorld.cs        # 权威世界状态、碰撞、Bot AI
│   ├── PlayerSession.cs    # 玩家状态、反作弊
│   ├── Messages.cs         # WebSocket 协议定义
│   └── SpatialHash.cs      # O(1) 空间哈希
├── Master.md               # 游戏设计文档
├── CLAUDE.md               # AI 开发指南
└── README.md
```

## 🎯 当前状态：Phase 3 完成

### Phase 1：纯前端物理引擎
- 棋盘格黑灰背景 + Google Fonts（Inter / Outfit / JetBrains Mono）
- Delta Time 主循环 | AABB 碰撞与贴墙滑动
- Hitscan 射击 + 动态散布
- 战利品搜寻与直升机撤离 | Glassmorphism HUD
- 中文开始画面 + 全中文界面

### Phase 2：C# 权威服务器
- .NET 8 WebSocket 服务器，60Hz Tick
- O(1) 空间哈希碰撞检测
- 速度异常检测（反加速挂）
- 权威射击判定 | 序列号客户端预测
- 状态快照广播 + 声音事件同步

### Phase 3：JSON 固定地图 + 全数据驱动 + 增强 AI + 音效
- **JSON 地图系统**：`factory_01.json` 数据驱动，图块网格 + 出生点 + 战利品点（含权重）+ Bot 巡逻节点 + 撤离点
- **全数据驱动**：特工 (`operators.json` 3种) / Bot (`bots.json` 7种) / 战利品 (`loot.json` 20种) 全部 JSON 定义，新增仅需修改数据文件
- **特工系统**：🕵️ 侦察兵 (轻甲高速) | 🥷 战术特工 (均衡) | 💂 重装兵 (重甲坦克)，开始画面可选
- **Bot 类型**：🧟 丧尸/狂奔者 | 👮 拾荒者枪手/狙击手/重装枪手 | 👹 食人魔头目/指挥官头目
- **增强 Bot AI**：所有 AI 参数来自 JSON（visionRange/attackRange/damage/penetration/reactionDelay），60° 视觉锥 → 反应延迟 → 5s 仇恨超时 → 0.5s Tick 降频
- **战利品类型**：💵 现金 | 💎 宝石 | 🔫 武器×3 | 🛡️ 护甲×2 | 💊 医疗包×2 | 🧨 手榴弹 | 📦 弹药×3 | 🔑 钥匙卡×2 | 📿 金项链 | 💾 加密U盘 | 🏷️ 身份牌
- **拾取效果**：医疗包 `heal_50` / 外科手术包 `heal_100`（`onPickup` 字段驱动）
- **程序化音效**（Web Audio API，带 try-catch 静默降级）：枪声、命中声、拾取声、撤离倒计时蜂鸣

## 🛠️ 运行方式

### 客户端（独立运行）
```bash
cd client
python3 -m http.server 8080
# 打开 http://localhost:8080
```

### 服务端
```bash
cd server
dotnet run
# 监听 http://localhost:5000/
```

## 🎮 操作指南

| 按键 | 功能 |
|------|------|
| W A S D | 移动 |
| Shift | 战术冲刺 |
| 鼠标移动 | 瞄准 |
| 鼠标左键 | 开火 |
| R | 换弹 |
| F | 拾取战利品 |
| Tab | 展开背包 |

## 🧠 Bot AI 行为（Phase 3）

| 状态 | 触发条件 | 行为 |
|------|---------|------|
| 巡逻 (Patrol) | 默认状态 | 在巡逻节点范围内随机移动 |
| 调查 (Investigate) | 听到枪声 | 移向声源，停留 3 秒后返回巡逻 |
| 接敌 (Aggro) | 60° 视觉锥内发现玩家 + LoS | 0.3s 反应后开火，5s 未发现则脱离 |
