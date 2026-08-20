# Skills

[English](README.md)

这个目录存放 Azusa 维护的可复用 Agent Skills。仓库中的文件是源码；Codex 和 OpenClaw 使用各自的安装目录，修改源码不会自动更新已安装的副本。

## 索引

| Skill | 用途 | Agent 指令 |
| --- | --- | --- |
| [`decision-canvas`](decision-canvas/) | 通过 Codex 内联表单、本地自动保存表单或按 section 拆分的飞书 Card 2.0 表单收集相关决策。 | [`SKILL.md`](decision-canvas/SKILL.md) |

## 目录约定

每个 Skill 使用 `SKILL.md` 保存触发条件和 Agent 工作流，配套文件按用途放入以下目录：

- `agents/`：Codex 展示信息。
- `scripts/`：可执行脚本。
- `references/`：Schema 和详细参考资料。
- `assets/`：模板及运行时资源。

面向人的导航和安装说明集中放在本文件中。不要在每个 Skill 内重复创建 README，以免与 `SKILL.md` 出现两套内容。

## 安装到 Codex

在仓库根目录执行：

```bash
mkdir -p ~/.codex/skills/<skill-name>
cp -Rp skills/<skill-name>/. ~/.codex/skills/<skill-name>/
```

例如安装 Decision Canvas：

```bash
mkdir -p ~/.codex/skills/decision-canvas
cp -Rp skills/decision-canvas/. ~/.codex/skills/decision-canvas/
```

安装后请新建 Codex 任务，再通过 Skill 名称调用：

```text
用 $decision-canvas 帮我收集这个新功能的产品决策。
```

仓库中的 Skill 更新并提交后，仍需重新复制到 Codex 安装目录。更新前应先比较源码与安装副本，避免覆盖安装目录中的独立修改。

## 安装到 OpenClaw

OpenClaw 读取同一套 `SKILL.md`、脚本、参考资料和资源文件，但忽略 `agents/openai.yaml`。

全局安装 Decision Canvas，让所有 OpenClaw Agent 都能使用：

```bash
openclaw skills install --global --force "$PWD/skills/decision-canvas"
```

只安装给指定 Agent：

```bash
openclaw skills install --agent main --force "$PWD/skills/decision-canvas"
```

检查安装结果：

```bash
openclaw skills info decision-canvas --json
openclaw skills check --json
```

OpenClaw 把全局 Skill 安装在 `~/.openclaw/skills/`。仓库源码更新后需要重新执行安装命令；已有会话仍使用旧快照时，请新建会话。

Decision Canvas 的本地表单运行时需要 Node.js，并在用户填写期间保持进程运行。它默认监听 `127.0.0.1`，只有运行 OpenClaw 的 Mac 可以访问。不要把当前未认证的服务绑定到 `0.0.0.0` 或暴露到公网。如需从其他设备访问，请先增加身份验证，并使用 Tailscale 等私有网络。

在飞书中使用时，Decision Canvas 负责生成 Card 2.0 JSON 并转换标准化回调事件；认证、发送卡片和消费 `card.action.trigger` 继续使用独立的 `lark-im` 与 `lark-event` Skill。生成卡片：

```bash
node skills/decision-canvas/scripts/decision-canvas.mjs \
  --config <questionnaire.json> \
  --lark <输出目录>
```

## 验证 Skill

检查 Decision Canvas 的运行脚本：

```bash
node --check skills/decision-canvas/scripts/decision-canvas.mjs
```

校验一份问卷配置：

```bash
node skills/decision-canvas/scripts/decision-canvas.mjs \
  --config <questionnaire.json> \
  --check
```

问卷字段和校验规则见 [`decision-canvas/references/schema.md`](decision-canvas/references/schema.md)。
