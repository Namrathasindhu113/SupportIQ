# SupportIQ — AI-Assisted Customer Support & Issue Resolution Platform

**A MERN stack application for customer support ticket management, team collaboration, and AI-assisted issue resolution.**

- **Live Application:** https://support-iq-nine.vercel.app/
- **GitHub Repository:** https://github.com/Namrathasindhu113/SupportIQ
- **Backend API:** https://supportiq-api-wtom.onrender.com

## 1. Project Overview

SupportIQ is a customer support platform that helps customers raise and track support tickets while enabling support agents to manage, prioritize, assign, and resolve issues through a centralized workspace.

The application provides separate customer and agent experiences, company-scoped access permissions, ticket activity tracking, and AI-assisted support workflows.

## 2. Key Features

### Customer Portal
- Secure registration and login.
- Create and view support tickets.
- Track ticket status and updates.
- View ticket conversations and replies.
- Access only tickets belonging to the authenticated customer.

### Agent Portal
- Agent dashboard with ticket metrics and recent activity.
- Centralized support desk for managing tickets.
- Search, filter, and paginate ticket queues.
- Assign tickets and update their status, priority, and category.
- Respond to customer messages.
- View ticket activity history.
- Work within authorized company workspaces.

### Company and Workspace Management
- Create and manage company workspaces using authorized agent accounts.
- Add existing members and invite new members.
- Apply company-scoped roles and permissions.
- Restrict member management and workspace settings to authorized company administrators.
- Keep customer access separate from agent administration.

### AI-Assisted Support
- AI-assisted analysis of support issues.
- Suggested responses and resolution guidance where supported by the configured AI service.
- Integration with the Groq API for AI-powered functionality.

### Security
- JWT-based authentication using HTTP-only cookies.
- Role-based and company-membership-based authorization.
- Backend validation of protected operations.
- Separation of customer and agent permissions.

## 3. Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas, Mongoose |
| Authentication | JWT, HTTP-only cookies |
| AI Integration | Groq API |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |
| Development AI Tool | Kiro |

## 4. Live Demo

Open the application:

https://support-iq-nine.vercel.app/

### Evaluator Access — Agent Portal

1. Open the live application and navigate to the login page.
2. Sign in using the verified evaluator agent account listed below.
3. Open the Agent Portal.
4. Explore the Overview, Support Desk, and Companies & Workspaces sections.
5. If the account has company administrator permissions, explore Team & Members and Workspace Settings as well.

**Agent demo email:** agent@supportiq.dev

**Agent demo password:** Agent@12345

> Demo access must be verified before submission. Do not use your personal account or publish production credentials. The demo account should contain only non-sensitive sample data and have the minimum permissions required for evaluation.

**Customer Portal:** Open the live application and sign in using a separate verified customer demo account, if provided.

## 5. Local Setup and Installation

### Prerequisites

- Node.js and npm
- MongoDB Atlas account or local MongoDB instance
- Groq API key for AI functionality

### Clone the repository

```bash
git clone https://github.com/Namrathasindhu113/SupportIQ.git
cd SupportIQ
```

### Install backend dependencies

```bash
cd backend
npm install
```

### Configure backend environment variables

Create a `backend/.env` file using the variable names required by the backend configuration.

```env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
JWT_EXPIRES_IN=your_configured_expiry
CLIENT_ORIGIN=http://localhost:5173
COOKIE_SECURE=false
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=your_supported_groq_model
```

Use valid local configuration values. Never commit `.env` files, API keys, JWT secrets, or database credentials.

### Install frontend dependencies

Open another terminal from the repository root:

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

### Run the application

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend in a second terminal:

```bash
cd frontend
npm run dev
```

Open the local frontend URL printed by Vite, usually:

http://localhost:5173

> Check the project's `package.json` scripts before running the commands. If a development script is not defined, use the start script provided by that package.

## 6. Production Deployment

The application is deployed using:

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** MongoDB Atlas

The frontend communicates with the backend through `VITE_API_BASE_URL`. The backend requires the appropriate MongoDB, JWT, CORS, cookie, and AI configuration.

For production, use HTTPS and configure secure cookies and the exact permitted frontend origin. Keep all secrets in the hosting provider's environment-variable settings.

Backend health endpoint:

https://supportiq-api-wtom.onrender.com/api/v1/health

## 7. Testing and Build Verification

Run the backend test suite from the repository root:

```bash
npm --prefix backend test
```

Build the frontend for production:

```bash
npm --prefix frontend run build
```

Authentication, authorization, ticket workflows, and integration behavior should be verified before release. AI functionality also depends on the availability and configuration of the external AI service.

## 8. AI Development Tool

**Tool used: Kiro**

Kiro was used as an AI-assisted development tool during the implementation of SupportIQ.

### AI Development Experience

Kiro helped accelerate development and debugging while keeping the implementation under review. Generated suggestions were checked against the existing codebase, application behavior, and test results rather than being accepted without validation.

### Specific Tasks Assisted by Kiro

1. **API development and integration:** Assisted with reviewing backend routes, request handling, and frontend-to-backend communication.
2. **Authentication and authorization:** Helped investigate JWT cookie handling, CORS configuration, and protected portal access.
3. **Ticket management:** Assisted with reviewing ticket workflows, assignment, status updates, and activity logging.
4. **Debugging and refactoring:** Helped trace application errors and identify implementation inconsistencies.
5. **Testing and validation:** Assisted with running tests, interpreting failures, and checking the production frontend build.

## 9. Engineering Considerations

- Customer and agent access are separated by authorization rules.
- Workspace administration is restricted to authorized company administrators.
- Sensitive credentials are supplied through environment variables.
- Automated tests and production builds are used to validate changes.
- External AI service availability can affect AI-assisted features.

## 10. Future Improvements

- Automated invitation email delivery.
- End-to-end browser testing.
- More comprehensive AI response evaluation.
- Enhanced monitoring and production observability.

## 11. Acknowledgements

Built as a MERN stack development assessment project for the StartupMeu Software Engineer Intern opportunity.

**Author:** Namratha Sindhu M
