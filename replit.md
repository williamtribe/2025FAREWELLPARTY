# 2025 Farewell Party - Replit Setup

## Overview
Korean farewell party website with:
- **Frontend**: Vite + React on port 5000
- **Backend**: FastAPI (Python) on port 8000
- **Features**: Kakao OAuth login, profile cards, OpenAI embeddings, Pinecone vector sync, Supabase storage

## Recent Changes (December 4, 2025)
- **MafBTI (/mafbti)**: Standalone Mafia42 personality test page
  - No login required - anyone can take the test
  - Simple self-intro input → AI job assignment via vector similarity
  - Beautiful result page with job image, team badge, and personalized reasoning
  - Link button on landing page (bottom left)
  - Public endpoint `/mafbti` in backend (no auth)
- **Custom interest addition**: /my-profile now has custom interest input field
  - Users can add their own interests beyond predefined categories
  - Input field with "추가" button, Enter key support
- **Role modal improvements**: Larger job image (240px), smaller text

## Previous Changes (December 3, 2025)
- **New simplified landing page at /**: Shows member count + swipeable public profile cards
  - Displays "X명이 참여 중" with real-time count from database
  - Browse public profiles with carousel navigation
  - Cleaner UX before login - no long form visible
- Profile editing moved to /my-profile (accessible after login)
- **Mafia42 role assignment overhaul - now uses vector similarity search**:
  - Job stories stored in Supabase `mafia42_jobs` table with code, name, team, story columns
  - Stories embedded into Pinecone (namespace: "mafia42_jobs") via admin panel
  - User profile text is embedded and matched against job stories for best fit
  - OpenAI generates personalized reasoning explaining why the job fits the user
  - Job images displayed from `/job_images/` folder with code-based mapping
  - Admin button "🎭 직업 스토리 임베딩" to re-embed all job stories
- Admin "온보딩 다시하기" button for testing onboarding flow
- **Kakao profile image support**: Profile images auto-update on login (new + existing users)
- **Developer comment styling**: Text starting with `*` displays in gray italic font
- **Admin profile order management**: 
  - Drag-and-drop UI to reorder landing page profile cards
  - Arrow buttons for fine-tuned ordering
  - Saves display_order to Supabase (with fallback to updated_at if column missing)
- **Admin fixed role assignment**: 
  - Admins can manually assign Mafia42 roles to users (bypasses RAG similarity search)
  - "🎯 직업 고정 배정" button opens modal with user list and job dropdown
  - Fixed roles show immediately during onboarding without AI reasoning generation
  - Stored in member_profiles.fixed_role column

## Previous Changes (December 2, 2025)
- Imported from GitHub repository
- Updated Vite config to run on port 5000 with `allowedHosts: true` for Replit proxy
- Added "다른 사람들 자기소개 카드 보기" feature with Pinecone vector similarity search
- **8-step onboarding wizard**: New users redirected to /onboarding after login
  1. AI 취향 테스트 (card swipe to generate intro)
  2. 이름 확인/수정
  3. 한 줄 소개 확인/수정
  4. 자기소개 확인/수정
  5. 관심사 선택 (categorized chips + custom add)
  6. 특기 입력
  7. 연락처 입력
  8. 마피아42 역할 공개 (AI-generated based on profile)
- Backend /role-assignment endpoint for Mafia42 role determination using OpenAI

## Project Structure
```
.
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── main.py       # API routes
│   │   ├── config.py     # Configuration & settings
│   │   └── services.py   # Service integrations
│   └── requirements.txt
├── frontend/          # Vite + React frontend
│   ├── src/
│   │   ├── App.jsx       # Main application
│   │   └── pages/        # Page components
│   ├── package.json
│   └── vite.config.js
└── start.sh          # Unified startup script
```

## Required API Keys & Secrets
To fully run this application, you need to set these secrets in Replit:

### Kakao Integration (Required for login)
- `KAKAO_CLIENT_ID` - Your Kakao app client ID
- `KAKAO_CLIENT_SECRET` - Your Kakao app client secret
- `VITE_KAKAO_JAVASCRIPT_KEY` - Kakao JavaScript SDK key for frontend sharing

### Database (Required for profile storage)
- `REACT_APP_SUPABASE_URL` - Your Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (optional, for admin features)

### AI Features (Optional)
- `OPENAI_API_KEY` - For generating profile embeddings
- `PINECONE_API_KEY` - For vector similarity matching

### Admin (Optional)
- `ADMIN_KAKAO_IDS` - Comma-separated list of Kakao IDs for admin users

## Environment Variables (Already Set)
- `VITE_API_BASE_URL` - Empty string (uses Vite proxy for API requests)
- `NEXT_PUBLIC_BASE_URL` - Public frontend URL (Replit domain)
- `KAKAO_REDIRECT_URI` - Kakao OAuth callback URL
- `PINECONE_INDEX` - Pinecone index name (members)
- `PINECONE_ENVIRONMENT` - Pinecone region (us-east-1)
- `OPENAI_EMBED_MODEL` - OpenAI embedding model (text-embedding-3-large)
- `SESSION_TTL_SECONDS` - Session duration (604800 = 7 days)
- `APP_SECRET` - Session signing secret

## API Proxy Configuration
Frontend uses Vite's proxy to forward `/api/*` requests to the backend:
- Frontend: `fetch('/profiles/123')` → Vite proxy → Backend `http://localhost:8000/profiles/123`
- This avoids CORS issues and works correctly in Replit's proxied environment

## Supabase Database Schema
Tables are set up in Supabase with RLS policies:

```sql
-- Member profiles table
CREATE TABLE public.member_profiles (
  kakao_id TEXT PRIMARY KEY,
  name TEXT,
  tagline TEXT,
  intro TEXT,
  interests TEXT[],
  strengths TEXT[],
  contact TEXT,
  visibility TEXT DEFAULT 'public',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Member preferences table
CREATE TABLE public.member_preferences (
  kakao_id TEXT PRIMARY KEY,
  answers JSONB,
  mood TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy for public profile reads
CREATE POLICY "Allow public read"
  ON public.member_profiles
  FOR SELECT
  USING (visibility = 'public');
```

## Current State
- ✅ Frontend running on port 5000
- ✅ Backend running on port 8000
- ✅ Dependencies installed (Python via uv, Node.js via npm)
- ✅ Vite configured for Replit proxy
- ✅ Vite proxy configured for API requests
- ✅ Deployment configured
- ✅ All API keys configured (Kakao, Supabase, OpenAI, Pinecone)
- ✅ Supabase database connected and working
- ✅ Profile data loading correctly from database
- ✅ Kakao OAuth login working (popup-based for iframe compatibility)
- ✅ AI-generated intro feature with 5-question form and OpenAI integration
- ✅ Card swipe feature (/ai-intro) with Supabase storage (intro_yesorno table)
- ✅ AI intro generation from swipe results with aligned question/trait mappings
- ✅ 8-step onboarding wizard for new users
- ✅ New user redirect to /onboarding after Kakao login
- ✅ Mafia42 role assignment with AI-generated reasoning

## Notes
- Kakao OAuth login uses popup window to bypass iframe cookie restrictions
- Profile storage and retrieval works through Supabase
- AI matching with OpenAI embeddings and Pinecone is available
- Kakao redirect URI must be registered in Kakao Developer Console:
  `https://5a4d3575-c26f-45c0-bf6c-bc9f23c6185d-00-k80bf8bkpqif.pike.replit.dev/api/auth/kakao/callback`

## Troubleshooting
- **KOE006 Error**: Register the Redirect URI in Kakao Developer Console
- **Cookie/Browser Settings Error**: OAuth uses popup window to avoid iframe restrictions
- **Backend not ready**: start.sh waits for backend health check before starting frontend
