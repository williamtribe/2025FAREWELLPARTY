# 2025FAREWELLPARTY
카카오 로그인 + 자기소개 카드 + OpenAI 3072d 임베딩 + Pinecone 벡터 동기화 + Supabase 저장소로 구성된 2025 송년회 웹사이트.

## 구성
- `frontend/` Vite + React: 카카오 로그인 트리거, 프로필 편집/미리보기, 취향 설문, 관리자 전체 목록 뷰.
- `backend/` FastAPI: Kakao OAuth2 코드 교환, 세션 서명, Supabase upsert, OpenAI 임베딩 생성, Pinecone 업서트, 간단한 관리자 API.
- `.env`는 이미 채워져 있음. `APP_SECRET`(세션 서명용)과 `ADMIN_KAKAO_IDS`(쉼표로 구분)를 필요하면 추가하세요.

## 빠른 실행
1) **백엔드**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

2) **프론트엔드**
```bash
cd frontend
npm install         # 최초 1회
npm run dev         # 3000번 포트, Kakao redirect와 일치
```

3) 브라우저에서 `http://localhost:3000` 접속 → 카카오 로그인 → `/api/auth/kakao/callback` 페이지에서 코드 처리 후 세션이 저장됩니다.

## 주요 API (백엔드)
- `GET /auth/kakao/login` → Kakao 인증 URL과 state 반환
- `GET /auth/kakao/callback?code=...` → Kakao 토큰 교환 후 세션 토큰 발급
- `GET /me` (Bearer) → 내 프로필 조회
- `PUT /me` (Bearer) → 프로필 저장 + OpenAI 임베딩 + Pinecone 업서트
- `POST /preferences` (Bearer) → Tinder 스타일 설문 저장
- `GET /profiles/{kakao_id}` → 공개 범위에 맞춰 프로필 조회
- `GET /admin/profiles` (Bearer, admin) → 전체 프로필 목록

## Supabase 테이블 예시
서비스 키나 RLS 정책에 맞게 아래 스키마를 준비하세요.
```sql
create table public.member_profiles (
  kakao_id text primary key,
  name text,
  tagline text,
  intro text,
  interests text[],
  strengths text[],
  contact text,
  visibility text default 'public',
  updated_at timestamptz default now()
);

create table public.member_preferences (
  kakao_id text primary key,
  answers jsonb,
  mood text,
  updated_at timestamptz default now()
);
```

## 노트
- OpenAI 임베딩 모델은 기본 `text-embedding-3-large`(3072d)로 설정되어 Pinecone 인덱스 dimension 3072에 업서트합니다.
- Kakao redirect URI는 `.env`의 `KAKAO_REDIRECT_URI`를 따릅니다. 로컬은 `http://localhost:3000/api/auth/kakao/callback` 경로로 맞춰져 있습니다.
- 관리자 권한은 `ADMIN_KAKAO_IDS`에 포함된 kakao_id가 세션으로 로그인할 때 활성화됩니다.
