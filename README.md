# Cairn UI 设计稿

当前已上线界面的独立静态设计版本，使用 **2026-10-14（Asia/Shanghai）真实收藏快照**。仓库为私有；不要公开部署或公开分发其中的收藏正文、媒体。

- 最初设计来源：[alpen-yy/newUI](https://github.com/alpen-yy/newUI)，基线 `74746901283006639dd2e815d16b151beb626803`。
- 本次界面同步：[Alpenl/cairn-ui](https://github.com/Alpenl/cairn-ui)，已上线提交 `293e978d9e4110e05b6cc997d972e1e5af4dd03c`。
- 最新视觉更新：用户提供的 `project/`（2026-10-14），同步首页、阅读器、设置、标签与合集管理样式。
- 本仓库：[Alpenl/UI](https://github.com/Alpenl/UI)。后续设计修改在这里进行，生产工程单独评审同步。

## 运行

使用 `.node-version` 指定的 Node 与 `package.json` 指定的 pnpm：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

直接打开 Vite 输出的本地地址，不需要登录、后端、API key、数据库或模型。默认静态快照模式；不设置任何环境变量即可。

```sh
pnpm check
pnpm test:e2e
pnpm test:live
pnpm test:go
pnpm preview
```

`check` 包含类型、lint、格式、单元测试和构建。端到端测试验证本地真实数据、搜索、分页、阅读、媒体、双语及窄屏；live/go 是保留的生产适配器模拟服务回归测试，不访问生产。

## 设计范围

- 最新三栏布局、固定侧栏底部、独立滚动并隐藏滚动条。
- 标签紧凑排版与布局缓存、搜索/筛选、合集与热力图。
- 真实正文、归档图片预览、自适应比例视频及画面内控制器。
- 标签快捷删除入口、类型管理、稳定 AI 名称与分类依据、上下位关系编辑、合集规则及补标表单。
- 准确区分分类完成、旧结果待核对、缺原文和正文失败。
- 完整中英文界面，真实收藏文字不随界面语言翻译。

## 静态数据与交互边界

`src/design/snapshot.json` 是展示所需的 API 数据快照，包含99篇收藏及真实标签、合集、正文与处理状态；`src/design/media.json` 是本地归档媒体索引，文件在 `public/design-media/`。不包含登录口令、Cookie、令牌、服务器配置和数据库备份。日期筛选固定在快照日，避免未来打开时示例过期。

`src/design/adapter.ts` 在浏览器内返回快照并完成搜索/分页，**没有网络回退**。读取走原有生产组件与校验合同，保留最新管理界面。表单可以打开和编辑草稿；提交、删除、预览计算、补标/模型调用均明确拒绝，不模拟保存成功，刷新恢复真实快照。历史批量补标列表为空不代表文章未分类：逐篇首次分类的真实结果在文章状态中。

图片和视频从本仓库本地文件读取；只有主动点击原帖/外链才会前往第三方网站。不会读取生产凭据或请求生产API。设置页面明确显示本地快照身份。

`src/mocks/fixtures.ts` 仍保留原始虚构数据供旧组件回归使用，仅显式 `VITE_DATA_MODE=demo` 时启用；默认页面不会使用它。生产适配器源码与历史工程文档保留供设计回同步参考，不能将这里的真实快照打包进公开生产产物。

## 后续同步

1. 从指定的已上线提交同步组件、样式和语言包；记录提交号。
2. 需要更新数据时，经用户授权只读导出展示字段和归档媒体；不要导出凭据、模型请求头或完整数据库。
3. 更新日期、快照和媒体索引，保持标签引用、合集关系与正文媒体映射一致。
4. 运行上述检查和浏览器验收，再提交。无需修改原设计仓库、生产仓库、后端或服务器。

本次同步说明见 [design-sync.md](docs/design-sync.md)。

## 当前界面预览

![首页](docs/previews/overview.png)

[标签管理](docs/previews/tags.png) · [合集管理](docs/previews/collections.png) · [视频阅读](docs/previews/video.png) · [窄屏](docs/previews/mobile.png)
