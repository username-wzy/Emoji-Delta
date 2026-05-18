# 🦅 Emoji Delta

基于 HTML5 Canvas 的硬核 2D 搜打撤（Extraction Shooter）游戏。纯 Unicode Emoji 像素风，C# 权威服务器 + 客户端预测架构。

## 这是什么

一款俯视角 2D 射击游戏。你扮演特工空降到战区，搜索物资、消灭敌人、在倒计时结束前赶到撤离点。成功撤离可以带走所有战利品并换成金币，死亡则装备全部遗失。

**核心特色：**
- 所有画面用 Emoji 绘制（🕵️ 特工 · 🧟 丧尸 · 🧱 墙壁 · 💎 宝石 · 🚁 撤离点）
- 全 JSON 数据驱动（地图/角色/武器/Bot/战利品全部可编辑）
- 局外经济系统（账号登录 · 金币交易 · 仓库装备 · 商店买卖）
- 程序化音效（Web Audio API，无需音频文件）

## 快速开始

```bash
cd client
python3 -m http.server 8080
# 打开 http://localhost:8080
```

C# 权威服务器：
```bash
cd server
dotnet run
# 监听 http://localhost:5000/
```

## 操作指南

| 按键 | 功能 | 按键 | 功能 |
|------|------|------|------|
| W A S D | 移动 | G | 投掷手雷 |
| 鼠标移动 | 瞄准 | H | 使用医疗包 |
| 鼠标左键 | 开火 | 1 / 2 | 切换武器 |
| Shift | 冲刺 | F | 拾取战利品 |
| R | 换弹 | Tab | 展开背包 |

## 游戏流程

```
登录 → 大厅（选特工 + 商店购物 + 装备武器）→ 部署进入战区 →
  搜索物资 + 消灭敌人 + 生存 → 赶到撤离点等待10秒 →
  ├─ 撤离成功：战利品变现 $ + 装备保留 → 返回大厅
  └─ 阵亡：装备全部遗失 → 返回大厅
```

## 项目结构

```
Emoji Delta/
├── client/                     # 前端（纯 HTML5 Canvas + ES Modules）
│   ├── index.html             # 主页面（登录/大厅/HUD/结算）
│   ├── style.css              # 全局样式
│   ├── data/                  # JSON 数据文件（与代码解耦）
│   │   ├── factory_01.json    #   地图：50×38 瓦片网格 + 出生点 + 战利品 + 巡逻节点 + 3个撤离点
│   │   ├── operators.json     #   3种特工（侦察兵/战术特工/重装兵）
│   │   ├── bots.json          #   7种Bot（丧尸/狂奔者/枪手/狙击手/重装枪手/食人魔/指挥官）
│   │   ├── loot.json          #   20种战利品（现金/宝石/武器/护甲/医疗包/手雷/弹药/钥匙卡）
│   │   └── shop.json          #   12种商店商品
│   └── js/                    # 游戏逻辑（15个ES模块）
│       ├── main.js            #   入口、游戏主循环
│       ├── entities.js        #   实体类（Player/Bot/Loot/Wall）
│       ├── physics.js         #   AABB碰撞、射线检测
│       ├── ai.js              #   Bot AI（100°视觉锥/反应延迟/巡逻/调查/接敌/警戒扩散）
│       ├── renderer.js        #   Canvas渲染（棋盘格背景/虚线撤离框/实体/准星）
│       ├── sound.js           #   Web Audio API 程序化音效
│       ├── economy.js         #   经济系统（金币/仓库/装备/密码 localStorage）
│       ├── shopdata.js        #   商店购买逻辑
│       ├── lootdata.js        #   战利品数据（加权随机生成）
│       ├── operatordata.js    #   特工数据加载
│       ├── botdata.js         #   Bot数据加载（加权随机生成）
│       ├── maploader.js       #   地图加载与解析
│       ├── hud.js             #   HUD更新（血量/护甲/体力/弹药/武器槽/手雷/药品）
│       ├── ui.js              #   登录/大厅/商店界面/结算弹窗
│       └── input.js           #   键盘鼠标输入
└── server/                     # C# 权威服务器
    ├── Program.cs
    ├── GameServer.cs          #   WebSocket + 60Hz Tick
    ├── GameWorld.cs           #   权威状态/碰撞/Bot AI
    ├── PlayerSession.cs       #   玩家状态/反作弊
    ├── Messages.cs            #   通信协议
    └── SpatialHash.cs         #   O(1)空间哈希
```

## Bot AI 行为

| 状态 | 触发条件 | 行为 |
|------|---------|------|
| 巡逻 | 默认 | 在巡逻节点范围内随机移动，旋转扫描周围 |
| 调查 | 听到枪声/警戒扩散/近距离察觉 | 移向声源或玩家最后位置 |
| 接敌 | 100° 视觉锥发现玩家 | 追踪并射击，6秒未发现则脱离 |

- 邻近 Bot 被惊动时会自动警戒扩散（350px 范围）
- 玩家距离 < 120px 时即使无视线也会被察觉（脚步声）
