# Testing Guidelines

## Framework & Setup

| Tool | Purpose |
|------|---------|
| Vitest 4.x | Test runner with globals enabled |
| Testing Library | React component testing |
| jsdom | Browser environment simulation |

```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode
npm test -- --coverage # Generate coverage report
```

## Test File Organization

Tests live in `__tests__` folders alongside source code:

```
src/
├── main/
│   └── agents/adapters/__tests__/
│       └── model-alias.test.ts
├── renderer/src/
│   ├── components/ui/__tests__/
│   │   └── markdown-renderer.test.tsx
│   └── stores/__tests__/
│       └── note-store.test.ts
```

**Naming convention:** `{ComponentName}.test.tsx` or `{module-name}.test.ts`

## Mocking Patterns

### Electron IPC (window.api)
```typescript
const mockApi = {
  updateNote: vi.fn(),
  listNotes: vi.fn().mockResolvedValue([])
}

// @ts-expect-error - mocking window.api
global.window = { api: mockApi }
```

### Module Mocking
```typescript
vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: vi.fn(() => ({
    status: 'idle',
    isListening: false
  }))
}))
```

### Electron Native APIs
```typescript
vi.mock('electron', () => ({
  Notification: class {
    static isSupported = vi.fn().mockReturnValue(true)
    show = vi.fn()
  }
}))
```

## Test Categories

| Type | Location | Pattern |
|------|----------|---------|
| Unit | `src/main/**/__tests__/` | Pure function/class tests |
| Component | `src/renderer/**/__tests__/` | React Testing Library |
| Store | `stores/__tests__/` | Zustand state + optimistic updates |
| Integration | `storage/sqlite/__tests__/` | In-memory SQLite (`:memory:`) |

## Common Patterns

### Setup/Teardown
```typescript
beforeEach(() => {
  vi.clearAllMocks()
  useNoteStore.setState({ notes: [] })
})
```

### Async Component Testing
```typescript
await waitFor(() => {
  expect(screen.getByTestId('result')).toBeInTheDocument()
})
```

### Optimistic Update Testing
```typescript
// Create hanging promise to test intermediate state
let resolve: (value: Note) => void
mockApi.updateNote.mockReturnValue(new Promise(r => { resolve = r }))

// Trigger action
await act(() => store.getState().updateNote(note))

// Assert optimistic state BEFORE API resolves
expect(store.getState().notes[0].title).toBe('New Title')

// Resolve and verify final state
resolve!(serverNote)
```

### Database Integration Tests
```typescript
beforeEach(async () => {
  await initializeDatabase(':memory:')
})

afterEach(async () => {
  await closeDatabase()
})
```

## Best Practices

- Use `screen` queries over destructured render results
- Prefer `data-testid` for elements without accessible roles
- Test user interactions, not implementation details
- Mock child components that have complex dependencies
- Use `it.skip()` for tests blocked by jsdom limitations
- Clear mocks in `beforeEach` for test isolation
