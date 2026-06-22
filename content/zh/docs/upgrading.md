---
title: 从上游升级
description: 把框架的改进拉取到你克隆的模板中，同时不丢失你的内容、配置或主题。
group: 部署
order: 2
---

# 从上游升级

你把 goodoc 作为模板克隆下来，填入了自己的内容。当上游框架有所改进时，把这些改进拉取进来，
同时**不丢失你的内容、配置或主题**：

```bash
npm run upgrade
```

然后执行 `npm install`、`npm run build`，检查 `git diff`，再提交。

## 什么会更新，什么仍归你所有

升级会读取 `goodoc.manifest.json`，它在两类文件之间划出了一条清晰的界线：

| | 示例 | 升级时 |
| --- | --- | --- |
| **框架所有** | `app/[lang]/`、`components/`、渲染库、配置、`dev-docs/` | 从上游覆盖 |
| **用户所有** | `content/`、`public/`、`lib/site-config.ts`、`app/theme.css` | **绝不触碰** |
| **需复核** | `package.json` | 上游版本写为 `package.json.upstream` 供合并 |

所以你的文档、你的项目文案与导航、你的调色板以及你的资源都是安全的；框架的路由、渲染和
组件则会得到升级。

## 选项

```bash
npm run upgrade -- --ref v1.2.0   # 升级到指定 tag/分支/commit
npm run upgrade -- --dry-run      # 显示将会发生的变更，但不实际执行
npm run upgrade -- --force        # 丢弃未提交的框架改动并继续
```

默认情况下，脚本会拒绝覆盖那些有未提交改动的框架文件 —— 请先提交或 stash，或者传入
`--force`。

## 小贴士

- **升级前先提交**，这样升级后的 `git diff` 易于复核，回滚也轻而易举。
- **锁定到 tag**（`--ref vX.Y.Z`）以获得可复现的升级；仓库的 `CHANGELOG.md`
  记录了变更内容。
- 上游**已删除**的文件不会被自动移除；升级后请检查 `git status`。

完整参考请见仓库根目录的 `UPGRADING.md`。
