# 独立生产前端

新入口：`http://miro.alpenl.com:8089`（与旧版相同的 IPv6 域名访问路径）；内网也可用 `http://192.168.110.200:8089`。原版入口：`http://192.168.110.200:8088`。

请求路径：浏览器 → 独立 cairn-ui 容器。新版标签和合集接口直接转发至共享 Worker；资料及状态接口沿用原 NAS Go 后端。新容器不包含采集、调度器或模型进程，Worker 访问令牌仅保存在服务端环境；模型密钥保存在 Worker secret。原服务目录、容器、端口、环境变量和镜像保持不变；共享数据库使用兼容旧客户端的 0067 增量迁移。

**业务数据共用。** 在任一前端修改标签、合集和备注，另一前端刷新后可见。部署隔离不代表数据隔离。

## 能力范围

- 真实书签全文、搜索、日期筛选、已有标签、合集、合集规则、成员和备注；保留来源内容，不自动翻译用户内容。
- 支持标签与类型的新增、改名、编辑、AI/手动、停用和恢复；标签删除移除关联。合集支持完整规则、预览、审核、回填、成员排序及删除恢复。保存失败保留草稿和操作编号，可重试或放弃草稿后刷新。
- 当前 Go 合同没有独立网站库、网站可用性/定价及该设计中的模型配额接口；所有生产书签进入文章库，网站库为空，不填演示数据。
- 首页通过 Worker 聚合接口一次读取最多40条摘要和完整统计；搜索、标签、日期筛选与分页由后端执行。正文和合集成员按需读取，正文缓存每次打开均向服务器校验版本。刷新只读取当前页；目前离线不可编辑。性能协议见 [performance.md](performance.md)。
- 按用户要求沿用旧版的域名访问方式，Docker 端口同时监听 IPv4/IPv6。域名公网访问依赖客户端 IPv6；A 记录不代表公网 IPv4 入站可达。本次不改变现有鉴权方式。

## 开发与验收

```sh
pnpm install --frozen-lockfile
VITE_DATA_MODE=live CAIRN_DEV_BACKEND=http://192.168.110.200:8089 pnpm dev
pnpm check
pnpm test:e2e
pnpm test:live
pnpm build:live
```

`test:live` 使用模拟后端验证生产模式、保存、冲突和错误，不写生产数据。默认 `pnpm dev/build` 是演示模式；生产必须使用 `build:live`。`.env` 不入库，`VITE_*` 不能包含任何凭据。

## 部署

先记录旧容器 ID、StartedAt、RestartCount 和健康状态；确认 8089 未占用、原服务正常。新目录独立为 `/vol1/1000/Docker/cairn-ui`，目录0700，Compose和发布env0600。部署必须显式使用该目录的 Compose，不在旧服务目录执行。

1. 运行以上检查，提交源码，执行 `pnpm build:live`。先备份共享 D1 并发布兼容 Worker（必须含 `/api/enrichment/workspace` 接口）；0067 已上线时无需再次迁移，性能更新无新增迁移。保留原 `CAIRN_CLASSIFICATION_MAX_CALLS=20`、`TYPESAFE_API_KEY` secret 和 `CAIRN_CUSTOM_TAG_AI_ENABLED=1`。正常调度仅在存在启用的自定义 AI 标签时调用模型。
2. 只传输 `dist/`、`deploy/Dockerfile`、`deploy/server.mjs`；按源码 commit 标记镜像 `cairn-ui:<commit>`，用 `docker build -f deploy/Dockerfile` 构建。基础运行时使用 Dockerfile 中固定的镜像摘要。
3. 将 `deploy/compose.yaml` 放在新目录；私有 `release.env` 包含 `CAIRN_UI_IMAGE=cairn-ui:<commit>`、`APP_REVISION=<full commit>` 和服务端 `CAIRN_WORKER_TOKEN`（复用当前后端令牌，仅在受限文件中写入，禁止输出或提交）。
4. 在新目录执行 `docker compose --env-file release.env config --quiet`，再 `docker compose --env-file release.env up -d`。容器使用非root用户、只读根目录、资源限制、无额外capability，同时监听IPv4/IPv6的8089。
5. 核对 `/healthz` 版本；使用 `curl --noproxy "*" -6` 验证域名入口首页和API，并验证内网IPv4；GET对比两个入口的书签/合集；浏览器验证阅读、中英文、手机布局。确认旧容器 ID/StartedAt/RestartCount 和镜像完全一致，原服务仍健康。

## 回滚

首次部署可在新目录执行 `docker compose --env-file release.env down`，只移除新 UI。后续保留上一版镜像和发布env，将 `CAIRN_UI_IMAGE`、`APP_REVISION` 改回上一版本后只重建新 UI。切勿重启/回滚原 cairn-x-enricher，也不执行数据库恢复。

新容器的 `/healthz` 仅表示前端进程健康；实际后端状态通过页面中的真实接口读取确认。
