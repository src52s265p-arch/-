# VAD Visual Dynamic Effect（4302）

这个仓库是现场演出的 VJ 模块。它固定运行于 `4302`，提供 VJ 控制台和可上屏的 `/screen/<screenId>` 输出页面。它不直接读取 DJ，而是通过 4300 总控接收音乐特征和 Visual Control 命令。

## 它在整套系统里的位置

| 模块 | 端口 | 关系 |
| --- | --- | --- |
| 4300 总控 API | `http://<LAN_IP>:4300` | VJ 的控制、路由、音频信号来源 |
| 4301 DJ | `http://<LAN_IP>:4301` | 音乐源，经 4300 转发给 VJ |
| 4302 VJ | `http://<LAN_IP>:4302` | 当前模块 |
| 4303 baofa | `http://<LAN_IP>:4303` | 与 VJ 共同承接 20 屏路由 |

核心链路：

```text
DJ 4301 -> 4300 /ws -> VJ 4302
4300 Visual Control -> control.command -> VJ 4302
4300 screen route -> /screen/<screenId> -> VJ 输出
```

## 启动

```bash
npm install
npm run dev
```

打开 VJ 控制台：

```text
http://<LAN_IP>:4302
```

打开某个上屏输出：

```text
http://<LAN_IP>:4302/screen/A1
http://<LAN_IP>:4302/screen/L1
```

生产模式：

```bash
npm run live
```

或分步：

```bash
npm run build
npm run start
```

类型检查：

```bash
npm run lint
```

## 局域网联调

代码内置当前演出默认运行配置。内部开发者通常只需要在主界面或受控环境中填写控制令牌；令牌为空时不会连接控制通道。

## 固定端口

VJ 固定使用：

- Node/Vite 服务端口：`4302`
- `/sync`：继续挂在 `4302`
- Vite HMR：关闭
- `/api` 代理目标：`http://<LAN_IP>:4300`

现场不允许自动漂移端口。若 `4302` 被占用，应先处理占用进程。

## 音频信源

VJ 的推荐信源是 `SHOW API`。

`SHOW API` 的来源不是本地麦克风，而是：

```text
DJ 4301 -> mixer.audioFrame -> 4300 -> VJ useApiAudioSource
```

VJ 会优先通过 WebSocket 接收 `mixer.audioFrame`；如果 WebSocket 短暂不可用，会降级轮询：

```text
GET http://<LAN_IP>:4300/api/audio-summary
```

VJ 控制台和 `/screen/<screenId>` 页面都会订阅 API 音频源，因此上屏画面也会跟随 DJ 音乐变化。

## Visual Control

4300 Dashboard 的 Visual Control 会向 VJ 广播：

- `setScene`
- `setPreset`
- `setText`
- `setColors`
- `setFx`
- `setAudioDrive`
- `setFullscreen`

VJ 的控制台和 screen 页面都会挂载 show-control bridge，确保 4300 改视觉时，已经上屏的画面也能响应。

## 屏幕路由

现场人员推荐只打开 4300 入口：

```text
http://<LAN_IP>:4300/screen/<screenId>
```

当 4300 把某个屏幕 owner 设置为 `vj` 时，该屏幕会自动跳转到：

```text
4300 后端返回的 4302 绝对 URL
```

当 owner 改成 `baofa` 时，VJ screen 会自动跳转到 4303。

## 与 baofa 共存

VJ 不嵌入 baofa，baofa 也不 iframe VJ。两者通过 4300 的屏幕路由共存：

- VJ owner：屏幕打开 VJ screen URL。
- baofa owner：屏幕打开 baofa screen URL。
- 4300 负责路由、菜单/debug 可见性、preset 切换。

## Token 说明

控制令牌是必要运行条件。不要把真实令牌写入 README、提交记录或公开示例。

## 部署说明

线上与备用通道的地址、供应商和运行细节不写入公开 README。代码默认配置用于当前组合项目；如需变更，由主界面运行时配置或受控环境管理。

## 开发注意

- 不要把 `/api` proxy 改回其它端口。
- 不要在现场模式启用 HMR。
- `tasks/` 和 `docs/` 不提交。
- 修改 screen 页面时，确认 `/screen/<screenId>` 仍接收 4300 控制与 API 音频。
