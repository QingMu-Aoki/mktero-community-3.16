# Mktero Community

[English](README.md) | 简体中文

在 Zotero 中阅读 Markdown，批量转换 PDF，并将结果保存为 Zotero 快照。

**本项目是 [Mktero](https://github.com/tenglvjun/mktero) 的非官方社区修改版。** 原作者为 **Tony（tenglvjun）**及贡献者；社区新增和修改部分由 **青木 · Aoki** 维护。本项目不代表 Mktero、Zotero 或 MinerU 官方。

## 本分支新增功能

| 功能 | 说明 |
| --- | --- |
| 批量转换 | 多选后右键启动，已有有效缓存或完整匹配快照自动跳过。 |
| MinerU 配置 | 填写 API Token，可同时处理 1～3 个 PDF，默认三个。 |
| 文献列表状态 | Markdown 列显示排队、上传、解析、下载和保存状态；父文献汇总其下全部 PDF。 |
| 本地结果导入 | 导入已有 MinerU 结果文件夹中的 Markdown、图片和支持的位置映射。 |
| 自动快照 | 新转换或导入后自动保存并核验，再清理该篇缓存；保存失败时在存储可用的情况下保留缓存。 |

继承自原版的能力包括：Markdown 阅读、公式与表格、标题及图表导航、受支持的 PDF 位置跳转、标注、校对、导出和可选 AI 翻译。这些基础能力归功于原作者，不属于本分支新增功能。

## 安装与配置

声明兼容 Zotero **7.0～10.0.***。开发检查和打包在 Windows 上完成；社区版尚未完成所有 Zotero 版本的实际验证。需要先将 PDF 附件下载到本机。

1. 从 [本仓库的 Releases](https://github.com/QingMu-Aoki/mktero-community-3.16/releases/latest) 的 Assets 中下载 `mktero-community-<版本>.xpi`。
2. **启用社区版前，先停用原版 Mktero 或此前的 Local Import Preview。** 社区版有独立插件 ID，但沿用已有设置及数据格式，不支持两者同时运行。
3. 在 Zotero 中选择「工具 → 插件 → 齿轮 → 从文件安装插件」，选择 XPI。
4. 打开「设置 → Mktero Community」，选择 MinerU，填写 API Token 后点击「保存账号配置」。已有 Token 设置可以继续使用。

配置修改从下一批次生效。Mistral 可作为替代服务，继续使用单独的一个 Key，其批量队列串行执行。AI 翻译需要另外配置 AI 服务。插件本身不要求开启 Zotero 的本地 API 权限。

## 选择与批量转换

- **选中文献标题，代表其下全部 PDF 附件。**
- 只想转换某一个 PDF，请展开文献，只选该附件，**取消选中父文献标题**。
- 父标题和子 PDF 同时选中时，处理全部 PDF，并去重。
- 右键选择「批量转换所选 PDF（N 个）」。在文献列表的列标题菜单中启用 **Markdown** 列查看状态。

批量转换不会自动打开一组阅读标签页。结束后统一报告转换成功、跳过、失败和快照保存失败数量，单篇失败不会阻断其他文件。

通过「停止批量转换」停止后续派发和本地请求。云端已接收的任务可能继续执行；已知 MinerU 任务可使用原 Key 恢复。修正不可用账号后重新启动所选文件，已完成结果会跳过。退出再打开 Zotero 不会自动重启整个批次。

并发数是客户端设置，不代表云端速度或独立额度承诺。请遵守 [MinerU 当前 API 限制](https://mineru.net/doc/docs/limit/)。账号限流时等待，不通过更换 Key 绕过同一任务的限流。

## 导入本地 GPU 结果

选中 PDF，点击「导入本地 MinerU 结果」，选择包含一个 Markdown 文件和图片的结果目录，图片通常位于 `images/`。如果存在受支持的 JSON 元数据和对应 origin PDF，请一并保留，它们有助于恢复位置映射。

**导入功能不会运行 MinerU 或本地 GPU。** 请先在插件外生成结果。没有 PDF 映射时仍可导入图片；可靠的 Markdown 跳转 PDF 功能需要兼容的位置数据及匹配的源文档。标题、图表识别和 OCR 效果取决于输入结果。

## 快照、缓存和导出

新转换及本地导入结果会自动保存为 Zotero 快照，核验 Markdown、图片和支持的位置映射后才清理对应缓存。仅浏览文献列表不会批量迁移历史缓存。

快照由 Zotero 笔记、Markdown／位置映射附件及关联图片组成。清理缓存后快照仍保留在文献库中；长期使用仍需保留并备份这些 Zotero 条目。快照不一定是一个包含 `.md` 和 `images/` 的独立文件夹。需要便携副本时，使用 Mktero 的导出功能。

只删除快照笔记可能遗留同级的源文件附件。请通过 Zotero 删除对应快照及其 Markdown、位置映射附件，不要直接删除不明归属的 storage 文件夹。删除快照和清理缓存是两件独立的事。

## 数据与限制

- 云端转换会将 PDF 上传给所选服务；AI 翻译会发送文本给配置的 AI 服务。本地结果导入本身不调用云端转换。
- API Key 以**未加密偏好设置**保存在当前 Zotero 配置中，输入框遮掩不等于加密。请勿在反馈中上传配置文件、真实密钥、带认证信息的日志或私人文献。
- 快照、缓存和图片由 Zotero／Mktero 管理。跨设备访问需要相应的 Zotero 同步设置以及附件文件可用。
- 文件缺失、服务额度、映射格式和 OCR 错误可能影响结果。停止任务不能保证撤销云端任务或返还额度。
- 切换插件前先停止批量任务。社区版保留旧偏好设置和快照格式，不支持与其他 Mktero 版本同时启用。

## 开发与发布

使用 `.node-version` 指定的 Node 版本（24.15.0）：

```sh
npm ci
npm run check
npm test
```

构建安装包前必须指定自己的实际仓库：

```powershell
$env:MKTERO_RELEASE_REPOSITORY = "QingMu-Aoki/mktero-community"
npm run build
```

请替换示例值。没有仓库配置，或指向原作者仓库时，构建会在替换产物前终止。GitHub Actions 从当前仓库生成发布链接。自动化测试使用虚构测试仓库验证打包，其产物不能作为正式安装包发布。

发布步骤见 [RELEASING.md](RELEASING.md)，分支历史见 [CHANGELOG.md](CHANGELOG.md)。项目仓库：[QingMu-Aoki/mktero-community](https://github.com/QingMu-Aoki/mktero-community)。安装包见 [Releases](https://github.com/QingMu-Aoki/mktero-community/releases)，问题反馈见 [Issues](https://github.com/QingMu-Aoki/mktero-community/issues)。

## 致谢与许可证

感谢 **Tony（tenglvjun）**以及 [Mktero 原项目贡献者](https://github.com/tenglvjun/mktero)提供的基础能力，感谢 [MinerU](https://github.com/opendatalab/MinerU) 提供文档解析技术。

原始工作：**Copyright (c) 2026 Tony**。社区新增和修改：**Copyright (c) 2026 青木 · Aoki**。项目沿用 [MIT License](LICENSE)，详细署名见 [NOTICE.md](NOTICE.md)。第三方依赖保留各自许可证。
