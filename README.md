# Lesson Desk

[English](README.md) | [简体中文](README.zh-CN.md)

Prepare exam explanations and classroom slides from your own papers. Lesson Desk is a desktop app for Windows and macOS, built for teachers working with English, Chinese language and literature, and chemistry. Import a paper, check the questions and answers, generate the teaching material you need, then edit and arrange it for class.

[Windows x64](https://github.com/zazedwhwhy/lesson-desk/releases/download/v0.18.1/LessonDesk-0.18.1-Setup.exe) · [macOS (Apple silicon)](https://github.com/zazedwhwhy/lesson-desk/releases/download/v0.18.1-macos.1/LessonDesk-0.18.1-macOS-arm64.dmg) · [macOS (Intel)](https://github.com/zazedwhwhy/lesson-desk/releases/download/v0.18.1-macos.1/LessonDesk-0.18.1-macOS-x64.dmg) · [Report an issue](https://github.com/zazedwhwhy/lesson-desk/issues) · [MIT license](LICENSE)

![Lesson and PowerPoint layout](docs/images/ppt-setup.png)

## Download

| Platform | Release | Installer |
| --- | --- | --- |
| Windows x64 | [0.18.1 stable](https://github.com/zazedwhwhy/lesson-desk/releases/tag/v0.18.1) | [Download EXE](https://github.com/zazedwhwhy/lesson-desk/releases/download/v0.18.1/LessonDesk-0.18.1-Setup.exe) |
| macOS with Apple silicon (arm64) | [0.18.1 preview](https://github.com/zazedwhwhy/lesson-desk/releases/tag/v0.18.1-macos.1) | [Download Apple silicon DMG](https://github.com/zazedwhwhy/lesson-desk/releases/download/v0.18.1-macos.1/LessonDesk-0.18.1-macOS-arm64.dmg) |
| macOS with an Intel processor (x64) | [0.18.1 preview](https://github.com/zazedwhwhy/lesson-desk/releases/tag/v0.18.1-macos.1) | [Download Intel DMG](https://github.com/zazedwhwhy/lesson-desk/releases/download/v0.18.1-macos.1/LessonDesk-0.18.1-macOS-x64.dmg) |

Each release page includes `SHA256SUMS.txt`. The experimental mistake notebook is available in [Windows Beta 0.17.2-beta.1](https://github.com/zazedwhwhy/lesson-desk/releases/tag/v0.17.2-beta.1).

Stable and Beta have separate installation names and data folders. On its first launch, Beta copies existing stable data; subsequent changes stay in their respective editions and do not sync. Removing the notebook from Stable does not delete existing notebook data.

The app interface is currently in Chinese. This repository provides English and Chinese documentation.

## Features

- Import PDF and Word (`.docx`) files, or paste questions and reference answers. Recognize scanned pages with your configured AI service and review the transcription against the source.
- Prepare English question explanations, translations, sentence analysis, passage analysis, contextual vocabulary and writing exercises.
- Organize Chinese reading, classical Chinese, poetry, language exercises and writing tasks by source material and question.
- Create chemistry explanations, knowledge summaries, problem-solving methods, experiment analysis and practice. Automatically associate flowcharts, apparatus diagrams and graphs with questions, retaining source images in lessons, presentations and PowerPoint exports.
- Render LaTeX and chemical notation offline with MathJax and mhchem.
- Edit generated content, retain teacher revisions and resume unfinished generation. Completed items remain saved after cancellation.
- Arrange topics and modules in teaching order. Present in the app or export editable PowerPoint slides with the same page order, separate exercise and answer pages, and automatic pagination.
- Use continuous review, side-by-side board notes or step-by-step reveal. Import a `.pptx` / `.potx` template to reuse its background, colors and fonts.
- Save courseware locally and export backup packages. Beta also supports collecting questions and excerpts into a mistake notebook for review.
- Use the [Lesson Desk Skill](https://github.com/zazedwhwhy/lesson-desk-skill) in Hermes Agent or another compatible AI client to prepare lessons in all three subjects, including English vocabulary notebooks and specialist reviews. Importing the package takes no Lesson Desk API key. [Installation and use](skills/lesson-desk-export/INSTALL.zh-CN.md) · [Workflow coverage](skills/lesson-desk-export/references/workflows.md)

## Get started

1. Open a sample or create courseware and choose a subject.
2. Open connection settings and enter your provider, base URL, model and API key. You can name, inspect and switch saved connections.
3. Import the paper and reference answers. Check recognized text, question associations and answers against the originals.
4. Select the teaching modules to generate, review the results and save your edits.
5. Open the lesson/PPT arrangement screen, select and order the content, then present or export it.

Sample browsing does not require an API key. AI features use your own account and may incur provider charges.

## AI connections

| Provider option | Default base URL | Protocol |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | Responses |
| Claude (Anthropic) | `https://api.anthropic.com/v1` | Messages |
| DeepSeek | `https://api.deepseek.com` | Chat Completions |
| OpenAI-compatible | Your provider's base URL | Chat Completions |

Enter a model available to your account. Scanned-page recognition and image-based tasks require image input support. For a proxy, select the protocol it implements and supply its base URL without `/responses`, `/messages` or `/chat/completions`.

The app sends the material needed for each AI task to the selected provider. It does not switch providers or models automatically after a failure. Check source permissions and provider settings before sending material.

## Local data and exports

Courseware, settings and templates are stored in the app's local user-data folder. API keys use Electron `safeStorage` encryption; courseware backups exclude API credentials.

Review OCR, answers and generated explanations before teaching. Unresolved source differences remain available for review. Legacy `.doc` files and audio transcription are not supported.

The built-in **Paper Lesson**, **Bauhaus Board**, and **Cinema** styles use the same layout and pagination in the app and PowerPoint. Paper keeps the answer, explanation, and evidence together when they fit. Bauhaus keeps the question title in a fixed blue column. Cinema reveals explanation blocks one page at a time. [Compare all three styles on the same question](docs/images/ppt-templates-0.18.2.jpg).

Custom PowerPoint templates contribute their layout, background, decoration and theme, not their sample text. Check exported files in your presentation software, especially when using complex templates or fonts that may not be installed.

## Build from source

Use Node.js 24 LTS and Git on Windows or macOS. Both 0.18.1 releases use the source at `v0.18.1`.

```sh
git clone https://github.com/zazedwhwhy/lesson-desk.git
cd lesson-desk
git checkout v0.18.1
npm ci
npm run build
npm start
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Browser UI preview; desktop import, storage and AI require Electron |
| `npm test` | Local automated tests using synthetic data and mocked requests |
| `npm run check:public` | Check tracked content for private data and credentials |
| `npm run build` / `npm run package` | Build the app / package the Windows stable installer |
| `npm run package:mac` | Package a DMG for the current Mac architecture |
| `npm run build:beta` / `npm run package:beta` | Build / package Beta |

Installers are written to `release/`. Stable and Beta build outputs are separate. The app uses Electron, React and TypeScript.

## Documentation and contributions

- [Windows 0.18.1 release notes](https://github.com/zazedwhwhy/lesson-desk/releases/tag/v0.18.1)
- [macOS 0.18.1 installation notes](https://github.com/zazedwhwhy/lesson-desk/blob/v0.18.1-macos.1/docs/releases/0.18.1.md) (Chinese)
- [Version history](docs/版本历史.md) (Chinese)
- [Contributing](CONTRIBUTING.md)
- [Development workflow](docs/开发与Git工作流.md) (Chinese)

Report bugs with the app version, subject, steps to reproduce and any relevant error message. Remove API keys and personal or student information from attachments.

## License

Original source code is licensed under [MIT](LICENSE). Literata and LXGW WenKai retain their SIL Open Font License 1.1 terms. See [third-party notices](THIRD_PARTY_NOTICES.md) for bundled components. Uploaded materials retain their own licenses.
