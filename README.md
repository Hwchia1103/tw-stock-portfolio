# 🏛️ 台股智慧資產與籌碼分析管理系統 (Taiwan Stock Portfolio Management & Institutional Flow Tracker)

[![React](https://img.shields.io/badge/Frontend-React%20%2B%20TS-blue?style=flat-square&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green?style=flat-square&logo=nodedotjs)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Container-Docker%20Compose-cyan?style=flat-square&logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

一個專為台股投資人設計、具備**機構水準**的資產管理與籌碼分析看板。本系統採用極致炫麗的**深色賽博玻璃風 (Dark Glassmorphic Cyber Style)** 設計，且採用**全本機容器化部署**，100% 保護您的個人資產隱私，絕不上傳雲端。

系統對接台灣官方 OpenAPI 財務比率庫與 Yahoo Finance 實時行情，不僅能精確演算您的持有成本與已實現/未實現損益，更整合了「存股被動年息收預估」、「近 15 日三大法人籌碼流向」與「365天歷史淨值增長 (NAV) vs 大盤加權指數對比」等四大高階分析功能。

---

## 🏛️ 系統四大高階核心功能 (Core Features)

### 1. 📊 歷史交易明細與「平均成本」帳本
*   **高精確度均價統計**：後端會依時間排序動態演算出您的每一檔庫存股的持有均價、帳面未實現損益、以及落袋的已實現損益。
*   **手續費與證交稅自動預估**：依照台股法規自動計算券商基本手續費率 (0.1425%) 與賣出證交稅率 (0.3%)，亦可手動微調。
*   **雙重記帳入口**：支援在「持股管理」中一鍵直接填寫均價與股數，後端會自動產生對應的平衡交易明細，與「交易帳本」保持 100% 同步。

### 2. 💰 存股族除權息與預估年息收看板
*   **未來息收動態預估**：動態預算投組未來一年的「預估年化總息收」與「綜合年化股利率 (%)」。
*   **月份息收柱狀圖**：使用 Chart.js 將近 12 個月每月的除息現金流可視化，清楚預覽每季/每月被動收入分配。
*   **實際持有期篩選**：股息歷史會自動比對每筆除息日與您的歷次交易日期，**精確演算您在除息當天「實際持有的股份」與「實領金額」**。
*   **單股篩選功能**：支援在「除權息歷史清單」中選擇單一股票，拉出近 5 年的完整除息時間軸與當時持有股數變動。

### 3. 📈 三大法人近 15 日籌碼趨勢 (T86 Tracker)
*   **官方日報自動快取**：後端盤後會自動請求 **台灣證券交易所 (TWSE)** 與 **櫃檯買賣中心 (TPEx)** 的法人每日買賣日報（T86），並寫入本地快取，防止 IP 遭官方限制。
*   **主力資金流向堆疊圖**：利用高質感紅（買超）綠（賣超）配色，展示外資、投信、自營商的每日操作張數，精準掌握主力動向。

### 4. 📉 1年期歷史資產淨值 (NAV) 曲線與大盤對比
*   **歷史淨值模擬**：回溯模擬您從最早交易日至今，每日的真實資產市值（股數 $\times$ 當日收盤價）。
*   **基準歸一化對抗大盤**：將您的資產淨值與「台股加權指數 (`^TWII`)」以首日為 100% 進行歸一化對比，視覺化展現您的投資組合是否擊敗大盤。

---

## 🛠️ 技術架構與資料流 (Architecture & Data Flow)

本系統採用微服務架構，利用 Docker 容器化技術將前後端分離，並使用 Nginx 進行靜態分發與反向代理。

### 1. 系統架構與資料流
*   **前端服務**：React + TypeScript (Vite 建置) 渲染精美的賽博毛玻璃介面。由 Nginx 獨立容器在 Port `8080` 進行服務。
*   **後端服務**：Express API 容器在 Port `3000` 運行。Nginx 會將 `/api/*` 的網路請求動態反向代理至後端。
*   **資料儲存**：全本機 JSON 實體掛載 (Volume Mapping)，防止資料洩露。
*   **第三方串接**：
    *   TWSE / TPEx OpenAPI：取得上市櫃股票名稱與最新 PE/PB/殖利率。
    *   Yahoo Finance API：即時抓取最新收盤價/實時市價，以及 5 年除權息日程。
    *   LINE / Discord Webhook：盤後定時自動推送資產市值報告。

### 2. 技術棧 (Tech Stack)
*   **前端 (Frontend)**:
    *   React 18 + TypeScript (Vite 建置工具)
    *   Vanilla CSS (賽博玻璃風設計系統)
    *   Chart.js / react-chartjs-2 (圖表渲染)
    *   TradingView Lightweight Charts (高動態 K 線與技術指標)
    *   Lucide React (高品質圖標庫)
*   **後端 (Backend)**:
    *   Node.js + Express
    *   Axios (資料請求與爬蟲)
    *   Node-Cron (背景定時收盤通知)
*   **容器化 (Containerization)**:
    *   Docker & Docker Compose
    *   Nginx Alpine (前端代理與靜態服務)

---

## 💾 資料庫設計 (Database Design)

本系統極度注重隱私安全，因此未使用雲端資料庫。所有資料均儲存在本地磁碟 `backend/data/database.json` 中，並透過 Docker Volume 進行實體持久化掛載。

### database.json 架構：
```json
{
  "transactions": [
    {
      "id": "tx_1780047786615_rd8l6",
      "symbol": "2330.TW",
      "type": "buy",
      "date": "2026-05-29",
      "price": 2355.0,
      "shares": 10,
      "fee": 34,
      "tax": 0
    }
  ],
  "settings": {
    "lineToken": "YOUR_LINE_NOTIFY_TOKEN",
    "discordWebhook": "YOUR_DISCORD_WEBHOOK_URL",
    "notifyTime": "14:00",
    "enabled": false
  }
}
```

---

## 🚀 環境建置與安裝指引 (Environment Setup)

### 前置需求
*   已安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS / Linux)。
*   已安裝 [Git](https://git-scm.com/)。

### 1. 複製專案與啟動
在您的終端機 (Terminal) 中執行以下指令：
```bash
# 1. 複製專案
git clone https://github.com/YOUR_USERNAME/tw-stock-portfolio.git
cd tw-stock-portfolio

# 2. 一鍵啟動 Docker 容器服務
docker-compose up --build -d
```

啟動完成後，開啟瀏覽器造訪以下網址即可使用：
👉 **`http://localhost:8080`** (前端介面)
👉 **`http://localhost:3000/api/portfolio`** (後端 API 測試端點)

---

## 📱 手機連線與 Windows 防火牆排障指南 (Mobile Access)

只要您的手機與電腦連接同一個家庭/公司 Wi-Fi，就能直接用手機存取本系統！

### 步驟 1：獲取電腦的區網 IP
在 Windows 的 **PowerShell** 中執行以下一列指令，即可直接輸出您的本機區網 IP 位址：
```powershell
# 在 PowerShell 中執行以獲取您的 Wi-Fi 區網 IP：
(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi").IPAddress
```
*(如果是使用有線有線網路，可將 `"Wi-Fi"` 換成 `"Ethernet"`，或直接在 `cmd` / `PowerShell` 中輸入 `ipconfig` 查詢)*

### 步驟 2：手機瀏覽器存取
在您的手機瀏覽器中輸入：
👉 **`http://<您的電腦區網IP>:8080`**

### 🛡️ 關鍵排障：Windows 防火牆阻擋解決辦法
如果手機一直顯示「連線逾時」，這是因為 Windows 防火牆阻擋了 `8080` 連接埠。請在電腦上執行以下**一秒排除指令**：
1.  在 Windows 搜尋欄輸入 `PowerShell`，點選 **「以系統管理員身分執行」**。
2.  複製並貼上以下指令後按下 Enter 鍵：
    ```powershell
    New-NetFirewallRule -DisplayName "台股智慧資產看板手機存取" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
    ```
3.  大功告成！手機再次刷新網頁即可瞬間連線！

---

## 📢 GitHub 上傳安全與隱私警告 (Privacy & Security)

> [!WARNING]
> **在將本專案上傳至 GitHub 公開倉庫前，請務必遵循以下隱私安全設定，否則您的資產帳本與通知 Webhooks 金鑰將會被全世界看到！**

1.  **檢查 `.gitignore` 檔案**：
    本專案已在根目錄設定了嚴格的 `.gitignore` 檔案。
    請確保 `.gitignore` 中包含以下兩行，以**防止本地資產紀錄與快取檔案被 commit 提交**：
    ```gitignore
    backend/data/database.json
    backend/data/t86_cache/
    ```
2.  **安全性確認**：
    本專案的後端已實作了 **「無資料庫自動建檔與種子初始化 (Auto-seeding)」** 機制。當其他人下載本專案並啟動 Docker 時，如果檢測到沒有 `database.json`，後端會自動生成一個預置台積電、聯發科種子資料的全新乾淨 `database.json` 檔案。因此，**忽略 database.json 絕不會導致專案無法運行**，請安心將其排除！

---

## 🚀 未來優化與擴展功能建議 (Future Roadmap)

1.  **📊 集保戶股權分散表趨勢分析**：
    定期向集保結算所爬取並解析每週個股的「千張大戶持有比例」與「散戶持有比例」變動，在個股分析中渲染主力與散戶籌碼對決圖。
2.  **🤖 智能 AI 新聞解盤與市場情緒估值**：
    串接免費的 Gemini API，在使用者點選個股分析時，自動閱讀、摘要並分析該個股近 3 日的 Google News 財經新聞，產出情緒分數與智能投資建議。
3.  **📈 財務報表河流圖 (PE/PB River Charts)**：
    自動抓取公開資訊觀測站的季度財報（營收、毛利、純益、EPS），繪製出專業的「本益比河流圖」或「股價淨值比河流圖」，一眼看出股價目前是便宜還是昂貴。
4.  **🔔 PWA 行動端原生推送通知**：
    將系統完全配置為 PWA，使其在 Android / iOS 上能被直接加入桌面當作原生 App 運行，並串接行動端瀏覽器 Service Worker 推送，不需 LINE/Discord 也能直接發送收盤回報。

---

## 📄 授權條款 (License)

本專案採用 [MIT License](LICENSE) 授權條款。
