# 🎮 Emoji Delta (代号) - 2D 网页端“搜打撤”游戏文档

## 1. 核心技术栈确认

- **前端 (Client)**: HTML5 Canvas / TypeScript (纯原生)。负责捕获鼠标/键盘输入、绘制黑框遮罩（视野）、渲染 Emoji 字符和插值动画。
- **后端 (Server)**: C# / .NET 8+ 控制台应用。作为**权威服务器 (Authoritative Server)**，处理所有物理碰撞、伤害判定、寻路与地图生成。
- **网络通信**: WebSockets (基于 TCP)。数据交互格式初期使用 JSON，后期可转为 MessagePack 以压缩带宽高频发包。
- **数据持久化**: SQLite（本地单文件，配合 Dapper ORM），极简高效，用于存储玩家金币、仓库数据。

## 2. 游戏设计规格与具体逻辑 (Game Specification & Logic)

### 2.1 视觉与世界观

- **表现形式**: 纯粹的 Unicode Emoji 像素风。Canvas 绘制文本 (`ctx.fillText`)。
- **基础映射**:
   - 玩家: 🕵️ (无甲) / 🥷 (轻甲/移速快) / 💂 (重甲/移速慢)
   - 掩体: 🧱 (砖墙，阻挡子弹与视野) / 🌲 (树木，阻挡视野不挡子弹)
   - 实体: 🧟 (近战 Bot) / 👮 (持枪 Bot) / 👹 (地图 Boss) / 🚁 (撤离点)
   - 战利品: 💵 (现金/低价值) / 💎 (高价值品) / 📦 (战利品箱) / 🎒 (玩家死亡掉落)

### 2.2 核心战斗控制与公式 (Combat & Formulas)

- **移动与体力逻辑**:
   - 键盘 `W A S D` 控制向量移动。支持 `Shift` 冲刺。
   - **体力消耗公式**: 冲刺时每 Tick 扣除体力，体力为 0 时强制降速。行走时缓慢恢复，静止时快速恢复。
- **开火逻辑与散布 (Spread & Recoil)**:
   - 准星随鼠标移动：`angle = Math.atan2(mouseY - playerY, mouseX - playerX)`。
   - **动态散布 (Inaccuracy)**: 玩家当前状态决定散布基数。静止射击散布极小（如 `±0.02` 弧度），移动射击散布增大（如 `±0.15` 弧度）。
   - 客户端发包：`{ type: "FIRE", angle: 1.57 }`。
   - **服务端权威判定**:
      1. 检查武器冷却 (Fire Rate Cooldown)。
      2. 检查弹匣余量。合法则扣除弹药。
      3. 服务端根据玩家当前速度加入随机散布偏移：`FinalAngle = angle + Random.Range(-Spread, Spread)`。
      4. 采用**瞬间射线检测 (Raycast Hitscan)**：沿 `FinalAngle` 发射射线。寻找最近的交点（🧱 或 玩家/Bot 实体）。
- **硬核伤害与护甲计算公式**:
   - 设定子弹具有 `BaseDamage` (基础伤害) 和 `Penetration` (穿甲值)。
   - 护甲具有 `ArmorClass` (护甲等级，如 1-6 级) 和 `Durability` (耐久度)。
   - **判定逻辑**:
      - 如果 `Penetration >= ArmorClass * 10` (高穿子弹打低级甲)：造成 100% 基础伤害，直接扣除 HP。护甲扣除少量耐久。
      - 如果穿甲不足：大部分伤害被护甲吸收（扣除耐久），仅造成极少量的“钝器伤害”给 HP。
      - **爆头判定**：射线命中的目标区域如果是上半部分（Y轴偏移），直接造成 2 倍伤害且无视 50% 护甲。

### 2.3 核心局内机制 (In-Raid Mechanics)

- **严格视野与听觉限制 (LoS & Audio Sensors)**:
   - **视觉遮挡**: 服务端发送快照前，执行射线检测。若 A 和 B 之间有 🧱 或 🌲，服务端**完全不发送 B 的坐标**给 A 的客户端（彻底杜绝透视外挂）。客户端使用反向 Raycast 绘制全屏黑色多边形遮罩，抠出可见区域。
   - **听觉暴露 (Sound Blips)**: 开枪会产生“噪音半径”（如无消音器半径 500px）。服务端检测在此半径内的其他玩家，并向他们发送一个“声音事件”。客户端据此在战争迷雾边缘渲染一个短暂的 🔊 或红色闪烁提示。
- **交互与拾取逻辑 (Interaction Check)**:
   - 玩家靠近物品按下 `F` 键。客户端发送 `{ op: "INTERACT", targetId: "loot_123" }`。
   - **服务端验证**:
      1. 检查目标实体 `loot_123` 是否存在且未被拾取。
      2. 计算距离 `Distance(Player, Loot)`。如果 `> 40 像素`，判定为非法拾取，拒绝。
      3. 检查玩家背包容量是否足够。
      4. 验证通过后，将物品数据写入玩家 Session 的临时背包，并广播 `EntityDestroyed` 通知所有客户端消除该地上的物品。
- **撤离机制 (Extraction Flow)**:
   - 玩家坐标与 🚁 的 AABB 碰撞盒重叠时，触发撤离流程。
   - 服务端为玩家附加 `IsExtracting = true` 状态，并开始 10 秒倒计时。
   - **中断条件**：如果玩家离开 🚁 区域，或受到任何伤害，倒计时立刻重置或中止。
   - 倒计时归零：判定存活。服务端锁定该玩家输入，将其身上的临时战利品结算至数据库持久化仓库，通知客户端展示“撤离成功”画面，然后断开连接。

## 3. 开发完整流程与底层实现细节 (Development Roadmap)

### 阶段一：纯前端物理、视野与主循环 (Week 1)

1. **时间步长主循环 (Delta Time Loop)**:
   - 采用 `requestAnimationFrame`。计算 `deltaTime (dt)`，所有位移必须乘以 `dt`（如 `x += speed * dt`）。
   - 渲染层级 (`z-index` 概念)：
      1. 背景地板色 -> 2. 静态墙体 🧱 -> 3. 地上物品 💎 -> 4. 动态实体 (玩家 🕵️, Bot) -> 5. 黑暗视野遮罩多边形 (使用 `destination-out` 混合模式挖空) -> 6. UI (血条, 弹匣)。
2. **预测碰撞 (AABB Collision)**:
   - 玩家移动前，计算 `NextX = currentX + vx * dt`。
   - 检测 `NextX` 是否与周围网格墙体重叠。若重叠，则将 `vx` 设为 0（实现贴墙滑动）。Y轴同理。

### 阶段二：C# 服务端接管与核心网络同步 (Week 2-3)

1. **服务端 Tick 架构与防作弊**:
   - C# 后台死循环：`while(true) { Update(dt); Thread.Sleep(16); }` (约 60 Tickrate)。
   - **反加速挂 (Speedhack Check)**：服务端记录玩家上一次的时间戳。当收到移动指令时，计算 `Distance / TimeDelta`。如果速度异常大于设定的最大移速（容差 10%），强制将玩家坐标拉回服务端上一次的合法位置。
2. **客户端预测与服务端回滚 (Client Prediction & Server Reconciliation)**:
   - **客户端**：按下 `W`，本地立刻将自己向前移动，并将该指令标记为 `seq: 1` 存入 `PendingInputs` 数组，发给服务器。
   - **服务端**：收到 `seq: 1`，计算合法的新坐标，然后在下一个发给客户端的状态广播（Snapshot）中附带 `LastProcessedSeq: 1` 及真实坐标 `ServerX, ServerY`。
   - **客户端修正**：收到广播后，强制将本地坐标设为 `ServerX, ServerY`。删除 `PendingInputs` 中 `seq <= 1` 的记录。将剩下未确认的指令（如 `seq: 2, 3`）在这一帧瞬间重新施加到现在的坐标上，实现无缝手感。
3. **服务端空间分区 (Spatial Hashing)**:
   - 地图划分为 100x100 的网格桶（Buckets）。实体移动时更新自己所在的桶。
   - 碰撞检测（如子弹判定）时，只获取子弹当前坐标所在桶及周边 8 个桶内的实体进行计算，将复杂度从 O(N2) 降为 O(1) 常数级。

### 阶段三：Roguelike 地图、AI 与动态生态 (Week 4)

1. **细胞自动机地图算法 (Cellular Automata)**:
   - 初始化 `int[,] grid` (0为空，1为墙)。随机撒种 45% 的墙。
   - 迭代规则：若一个网格周围 8 个格子中有 >=5 个墙，它变成墙；否则变为空地。迭代 5 次形成自然洞穴。
   - 运行 **Flood Fill（泛洪算法）** 找出最大的连通区域作为游戏主区域，填平其他死胡同。生成出生点和撤离点。
2. **Bot AI 状态机增强 (FSM with Sensory)**:
   - **Tick 降频**：寻路 `A*` 算法开销大，Bot 每 0.5 秒或 1 秒才请求一次新路径。
   - **状态转换逻辑**:
      - `Patrol (巡逻)`：在出生点半径 200 内随机走动。
      - `Investigate (调查)`：若监听到枪声（产生于 `AudioSensor` 范围），将枪声坐标设为目标点，移动过去停留 3 秒。
      - `Aggro (接敌)`：若视野扇形区（角度 60°，无 🧱 遮挡）检测到玩家，切换为接敌。停止移动，延迟 0.3 秒（模拟人类反应）后开火。若玩家跑出视野超过 5 秒，降级回 `Investigate`。

### 阶段四：局外经济、UI 与持久化 (Week 5)

1. **状态机与 SQLite 数据库隔离**:
   - 数据表结构：
      - `Users (Id, Username, PassHash, Coins)`
      - `Inventory (Id, UserId, ItemKey, Quantity)`
   - 玩家连接 WebSocket 时为 `Lobby` 状态。只能发送 `op: "BUY" / "SELL" / "EQUIP"` 协议。
   - 服务端在 `Lobby` 状态下不分配物理世界坐标，完全作为 API 服务器处理数据库增删改查。
2. **部署进入局内 (Deploy)**:
   - 玩家点击部署，扣除一定“入场费”或验证装备。服务端将玩家 Session 转移至正在运行的 `Match Instance`，分配出生坐标，下发包含地图数据的 `MAP_INIT` 包，状态转为 `InRaid`。

### 阶段五：细节抛光与部署上线 (Week 6)

1. **实体插值平滑 (Entity Interpolation)**:
   - 由于服务端按 20Hz (50ms) 广播其他玩家坐标，直接赋值会导致别人走路一卡一卡。
   - **客户端渲染延迟 (Render Delay)**：客户端人为将其他实体的渲染时间倒退 100ms。利用这 100ms 内收到的两个快照包 `Snapshot[t1]` 和 `Snapshot[t2]`，根据当前时间进行 `Lerp` (线性插值)，使得别人动起来极致丝滑。
2. **部署流程**:
   - C# 服务端：`dotnet publish -c Release -r linux-x64 --no-self-contained`。在 Linux 云服务器（如 Ubuntu 22.04）使用 `systemd` 守护进程运行。
   - 客户端：使用 Vite 等工具打包，HTML/JS 部署至 Nginx，配置 WSS (WebSocket Secure / SSL 证书) 以支持现代浏览器的安全限制。