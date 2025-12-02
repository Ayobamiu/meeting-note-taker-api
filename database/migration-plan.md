# Migration Plan: In-Memory to Supabase

## Current State

- In-memory storage using JavaScript `Map`
- Data lost on server restart
- No persistence

## Target State

- Supabase PostgreSQL database
- Persistent storage
- Data survives server restarts

## Migration Steps

### Phase 1: Setup

1. ✅ Create Supabase project
2. ✅ Run schema.sql to create tables
3. ✅ Install Supabase client library
4. ✅ Add environment variables

### Phase 2: Database Service Layer

1. Create `databaseService.js` with Supabase client
2. Implement CRUD operations:
   - `createMeeting()`
   - `getMeeting(id)`
   - `getAllMeetings()`
   - `updateMeeting(id, updates)`
   - `updateProgress(id, message, percentage)`

### Phase 3: Update MeetingService

1. Replace in-memory Map with database calls
2. Keep same interface (no changes to controllers)
3. Handle async operations properly

### Phase 4: Testing

1. Test all CRUD operations
2. Test webhook updates
3. Test concurrent updates
4. Verify data persistence

### Phase 5: Deployment

1. Update production environment variables
2. Run migration
3. Monitor for issues

## Implementation Strategy

### Option A: Direct Replacement (Recommended)

- Replace `meetingService.js` implementation
- Keep same public API
- Controllers don't need changes

### Option B: Adapter Pattern

- Create database adapter
- MeetingService uses adapter
- Easier to switch back if needed

## Considerations

### JSONB Storage

- Transcripts can be large (store as JSONB)
- Notes are smaller (store as JSONB)
- Progress is small (store as JSONB)

### Performance

- Indexes on frequently queried fields
- GIN indexes for JSONB search
- Consider pagination for `getAllMeetings()`

### Error Handling

- Handle database connection errors
- Handle query failures gracefully
- Log errors appropriately

### Data Migration

- No existing data to migrate (in-memory)
- Fresh start with database
