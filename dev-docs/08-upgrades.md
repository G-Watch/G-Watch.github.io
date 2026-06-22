# 08 · 模板升级机制

下游项目以 goodoc 为模板 clone 后，可用 `npm run upgrade` 拉取上游框架更新，而
**不动自己的内容、配置与主题**。面向用户的说明见根目录 [`UPGRADING.md`](../UPGRADING.md)；
本篇讲实现。

## 核心：所有权边界

`goodoc.manifest.json` 把仓库文件分成三类：

- **framework**：框架拥有，升级时从上游覆盖（路由、组件、渲染库、配置、dev-docs）。
- **userOwned**：用户拥有，升级**绝不触碰**（`content/`、`public/`、
  `lib/site-config.ts`、`app/theme.css`、`README.md`、`LICENSE`）。
- **review**：需人工合并（`package.json`）——升级时把上游版写到 `package.json.upstream`。

**关键不变式**：framework 与 userOwned 路径**互不重叠**。因此可以对每个 framework
路径直接 `git checkout <ref> -- <path>`，而不会碰到 userOwned 文件，无需备份/还原。

为此特意做了拆分：

- 主题令牌（调色板/字体）放在 **`app/theme.css`（userOwned）**；
- 渲染样式（prose/agent）留在 **`app/globals.css`（framework）**，由 globals 用
  `@import "./theme.css"` 引入。

这样框架能更新渲染 CSS，用户的配色永不被覆盖。

## 脚本流程（`scripts/upgrade.mjs`）

1. 读 `goodoc.manifest.json`，确认在 git 仓库内。
2. 若无 `upstream` remote，按 manifest 的 URL 添加。
3. `git fetch upstream --tags`；校验目标 ref（默认 `upstream/<branch>`，可 `--ref` 指定 tag）。
4. **安全闸**：若有 framework 路径处于未提交修改状态，默认中止（`--force` 可强制）。
   userOwned 的未提交修改不受影响（不在覆盖范围内）。
5. 对每个 framework 路径 `git checkout <ref> -- <path>`（新增文件会被创建）。
6. 对 review 路径，写出 `<path>.upstream` 供人工 diff。
7. 打印后续步骤（`npm install` → `npm run build` → `git diff` → commit）。

参数：`--ref <tag>`、`--dry-run`（只看不改）、`--force`。

## 已知限制

- **上游删除的文件不会自动删除**（`git checkout -- path` 不处理删除）。升级后用
  `git status` 检查残留。
- `package.json` 不自动覆盖（用户可能改了 name/version/加了依赖），改为产出
  `package.json.upstream` 让用户合并。
- `lib/dictionaries.ts` 是 framework；若用户翻译过又被升级覆盖，需重新应用。新增的
  字典 key 会在编译期暴露（类型报错）以提醒补全。

## 演进 manifest

`goodoc.manifest.json` 自身是 framework 路径，会随升级更新。所以未来版本调整边界
（新增/移除 framework 路径）会在用户首次升级后自动同步——但**新增 userOwned 路径**
需要在引入它的那次升级里同时调整 manifest，并在 CHANGELOG 注明。
