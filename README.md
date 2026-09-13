# Mktero Community

English | [简体中文](README.zh-CN.md)

Read Zotero PDFs as Markdown, convert selected attachments in batches, and keep results as Zotero snapshots.

**Unofficial community fork of [Mktero](https://github.com/tenglvjun/mktero).** Original author: **Tony (tenglvjun)** and contributors. Community additions and maintenance: **青木 · Aoki**. This is not an official Mktero, Zotero or MinerU release.

## What this fork adds

| Feature | Behavior |
| --- | --- |
| Batch conversion | Right-click selected items and choose **Batch convert selected PDFs**. Valid cached results or complete matching snapshots are skipped. |
| MinerU configuration | Configure your API Token and process 1–3 PDFs concurrently, default 3. |
| Library status | The Markdown column shows queued, uploading, parsing, downloading and saving states; parent items summarize all their PDFs. |
| Local MinerU import | Import an existing result folder, including Markdown, images and supported source mappings. |
| Automatic snapshots | Save and verify new conversion/import results, then remove only that document’s cache entry. Failed saves retain the cache when storage is available. |

Inherited from Mktero: Markdown reading with formulas and tables, headings and figures navigation, supported PDF source links, annotations, correction tools, export, and optional AI translation. These are upstream capabilities, not new work attributed to this fork.

## Install and configure

Declared compatibility: Zotero **7.0–10.0.***. Development checks and packaging were performed on Windows; the community release has not yet been verified across all these Zotero versions. PDFs must be downloaded locally.

1. Download `mktero-community-<version>.xpi` from the Assets section of [this repository’s Releases](https://github.com/QingMu-Aoki/mktero-community/releases/latest).
2. **Disable the original Mktero or the earlier Local Import Preview before enabling this fork.** It has its own plugin ID but shares existing settings and data formats; running both is unsupported.
3. In Zotero, choose **Tools → Plugins → gear menu → Install Add-on From File** and select the XPI.
4. Open **Settings → Mktero Community**, choose MinerU, enter your API Token, and click **Save accounts**. Existing Token settings remain available.

Settings changes apply to the next batch. Mistral remains available as an alternative provider with its own single Key; its batch queue is serial. Optional AI translation requires separate AI provider settings. The Zotero local API permission is not required for the plugin itself.

## Select and convert

- Selecting a **parent reference includes all its PDF attachments**.
- To convert only a particular PDF, expand the reference and select that attachment **without selecting its parent**.
- Selecting both a parent and a child includes all PDFs under that parent, deduplicated.
- Right-click and choose **Batch convert selected PDFs (N)**. Enable the **Markdown** column from the library column-header menu to see status.

Batch conversion does not open a tab per PDF. It reports converted, skipped, failed and snapshot-save failures at the end. Individual failures do not stop other documents. Use **Stop batch conversion** to stop dispatch and local requests. Already submitted cloud tasks may continue; known MinerU tasks can resume with their original Key. Fix unavailable accounts and start the selection again; finished results are skipped. The whole batch does not automatically restart when Zotero reopens.

The concurrency settings are client limits, not a promise of cloud throughput or independent quotas. Respect [MinerU’s current API limits](https://mineru.net/doc/docs/limit/). Throttled accounts wait; changing Keys is not used to bypass a throttled task.

## Import local GPU results

Select a PDF, choose **Import local MinerU result**, and select its output folder containing one Markdown file and its image files, commonly under `images/`. Keep supported JSON metadata and the corresponding origin PDF when available: they can help restore source mappings.

**Importing does not run MinerU or your GPU.** Generate the result separately with MinerU first. Images can be imported without PDF mappings; reliable click-to-PDF navigation requires compatible mapping data and a matching source document. Headings, figure detection and OCR quality depend on the result contents.

## Snapshots, cache and export

New conversions and local imports automatically create a Zotero snapshot. Markdown, supported mappings and images are verified before the corresponding cache entry is removed. Existing cached documents are not bulk-migrated just by viewing the library.

Snapshots consist of a Zotero note plus Markdown/source-map attachments and associated images. They remain in the Zotero library after cache cleanup; their continued availability depends on retaining and backing up those Zotero items. They are not necessarily a single folder containing `document.md` and `images/`. Use Mktero’s export action for a portable local Markdown-and-images copy.

Deleting a snapshot note alone may leave its sibling source attachments. Delete only the matching snapshot and its Markdown/source-map attachments through Zotero; do not manually delete arbitrary Zotero storage directories. Cache cleanup and snapshot deletion are separate operations.

## Privacy and limitations

- Cloud conversion uploads the PDF to the selected provider. Optional AI translation sends text to the configured AI service. Local-result import itself does not require a cloud conversion.
- API Keys are **unencrypted preferences** in the active Zotero profile. Masked input is not encryption. Do not share profiles, tokens, authenticated logs or private papers in issues.
- Cache, snapshots and images are local data managed by Zotero/Mktero. Snapshot availability across devices requires the relevant Zotero synchronization and file availability.
- Missing files, provider limits, unsupported mapping formats and OCR errors can prevent complete results. A stopped cloud request may already have consumed provider quota.
- Stop the batch before switching plugins. This fork deliberately retains legacy preferences and snapshot schemas; simultaneous operation with another Mktero variant is unsupported.

## Development and release

Use the Node version in `.node-version` (24.15.0), then:

```sh
npm ci
npm run check
npm test
```

A real repository must be specified to build an installable package:

```powershell
$env:MKTERO_RELEASE_REPOSITORY = "QingMu-Aoki/mktero-community"
npm run build
```

Replace the example with your repository. Builds without a repository, or targeting the upstream repository, fail before replacing build output. GitHub Actions derives URLs from the current repository. Tests use a synthetic repository solely to validate packaging; those test artifacts must not be published.

See [RELEASING.md](RELEASING.md) for release steps and [CHANGELOG.md](CHANGELOG.md) for the fork’s changes. Community repository: [QingMu-Aoki/mktero-community](https://github.com/QingMu-Aoki/mktero-community). Downloads: [Releases](https://github.com/QingMu-Aoki/mktero-community/releases). Report fork-specific issues in [Issues](https://github.com/QingMu-Aoki/mktero-community/issues).

## Credits and license

Thank you to **Tony (tenglvjun)** and all [Mktero contributors](https://github.com/tenglvjun/mktero), and to [MinerU](https://github.com/opendatalab/MinerU) for document parsing.

Original work: **Copyright (c) 2026 Tony**. Community additions and modifications: **Copyright (c) 2026 青木 · Aoki**. Distributed under the [MIT License](LICENSE); see [NOTICE.md](NOTICE.md) for attribution. Third-party dependencies retain their own licenses.
