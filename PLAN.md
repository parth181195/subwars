# SubWars 6 - Dota 2 Tournament Quiz Event - Planning Document

## 1. Project Overview

SubWars 6 is a Dota 2 community tournament happening in December 2025. This quiz platform is an audience engagement activity with giveaways that will be played during the tournament stream. Participants compete individually, climb the leaderboard, and top performers are eligible for giveaways throughout the event.

A real-time quiz contest platform for Dota 2 voice line identification with registration, admin management, and content scraping capabilities.

### Core Applications
1. **Quiz + Registration App** - Participant application with real-time quiz functionality
2. **Landing Page** - Public-facing SSR page for contest information
3. **Admin App** - Admin dashboard for managing registrations and quizzes
4. **Scraper App** - Tool to download voice lines from Dota 2 wiki

---

## 2. System Architecture

### Tech Stack
- **Frontend**: Angular (with SSR for landing page)
- **Backend**: NestJS
- **Database**: Supabase (PostgreSQL with real-time)
- **ORM**: Sequelize (TypeScript decorators)
- **Real-time**: Supabase Real-time + Socket.IO (for quiz control)
- **Authentication**: Supabase Auth (Google OAuth 2.0)
- **File Storage**: Firebase Storage
- **API Format**: REST + WebSocket + Supabase Real-time Subscriptions

### Architecture Pattern
- **Monorepo Structure** (NX workspace recommended)
- **Microservices approach** (separate NestJS apps for each service)
- **Shared libraries** for common code
- **Read-Only Frontend**: Frontend uses Supabase client for SELECT queries only
- **API-Only Writes**: All INSERT, UPDATE, DELETE operations go through NestJS API using Sequelize ORM

---

## 3. Application Breakdown

### 3.1 Quiz + Registration App

#### Features
- **Google OAuth Login**
  - Integration with Google Sign-In
  - JWT token management
  - Session persistence

- **Registration Form** (post-login)
  Fields required:
  - Full Name (text)
  - Phone Number / WhatsApp Number (text, validation)
  - In Game Name / Gaming Nickname (text)
  - Dota 2 Friend ID (SteamID32) (text, validation)
  - Captionless Profile Image (file upload, max size: 5MB, image only)
  - Steam Profile Link (URL validation, must be public)
  - Current Rank (Medal) and MMR (text, format: "IMMORTAL - 8125")
  - Discord ID (text)
  - Discord verification badge (confirmation that user joined Discord)
  - Proof of Payment (file upload, PDF or image, max 100MB)
  - UPI ID / Payment Number (text)

- **Quiz Functionality**
  - Real-time quiz participation via WebSocket
  - Voice line playback (audio player)
  - Text input for hero name answer
  - Timer for each question (configurable)
  - Auto-submission on timeout
  - Instant feedback on answer submission

- **Leaderboard**
  - Real-time updates via WebSocket
  - Shows during question breaks
  - Displays:
    - Ranking
    - Player name/gamertag
    - Score (points)
    - Response time
  - Filters: Current quiz session, All-time

- **User Dashboard**
  - Registration status
  - Quiz participation history
  - Current score/ranking
  - Payment status

#### User Flow
1. User visits quiz app
2. Click "Sign in with Google" (Required to play)
3. After Google login, user can immediately:
   - View active quizzes
   - Join quiz sessions
   - See questions and voice lines
4. **Registration (Optional)**
   - User can choose to register for contest participation
   - Registration required to:
     - Submit answers
     - Appear on leaderboard
     - Participate in contest
   - After registration, wait for admin approval
5. Play quiz:
   - If registered: Can submit answers and appear on leaderboard
   - If not registered: Can view quiz but cannot submit answers
6. View leaderboard between questions (only registered users appear)

---

### 3.2 Landing Page

#### Features
- **Server-Side Rendering (SSR)**
  - Angular Universal for SEO optimization
  - Fast initial page load

- **Content Management**
  - All content loaded from JSON config
  - Admin can update JSON to change content
  - Dynamic sections:
    - Hero section with contest title
    - Contest rules and guidelines
    - Prize pool information
    - Schedule/timeline
    - Registration CTA button
    - Contact/Discord links
    - Previous winners showcase
    - FAQ section

- **Design Requirements**
  - Modern, attractive UI
  - Responsive design (mobile, tablet, desktop)
  - Dark theme (Dota 2 aesthetic)
  - Smooth animations
  - **Flare line effect** (inspired by [dota2.com/home](https://www.dota2.com/home))
    - Animated glowing line that runs across sections
    - CSS-based animation for performance
    - Subtle light streak effect for visual appeal
    - Can use CSS gradients with keyframe animations or GSAP library

#### Content Structure (JSON)
```json
{
  "hero": {
    "title": "SUB WARS 4",
    "subtitle": "Dota 2 Voice Line Quiz Contest",
    "ctaText": "Register Now"
  },
  "contestInfo": {
    "entryFee": 300,
    "currency": "INR",
    "prizePool": "...",
    "rules": ["..."],
    "schedule": "..."
  },
  "links": {
    "discord": "https://discord.gg/qfnfBRU",
    "registration": "/register"
  }
}
```

---

### 3.3 Admin App

#### Features

**Registration Management**
- View all registrations in table/list
- Filter by status: Pending, Approved, Rejected, Payment Pending
- Search by name, email, Discord ID, etc.
- Actions per registration:
  - **Approve**: Accept registration
  - **Reject**: Reject with optional reason
  - **Request Changes**: Add comments/notes for user to update
  - **Mark Payment Pending**: Flag payment issue
  - **View Details**: Full registration information
  - **Download Files**: Profile image, payment proof

**Quiz Management**
- Create new quiz sessions
  - Set quiz name, date/time
  - Add questions from voice line library
  - Configure question order
- Manage active quiz
  - Make question live (one at a time)
  - View all submissions in real-time
  - Auto-mark correct answers (hero name matching)
  - Manual override for edge cases
  - Pause/resume quiz
  - End quiz session
- View results
  - All submissions with timestamps
  - Correct/incorrect answers
  - Response times
  - Score calculations
- Announce winner
  - Manual selection from leaderboard
  - Mark winner in system

**Dashboard**
- Statistics overview
  - Total registrations
  - Approved/rejected counts
  - Active quiz sessions
  - Payment status breakdown

#### Admin Routes/Views
- `/admin/dashboard` - Overview
- `/admin/registrations` - Registration list
- `/admin/registrations/:id` - Registration detail
- `/admin/quizzes` - Quiz list
- `/admin/quizzes/new` - Create quiz
- `/admin/quizzes/:id` - Quiz management
- `/admin/questions` - Voice line library

---

### 3.4 Scraper App

#### Features
- Scrape Dota 2 wiki: https://dota2.fandom.com/wiki/Category:Responses
- Extract voice lines for each hero
- Download audio files
- Organize by hero name
- Store metadata (hero name, response type, URL)
- Save to local storage or cloud storage
- Provide API endpoints to:
  - List all available voice lines
  - Get random voice line for quiz
  - Search by hero name

#### Scraping Strategy
1. Navigate category page
2. Extract all hero pages
3. For each hero page:
   - Find voice line/response sections
   - Extract audio file links
   - Download audio files
   - Rename with hero name + index
4. Store in structured format:
   ```
   /voice-lines/
     /hero-name/
       - response_1.mp3
       - response_2.mp3
       - metadata.json
   ```

#### Scraper API Endpoints
- `POST /scraper/scrape` - Start scraping process
- `GET /scraper/status` - Get scraping status
- `GET /scraper/voice-lines` - List all scraped voice lines
- `GET /scraper/voice-lines/:hero` - Get voice lines for specific hero
- `GET /scraper/random` - Get random voice line (for testing)

---

## 4. Database Schema (Supabase PostgreSQL)

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  google_id TEXT UNIQUE,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  in_game_name TEXT,
  dota2_friend_id TEXT,
  profile_image_url TEXT,
  steam_profile_link TEXT,
  rank_and_mmr TEXT,
  discord_id TEXT,
  discord_verified BOOLEAN DEFAULT FALSE,
  proof_of_payment_url TEXT,
  upi_id TEXT,
  registration_status TEXT NOT NULL DEFAULT 'pending' CHECK (registration_status IN ('pending', 'approved', 'rejected', 'payment_pending')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_registration_status ON users(registration_status);
```

### Quizzes Table
```sql
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'paused', 'completed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quizzes_status ON quizzes(status);
CREATE INDEX idx_quizzes_scheduled_at ON quizzes(scheduled_at);
```

### Quiz Questions Table
```sql
CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  hero_name TEXT NOT NULL,
  voice_line_url TEXT NOT NULL,
  voice_line_metadata JSONB,
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'completed')),
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX idx_quiz_questions_status ON quiz_questions(status);
```

### Answers Table
```sql
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  response_time INTEGER, -- milliseconds
  score INTEGER DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

CREATE INDEX idx_answers_user_id ON answers(user_id);
CREATE INDEX idx_answers_quiz_id ON answers(quiz_id);
CREATE INDEX idx_answers_question_id ON answers(question_id);
CREATE INDEX idx_answers_submitted_at ON answers(submitted_at);
CREATE INDEX idx_answers_quiz_question ON answers(quiz_id, question_id, submitted_at);
```

### Voice Lines Table
```sql
CREATE TABLE voice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hero_name TEXT NOT NULL,
  voice_line_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  metadata JSONB,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_lines_hero_name ON voice_lines(hero_name);
```

### Admin Users Table
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
```

### Row Level Security (RLS) Policies

See SQL migration files for detailed RLS policies.

---

## 5. API Design

### Authentication APIs
```
POST /auth/google/login
POST /auth/logout
GET /auth/me
```

### Registration APIs
```
POST /api/registration
GET /api/registration/me
PUT /api/registration/me
GET /api/registration/status
```

### Quiz APIs (Participant)
```
GET /api/quiz/active
GET /api/quiz/:id
GET /api/quiz/:id/leaderboard
POST /api/quiz/:id/answer
GET /api/quiz/:id/question/current
```

### Quiz APIs (Admin)
```
GET /api/admin/quizzes
POST /api/admin/quizzes
GET /api/admin/quizzes/:id
PUT /api/admin/quizzes/:id
DELETE /api/admin/quizzes/:id
POST /api/admin/quizzes/:id/questions
POST /api/admin/quizzes/:id/start
POST /api/admin/quizzes/:id/pause
POST /api/admin/quizzes/:id/end
POST /api/admin/questions/:id/make-live
GET /api/admin/quizzes/:id/submissions
```

### Registration Management APIs (Admin)
```
GET /api/admin/registrations
GET /api/admin/registrations/:id
PUT /api/admin/registrations/:id/approve
PUT /api/admin/registrations/:id/reject
PUT /api/admin/registrations/:id/request-changes
PUT /api/admin/registrations/:id/payment-status
```

### Voice Line APIs
```
GET /api/voice-lines
GET /api/voice-lines/:hero
GET /api/voice-lines/random
```

### WebSocket Events
```
Client -> Server:
  - join-quiz
  - submit-answer
  - leave-quiz

Server -> Client:
  - quiz-started
  - question-live
  - question-ended
  - leaderboard-updated
  - quiz-ended
  - error
```

---

## 6. File Structure (NX Monorepo)

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
├── database/
│   ├── migrations/
│   └── seeds/
├── assets/
│   ├── voice-lines/           # Downloaded voice lines
│   └── uploads/               # User uploads
├── nx.json
├── package.json
└── tsconfig.json
```

---

## 7. Implementation Phases

### Phase 1: Project Setup & Infrastructure
- [ ] Initialize NX monorepo
- [ ] Set up Angular apps (quiz, landing, admin)
- [ ] Set up NestJS API
- [ ] Configure database
- [ ] Set up authentication (Google OAuth)
- [ ] Configure file upload handling

### Phase 2: Landing Page
- [ ] Create SSR Angular app
- [ ] Design and implement landing page UI
- [ ] Create JSON config system
- [ ] Add SEO optimizations

### Phase 3: Registration System
- [ ] Implement Google OAuth login
- [ ] Create registration form
- [ ] Set up file uploads (profile image, payment proof)
- [ ] Implement registration API endpoints
- [ ] Add validation

### Phase 4: Admin - Registration Management
- [ ] Create admin app shell
- [ ] Implement registration list view
- [ ] Add filtering and search
- [ ] Create registration detail view
- [ ] Implement approval/rejection workflow
- [ ] Add admin authentication

### Phase 5: Scraper Service
- [ ] Build scraper service
- [ ] Implement wiki scraping logic
- [ ] Add file download functionality
- [ ] Create voice line storage system
- [ ] Build voice line API endpoints

### Phase 6: Quiz System - Core
- [ ] Create quiz database models
- [ ] Implement quiz creation API
- [ ] Build quiz management UI (admin)
- [ ] Create question management

### Phase 7: Quiz System - Real-time
- [ ] Set up Socket.IO
- [ ] Implement WebSocket events
- [ ] Build real-time quiz interface
- [ ] Create answer submission system
- [ ] Implement auto-scoring
- [ ] Build real-time leaderboard

### Phase 8: Testing & Polish
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Performance optimization
- [ ] Security audit
- [ ] UI/UX polish

---

## 8. Security Considerations

- **Authentication**: JWT tokens with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **File Uploads**: 
  - File type validation
  - File size limits
  - Virus scanning (optional)
  - Secure file storage
- **API Security**: 
  - Rate limiting
  - Input validation
  - SQL injection prevention
  - XSS protection
- **Data Privacy**: 
  - Encrypt sensitive data
  - GDPR compliance (if applicable)
  - Secure payment information handling

---

## 9. Key Features Summary

### Participant Experience
- Simple Google login
- Comprehensive registration
- Real-time quiz participation
- Instant leaderboard feedback
- Payment verification

### Admin Experience
- Centralized registration management
- Flexible quiz creation and control
- Real-time monitoring of submissions
- Automated scoring with manual override
- Winner announcement system

### Technical Highlights
- Real-time communication via WebSocket
- SSR for SEO-optimized landing page
- Scalable monorepo architecture
- Automated content scraping
- File management system

---

## 10. Next Steps

1. Set up development environment
2. Initialize NX workspace
3. Configure CI/CD pipeline
4. Set up staging environment
5. Begin Phase 1 implementation

