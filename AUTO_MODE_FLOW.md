# Auto Mode Flow Documentation

## Overview
Auto Mode automatically cycles through quiz questions at a specified interval. This document explains the complete flow from enabling auto mode to question activation and completion.

## Architecture Components

### Services
- **QuizAutoModeService**: Manages auto mode lifecycle and question activation
- **QuizService**: Handles question activation/ending logic
- **QuizGateway**: Emits WebSocket events for real-time updates

### State Management
- **AutoModeState**: In-memory state for each active auto mode
  ```typescript
  {
    quizId: string;
    nextActivationTime: Date | null;
    questionIndex: number;
    questions: QuizQuestion[];
    intervalSeconds: number;
  }
  ```

## Flow Diagrams

### 1. Initialization Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Startup                      │
│                  (onModuleInit)                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Setup Cron Jobs             │
        │  - Question Activation:      │
        │    Every 10 seconds          │
        │  - Quiz Management:          │
        │    Every 30 seconds          │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Check for Existing Live      │
        │  Quizzes with Auto Mode       │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Start Auto Mode for Each    │
        │  Live Quiz with Auto Mode    │
        └──────────────────────────────┘
```

### 2. Enabling Auto Mode Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Panel                               │
│  User clicks "Turn On Auto Mode" button                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Frontend: handleToggleAutoMode()│
        │  - Validates quiz is LIVE     │
        │  - Sends PUT /api/admin/quizzes/{id}│
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Backend: QuizService.updateQuiz()│
        │  - Validates auto_mode_enabled│
        │  - Updates quiz in database   │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  QuizService calls            │
        │  autoModeService.restartAutoMode()│
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  AutoModeService.startAutoMode()│
        │  1. Fetch all questions       │
        │  2. Find current position     │
        │  3. Activate first question   │
        │  4. Set next activation time  │
        │  5. Store state in memory     │
        └──────────────────────────────┘
```

### 3. Question Activation Cycle

```
┌─────────────────────────────────────────────────────────────┐
│              Cron Job (Every 10 seconds)                     │
│         checkAndActivateQuestions()                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  For each active auto mode:   │
        │  - Check if nextActivationTime│
        │    has been reached           │
        └──────────────┬───────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
    Time Not Reached          Time Reached
         │                           │
         │                           ▼
         │              ┌──────────────────────────────┐
         │              │  Verify Quiz Still Valid:   │
         │              │  - Status is LIVE           │
         │              │  - auto_mode_enabled = true │
         │              │  - auto_mode_paused = false │
         │              └──────────────┬─────────────┘
         │                             │
         │                             ▼
         │              ┌──────────────────────────────┐
         │              │  activateNextQuestion()      │
         │              │  1. End current question    │
         │              │  2. Emit question-ended     │
         │              │  3. Activate next question  │
         │              │  4. Emit question-live     │
         │              └──────────────┬─────────────┘
         │                             │
         │                             ▼
         │              ┌──────────────────────────────┐
         │              │  Update State:               │
         │              │  - Increment questionIndex   │
         │              │  - Set nextActivationTime   │
         │              │    (now + intervalSeconds)  │
         │              └──────────────┬─────────────┘
         │                             │
         │                             ▼
         │              ┌──────────────────────────────┐
         │              │  Check if all questions done │
         │              │  - If yes: stopAutoMode()    │
         │              │  - If no: Continue          │
         │              └──────────────────────────────┘
         │
         └─────────────────────────────────────────────┘
```

### 4. Pause/Resume Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Panel                               │
│  User clicks "Pause" button                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Frontend: Updates             │
        │  auto_mode_paused = true       │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Backend: QuizService.updateQuiz()│
        │  - Updates quiz in database   │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Cron Job (Every 30 seconds)  │
        │  checkAndManageAutoModes()    │
        │  - Detects paused state       │
        │  - Sets nextActivationTime = null│
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Auto Mode State:              │
        │  - State kept in memory       │
        │  - nextActivationTime = null  │
        │  - Question activation paused │
        └──────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Admin Panel                               │
│  User clicks "Resume" button                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Frontend: Updates             │
        │  auto_mode_paused = false     │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Backend: QuizService.updateQuiz()│
        │  - Updates quiz in database   │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Cron Job (Every 30 seconds)  │
        │  checkAndManageAutoModes()    │
        │  - Detects resumed state      │
        │  - Calls resumeAutoMode()      │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  resumeAutoMode()             │
        │  - Sets nextActivationTime   │
        │    (now + intervalSeconds)   │
        │  - Auto mode resumes          │
        └──────────────────────────────┘
```

### 5. Stopping Auto Mode Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Stop Triggers                            │
│  1. All questions completed                                  │
│  2. User disables auto mode                                 │
│  3. Quiz status changed to DRAFT                            │
│  4. Quiz status changed from LIVE                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  stopAutoMode(quizId, skipDraftUpdate)│
        │  - Remove from activeAutoModes Map│
        └──────────────┬───────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
   skipDraftUpdate = false   skipDraftUpdate = true
         │                           │
         ▼                           │
┌──────────────────────────────┐    │
│  Set quiz status to DRAFT    │    │
│  (if quiz is still LIVE)     │    │
└──────────────────────────────┘    │
                                     │
                                     └───> (Manual draft change)
```

## Detailed Step-by-Step Flow

### Step 1: Enabling Auto Mode

1. **User Action**: Admin clicks "Turn On Auto Mode" button in admin panel
2. **Validation**: Frontend checks if quiz status is "live"
3. **API Call**: `PUT /api/admin/quizzes/{id}` with `auto_mode_enabled: true`
4. **Backend Validation**: 
   - Quiz must be LIVE status
   - Throws error if not live
5. **Database Update**: Quiz record updated with `auto_mode_enabled = true`
6. **Auto Mode Start**: `restartAutoMode()` called
7. **Question Loading**: All questions fetched, sorted by `order_index`
8. **Position Detection**:
   - If active question exists → start from next question
   - If no active question → find first PENDING question
   - If all completed → start from beginning
9. **First Activation**: First question activated immediately (if no active question)
10. **State Creation**: Auto mode state stored in memory with:
    - `nextActivationTime = now + intervalSeconds`
    - `questionIndex = current position`
    - `questions = all questions array`

### Step 2: Periodic Question Activation

1. **Cron Trigger**: Every 10 seconds, `checkAndActivateQuestions()` runs
2. **Time Check**: For each active auto mode:
   - Compare `nextActivationTime` with current time
   - If time reached → proceed to activation
3. **Validation**: Before activating:
   - Quiz status is LIVE
   - `auto_mode_enabled = true`
   - `auto_mode_paused = false`
   - If invalid → stop auto mode
4. **Question Transition**:
   - Find current active question
   - End current question (if exists)
   - Emit `question-ended` WebSocket event
   - Activate next question
   - Emit `question-live` WebSocket event
5. **State Update**:
   - Increment `questionIndex`
   - Set `nextActivationTime = now + intervalSeconds`
6. **Completion Check**: If `questionIndex >= questions.length`:
   - Call `stopAutoMode()`
   - Set quiz status to DRAFT

### Step 3: Pausing Auto Mode

1. **User Action**: Admin clicks "Pause" button
2. **API Call**: `PUT /api/admin/quizzes/{id}` with `auto_mode_paused: true`
3. **Database Update**: Quiz record updated
4. **Cron Detection**: Next `checkAndManageAutoModes()` (within 30 seconds) detects pause
5. **State Update**: `nextActivationTime` set to `null` (pauses activation)
6. **State Preserved**: Auto mode state kept in memory, just paused

### Step 4: Resuming Auto Mode

1. **User Action**: Admin clicks "Resume" button
2. **API Call**: `PUT /api/admin/quizzes/{id}` with `auto_mode_paused: false`
3. **Database Update**: Quiz record updated
4. **Cron Detection**: Next `checkAndManageAutoModes()` detects resume
5. **Resume Logic**: `resumeAutoMode()` called
6. **State Update**: `nextActivationTime = now + intervalSeconds`
7. **Auto Mode Resumes**: Next question will activate at scheduled time

### Step 5: Stopping Auto Mode

**Scenario A: All Questions Completed**
1. Last question activated
2. `questionIndex` reaches `questions.length`
3. `stopAutoMode()` called automatically
4. Quiz status set to DRAFT
5. State removed from memory

**Scenario B: User Disables Auto Mode**
1. User clicks "Turn Off Auto Mode"
2. `PUT /api/admin/quizzes/{id}` with `auto_mode_enabled: false`
3. Database updated
4. Next `checkAndManageAutoModes()` detects disabled state
5. `stopAutoMode(quizId, false)` called
6. State removed from memory

**Scenario C: Quiz Status Changed to DRAFT**
1. User changes quiz status to DRAFT
2. `QuizService.updateQuiz()` called
3. `stopAutoMode(quizId, true)` called (skipDraftUpdate = true)
4. State removed from memory
5. Quiz status manually set to DRAFT (not auto-set)

## Key Timing Details

### Cron Jobs
- **Question Activation Check**: Every 10 seconds
  - Checks if `nextActivationTime` has been reached
  - Activates questions when time arrives
  
- **Quiz Management Check**: Every 30 seconds
  - Checks for new live quizzes with auto mode
  - Detects pause/resume state changes
  - Stops auto modes for non-live quizzes

### Question Activation Timing
- **First Question**: Activated immediately when auto mode starts (if no active question)
- **Subsequent Questions**: Activated at `nextActivationTime = now + intervalSeconds`
- **Precision**: ±10 seconds (due to cron job frequency)

### State Persistence
- **In-Memory Only**: Auto mode state is stored in `activeAutoModes` Map
- **Not Persisted**: State is lost on server restart
- **Recovery**: On restart, `checkAndManageAutoModes()` will restart auto modes for live quizzes

## Error Handling

### Question Activation Errors
- If activation fails → error logged, state updated to retry in 5 seconds
- Question index not incremented → allows retry on next cron run

### Quiz Validation Errors
- If quiz becomes invalid (not LIVE, disabled, paused) → auto mode stopped
- State cleaned up automatically

### Database Errors
- Errors logged but don't crash the service
- Auto mode continues for other quizzes

## WebSocket Events

### Events Emitted
1. **question-live**: When a question is activated
   - Emitted to all clients
   - Includes question data and time remaining

2. **question-ended**: When a question ends
   - Emitted to all clients
   - Includes ended question data

3. **quiz-status-changed**: When quiz status changes
   - Emitted to all clients
   - Includes updated quiz data

## Configuration

### Required Settings
- `auto_mode_enabled`: Boolean - Enable/disable auto mode
- `auto_mode_interval_seconds`: Number - Time between questions (default: 120)
- `quiz_duration_minutes`: Number - Total quiz duration (for calculation)

### Constraints
- Auto mode can only be enabled when quiz status is LIVE
- Minimum interval: 10 seconds
- Maximum interval: 3600 seconds (1 hour)

## Performance Considerations

1. **Cron Job Frequency**: 
   - 10 seconds for question activation (balance between precision and load)
   - 30 seconds for quiz management (less frequent, acceptable delay)

2. **Database Queries**:
   - Questions loaded once at start
   - Quiz validation on each activation (lightweight)
   - State stored in memory (fast access)

3. **Concurrent Quizzes**:
   - Each quiz has independent state
   - Multiple quizzes can run simultaneously
   - No interference between quizzes

## Troubleshooting

### Auto Mode Not Starting
- Check quiz status is LIVE
- Verify `auto_mode_enabled = true` in database
- Check server logs for errors
- Ensure questions exist for the quiz

### Questions Not Activating
- Check `auto_mode_paused` is false
- Verify `nextActivationTime` is set
- Check cron job is running (server logs)
- Verify quiz is still LIVE

### Auto Mode Stops Unexpectedly
- Check if quiz status changed
- Verify `auto_mode_enabled` is still true
- Check for errors in server logs
- Verify all questions haven't been completed

