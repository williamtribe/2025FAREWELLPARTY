# 2025 Farewell Party - Replit Setup

## Overview
Korean farewell party website with:
- **Frontend**: Vite + React on port 5000
- **Backend**: FastAPI (Python) on port 8000
- **Features**: Kakao OAuth login, profile cards, OpenAI embeddings, Pinecone vector sync, Supabase storage

## Recent Changes (December 2, 2025)
- Imported from GitHub repository
- Updated Vite config to run on port 5000 with `allowedHosts: true` for Replit proxy
- Updated backend CORS to allow port 5000
- Fixed Pinecone package from `pinecone-client` to `pinecone`
- Configured deployment with autoscale target
- Set up unified startup script (start.sh) that runs both frontend and backend

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
- `VITE_API_BASE_URL` - Backend API URL (http://localhost:8000)
- `NEXT_PUBLIC_BASE_URL` - Public frontend URL (Replit domain)
- `KAKAO_REDIRECT_URI` - Kakao OAuth callback URL
- `PINECONE_INDEX` - Pinecone index name (members)
- `PINECONE_ENVIRONMENT` - Pinecone region (us-east-1)
- `OPENAI_EMBED_MODEL` - OpenAI embedding model (text-embedding-3-large)
- `SESSION_TTL_SECONDS` - Session duration (604800 = 7 days)
- `APP_SECRET` - Session signing secret

## Supabase Database Schema
You need to create these tables in your Supabase project:

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
```

## Current State
- ✅ Frontend running on port 5000
- ✅ Backend running on port 8000
- ✅ Dependencies installed (Python via uv, Node.js via npm)
- ✅ Vite configured for Replit proxy
- ✅ Deployment configured
- ⚠️ API keys not yet configured (app runs but features disabled)
- ⚠️ Supabase database not yet set up

## Notes
- The application will run without API keys, but features like login, profile storage, and AI matching will be disabled
- Kakao redirect URI is configured for the Replit domain
- Frontend shows intro page even without backend integration
- Backend gracefully handles missing credentials with warnings
