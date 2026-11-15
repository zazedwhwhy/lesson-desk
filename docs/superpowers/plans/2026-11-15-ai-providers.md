# OpenAI / Claude API support

**Goal:** Fix the OpenAI scan gate and support Claude across the existing shared AI entry point.

**Architecture:** Keep `callAI` as the single network boundary. Extract provider request/response mapping; share connection validation and UI presets. OpenAI uses Responses, Claude uses Messages, DeepSeek/custom use Chat Completions. Never switch providers, models or protocols after failure. Keep client-side output validation and existing subject rules.

**Scope:** Settings, OCR, text/image generation, errors, request previews, regression tests, local Windows package. No real credentials, account calls, installation or publishing.

**Decisions:** Use explicit provider selection and editable model/base URL. No model-name whitelist for vision: custom aliases and future models must reach the selected endpoint. Claude receives JSON instructions and the task schema, with strict local validation rather than requiring a model-specific structured-output feature. Preserve existing credentials only for the same normalized provider/address. UI must disclose that images require a vision-capable model.

## Tasks

- [x] Reproduce the exact OpenAI scan rejection with a synthetic single-page OCR test.
- [x] Add protocol contract tests through real `callAI`: auth, images, endpoint, output, refusals, truncation, cancellation, invalid schemas, HTTP failures and redacted previews.
- [x] Implement shared settings and native Claude mapping, remove the OCR provider gate, update service copy.
- [x] Exercise subject workflows with both native providers and retain existing cross-subject regression tests.
- [x] Build, inspect the desktop UI with synthetic data, and package a new local beta installer.
- [x] Commit only task changes, rerun applicable verification against the commit, and leave push pending explicit consent.

## Evidence boundaries

Tests use synthetic PDFs/images and mocked HTTP responses. They establish request and state behavior, not live account access, model accuracy or installer upgrade behavior. The pre-existing untracked `designs/` is outside this task.

## Review and verification

- Initial regression reproduced the exact DeepSeek-only rejection before any HTTP request; all four providers now pass the OCR contract.
- Native-provider workflow tests cover English analysis, Chinese organization/image explanation, and all five chemistry caller modules.
- OpenAI strict schema now represents optional fields with nullable wire values, restores optional absence before local validation, removes schema defaults, and maps Zod discriminated unions from oneOf to anyOf.
- Independent review identified unsupported oneOf and cross-origin Claude key forwarding. Both were fixed and reviewed again. A real two-server local HTTP test verifies that redirects never reach the target.
- Post-implementation commit verification: 764 tests across 122 test files and the production build passed. Public content check passed for 232 tracked files. The final packaged main/preload/HTML match that post-commit build.
- Browser settings verified for provider choices, base addresses, protocols and clearing the synthetic key field. Native Electron UI verified saving/reopening settings, clearing the old saved-key hint when switching providers, and one synthetic PDF OCR run each for OpenAI and Claude. The rebuilt packaged app also reopened the saved Claude settings and completed another synthetic PDF OCR run. All three sources persisted with no pending OCR pages, page 1 awaiting review, and no falsely verified pages.
- Initial hidden-process launch was not inspectable; a subsequent launch exposed the window and allowed the checks above. Installer upgrade and real-account API accuracy remain unverified. No installation, live API call or GitHub push was performed.
- Final local package: `release/0.17.0-beta.3-verified/LessonDesk-0.17.0-beta.3-Setup.exe` (SHA-256 `E2C1576EB968C3ACFD7EF25463951D5C263015664FC1BB09D9F4F0D3D62B060B`). Local screenshots and synthetic request/state evidence are under `test-results/provider-api-ui/` and `test-results/provider-api-desktop/`.
