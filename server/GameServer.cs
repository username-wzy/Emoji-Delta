// GameServer.cs - WebSocket server, 60Hz game loop, client ↔ server protocol
using System.Collections.Concurrent;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace EmojiDelta.Server;

public class GameServer
{
    private readonly HttpListener _http = new();
    private readonly ConcurrentDictionary<string, PlayerSession> _sessions = new();
    private readonly GameWorld _world = new();
    private readonly CancellationTokenSource _cts = new();
    private volatile bool _running;
    private int _tick;

    public async Task Start(string url = "http://localhost:5000/")
    {
        _http.Prefixes.Add(url);
        _http.Start();
        _running = true;
        Console.WriteLine($"🦅 Emoji Delta Server listening on {url}");

        // Game loop (60Hz)
        _ = Task.Run(GameLoop);
        // Accept loop
        _ = Task.Run(AcceptLoop);

        await Task.Delay(-1, _cts.Token);
    }

    private async Task AcceptLoop()
    {
        while (_running)
        {
            try
            {
                var ctx = await _http.GetContextAsync();
                if (ctx.Request.IsWebSocketRequest)
                {
                    var wsCtx = await ctx.AcceptWebSocketAsync(null);
                    _ = Task.Run(() => HandleClient(wsCtx.WebSocket));
                }
                else
                {
                    ctx.Response.StatusCode = 400;
                    ctx.Response.Close();
                }
            }
            catch (Exception ex) { Console.WriteLine($"Accept error: {ex.Message}"); }
        }
    }

    private async Task HandleClient(WebSocket ws)
    {
        var session = new PlayerSession { Socket = ws };
        _sessions[session.Id] = session;
        Console.WriteLine($"[+] Player {session.Id} connected ({_sessions.Count} online)");

        // Send map init
        await SendMessage(ws, new Messages.S2C_MapInit(
            GameWorld.WorldWidth, GameWorld.WorldHeight, GameWorld.TileSize,
            400, GameWorld.WorldHeight - 400,
            _world.Walls.Select(w => new Messages.WallData((int)w.X, (int)w.Y, (int)w.W, (int)w.H, w.Emoji, w.BlockingLoS)).ToList(),
            new Messages.ExtractionData(_world.Extraction.X, _world.Extraction.Y,
                _world.Extraction.W, _world.Extraction.H, _world.Extraction.Emoji)
        ));

        var buffer = new byte[4096];
        while (ws.State == WebSocketState.Open)
        {
            try
            {
                var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close) break;

                var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
                ProcessMessage(session, json);
            }
            catch (WebSocketException) { break; }
            catch (Exception ex) { Console.WriteLine($"Client error: {ex.Message}"); }
        }

        _sessions.TryRemove(session.Id, out _);
        Console.WriteLine($"[-] Player {session.Id} disconnected ({_sessions.Count} online)");
    }

    private void ProcessMessage(PlayerSession session, string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("type", out var typeProp)) return;
            var type = typeProp.GetString();

            switch (type)
            {
                case "INPUT":
                    HandleInput(session, root);
                    break;
                case "INTERACT":
                    _world.HandleInteract(session);
                    break;
                case "RELOAD":
                    if (!session.Gun.IsReloading && session.Gun.CurrentAmmo < session.Gun.MagSize && session.Gun.MaxAmmo > 0)
                    {
                        session.Gun.IsReloading = true;
                        session.Gun.ReloadTimer = session.Gun.ReloadTime;
                    }
                    break;
                case "DEPLOY":
                    // Reset player state on deploy
                    session.X = 400;
                    session.Y = GameWorld.WorldHeight - 400;
                    session.Hp = session.MaxHp;
                    session.Armor = session.MaxArmor;
                    break;
            }
        }
        catch (Exception ex) { Console.WriteLine($"Parse error: {ex.Message}"); }
    }

    private void HandleInput(PlayerSession session, JsonElement root)
    {
        var seq = root.GetProperty("seq").GetInt32();
        var dt = root.GetProperty("dt").GetSingle();
        var w = GetBool(root, "w"); var a = GetBool(root, "a");
        var s = GetBool(root, "s"); var d = GetBool(root, "d");
        var sprint = GetBool(root, "sprint");
        var fire = GetBool(root, "fire");

        // Speedhack detection
        var now = DateTime.UtcNow;
        var timeDelta = (float)(now - session.LastInputTime).TotalSeconds;
        session.LastInputTime = now;
        session.InputDeltaTime = dt;

        if (timeDelta > 0.1f) // tolerance for network jitter
        {
            var prevX = session.X; var prevY = session.Y;
            var (newX, newY, spread) = _world.ProcessPlayerMovement(session, dt, w, a, s, d, sprint);

            // Check for speed anomaly
            var movedDist = Hypot(newX - prevX, newY - prevY);
            var maxLegalDist = PlayerSession.MaxAllowedSpeed * dt;
            if (movedDist > maxLegalDist * 1.1f)
            {
                session.SuspiciousActivity += 1;
                if (session.SuspiciousActivity > 10)
                {
                    Console.WriteLine($"⚠ Speedhack suspected: {session.Id} moved {movedDist:F1}px in {dt:F3}s (max: {maxLegalDist:F1})");
                    // Snap back - ignore movement this tick
                    return;
                }
            }
        }
        else
        {
            _world.ProcessPlayerMovement(session, dt, w, a, s, d, sprint);
        }

        // Shooting
        if (fire && session.Gun.Cooldown <= 0 && !session.Gun.IsReloading)
        {
            var fireAngle = root.TryGetProperty("fireAngle", out var fa) ? fa.GetSingle() : 0f;
            _world.ProcessShot(session.X, session.Y, fireAngle, session.Spread, session);

            // Broadcast sound event
            _pendingSounds.Add(new(session.X, session.Y, 600f, "gunshot"));
        }

        // Reload tick
        if (session.Gun.IsReloading)
        {
            session.Gun.ReloadTimer -= dt;
            if (session.Gun.ReloadTimer <= 0)
            {
                session.Gun.IsReloading = false;
                var needed = session.Gun.MagSize - session.Gun.CurrentAmmo;
                var available = Math.Min(needed, session.Gun.MaxAmmo);
                session.Gun.CurrentAmmo += available;
                session.Gun.MaxAmmo -= available;
            }
        }
        else
        {
            session.Gun.Cooldown = MathF.Max(0, session.Gun.Cooldown - dt);
        }

        // Extraction check
        if (_world.CheckExtraction(session))
        {
            if (!session.IsExtracting)
            {
                session.IsExtracting = true;
                session.ExtractTimer = PlayerSession.ExtractDuration;
                _pendingEvents.Add(new Messages.S2C_GameEvent("extraction_start", "进入撤离区"));
            }
            session.ExtractTimer -= dt;
            if (session.ExtractTimer <= 0)
            {
                session.Hp = session.MaxHp; // survived
                _pendingEvents.Add(new Messages.S2C_GameEvent("extraction_complete", "撤离成功"));
            }
        }
        else if (session.IsExtracting)
        {
            session.IsExtracting = false;
            _pendingEvents.Add(new Messages.S2C_GameEvent("extraction_cancel", "撤离中断"));
        }

        session.LastProcessedSeq = seq;
    }

    private readonly List<Messages.SoundEvent> _pendingSounds = new();
    private readonly List<Messages.S2C_GameEvent> _pendingEvents = new();

    private async Task GameLoop()
    {
        const float tickRate = 1f / 60f;
        var lastTime = DateTime.UtcNow;

        while (_running)
        {
            var now = DateTime.UtcNow;
            var dt = (float)(now - lastTime).TotalSeconds;
            if (dt < tickRate) { await Task.Delay(1); continue; }
            lastTime = now;
            _tick++;

            if (dt > 0.1f) dt = 0.1f; // cap to prevent spiral
            if (dt <= 0) continue;

            // Update world
            var players = _sessions.Values.Where(p => p.Hp > 0).ToList();
            var botSounds = _world.UpdateBots(dt, players);
            _pendingSounds.AddRange(botSounds);

            // Build and broadcast snapshots
            foreach (var session in _sessions.Values)
            {
                if (session.Socket.State != WebSocketState.Open) continue;

                var entities = new List<Messages.EntityState>();

                // Other players
                foreach (var other in _sessions.Values)
                {
                    if (other.Id == session.Id) continue;
                    entities.Add(new(other.Id, "player", other.Emoji, other.X, other.Y, other.Hp, other.MaxHp, other.Hp <= 0));
                }

                // Bots
                foreach (var bot in _world.Bots)
                    entities.Add(new(bot.Id, "bot", bot.Emoji, bot.X, bot.Y, bot.Hp, bot.MaxHp, bot.Hp <= 0));

                // Loot
                foreach (var loot in _world.Loots)
                    entities.Add(new(loot.Id, "loot", loot.Emoji, loot.X, loot.Y, 1, 1, false));

                var snapshot = new Messages.S2C_Snapshot(
                    _tick, now.Ticks,
                    session.LastProcessedSeq,
                    session.X, session.Y,
                    entities,
                    _pendingSounds
                );

                try
                {
                    await SendMessage(session.Socket, snapshot);
                }
                catch { /* client disconnected */ }
            }

            // Send game events
            foreach (var session in _sessions.Values)
            {
                foreach (var evt in _pendingEvents)
                {
                    try { await SendMessage(session.Socket, evt); } catch { }
                }
            }

            _pendingSounds.Clear();
            _pendingEvents.Clear();

            // Check dead players
            foreach (var session in _sessions.Values)
            {
                if (session.Hp <= 0 && session.Socket.State == WebSocketState.Open)
                {
                    try
                    {
                        await SendMessage(session.Socket,
                            new Messages.S2C_GameEvent("player_killed", "你已被消灭"));
                    }
                    catch { }
                }
            }
        }
    }

    private static async Task SendMessage(WebSocket ws, object msg)
    {
        var json = JsonSerializer.Serialize(msg, Messages.JsonOpts);
        var bytes = Encoding.UTF8.GetBytes(json);
        await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
    }

    private static bool GetBool(JsonElement el, string key) =>
        el.TryGetProperty(key, out var p) && p.GetBoolean();

    private static float Hypot(float x, float y) => MathF.Sqrt(x * x + y * y);

    public void Stop()
    {
        _running = false;
        _cts.Cancel();
        _http.Stop();
    }
}
