# transcription-reporting

# 🎤 Voice Transcription App

A modern, production-ready voice recording and transcription application with date-focused meeting records. Built with Next.js 14, NestJS, Prisma, and Docker.

## ✨ Features

- **🎯 Date-Focused Architecture**: Meeting records organized by date for efficient querying
- **🎤 Voice Recording**: Real-time audio recording with Web Audio API
- **📝 Strict Format Validation**: Enforces exact sentence structure
- **🤖 AI Transcription**: Support for OpenAI Whisper, Google Speech-to-Text, Azure Speech
- **📊 Google Sheets Integration**: Automatic synchronization of meeting records
- **📈 Analytics Dashboard**: Meeting statistics and trends
- **🔒 Production Ready**: Docker, TypeScript, comprehensive error handling

## 🏗️ Tech Stack

### Frontend

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Radix UI** for components
- **Zustand** for state management

### Backend

- **NestJS** with TypeScript
- **Prisma ORM** with PostgreSQL
- **Redis** for caching
- **OpenAPI/Swagger** documentation

### Infrastructure

- **Docker & Docker Compose**
- **Turborepo** for monorepo management
- **ESLint & Prettier** for code quality

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

### 1. Clone & Setup

```bash
git clone <repository-url>
cd voice-transcription-app
npm install
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` with your API keys:

```bash
# Required for transcription
OPENAI_API_KEY="your-openai-api-key"

# Required for Google Sheets
GOOGLE_SHEETS_API_KEY="your-google-sheets-api-key"
GOOGLE_SHEETS_SPREADSHEET_ID="your-spreadsheet-id"

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/voice_transcription"
```

### 3. Start with Docker

```bash
npm run docker:up
```

### 4. Initialize Database

```bash
npm run db:migrate
npm run db:seed
```

### 5. Open Application

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api/docs
- **Database Studio**: `npm run db:studio`

## 📋 Required Voice Message Format

The application enforces this exact format:

> **"My name is [name] and I belong to group [#] and today I met [person's name] at [location]."**

### Examples:

- ✅ "My name is John Smith and I belong to group 5 and today I met Sarah Johnson at the coffee shop."
- ✅ "My name is Maria Garcia and I belong to group 12 and today I met David Wilson at the library."
- ❌ "Hi, my name is John and I met Sarah today."

## 🗄️ Database Schema

### Primary Tables

**meeting_records** (Main table - optimized for date queries)

```sql
- id (Primary Key)
- recording_date (DATE) -- MOST IMPORTANT FIELD
- recording_datetime (TIMESTAMP)
- speaker_name, group_number, person_met, location
- full_transcription, recording_duration
- year, month, day, day_of_week (for fast queries)
- status, processing_status, validation_score
- synced_to_sheets, sheets_last_sync
```

**Key Indexes:**

- `recording_date` (Primary index for date queries)
- `group_number, recording_date` (Group + date filtering)
- `speaker_name`, `status` (Additional filters)

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev                 # Start all services in dev mode
npm run build              # Build all applications
npm run start              # Start production servers

# Database
npm run db:migrate         # Run database migrations
npm run db:seed           # Seed database with sample data
npm run db:studio         # Open Prisma Studio
npm run db:reset          # Reset database

# Docker
npm run docker:up         # Start all containers
npm run docker:down       # Stop all containers
npm run docker:logs       # View container logs

# Code Quality
npm run lint              # Lint all code
npm run format           # Format all code
npm run type-check       # Check TypeScript types
```

### Project Structure

```
voice-transcription-app/
├── apps/
│   ├── web/                    # Next.js Frontend
│   │   ├── src/app/           # App Router pages
│   │   ├── src/components/    # UI components
│   │   ├── src/hooks/         # Custom React hooks
│   │   └── src/lib/           # Utilities
│   │
│   └── api/                   # NestJS Backend
│       ├── src/modules/       # Feature modules
│       ├── src/common/        # Shared utilities
│       └── prisma/            # Database schema
│
├── packages/
│   ├── shared/                # Shared types & utilities
│   └── ui/                    # Reusable UI components
│
└── tools/                     # Build tools & configs
```

## 🔌 API Integration

### Transcription Services

**OpenAI Whisper** (Recommended)

```typescript
// Configuration
TRANSCRIPTION_PROVIDER = "openai";
OPENAI_API_KEY = "sk-your-key";
OPENAI_MODEL = "whisper-1";
```

**Google Speech-to-Text**

```typescript
TRANSCRIPTION_PROVIDER = "google";
GOOGLE_SPEECH_API_KEY = "your-key";
GOOGLE_PROJECT_ID = "your-project";
```

**Azure Speech Services**

```typescript
TRANSCRIPTION_PROVIDER = "azure";
AZURE_SPEECH_API_KEY = "your-key";
AZURE_SPEECH_REGION = "your-region";
```

### Google Sheets Integration

1. Create a Google Cloud Project
2. Enable Google Sheets API
3. Create a Service Account
4. Download credentials JSON
5. Set environment variables:

```bash
GOOGLE_SHEETS_API_KEY="your-api-key"
GOOGLE_SHEETS_SPREADSHEET_ID="your-spreadsheet-id"
GOOGLE_SERVICE_ACCOUNT_EMAIL="service@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

## 📊 Google Sheets Format

Records are automatically synced with this column structure:

| A          | B        | C          | D     | E             | F           | G      | H             | I        |
| ---------- | -------- | ---------- | ----- | ------------- | ----------- | ------ | ------------- | -------- |
| **Date**   | Time     | Speaker    | Group | Person Met    | Location    | Day    | Transcription | Duration |
| 2024-01-15 | 10:30 AM | John Smith | 5     | Sarah Johnson | Coffee Shop | Monday | Full text...  | 01:30    |

## 🧪 Testing

### Sample Data

The seed script creates test records for:

- **Today**: John Smith (Group 5) met Sarah Johnson
- **Yesterday**: Maria Garcia (Group 12) met David Wilson
- **Two days ago**: Alex Chen (Group 1) met Emma Brown

### API Testing

```bash
# Health check
curl http://localhost:3001/api/v1

# Get meetings
curl http://localhost:3001/api/v1/meetings

# Get statistics
curl http://localhost:3001/api/v1/meetings/statistics
```

## 🚀 Deployment

### Environment Setup

1. **Production Environment Variables**

```bash
NODE_ENV=production
DATABASE_URL="your-production-db-url"
REDIS_URL="your-production-redis-url"
FRONTEND_URL="https://your-domain.com"
```

2. **Build for Production**

```bash
npm run build
```

3. **Deploy Options**

- **Vercel** (Frontend) + **Railway/Render** (Backend)
- **AWS ECS** with Docker containers
- **Kubernetes** with provided manifests
- **DigitalOcean App Platform**

### Docker Production

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production stack
docker-compose -f docker-compose.prod.yml up -d
```

## 🔍 Monitoring & Analytics

### Built-in Analytics

- **Daily Statistics**: Total recordings, success rate, unique groups
- **Group Analytics**: Meeting frequency, popular locations
- **Performance Metrics**: Processing times, error rates

### Health Checks

- **Database**: Connection and query performance
- **APIs**: External service availability
- **Storage**: File upload and retrieval

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration
- **Prettier**: Consistent formatting
- **Conventional Commits**: Semantic commit messages

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Common Issues

**Microphone Access Denied**

- Ensure HTTPS in production
- Check browser permissions
- Test with different browsers

**Transcription Fails**

- Verify API keys are correct
- Check network connectivity
- Review audio format compatibility

**Database Connection Issues**

- Confirm PostgreSQL is running
- Check DATABASE_URL format
- Verify network access
