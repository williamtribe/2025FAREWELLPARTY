# 2025 Farewell Party - Replit Setup

## Overview
Korean farewell party website with:
- **Frontend**: Vite + React on port 5000
- **Backend**: FastAPI (Python) on port 8000
- **Features**: Kakao OAuth login, profile cards, OpenAI embeddings, Pinecone vector sync, Supabase storage

## Recent Changes (December 26, 2025)
- **Public Letter Writing Page (/write-letter)**:
  - New page for anyone to write letters with sender/recipient names
  - Form fields: title, content, sender name (화자), recipient name (청자)
  - Creates two claim codes: one for sender, one for recipient
  - Each person can claim their role by entering their code on personal page
  - Prevents overwriting: once a role is claimed, code can't be reused
  - API endpoints:
    - POST /api/public-letters - Create letter with sender/recipient codes
    - GET /api/public-letters - List all public letters
  - Database: public_letters table (sender_name, recipient_name, sender_code, recipient_code, sender_kakao_id, recipient_kakao_id)

- **Claimable Letter System**:
  - Admin creates letters with auto-generated 8-character claim codes
  - Users claim letters by entering the code on their personal page (/personal/{kakao_id})
  - Once claimed, letters appear in the user's "받은 편지" inbox
  - Admin UI: "✉️ 편지 코드 생성" button opens modal for title/content input
  - Generated code displayed with copy button for easy sharing
  - User UI: "🔑 편지 코드 입력" section on PersonalPage
  - Validation: invalid codes, already claimed codes, proper error messages
  - API endpoints:
    - POST /api/admin/claimable-letters - Create letter with code (admin only)
    - GET /api/admin/claimable-letters - List all claimable letters (admin only)
    - POST /api/claim-letter - User claims letter with code (authenticated)
  - Database columns: claim_code, claim_status (unclaimed/claimed), claimed_at, claimed_by_kakao_id

## Previous Changes (December 22, 2025)
- **Personal Page Feature (/personal/{kakao_id})**:
  - Each user has their own personal page accessible only by themselves
  - Developers/admins can write personalized farewell messages with title + content
  - Beautiful styled message display with profile image and name
  - Access control: only the matching kakao_id user can view their page
  - Admin panel: "💌 개인 메시지 관리" button to manage all user messages
  - API endpoints:
    - GET /api/personal-page/{kakao_id} - View personal page (owner only)
    - GET /api/admin/personal-messages - List all users and messages (admin only)
    - POST /api/admin/personal-messages - Create/update message (admin only)
  - Database: personal_messages table (kakao_id, title, content)

## Previous Changes (December 19, 2025)
- **Admin All Roles Viewer**:
  - View all member Mafia42 role assignments at once
  - Shows fixed roles (admin-assigned) and calculated roles (AI similarity)
  - Grouped by team: 마피아팀, 시민팀, 교주팀, 미배정
  - Displays profile image, name, role, similarity score
  - API endpoint: GET /api/admin/all-roles (admin-only)
- **Admin Clustering Feature**:
  - Soft-balanced K-means clustering (±20% tolerance for natural grouping)
  - Configurable cluster count (2-10) and namespace (intro/interests)
  - PCA for 2D visualization with normalized coordinates
  - API endpoint: POST /api/admin/clusters with {k, namespace}
  - Admin-only access via session check
  - react-force-graph-2d for interactive graph visualization
  - Modal shows cluster groups with member lists + force-directed graph
  - Click nodes to see cluster member details
- **Search result pick buttons**: Logged-in users can pick/unpick profiles from search results
- **임베딩 기반 검색 기능 on LandingPage**:
  - Two search modes: 자기소개로 검색 (intro) / 관심사로 검색 (interests)
  - Uses OpenAI embeddings + Pinecone vector similarity search
  - API endpoint: GET /search-profiles?q={query}&search_type={intro|interests}
  - Results show similarity score (%) for each profile
  - Search results display name, tagline, intro preview, and interest chips
- **찜하기 (Pick/Favorite) feature on LandingPage**:
  - Logged-in users can pick/unpick profiles on the main carousel
  - Picks stored in member_profiles.has_picked array (Supabase)
  - API endpoints: GET /picks, POST /picks/{target_kakao_id}, DELETE /picks/{target_kakao_id}
  - Cannot pick own profile
  - Green button when picked, white outline when not picked

## Previous Changes (December 12, 2025)
- **Dynamic OG meta tags for social sharing (Crawler Bot Detection)**:
  - FastAPI middleware detects Kakao/Facebook/Twitter/etc crawlers by User-Agent
  - Returns page-specific OG meta tags instead of SPA shell
  - Paths: `/` → 등록 안내, `/event` → 행사 정보, `/mafbti` → 성격테스트
  - Works in production mode only (after Publish)
- **Simple registration button moved to OnboardingPage**:
  - "⚡ 자기소개 생략" floating button on onboarding page
  - Triggers Kakao login if not logged in, then saves minimal profile
  - Removed from LandingPage for cleaner UX

## Previous Changes (December 4, 2025)
- **MafBTI (/mafbti)**: Standalone Mafia42 personality test page
  - No login required - anyone can take the test
  - Simple self-intro input → AI job assignment via vector similarity
  - Beautiful result page with job image, team badge, and personalized reasoning
  - URL 직접 접근만 가능 (메인 페이지 버튼 없음)
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
