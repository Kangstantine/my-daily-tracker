# Daily Tracker

## 写作计划打钩

每日任务的完成状态写在 `data/writing-plan.json`，页面只读，不会改这个文件。

要勾掉一项：打开该文件，把那一项的 `"done": false` 改成 `true`，然后提交到 `main`。卡片上的「去 GitHub 打钩」会打开这个编辑页：

https://github.com/Kangstantine/my-daily-tracker/edit/main/data/writing-plan.json

未完成、而且原定日期已过的任务，会在打开页面时整段顺延到今天，JSON 里的日期不变。
