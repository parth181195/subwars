# Dota 2 Hero Voice Line Quiz Contest

A real-time quiz contest platform built with Angular and NestJS.

## Project Structure

```
pasoll-contest/
├── apps/
│   ├── quiz-app/              # Quiz + Registration Angular app (includes landing page)
│   ├── admin-app/             # Admin Angular app
│   ├── api/                   # Main NestJS API
│   └── scraper-service/       # NestJS scraper service
├── libs/
│   ├── shared/
│   │   ├── ui/                # Shared UI components
│   │   ├── models/            # Shared TypeScript models
│   │   └── utils/             # Utility functions
│   ├── auth/                  # Authentication library
│   └── quiz/                  # Quiz logic library
├── assets/
│   ├── voice-lines/           # Downloaded voice lines
│   └── uploads/               # User uploads
└── supabase/
    ├── migrations/
    │   └── 001_initial_schema.sql
    └── config.toml
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm
- Supabase account (free tier is sufficient)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up Supabase:
   ```bash
   # 1. Create a project at https://supabase.com
   # 2. Get your API keys from Project Settings → API
   # 3. Update api/.env with your Supabase credentials
   # 4. Update Angular environment files with Supabase config
   # 5. Run database migrations in Supabase SQL Editor
   ```
   
   For detailed Supabase setup instructions, see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

### Development

Run individual apps:
```bash
npm run dev:api        # Start NestJS API server
npm run dev:quiz       # Start quiz app (includes landing page)
npm run dev:admin      # Start admin app
npm run dev:scraper    # Start scraper service
```

### Building

Build individual apps:
```bash
npm run build:api
npm run build:quiz
npm run build:admin
npm run build:scraper
```

## Tech Stack

- **Frontend**: Angular 20
- **Backend**: NestJS
- **Database**: Supabase (PostgreSQL with real-time)
- **ORM**: Sequelize (TypeScript)
- **Real-time**: Supabase Real-time + Socket.IO
- **Authentication**: Supabase Auth (Google OAuth 2.0)
- **File Storage**: Firebase Storage
- **Monorepo**: NX Workspace
- **Architecture**: Read-only frontend, API-only writes

## Applications

### Quiz App
Participant application (includes landing page) for:
- Google OAuth login
- Registration form submission
- Real-time quiz participation
- Leaderboard viewing
- Landing page with tournament information

### Admin App
Admin dashboard for:
- Registration review and approval
- Quiz creation and management
- Real-time quiz monitoring

### API
Main NestJS API providing:
- Authentication endpoints
- Registration management
- Quiz APIs
- WebSocket for real-time events

### Scraper Service
Service to scrape Dota 2 wiki and download voice lines.

## Configuration

This project uses:

**Supabase:**
- **PostgreSQL Database** - Users, quizzes, answers, and voice lines with real-time subscriptions
- **Authentication** - Google OAuth via Supabase Auth

**Firebase:**
- **Storage** - File storage for user uploads and voice lines

### Quick Setup

```bash
# 1. Create Supabase project at https://supabase.com
# 2. Get API keys from Project Settings → API
# 3. Update api/.env with:
#    - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
#    - FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_STORAGE_BUCKET
# 4. Update Angular environment files with Supabase config
# 5. Run migrations from supabase/migrations/001_initial_schema.sql
# 6. Set up Firebase Storage and deploy storage.rules
```

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for complete setup guide.

## Documentation

- **Planning**: See `PLAN.md` for detailed planning and architecture documentation
- **Supabase Setup**: See `SUPABASE_SETUP.md` for Supabase configuration guide
- **Sequelize Setup**: See `SEQUELIZE_SETUP.md` for ORM usage guide
- **Database Recommendation**: See `DATABASE_RECOMMENDATION.md` for database selection rationale

## Architecture Notes

### Frontend (Read-Only)
- Uses Supabase client for SELECT queries only
- Real-time subscriptions for leaderboard updates
- All write operations go through REST API

### Backend (API-Only Writes)
- Uses Sequelize ORM for all database operations
- All INSERT, UPDATE, DELETE operations handled by NestJS API
- Uses service_role key to bypass RLS

