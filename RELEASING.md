# Publishing Mktero Community / 发布说明

Maintainer / 维护者：**青木 · Aoki**。

The community repository is [QingMu-Aoki/mktero-community](https://github.com/QingMu-Aoki/mktero-community). Do not publish
packages built by the automated test fixture. Do not publish the earlier Local
Import Preview XPI under the community name: it retains the upstream identity.

## Prepare the repository / 准备仓库

1. Use the community repository linked above. Upload the clean source archive contents,
   or commit the intended source changes from this working tree. Do not upload
   the whole development directory, `build`, `node_modules`, profiles or logs.
2. Keep `LICENSE`, `NOTICE.md` and both READMEs. Update the READMEs' pending
   repository links if publishing a further fork.
3. Retain the fixed community plugin UUID in `manifest.json` across future
   versions. It is intentionally different from upstream. Do not regenerate it.
4. Keep manifest/package/lockfile versions equal. The initial prepared version is
   0.3.16; subsequent releases must increment these together and update the changelog.

选择实际仓库后，上传整理后的源码，保留版权及许可证。首次发布前补全 README 的
Releases／Issues 链接（本版已配置）。以后更新不要改变社区版插件 UUID。源码压缩包不包含 Git 历史；
上游来源及版本记录保留在 NOTICE 和 CHANGELOG 中。

## Validate and build / 验证与构建

Use Node from `.node-version`, then run `npm ci`, `npm run check`, `npm test`.
Tests use a synthetic repository to check reproducible packaging; always rebuild
with your real repository after testing:

```powershell
$env:MKTERO_RELEASE_REPOSITORY = "QingMu-Aoki/mktero-community"
npm run build
```

Replace that example value with the actual repository. The build refuses an
empty repository or `tenglvjun/mktero` before replacing any build output.
It injects the update URL into the packaged manifest; the source manifest is a
template and must not be zipped directly as an installer.

测试后务必用实际仓库地址重新构建。构建脚本将更新地址注入包内 manifest，源码中的
manifest 不是可直接安装的完整发布清单。没有仓库地址时不提供正式安装包。

Inspect `build/mktero-community-0.3.16.xpi`, its `.sha256`, and `build/updates.json`:
the plugin UUID must match the source and all download/update URLs must point to
your repository. LICENSE and NOTICE are included in the XPI alongside dependency
licenses. Install with original Mktero disabled and verify existing snapshots,
settings, local import and a small batch before publishing. Automated tests do
not establish compatibility across every declared Zotero version.

## GitHub release / GitHub 发布

The existing workflow builds on tags `v*`, requires the tag to match the manifest,
runs checks/tests and builds with `GITHUB_REPOSITORY`. It attaches the XPI,
checksum and `updates.json`, and retains provenance attestation. In Actions, a
repository override must match the current repository.

Publishing a matching tag triggers the release workflow. Inspect the workflow
and enable Actions only when ready to publish. Drafts/prereleases are not the
stable `releases/latest` update channel. Never overwrite an existing release's
assets; publish a new version instead.

推送与版本匹配的标签会触发发布流程，因此确认准备好后再推送标签。正式版通过本仓库
的 latest release 提供自动更新；不覆盖已有 Release 的文件。本文档不执行发布操作。
