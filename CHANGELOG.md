# Community changelog / 社区修改记录

The fork starts from upstream Mktero 0.3.9, commit `663733a`. These are local
preview version numbers; publication dates are intentionally not assigned.
本分支基于原版 0.3.9；以下为本地预览版本记录，不代表曾在 GitHub 正式发布。

## 0.3.16

- Simplify API Token configuration while retaining batch conversion, progress tracking and automatic snapshots.
- 简化 API Token 配置，保留批量转换、进度显示和自动快照；更新使用说明。

## 0.3.15

- Batch conversion of selected PDFs; a selected parent includes every PDF attachment, deduplicated.
- MinerU configuration and shared individual/batch conversion scheduling.
- Per-document phases and parent status summaries, cancellation, account-bound recovery, isolated throttling and serialized snapshot saves.
- 批量转换、并发调度、选择去重、状态汇总、停止与账号绑定恢复。
- Community publication preparation: independent plugin identity, bilingual documentation, 青木 · Aoki attribution and repository-derived release URLs. Release repository: `QingMu-Aoki/mktero-community`.

## 0.3.14

- Automatically save and verify snapshots after new conversions or local imports; remove the document cache only after verification.
- Open complete matching snapshots when cache is absent; keep cached results when saving fails and storage is available.
- 自动保存快照、核验 Markdown／图片／映射，并按篇清理缓存。

## 0.3.13

- Recognize supported spaced figure captions in imported results.
- Compare PDF text/layout when byte hashes differ to recover compatible source mapping; uncertain matches remain unmapped.
- 改善本地导入的图表导航及等效 PDF 的位置映射恢复。

## 0.3.12

- Improve local import errors and permit confirmed source-PDF mismatches without presenting unreliable mappings as valid.
- 改善本地导入错误提示和 PDF 不匹配处理。

## 0.3.11

- Refresh affected PDF/parent rows instead of rechecking the entire library during ordinary reader lifecycle events.
- 优化 Markdown 状态刷新，减少无关条目反复检查。

## 0.3.10

- Add the library Markdown status column, library context-menu access and local MinerU result import.
- 新增文献列表状态列、右键入口及本地结果导入。
