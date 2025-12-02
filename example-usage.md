# Example Usage

## Quick Start

1. **Start the server:**
   ```bash
   npm install
   npm start
   ```

2. **Add a meeting:**
   ```bash
   curl -X POST http://localhost:3000/api/meetings \
     -H "Content-Type: application/json" \
     -d '{
       "meetingUrl": "https://meet.google.com/abc-defg-hij",
       "grantId": "your_nylas_grant_id"
     }'
   ```

3. **Check meeting status:**
   ```bash
   curl http://localhost:3000/api/meetings/meeting_1234567890_abc123
   ```

4. **Get the generated note:**
   ```bash
   curl http://localhost:3000/api/meetings/meeting_1234567890_abc123/note
   ```

## JavaScript/Node.js Example

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function addMeeting(meetingUrl, grantId) {
  const response = await axios.post(`${API_BASE}/meetings`, {
    meetingUrl,
    grantId,
  });
  return response.data.meeting;
}

async function checkStatus(meetingId) {
  const response = await axios.get(`${API_BASE}/meetings/${meetingId}`);
  return response.data.meeting;
}

async function getNote(meetingId) {
  const response = await axios.get(`${API_BASE}/meetings/${meetingId}/note`);
  return response.data.note;
}

// Usage
(async () => {
  // Add a meeting
  const meeting = await addMeeting(
    'https://meet.google.com/abc-defg-hij',
    'your_grant_id'
  );
  console.log('Meeting added:', meeting.id);

  // Poll for status updates
  const interval = setInterval(async () => {
    const status = await checkStatus(meeting.id);
    console.log(`Status: ${status.status} - ${status.progress.message}`);
    
    if (status.status === 'completed') {
      clearInterval(interval);
      const note = await getNote(meeting.id);
      console.log('Note:', note);
    } else if (status.status === 'failed') {
      clearInterval(interval);
      console.error('Meeting failed');
    }
  }, 5000); // Check every 5 seconds
})();
```

## Python Example

```python
import requests
import time

API_BASE = "http://localhost:3000/api"

def add_meeting(meeting_url, grant_id):
    response = requests.post(
        f"{API_BASE}/meetings",
        json={"meetingUrl": meeting_url, "grantId": grant_id}
    )
    return response.json()["meeting"]

def check_status(meeting_id):
    response = requests.get(f"{API_BASE}/meetings/{meeting_id}")
    return response.json()["meeting"]

def get_note(meeting_id):
    response = requests.get(f"{API_BASE}/meetings/{meeting_id}/note")
    return response.json()["note"]

# Usage
meeting = add_meeting(
    "https://meet.google.com/abc-defg-hij",
    "your_grant_id"
)
print(f"Meeting added: {meeting['id']}")

# Poll for status
while True:
    status = check_status(meeting["id"])
    print(f"Status: {status['status']} - {status['progress']['message']}")
    
    if status["status"] == "completed":
        note = get_note(meeting["id"])
        print("Note:", note)
        break
    elif status["status"] == "failed":
        print("Meeting failed")
        break
    
    time.sleep(5)  # Check every 5 seconds
```

