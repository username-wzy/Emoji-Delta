# 🎮 Emoji Delta (代号) - 2D 网页端“搜打撤”游戏文档 (v2 - 账号与固定地图版)

## 1. 核心技术栈确认

* **前端 (Client):** HTML5 Canvas / TypeScript (纯原生)。负责捕获鼠标/键盘输入、渲染 Emoji 字符和插值动画。（注：已取消黑框视野遮挡，玩家默认享有全屏视野，由摄像机边界控制可视范围）。
* **后端 (Server):** C# / .NET 8+ 控制台应用。作为权威服务器 (Authoritative Server)，处理物理碰撞、伤害判定、AI逻辑。
* **地图管理:** JSON 格式静态地图文件。完全与核心逻辑代码解耦，实现数据驱动。
* **网络通信:** WebSockets (基于 TCP)。前期使用 JSON，后期转 MessagePack。
* **数据持久化:** SQLite（本地单文件，配合 Dapper ORM），处理高频的账密验证、物品增删改查。

---

## 2. 游戏设计规格与具体逻辑 (Game Specification & Logic)

### 2.1 视觉与世界观

* **表现形式:** 纯粹的 Unicode Emoji 像素风。Canvas 绘制文本 (`ctx.fillText`)。
* **基础映射:**
* **玩家:** 🕵️ (轻装) / 🥷 (战术装) / 💂 (重甲)
* **掩体:** 🧱 (墙壁，阻挡子弹) / 🌲 (草丛/树木)
* **实体:** 🧟 (近战 Bot) / 👮 (持枪 Bot) / 👹 (地图 Boss) / 🚁 (撤离点)
* **战利品:** 💵 (现金) / 💎 (高价值品) / 🔫 (枪械武器) / 🎒 (死亡掉落包)



### 2.2 核心战斗控制与公式 (Combat & Formulas)

*(保留核心：WASD移动、体力消耗控制、鼠标指向计算 Angle 并结合运动状态产生开火散布。采用服务端射线检测命中、判定护甲穿透率及钝器伤害。具体公式保持不变。)*

### 2.3 核心局内机制 (In-Raid Mechanics)

* **固定地图系统 (数据与代码分离):**
* 游戏不再使用代码随机生成地图。所有环境数据保存在外部文件（如 `map_factory_01.json`）中。
* JSON 结构包含：网格宽高、二维数组构成的图块（TileMap，如 `0` 代表空地，`1` 代表 🧱）、预设的出生点坐标数组、预设的战利品刷新点（包含权重概率）、Bot 巡逻路线节点及撤离点 🚁 坐标。


* **交互与拾取逻辑:**
* 靠近物品按 F 键。客户端发送 `{ op: "INTERACT", targetId: "loot_123" }`。
* 服务端距离校验（> 40像素判定无效），校验通过后将物品写入玩家的**局内临时背包**，并广播 `EntityDestroyed` 销毁地上的实体。


* **撤离机制 (Extraction Flow):**
* 玩家重叠 🚁 坐标并保持 10 秒。受击或离开重置。倒计时归零则撤离成功，转入结算逻辑（将局内背包写入持久化数据库）。



### 2.4 局外养成与大厅系统 (Out-of-Raid Meta & Economy) *[新增]*

* **账号与认证系统 (Auth):**
* 首次登录即注册。玩家输入账号/密码，服务端对密码进行加盐 Hash（如 BCrypt）后存入 SQLite。登录成功后下发 SessionToken（或 JWT）供长连接鉴权。
* **初始资金:** 新注册账号默认在 `Users` 表中分配 50,000 💵 起步资金，并在仓库发放一把初始手枪 🔫。


* **大厅自由交易 (Trading):**
* **商人系统:** 提供固定的武器、护甲、背包购买列表。玩家点击购买，发包给服务端校验 `Coins >= Price`，扣除金币，并在 `Inventory` 表插入新物品记录。
* **出售系统:** 局内撤离带出的战利品（💎 等），一键折算为金币增加至账户余额。


* **选配装备带入 (Loadout & Slots):**
* 玩家的资产分为两种状态：**仓库中 (Stash)** 和 **已装备 (Equipped)**。
* 前端 UI 提供“角色装备槽”（武器槽、护甲槽、背包槽）。玩家在前端拖拽装备，服务端更新数据库中该物品的 `Status` 字段。
* **高风险惩罚:** 只有处于“已装备”状态的物品能带入局内。如果在局内死亡，服务端将直接从数据库 `DELETE` 这些高价值物品（模拟全部掉落）。



---

## 3. 开发完整流程与底层实现细节 (Development Roadmap)

### 阶段一：纯前端物理与主循环 (Week 1) *[移除遮挡逻辑]*

* **时间步长主循环 (Delta Time Loop):** 使用 `requestAnimationFrame` 结合 `dt` 计算位移。
* **预测碰撞 (AABB Collision):** 构建基础网格系统，计算 `NextX/Y` 与墙壁 🧱 的碰撞重叠，实现平滑滑动贴墙手感。
* **渲染图层:** 背景地板色 -> 静态墙体/掩体 -> 地上物品 -> 动态实体 (玩家, Bot) -> UI (血条, 弹匣)。

### 阶段二：C# 服务端接管与核心网络同步 (Week 2-3) *[保持不变]*

* **服务端 Tick 架构与防作弊:** `while(true)` 循环维持 60 Tickrate。严格校验客户端时间戳和移动距离计算，防止加速外挂。
* **客户端预测与服务端回滚:** 客户端先行移动并缓存指令 Sequence，服务端计算后下发权威坐标，客户端利用历史 Sequence 进行比对和坐标修正重播（解决网络延迟手感问题）。
* **服务端空间分区 (Spatial Hashing):** 使用网格桶优化高频子弹射线检测性能。

### 阶段三：固定地图加载引擎与 AI 生态 (Week 4) *[重点重构]*

* **JSON 地图序列化解析 (Map Parser):**
* C# 服务端使用 `System.Text.Json` 读取外部的 `map_01.json`。
* 初始化代码：`var mapData = JsonSerializer.Deserialize<MapModel>(jsonString);`
* 服务端根据读取到的 `mapData.Tiles` 构建二维碰撞数组，根据 `mapData.Spawns` 初始化 Bot 实体。


* **AI 状态机 (Bot FSM):**
* Tick 降频处理寻路以节省 CPU 开销。
* 实现 巡逻 (Patrol) -> 调查声音点 (Investigate) -> 视野扇形接敌 (Aggro) 的逻辑闭环。



### 阶段四：局外经济、账号与数据库业务 (Week 5) *[新增业务层]*

* **SQLite 数据库表结构设计:**
* `Users`: `Id`, `Username`, `PassHash`, `Coins` (金币余额), `CreatedAt`
* `Inventory`: `Id` (GUID), `UserId` (外键), `ItemKey` (物品配置表ID，如 'weapon_ak47'), `Status` (0=Stash仓库, 1=EquippedMain主武器, 2=EquippedArmor护甲)


* **大厅状态 (Lobby Session):**
* 玩家连接 WebSocket 后，处于 `State: Lobby`。此时服务端不分配地图物理实体。
* 实现 HTTP 或 WS 协议的 CRUD 接口：`ReqLogin`, `ReqBuyItem`, `ReqSellItem`, `ReqEquipItem`。


* **部署进入局内 (Deploy to Raid):**
* 玩家点击部署。服务端查询其 `Inventory` 中 `Status > 0` 的物品，将其组装成玩家的“局内初始状态”。
* 将会话转移至 `State: InRaid`，下发 JSON 地图基础数据包 `MAP_INIT`，分配出生点坐标，正式开始游戏。



### 阶段五：细节抛光与部署上线 (Week 6)

* **实体插值平滑 (Entity Interpolation):** 客户端人为延迟 100ms 渲染其他实体，利用过去两个 Snapshot 进行线性插值 (Lerp)，保证移动丝滑。
* **多地图实例管理:** 服务端开启多个独立的 Match 实例管理并发战局。
* **部署上线:** C# 服务端采用无头模式 (Headless) 发布至 Linux 服务器，客户端网页部署至 Nginx 并配置 WSS/HTTPS 证书。