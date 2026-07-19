# Cloudflare Worker — 金句工具 API 代理（quote-proxy）

讓 `index.html`（金句工具）透過 Cloudflare Worker 呼叫 Claude API。金鑰存在 Worker 環境變數，並以 Origin 檢查 + 通行碼（`X-Passcode`）防止陌生人盜用額度。

英文學習工具用的是另一個 Worker，見 [`../notion-worker/README.md`](../notion-worker/README.md)。

---

## 部署 / 更新步驟

1. https://dash.cloudflare.com → **Workers & Pages** → 點 `quote-proxy`
2. **Edit code** → 全部刪除 → 貼上 [`worker.js`](./worker.js) 內容 → **Deploy**
3. **Settings → Variables and Secrets** — 確認以下 **3 個變數**都在（名稱要一模一樣）：

| Variable name | Value | Type |
|---|---|---|
| `ALLOWED_ORIGIN` | `https://welsonchen0704.github.io` | Text |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | **Secret** |
| `APP_PASSCODE` | 自訂通行碼（可與英文工具用同一組） | **Secret** |

4. **務必按 Save and deploy** — 環境變數要重新部署才生效
5. 打開金句工具，第一次按生成時會跳出通行碼輸入框，輸入一次即記住

**懶人提示**：把 `https://welsonchen0704.github.io/quote-tool/index.html#p=你的通行碼` 存成書籤／加入主畫面，開啟時自動帶入通行碼並清掉網址，瀏覽器資料被清也不用重打。

---

## 安全模型

- Claude API 金鑰只存在 Cloudflare 加密 secret 變數，瀏覽器永遠看不到
- Origin 驗證只放行你的 GitHub Pages 網域（擋掉其他網站從瀏覽器盜連）
- **通行碼驗證**：Worker URL 寫在公開頁面原始碼裡，所以每個請求都要帶 `X-Passcode` header，不對就回 401。通行碼只存在你自己裝置的 localStorage，不在 repo 裡
- `APP_PASSCODE` 沒設的話 Worker 就只剩 Origin 檢查（curl 可偽造）— **務必設定**

---

## 疑難排解

| 錯誤訊息 | 原因 |
|---|---|
| `Forbidden: bad origin` | `ALLOWED_ORIGIN` 沒設或設錯（要剛好 `https://welsonchen0704.github.io`） |
| 通行碼錯誤或未填（401） | 輸入的通行碼與 Worker 的 `APP_PASSCODE` 不一致；再點一次生成重新輸入 |
| `ANTHROPIC_API_KEY not configured on Worker` | 環境變數名稱不對或沒加；加完要 Save and deploy |
| 改了 `worker.js` 沒生效 | Worker 程式碼不會自動同步 — 要回 Cloudflare **Edit code** 重新貼上並 Deploy |
