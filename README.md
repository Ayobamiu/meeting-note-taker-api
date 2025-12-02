# Meeting Note Taker

A simple MVP application that joins Google Meet meetings using Nylas Notetaker API, tracks progress, and generates basic notes after meetings end.

## Features

- ✅ Add Google Meet links
- ✅ Bot automatically joins meetings
- ✅ Real-time progress updates
- ✅ Automatic note generation after meeting ends
- ✅ Simple REST API

## Prerequisites

- Node.js 18+ installed
- Nylas API account and API key
- Nylas Grant ID (connected Google account)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Nylas credentials:
   ```
   NYLAS_API_KEY=your_nylas_api_key_here
   NYLAS_API_URL=https://api.nylas.com
   PORT=3000
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

## API Endpoints

### Add a Meeting
```http
POST /api/meetings
Content-Type: application/json

{
  "meetingUrl": "https://meet.google.com/abc-defg-hij",
  "grantId": "your_nylas_grant_id"
}
```

**Response:**
```json
{
  "success": true,
  "meeting": {
    "id": "meeting_1234567890_abc123",
    "meetingUrl": "https://meet.google.com/abc-defg-hij",
    "status": "joining",
    "progress": {
      "message": "Bot deployed. Joining meeting...",
      "percentage": 20
    },
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}
```

### Get Meeting Status
```http
GET /api/meetings/:meetingId
```

**Response:**
```json
{
  "success": true,
  "meeting": {
    "id": "meeting_1234567890_abc123",
    "meetingUrl": "https://meet.google.com/abc-defg-hij",
    "status": "recording",
    "progress": {
      "message": "Recording meeting...",
      "percentage": 70
    },
    "createdAt": "2024-01-01T12:00:00.000Z",
    "updatedAt": "2024-01-01T12:05:00.000Z"
  }
}
```

### Get All Meetings
```http
GET /api/meetings
```

### Get Meeting Note
```http
GET /api/meetings/:meetingId/note
```

**Response:**
```json
{
  "success": true,
  "note": {
    "summary": "Meeting discussion about...",
    "keyPoints": [
      "Key point 1",
      "Key point 2"
    ],
    "participants": ["Speaker 1", "Speaker 2"],
    "duration": 1800,
    "wordCount": 500,
    "generatedAt": "2024-01-01T12:30:00.000Z"
  }
}
```

### Webhook Endpoint (for Nylas)
```http
POST /api/webhooks/nylas
```

This endpoint receives updates from Nylas about bot status changes.

## Meeting Status Flow

1. **pending** - Meeting link added, waiting to deploy bot
2. **joining** - Bot deployed, attempting to join meeting
3. **recording** - Bot joined and recording
4. **processing** - Meeting ended, processing transcript
5. **completed** - Note generated successfully
6. **failed** - Error occurred

## Getting a Nylas Grant ID

To get a Grant ID, you need to:

1. Set up OAuth with Nylas to connect a Google account
2. The Grant ID is returned after successful OAuth connection

For MVP testing, you can use Nylas's OAuth flow or their API to create grants.

## Project Structure

```
meeting-note-taker/
├── src/
│   ├── config.js              # Configuration
│   ├── server.js              # Express server
│   ├── controllers/           # Request handlers
│   │   └── meetingController.js
│   ├── services/              # Business logic
│   │   ├── nylasService.js    # Nylas API integration
│   │   ├── meetingService.js  # Meeting state management
│   │   └── noteGenerator.js   # Note generation
│   └── routes/                # API routes
│       ├── meetingRoutes.js
│       └── webhookRoutes.js
├── .env.example
├── package.json
└── README.md
```

## Notes

- Currently uses in-memory storage (meetings are lost on server restart)
- For production, replace with a database (PostgreSQL, MongoDB, etc.)
- Webhook secret validation should be added for security
- Error handling can be improved
- Add authentication/authorization for production use

## Next Steps

- [ ] Add database persistence
- [ ] Implement OAuth flow for Grant ID
- [ ] Add webhook signature verification
- [ ] Improve note generation with AI
- [ ] Add calendar integration
- [ ] Support for Zoom and other platforms

# meeting-note-taker-api
