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
│   │   ├── bots.json       # Bot 类型定义（7 种，属性/AI参数）
│   │   └── shop.json       # 商店商品定义（12 种，价格/分类）
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
│       ├── economy.js      # 经济系统 (金币/仓库/装备 localStorage)
│       ├── shopdata.js     # 商店系统 (购买/金币校验)
│       ├── sound.js        # Web Audio API 程序化音效（try-catch）
│       ├── renderer.js     # Canvas 渲染（棋盘格背景、实体、准星）
│       ├── hud.js          # HUD 更新、背包、通知
│       └── ui.js           # 登录/大厅/商店/结算弹窗
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
- **JSON 地图系统**：`factory_01.json` 数据驱动
- **全数据驱动**：特工/Bot/战利品全部 JSON 定义，新增仅需修改数据文件
- **特工系统**：🕵️ 侦察兵 | 🥷 战术特工 | 💂 重装兵，开始画面可选
- **Bot 类型**：7种 (丧尸/狂奔者/枪手/狙击手/重装枪手/食人魔/指挥官)
- **增强 Bot AI**：60° 视觉锥 → 反应延迟 → 5s 仇恨超时 → 0.5s Tick 降频
- **程序化音效**：枪声/命中/拾取/撤离蜂鸣 (try-catch 静默降级)

### Phase 4：局外经济系统 (登录/金币/仓库/商店/装备)
- **登录系统**：特工代号 → localStorage 持久化，下次自动填充
- **金钱系统**：初始 $50,000，撤离结算战利品价值 + $5,000 奖励，HUD 实时显示
- **仓库系统**：撤离战利品自动入库，大厅展示前 32 件物品
- **商店系统**：12 种商品 (武器/护甲/消耗品/弹药/钥匙卡)，金币购买
- **装备系统**：从仓库装备最多 4 件物品带入局内，死亡全部遗失
- **出售系统**：仓库物品 40% 回收价出售换金币
- **游戏循环**：登录 → 大厅(选特工/购物/装备) → 部署战斗 → 撤离(战利品入库/赚钱) 或 死亡(装备遗失)

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
