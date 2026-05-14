# Notion Worker — 設定步驟

讓 `english.html` 把每天的單字課程同步到 Notion 資料庫。

---

## 1. 建立 Notion Integration（取得 Token）

1. 打開 https://www.notion.so/my-integrations
2. 點 **+ New integration**
3. 名稱填 `English Daily`，Workspace 選你的，Type 選 **Internal**
4. 點 **Save** → 複製 **Internal Integration Secret**（`ntn_...` 開頭，等下要用）

## 2. 建立 Notion 資料庫

在你想存放的頁面，新增一個 **Full page database**，命名隨意（例如「每日英文」）。
資料庫的「Properties」必須**完全照下面這個 schema 建立**（屬性名稱大小寫要一樣）：

| Property name | Type | 用途 |
|---|---|---|
| `Title` | Title | 文章英文標題 |
| `Date` | Date | 學習日期 |
| `Level` | Select | 難度（A1-A2 / B1-B2 / C1-C2） |
| `Topic` | Rich text | 主題 |
| `Words` | Multi-select | 5 個目標單字 |

> Notion 新建資料庫預設會有一個 `Name` 標題欄 — **把它改名為 `Title`**，不要新增另一個。

建好後：
- 點資料庫右上 **⋯ → Connections → Add connection** → 選剛剛建的 `English Daily` integration
- 從網址列複製 **Database ID**：`https://www.notion.so/<workspace>/<database-id>?v=...` 中間那一段 32 字元（含或不含 `-` 都行）

## 3. 部署 Cloudflare Worker

1. 註冊 https://dash.cloudflare.com（免費）
2. 左側 **Workers & Pages → Create → Create Worker**
3. 名稱隨意（例如 `english-notion`），先 **Deploy** 預設範本
4. Deploy 後點 **Edit code**，把編輯器內容**全部刪掉**，貼上 [`worker.js`](./worker.js) 的內容 → 右上 **Deploy**
5. 回到 Worker 主頁 → **Settings → Variables and Secrets → Add**
   - 加 `ALLOWED_ORIGIN` = `https://welsonchen0704.github.io`（type 選 Text）
   - 加 `NOTION_TOKEN` = `ntn_...`（你的 integration secret，type 選 Secret）
   - 兩個都加完按 **Deploy** 讓變數生效
6. 複製 Worker URL（`https://english-notion.<your-subdomain>.workers.dev`）

## 4. 在 app 設定填入

打開 https://welsonchen0704.github.io/quote-tool/english.html → 設定：
- **Notion Worker URL**：上面複製的 `https://...workers.dev`
- **Notion Database ID**：步驟 2 取得的 32 字元 ID

之後每天生成單字時，會自動同步到 Notion。手機開 Notion app 就能複習。

---

## 疑難排解

- **403 Forbidden**：`ALLOWED_ORIGIN` 沒設或設錯。要正好是 `https://welsonchen0704.github.io`（沒有結尾斜線）
- **401 Unauthorized**：Notion Token 無效，或資料庫沒有 share 給 integration（步驟 2 最後一步）
- **400 property doesn't exist**：資料庫的 property 名稱跟 schema 不一致，請依照表格名稱重新建立
