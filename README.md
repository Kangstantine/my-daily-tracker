# Daily Tracker

## 在页面上勾选写作计划

打开 [每日追踪](https://kangstantine.github.io/my-daily-tracker/) 的 Goals 页，写作计划里每一项前面都有勾选框。勾上或取消会把 `data/writing-plan.json` 里对应的 `"done"` 写成 `true` 或 `false`，并提交到 `main`。页面会马上按新状态重画（包括未完成任务的顺延）。GitHub Pages 上的静态文件可能还要 1–2 分钟才和仓库一致，刷新太早会暂时看到旧状态。

「去 GitHub 打钩」仍然可以打开 GitHub 编辑页，当作备用。

### 做一把 fine-grained token

1. 打开 GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token。
2. Token name 随便起，例如 `daily-tracker-ticks`。
3. Expiration 选一个短的期限，建议 30 天或 90 天，不要选 No expiration。到期后再做一把。
4. Resource owner 选 `Kangstantine`。
5. Repository access 选 **Only select repositories**，只勾 `Kangstantine/my-daily-tracker`。
6. Permissions 里只把 **Contents** 设为 **Read and write**。其他权限保持 No access。
7. Generate token，复制以 `github_pat_` 开头的那一串。这一页关掉就看不到了。

### 填进浏览器

第一次勾选任务时，页面会问你要这把 token。也可以随时点卡片上的「令牌设置」更换；把输入框留空再确定，就会清除。

Token 只写在这台浏览器的 localStorage（键名 `writing-plan-github-token`）。它不会进 Git 仓库，也不会写进每日追踪自己的数据（`daily-tracker-v3`）。不要把 token 贴到聊天、截图或提交说明里。这把钥匙能改这个仓库的文件，只在自己的浏览器里用。
