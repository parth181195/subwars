# Quiz API Endpoints Review

This document lists all quiz-related API endpoints organized by functional area for manual review.

---

## 📋 Quiz APIs (`/quiz/**`) - For Quiz React App

These endpoints are used by the quiz-react frontend application (public-facing quiz interface).

### 1. Get Active Quizzes
- **Method**: `GET`
- **Path**: `/quiz/active`
- **Auth**: None (Public)
- **Description**: Returns all quizzes with status 'live'
- **Controller**: `QuizController.getActiveQuizzes()`
- **File**: `api/src/app/quiz/quiz.controller.ts:30`
- **Frontend Usage**:
  - `quiz-react/src/services/quiz.ts:55` - `QuizService.getActiveQuizzes()`
  - `quiz-react/src/components/LiveQuestionNotification/LiveQuestionNotification.tsx:50` - Polls for live quizzes

### 2. Get Quiz by ID
- **Method**: `GET`
- **Path**: `/quiz/:id`
- **Auth**: Optional (checks token if provided)
- **Description**: Returns quiz with user access info (can_participate, has_email_restriction)
- **Controller**: `QuizController.getQuizById()`
- **File**: `api/src/app/quiz/quiz.controller.ts:40`
- **Frontend Usage**:
  - `quiz-react/src/services/quiz.ts:66` - `QuizService.getQuizById()`
  - `quiz-react/src/pages/Quiz/Quiz.tsx:127` - Fetches quiz with auth token to check participation access

### 3. Get Quiz Questions
- **Method**: `GET`
- **Path**: `/quiz/:id/questions`
- **Auth**: None (Public)
- **Description**: Returns all questions for a quiz (sanitized - no answers)
- **Controller**: `QuizController.getQuizQuestions()`
- **File**: `api/src/app/quiz/quiz.controller.ts:88`
- **Frontend Usage**:
  - `quiz-react/src/services/quiz.ts:77` - `QuizService.getQuizQuestions()`

### 4. Get Current Active Question
- **Method**: `GET`
- **Path**: `/quiz/:id/active-question`
- **Auth**: None (Public)
- **Description**: Returns the currently active question for a quiz (sanitized)
- **Controller**: `QuizController.getCurrentActiveQuestion()`
- **File**: `api/src/app/quiz/quiz.controller.ts:98`
- **Frontend Usage**:
  - `quiz-react/src/services/quiz.ts:88` - `QuizService.getCurrentActiveQuestion()`
  - `quiz-react/src/components/LiveQuestionNotification/LiveQuestionNotification.tsx:70` - Checks for active question in live quiz

### 5. Get Top Answers for Question
- **Method**: `GET`
- **Path**: `/quiz/questions/:questionId/top-answers`
- **Auth**: None (Public)
- **Description**: Returns top 3 fastest correct answers for a question
- **Controller**: `QuizController.getTopAnswers()`
- **File**: `api/src/app/quiz/quiz.controller.ts:142`
- **Frontend Usage**:
  - `quiz-react/src/services/quiz.ts:122` - `QuizService.getTopAnswers()`

### 6. Submit Answer
- **Method**: `POST`
- **Path**: `/quiz/questions/:questionId/answers`
- **Auth**: Required (FirebaseAuthGuard)
- **Description**: Submits an answer for a question. Checks quiz restrictions.
- **Body**: `{ answer: string, quizId: string, userId: string, responseTime?: number }`
- **Controller**: `QuizController.submitAnswer()`
- **File**: `api/src/app/quiz/quiz.controller.ts:150`
- **Frontend Usage**:
  - `quiz-react/src/pages/Quiz/Quiz.tsx:691` - Submits answer when user clicks submit button

### 7. Get Voice Line (Proxy)
- **Method**: `GET`
- **Path**: `/quiz/voice-line/:questionId`
- **Auth**: None (Public)
- **Description**: Proxies voice line file from CDN, masks hero name in URL. Uses caching.
- **Controller**: `QuizController.getVoiceLine()`
- **File**: `api/src/app/quiz/quiz.controller.ts:224`
- **Frontend Usage**:
  - `quiz-react/src/pages/Quiz/Quiz.tsx:866` - Used in `<audio>` tag `src` attribute for voice line questions (URL is sanitized in question_content)

---

## 🔐 Admin Quiz APIs (`/admin/quizzes/**`)

These endpoints are used by the admin-react frontend application for quiz and question management.

### Quiz Management

### 8. Get All Quizzes
- **Method**: `GET`
- **Path**: `/admin/quizzes`
- **Auth**: AdminAuthGuard
- **Description**: Returns all quizzes
- **Controller**: `AdminQuizController.getAllQuizzes()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:52`
- **Frontend Usage**:
  - `admin-react/src/pages/Quizzes/Quizzes.tsx:35` - Fetches all quizzes for the quizzes list page

### 9. Get Quiz by ID
- **Method**: `GET`
- **Path**: `/admin/quizzes/:id`
- **Auth**: AdminAuthGuard
- **Description**: Returns a specific quiz (full data, not sanitized)
- **Controller**: `AdminQuizController.getQuizById()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:68`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuizDetail.tsx:258` - Fetches quiz details on page load
  - `admin-react/src/pages/QuizDetail/QuizDetail.tsx:591` - Fetches quiz after auto mode update
  - `admin-react/src/pages/QuizDetail/QuizDetail.tsx:693` - Fetches quiz after quiz duration update

### 10. Create Quiz
- **Method**: `POST`
- **Path**: `/admin/quizzes`
- **Auth**: AdminAuthGuard
- **Description**: Creates a new quiz
- **Body**: `QuizInsert`
- **Controller**: `AdminQuizController.createQuiz()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:89`
- **Frontend Usage**:
  - `admin-react/src/pages/Quizzes/Quizzes.tsx:51` - Creates new quiz from CreateQuizDialog

### 11. Update Quiz
- **Method**: `PUT`
- **Path**: `/admin/quizzes/:id`
- **Auth**: AdminAuthGuard
- **Description**: Updates a quiz. Handles status changes (live/draft).
- **Body**: `QuizUpdate`
- **Controller**: `AdminQuizController.updateQuiz()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:94`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuizDetail.tsx:591` - Updates quiz status (live/draft toggle)
  - `admin-react/src/pages/QuizDetail/QuizDetail.tsx:693` - Updates quiz duration and auto mode settings

### 12. Delete Quiz
- **Method**: `DELETE`
- **Path**: `/admin/quizzes/:id`
- **Auth**: AdminAuthGuard
- **Description**: Deletes a quiz
- **Controller**: `AdminQuizController.deleteQuiz()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:115`
- **Frontend Usage**: *Not currently used in frontend*

### Question Management

### 13. Get Question by ID
- **Method**: `GET`
- **Path**: `/admin/quizzes/questions/:questionId`
- **Auth**: AdminAuthGuard
- **Description**: Returns a specific question (full data)
- **Controller**: `AdminQuizController.getQuestionById()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:58`
- **Note**: Must come before `:id` route
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuestionsTab.tsx:95` - Fetches question details when viewing question statistics
  - `admin-react/src/pages/Answers/Answers.tsx:74` - Fetches question details on answers page

### 14. Get Quiz Questions
- **Method**: `GET`
- **Path**: `/admin/quizzes/:id/questions`
- **Auth**: AdminAuthGuard
- **Description**: Returns all questions for a quiz
- **Controller**: `AdminQuizController.getQuizQuestions()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:122`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuizDetail.tsx:282` - Fetches all questions for a quiz

### 15. Create Question
- **Method**: `POST`
- **Path**: `/admin/quizzes/:id/questions`
- **Auth**: AdminAuthGuard
- **Description**: Creates a new question for a quiz. Supports file uploads.
- **Body**: `QuizQuestionInsert` + file uploads
- **Controller**: `AdminQuizController.createQuestion()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:127`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuestionsTab.tsx:305` - Creates new question from form (FormData with file uploads)

### 16. Update Question
- **Method**: `PUT`
- **Path**: `/admin/quizzes/questions/:questionId`
- **Auth**: AdminAuthGuard
- **Description**: Updates a question. Supports file uploads.
- **Body**: `QuizQuestionUpdate` + optional file uploads
- **Controller**: `AdminQuizController.updateQuestion()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:205`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuestionsTab.tsx:238` - Updates question from edit form (FormData with file uploads)

### 17. Delete Question
- **Method**: `DELETE`
- **Path**: `/admin/quizzes/questions/:questionId`
- **Auth**: AdminAuthGuard
- **Description**: Deletes a question
- **Controller**: `AdminQuizController.deleteQuestion()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:270`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuestionsTab.tsx:202` - Deletes question after confirmation

### 18. Make Question Live
- **Method**: `POST`
- **Path**: `/admin/quizzes/questions/:questionId/make-live`
- **Auth**: AdminAuthGuard
- **Description**: Activates a question (sets it to live status)
- **Controller**: `AdminQuizController.makeQuestionLive()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:277`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuestionsTab.tsx:148` - Makes question live from questions tab
  - `admin-react/src/pages/QuizDetail/QuizDetail.tsx:918` - Ends question when quiz is set to draft

### 19. End Question
- **Method**: `POST`
- **Path**: `/admin/quizzes/questions/:questionId/end`
- **Auth**: AdminAuthGuard
- **Description**: Ends a question (sets it to completed status)
- **Controller**: `AdminQuizController.endQuestion()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:287`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuestionsTab.tsx:179` - Ends question from questions tab

### 20. Auto Generate Questions
- **Method**: `POST`
- **Path**: `/admin/quizzes/:id/questions/auto-generate`
- **Auth**: AdminAuthGuard
- **Description**: Automatically generates questions for a quiz from voice lines
- **Body**: `{ count: number, questionType: QuestionType }`
- **Controller**: `AdminQuizController.autoGenerateQuestions()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:298`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/AutoGenerateQuestionsDialog.tsx:38` - Generates questions from dialog

### Auto Mode

### 21. Get Next Question Time
- **Method**: `GET`
- **Path**: `/admin/quizzes/:id/next-question-time`
- **Auth**: AdminAuthGuard
- **Description**: Returns the next question activation time for auto mode
- **Controller**: `AdminQuizController.getNextQuestionTime()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:73`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuizDetail.tsx:209` - Polls every 10 seconds to show countdown for next question in auto mode

### Allowed Emails Management

### 22. Get Allowed Emails
- **Method**: `GET`
- **Path**: `/admin/quizzes/:id/allowed-emails`
- **Auth**: AdminAuthGuard
- **Description**: Returns list of allowed emails for a quiz
- **Controller**: `AdminQuizController.getAllowedEmails()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:483`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuizDetail.tsx:336` - Fetches allowed emails for quiz access management

### 23. Set Allowed Emails
- **Method**: `POST`
- **Path**: `/admin/quizzes/:id/allowed-emails`
- **Auth**: AdminAuthGuard
- **Description**: Sets the allowed emails list for a quiz
- **Body**: `{ allowedEmails: string[] }`
- **Controller**: `AdminQuizController.setAllowedEmails()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:497`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuizDetail.tsx:364` - Adds email to allowed list

### 24. Remove Allowed Email
- **Method**: `DELETE`
- **Path**: `/admin/quizzes/:id/allowed-emails`
- **Auth**: AdminAuthGuard
- **Description**: Removes a specific email from allowed list
- **Query**: `?email=user@example.com`
- **Controller**: `AdminQuizController.removeAllowedEmail()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:528`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuizDetail.tsx:407` - Removes email from allowed list

### 25. Clear All Allowed Emails
- **Method**: `DELETE`
- **Path**: `/admin/quizzes/:id/allowed-emails/all`
- **Auth**: AdminAuthGuard
- **Description**: Clears all allowed emails (makes quiz public)
- **Controller**: `AdminQuizController.clearAllAllowedEmails()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:554`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuizDetail.tsx:453` - Clears all allowed emails (makes quiz public)

---

## 🏆 Leaderboard APIs (`/quiz/leaderboard/**` and `/admin/quizzes/leaderboard/**`)

These endpoints handle leaderboard data for both public and admin views.

### Public Leaderboard Endpoints

### 26. Get Combined Leaderboard
- **Method**: `GET`
- **Path**: `/quiz/leaderboard/combined`
- **Auth**: None (Public)
- **Description**: Returns leaderboard across all quizzes
- **Controller**: `QuizController.getCombinedLeaderboard()`
- **File**: `api/src/app/quiz/quiz.controller.ts:111`
- **Note**: Must come before `:id/leaderboard` to avoid route conflicts
- **Frontend Usage**:
  - `quiz-react/src/pages/Leaderboard/Leaderboard.tsx:32` - Displays combined leaderboard page

### 27. Get Quiz Leaderboard
- **Method**: `GET`
- **Path**: `/quiz/:id/leaderboard`
- **Auth**: None (Public)
- **Description**: Returns leaderboard for a specific quiz
- **Controller**: `QuizController.getQuizLeaderboard()`
- **File**: `api/src/app/quiz/quiz.controller.ts:119`
- **Frontend Usage**:
  - `quiz-react/src/services/quiz.ts:134` - `QuizService.getQuizLeaderboard()` (uses authenticated fetch)

### Admin Leaderboard Endpoints

### 28. Get Combined Leaderboard (Admin)
- **Method**: `GET`
- **Path**: `/admin/quizzes/leaderboard/combined`
- **Auth**: AdminAuthGuard
- **Description**: Returns combined leaderboard across all quizzes
- **Controller**: `AdminQuizController.getCombinedLeaderboard()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:328`
- **Frontend Usage**:
  - `admin-react/src/pages/CombinedLeaderboard/CombinedLeaderboard.tsx:44` - Displays combined leaderboard page

### 29. Get Quiz Leaderboard (Admin)
- **Method**: `GET`
- **Path**: `/admin/quizzes/:id/leaderboard`
- **Auth**: AdminAuthGuard
- **Description**: Returns leaderboard for a specific quiz
- **Controller**: `AdminQuizController.getQuizLeaderboard()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:336`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/LeaderboardTab.tsx:127` - Displays quiz leaderboard in leaderboard tab

### Leaderboard Management

### 30. Reset Quiz Leaderboard
- **Method**: `DELETE`
- **Path**: `/admin/quizzes/:id/leaderboard`
- **Auth**: AdminAuthGuard
- **Description**: Deletes all answers for a specific quiz
- **Controller**: `AdminQuizController.resetQuizLeaderboard()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:364`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/LeaderboardTab.tsx:127` - Resets leaderboard after confirmation dialog

### 31. Reset Combined Leaderboard
- **Method**: `DELETE`
- **Path**: `/admin/quizzes/leaderboard/combined`
- **Auth**: AdminAuthGuard
- **Description**: Deletes all answers across all quizzes
- **Controller**: `AdminQuizController.resetCombinedLeaderboard()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:379`
- **Frontend Usage**:
  - `admin-react/src/pages/CombinedLeaderboard/CombinedLeaderboard.tsx:91` - Resets combined leaderboard after confirmation

### 32. Get Hidden Emails
- **Method**: `GET`
- **Path**: `/admin/quizzes/leaderboard/hidden-emails`
- **Auth**: AdminAuthGuard
- **Description**: Returns list of emails hidden from leaderboard
- **Controller**: `AdminQuizController.getHiddenEmails()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:394`
- **Frontend Usage**:
  - `admin-react/src/pages/CombinedLeaderboard/CombinedLeaderboard.tsx:68` - Fetches hidden emails list

### 33. Hide Email from Leaderboard
- **Method**: `POST`
- **Path**: `/admin/quizzes/leaderboard/hide-email`
- **Auth**: AdminAuthGuard
- **Description**: Adds an email to the hidden list
- **Body**: `{ email: string }`
- **Controller**: `AdminQuizController.hideEmailFromLeaderboard()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:411`
- **Frontend Usage**:
  - `admin-react/src/pages/CombinedLeaderboard/CombinedLeaderboard.tsx:140` - Hides email from leaderboard

### 34. Show Email in Leaderboard
- **Method**: `POST`
- **Path**: `/admin/quizzes/leaderboard/show-email`
- **Auth**: AdminAuthGuard
- **Description**: Removes an email from the hidden list
- **Body**: `{ email: string }`
- **Controller**: `AdminQuizController.showEmailInLeaderboard()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:455`
- **Frontend Usage**:
  - `admin-react/src/pages/CombinedLeaderboard/CombinedLeaderboard.tsx:271` - Shows email in leaderboard (removes from hidden list)

---

## 📝 Answer List APIs (`/admin/quizzes/**/answers`)

These endpoints handle answer data retrieval for admin purposes.

### 35. Get Question Answers
- **Method**: `GET`
- **Path**: `/admin/quizzes/questions/:questionId/answers`
- **Auth**: AdminAuthGuard
- **Description**: Returns all answers for a question
- **Controller**: `AdminQuizController.getQuestionAnswers()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:63`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuestionsTab.tsx:94` - Fetches answers when viewing question statistics
  - `admin-react/src/pages/Answers/Answers.tsx:47` - Fetches all answers for a question on answers page

### 36. Get Quiz Answers
- **Method**: `GET`
- **Path**: `/admin/quizzes/:id/answers`
- **Auth**: AdminAuthGuard
- **Description**: Returns all answers for a quiz with user data
- **Controller**: `AdminQuizController.getQuizAnswers()`
- **File**: `api/src/app/admin/admin-quiz.controller.ts:344`
- **Frontend Usage**:
  - `admin-react/src/pages/QuizDetail/QuizDetail.tsx:491` - Fetches answers for CSV download

---

## 📝 Review Checklist

For each endpoint, review:

- [ ] **Route ordering** - More specific routes before parameterized routes
- [ ] **Authentication** - Correct guards applied
- [ ] **Authorization** - Proper permission checks
- [ ] **Input validation** - Required fields, types, formats
- [ ] **Error handling** - Appropriate HTTP status codes
- [ ] **Response format** - Consistent structure
- [ ] **Performance** - Efficient queries, no N+1 problems
- [ ] **Security** - No sensitive data leaks, SQL injection protection
- [ ] **PostgreSQL usage** - Using PostgresService correctly
- [ ] **Transaction handling** - Where needed for atomicity
- [ ] **Edge cases** - Null checks, empty arrays, missing data

---

## 🔍 Key Files to Review

1. **Public Quiz Controller**: `api/src/app/quiz/quiz.controller.ts`
2. **Admin Quiz Controller**: `api/src/app/admin/admin-quiz.controller.ts`
3. **Quiz Service**: `api/src/app/quiz/quiz.service.ts`
4. **Answer Service**: `api/src/app/answer/answer.service.ts`
5. **Postgres Service**: `api/src/app/services/postgres.service.ts`

---

## 🚨 Potential Issues to Check

1. **Firestore references** - Ensure all removed
2. **Route conflicts** - Check route ordering (e.g., `leaderboard/combined` before `:id/leaderboard`)
3. **Transaction usage** - Multi-step operations should use transactions
4. **Error messages** - Should be user-friendly and not expose internals
5. **Performance** - Check for N+1 queries, missing indexes
6. **Data consistency** - Leaderboard calculations, status updates
