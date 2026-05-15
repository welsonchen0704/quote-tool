# Cloudflare Worker — 統一 API 代理

讓 `english.html` 透過你的 Cloudflare Worker 呼叫 **Claude / OpenAI / Notion** 三家 API。所有金鑰都鎖在 Cloudflare 環境變數，瀏覽器只需要記得 Worker URL。

---

## 一次性設定

### 1. Notion Integration（取得 token）

1. 開 https://www.notion.so/profile/integrations
2. 點 **+ New integration**
3. 名稱填 `English Daily`，Workspace 選你的，Type 選 **Internal**
4. 點 **Save** → 複製 **Internal Integration Secret**（`ntn_...` 開頭）

### 2. Notion 資料庫

在你想存放的頁面新增一個 **Full page database**，命名「每日英文」。Properties **必須**照下列 schema：

| Property name | Type |
|---|---|
| `Title` | Title（把預設的 `Name` 改名為 `Title`） |
| `Date` | Date |
| `Level` | Select |
| `Topic` | Rich text |
| `Words` | Multi-select |

建好後：
- 點資料庫 **⋯ → Connections → Add → 選 English Daily**
- 從網址列複製 **Database ID**（32 字元）

### 3. 部署 Cloudflare Worker

1. https://dash.cloudflare.com → **Workers & Pages → Create → Create Worker**
2. 名稱 `english-notion`（或你喜歡的）→ Deploy
3. **Edit code** → 全部刪除 → 貼上 [`worker.js`](./worker.js) 內容 → **Deploy**
4. 回 Worker 主頁 → **Settings → Variables and Secrets → Add**，加 **5 個變數**：

| Variable name | Value | Type |
|---|---|---|
| `ALLOWED_ORIGIN` | `https://welsonchen0704.github.io` | Text |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | **Secret** |
| `OPENAI_API_KEY` | `sk-...` | **Secret** |
| `NOTION_TOKEN` | `ntn_...` | **Secret** |
| `NOTION_DATABASE_ID` | 第 2 步的 32 字元 ID | Text |

5. **務必按 Save and deploy** — 環境變數要重新部署才生效

### 4. 在 app 填入

打開 https://welsonchen0704.github.io/quote-tool/english.html → 設定：

| 欄位 | 值 |
|---|---|
| Worker URL | 上面 Cloudflare 給你的 `https://english-notion.<your-subdomain>.workers.dev` |

**就這一個欄位**。所有 API 金鑰都在 Worker 端。

---

## 安全模型

- 三家 API 金鑰只存在 Cloudflare 加密 secret 變數，瀏覽器永遠看不到、localStorage 也沒有
- Origin 驗證只放行你的 GitHub Pages 網域
- Worker 程式碼有端點白名單（不接其他亂 path）
- 萬一 Worker URL 流出，攻擊者要呼叫到 API 還需要繞過 Origin 檢查（curl 可以、一般人不會）
- 真要更安全的話可以再加 passcode header

---

## 端點對照

| App 呼叫 | Worker 轉發到 | 用什麼金鑰 |
|---|---|---|
| `POST /claude/messages` | `https://api.anthropic.com/v1/messages` | `ANTHROPIC_API_KEY` |
| `POST /openai/audio/speech` | `https://api.openai.com/v1/audio/speech` | `OPENAI_API_KEY` |
| `POST /notion/pages` | `https://api.notion.com/v1/pages`（自動注入 `NOTION_DATABASE_ID`） | `NOTION_TOKEN` |

---

## 疑難排解

| 錯誤訊息 | 原因 |
|---|---|
| `Forbidden: bad origin` | `ALLOWED_ORIGIN` 沒設或設錯（要剛好 `https://welsonchen0704.github.io`） |
| `ANTHROPIC_API_KEY not configured on Worker` | Cloudflare 沒加 `ANTHROPIC_API_KEY` 環境變數，或加完沒 Deploy |
| `OPENAI_API_KEY not configured on Worker` | 同上，加 `OPENAI_API_KEY` |
| `NOTION_TOKEN not configured on Worker` | 同上，加 `NOTION_TOKEN` |
| 401 from Notion | Token 失效 / 資料庫沒 share 給 integration |
| `Path not allowed` | 程式碼出問題或 app 版本不一致；確認 Worker 已重新部署 |
