# にほんご道場 API

FastAPI + PostgreSQL + Redis 日語學習平台後端

## 快速開始

```bash
# 1. 安裝套件
pip install -r requirements.txt

# 2. 複製環境設定
cp .env.example .env
# 編輯 .env 填入 DB / Redis 連線資訊

# 3. 建立資料表
make migrate

# 4. 匯入種子資料
make seed

# 5. 啟動開發伺服器
make dev
```

API 文件: http://localhost:8000/docs

## 目錄結構

```
app/
├── main.py              # FastAPI 入口
├── core/
│   ├── config.py        # 環境設定 (pydantic-settings)
│   ├── security.py      # JWT / 密碼雜湊
│   └── deps.py          # 路由依賴 (get_current_user)
├── db/
│   ├── base.py          # SQLAlchemy async engine
│   └── redis.py         # Redis 連線
├── models/              # SQLAlchemy ORM 模型
│   ├── user.py
│   ├── vocabulary.py    # Vocabulary + UserVocabSRS (SM-2)
│   └── quiz.py          # QuizQuestion + QuizAttempt
├── schemas/             # Pydantic 輸入/輸出
├── services/
│   ├── srs.py           # SM-2 演算法核心
│   └── auth_service.py
└── api/v1/endpoints/    # 路由
    ├── auth.py
    ├── vocab.py
    ├── quiz.py
    └── user.py
```

## API 路由一覽

| Method | Path | 說明 |
|--------|------|------|
| POST | /api/v1/auth/register | 註冊 |
| POST | /api/v1/auth/login | 登入 |
| GET  | /api/v1/vocab?level=N5 | 單字列表 |
| GET  | /api/v1/vocab/review/today | 今日複習清單 |
| POST | /api/v1/vocab/{id}/grade | SM-2 評分 |
| GET  | /api/v1/quiz?level=N4 | 測驗題目 |
| POST | /api/v1/quiz/{id}/attempt | 提交答案 |
| GET  | /api/v1/quiz/stats | 答題統計 |
| GET  | /api/v1/user/me | 取得用戶資訊 |
