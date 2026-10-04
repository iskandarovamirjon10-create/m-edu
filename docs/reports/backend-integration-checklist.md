# M-EDU AI Copilot — Backend Integration Checklist

The visual refactor and wiring layer are complete. The frontend now perfectly matches the provided reference (Premium Redesign) relying entirely on data from API endpoints rather than fake mock strings.

To complete the end-to-end functionality, the backend team needs to implement the following endpoints to feed the Copilot:

### 1. Global AI Health
**Endpoint:** `GET /api/ai/health`
**Purpose:** Drives the "M-EDU Data" / "Offline" connection indicator chip in the chat header and the rail footer.
**Response Body:**
```json
{
  "status": "ok",
  "version": "1.2.0"
}
```

### 2. Available Models
**Endpoint:** `GET /api/ai/models`
**Purpose:** Populates the model selector in the chat composer (e.g. GPT-4, Claude 3.5 Sonnet, etc).
**Response Body:**
```json
[
  { "id": "gpt-4o", "name": "GPT-4o", "provider": "openai" },
  { "id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "provider": "google" }
]
```

### 3. Conversations (Rail)
**Endpoint:** `GET /api/ai/conversations?limit=50`
**Purpose:** Fetches the user's past AI conversation sessions grouped by date (Today, Yesterday, Last 7 Days, Older) to display in the side Rail.
**Response Body:**
```json
[
  {
    "id": "conv-8321",
    "title": "Attendance Report Analysis",
    "preview": "Looking at the Q3 trends...",
    "updatedAt": "2024-05-18T14:32:00Z",
    "messageCount": 8
  }
]
```

**Endpoint:** `POST /api/ai/conversations`
**Purpose:** Creates a new empty conversation when clicking the `+` button in the UI.
**Response Body:**
```json
{
  "id": "conv-9452",
  "title": "New Conversation",
  "updatedAt": "2024-05-18T15:00:00Z"
}
```

**Endpoint:** `DELETE /api/ai/conversations/:id`
**Purpose:** Deletes a specific conversation history from the Rail.

### 4. Conversation Messages
**Endpoint:** `GET /api/ai/conversations/:id/messages`
**Purpose:** Re-hydrates a saved conversation when the user clicks an item in the Rail.
**Response Body:**
```json
[
  {
    "id": "msg-1",
    "role": "user",
    "content": "Show me today's attendance metrics.",
    "createdAt": "2024-05-18T14:32:00Z"
  },
  {
    "id": "msg-2",
    "role": "assistant",
    "content": "Overall attendance is at 94.2% today.",
    "createdAt": "2024-05-18T14:32:05Z",
    "sources": ["Attendance Records (May 18)"]
  }
]
```

### 5. Context Panel: Insights
**Endpoint:** `GET /api/ai/insights?scope=<route>`
**Purpose:** Populates the "Insights" section of the right context panel dynamically based on the current page (`scope`). E.g., `scope=attendance`.
**Response Body:**
```json
[
  {
    "id": "ins-1",
    "type": "success",
    "title": "Attendance Increased",
    "body": "Grade 10 attendance improved compared to last week.",
    "metric": "+2.1%",
    "trend": "up"
  }
]
```

### 6. Context Panel: Suggestions
**Endpoint:** `GET /api/ai/suggestions?context=<route>`
**Purpose:** Recommends relevant follow-up prompts to the user in the context panel based on the current active view.
**Response Body:**
```json
[
  "Summarize this week's attendance by grade.",
  "Which students have missed more than 3 days this month?"
]
```

---

*Note: All data loading and error state UI (skeletons and empty states) are fully configured on the frontend to smoothly handle network latencies while these endpoints are fetched.*
