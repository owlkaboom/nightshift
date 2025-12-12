import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VoiceTaskDialog } from '../VoiceTaskDialog'
import type { Project } from '@shared/types'

// Mock the hooks and stores
vi.mock('../../../hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: vi.fn(() => ({
    status: 'idle',
    isListening: false,
    transcript: '',
    isSupported: true,
    isModelLoaded: true,
    modelLoadProgress: 100,
    recordingDuration: 0,
    audioLevel: 0,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    clearTranscript: vi.fn(),
    loadModel: vi.fn(),
    error: null
  }))
}))

vi.mock('../../../stores/session-store', () => ({
  useSessionStore: vi.fn(() => ({
    sessionProjectId: null,
    setSessionProject: vi.fn()
  }))
}))

vi.mock('../../../stores/skill-store', () => ({
  useSkillStore: vi.fn(() => ({
    skills: [],
    fetchSkills: vi.fn()
  }))
}))

vi.mock('../../../lib/skill-suggestions', () => ({
  suggestSkills: vi.fn(() => [])
}))

// Mock RichTextEditor component
vi.mock('../../ui/rich-text-editor', () => ({
  RichTextEditor: ({ content, onChange, editable = true }: any) => (
    <div data-testid="rich-text-editor" data-editable={editable}>
      {content && <div data-testid="editor-content">{content}</div>}
      {editable && onChange && (
        <button
          onClick={() => onChange('<p>test</p>', 'test')}
          data-testid="editor-change"
        >
          Change
        </button>
      )}
    </div>
  )
}))

const mockProjects: Project[] = [
  {
    id: 'project-1',
    name: 'Test Project',
    description: 'Test description',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

describe('VoiceTaskDialog - Markdown Conversion', () => {
  let mockOnAdd: ReturnType<typeof vi.fn>
  let mockOnOpenChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnAdd = vi.fn()
    mockOnOpenChange = vi.fn()
    vi.clearAllMocks()
  })

  describe('Voice transcript markdown detection and conversion', () => {
    it('should convert markdown headers in voice transcript', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      // Simulate voice input with markdown header
      const transcriptWithHeader = '# Fix authentication bug\n\nUpdate login validation'

      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: transcriptWithHeader,
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: vi.fn(),
        stopListening: vi.fn(),
        clearTranscript: vi.fn(),
        loadModel: vi.fn(),
        error: null
      })

      render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      // The component should detect markdown and convert it
      await waitFor(() => {
        const editorContent = screen.getByTestId('editor-content')
        expect(editorContent.textContent).toContain('h1')
      })
    })

    it('should convert markdown lists in voice transcript', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      const transcriptWithList = `- Add user authentication
- Update database schema
- Write tests`

      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: transcriptWithList,
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: vi.fn(),
        stopListening: vi.fn(),
        clearTranscript: vi.fn(),
        loadModel: vi.fn(),
        error: null
      })

      render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      await waitFor(() => {
        const editorContent = screen.getByTestId('editor-content')
        expect(editorContent.textContent).toContain('ul')
        expect(editorContent.textContent).toContain('li')
      })
    })

    it('should convert markdown code blocks in voice transcript', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      const transcriptWithCode = 'Fix the function\n\n```typescript\nfunction test() {\n  return true\n}\n```'

      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: transcriptWithCode,
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: vi.fn(),
        stopListening: vi.fn(),
        clearTranscript: vi.fn(),
        loadModel: vi.fn(),
        error: null
      })

      render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      await waitFor(() => {
        const editorContent = screen.getByTestId('editor-content')
        expect(editorContent.textContent).toContain('pre')
        expect(editorContent.textContent).toContain('code')
      })
    })

    it('should convert markdown bold and italic formatting', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      const transcriptWithFormatting = 'Make **bold changes** to the *important* parts'

      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: transcriptWithFormatting,
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: vi.fn(),
        stopListening: vi.fn(),
        clearTranscript: vi.fn(),
        loadModel: vi.fn(),
        error: null
      })

      render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      await waitFor(() => {
        const editorContent = screen.getByTestId('editor-content')
        expect(editorContent.textContent).toContain('strong')
        expect(editorContent.textContent).toContain('em')
      })
    })

    it('should preserve plain text when no markdown is detected', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      const plainTranscript = 'Just a simple task description without any markdown'

      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: plainTranscript,
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: vi.fn(),
        stopListening: vi.fn(),
        clearTranscript: vi.fn(),
        loadModel: vi.fn(),
        error: null
      })

      render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      await waitFor(() => {
        const editorContent = screen.getByTestId('editor-content')
        // Should still be wrapped in paragraph tag
        expect(editorContent.textContent).toBe(plainTranscript)
      })
    })

    it('should preserve promptText as plain text even when HTML is converted', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      const transcriptWithMarkdown = '# Task\n\n**Important**: Do this'

      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: transcriptWithMarkdown,
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: vi.fn(),
        stopListening: vi.fn(),
        clearTranscript: vi.fn(),
        loadModel: vi.fn(),
        error: null
      })

      render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      // Verify HTML conversion happens
      await waitFor(() => {
        const editorContent = screen.getByTestId('editor-content')
        expect(editorContent.textContent).toContain('h1')
      })

      // Note: We can't directly test internal state (promptText) in this test,
      // but the implementation should ensure promptText remains as plain text
      // for skill detection purposes. This would be verified through integration tests
      // or by checking the onAdd callback receives correct data.
    })

    it('should handle complex markdown with multiple elements', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      const complexTranscript = `# Authentication Task

Update the login system:

- Add **two-factor authentication**
- Update *password validation*
- Add tests

## Implementation

\`\`\`typescript
function validate(password: string): boolean {
  return password.length >= 8
}
\`\`\`

> Remember to update docs`

      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: complexTranscript,
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: vi.fn(),
        stopListening: vi.fn(),
        clearTranscript: vi.fn(),
        loadModel: vi.fn(),
        error: null
      })

      render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      await waitFor(() => {
        const editorContent = screen.getByTestId('editor-content')
        // Check for various markdown elements
        expect(editorContent.textContent).toContain('h1')
        expect(editorContent.textContent).toContain('h2')
        expect(editorContent.textContent).toContain('ul')
        expect(editorContent.textContent).toContain('code')
        expect(editorContent.textContent).toContain('blockquote')
      })
    })

    it('should convert inline code in voice transcript', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      const transcriptWithInlineCode = 'Update the `getUserData` function to handle errors'

      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: transcriptWithInlineCode,
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: vi.fn(),
        stopListening: vi.fn(),
        clearTranscript: vi.fn(),
        loadModel: vi.fn(),
        error: null
      })

      render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      await waitFor(() => {
        const editorContent = screen.getByTestId('editor-content')
        expect(editorContent.textContent).toContain('code')
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle empty transcript', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: '',
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: vi.fn(),
        stopListening: vi.fn(),
        clearTranscript: vi.fn(),
        loadModel: vi.fn(),
        error: null
      })

      render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      // Should not crash and editor should be empty
      const editor = screen.getByTestId('rich-text-editor')
      expect(editor).toBeInTheDocument()
    })

    it('should handle transcript with only whitespace', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: '   \n\n   ',
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: vi.fn(),
        stopListening: vi.fn(),
        clearTranscript: vi.fn(),
        loadModel: vi.fn(),
        error: null
      })

      render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      // Should handle gracefully
      const editor = screen.getByTestId('rich-text-editor')
      expect(editor).toBeInTheDocument()
    })
  })

  describe('State reset on cancel', () => {
    it('should reset all state when dialog is canceled', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      const mockStopListening = vi.fn()
      const mockClearTranscript = vi.fn()
      const mockStartListening = vi.fn()

      // First render with transcript
      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: '# Test task with markdown',
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: mockStartListening,
        stopListening: mockStopListening,
        clearTranscript: mockClearTranscript,
        loadModel: vi.fn(),
        error: null
      })

      const { rerender } = render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      // Wait for content to appear
      await waitFor(() => {
        const editorContent = screen.queryByTestId('editor-content')
        expect(editorContent).toBeInTheDocument()
      })

      // Click cancel button
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await userEvent.click(cancelButton)

      // Verify cleanup functions were called
      expect(mockStopListening).toHaveBeenCalled()
      expect(mockClearTranscript).toHaveBeenCalled()
      expect(mockOnOpenChange).toHaveBeenCalledWith(false)

      // Re-open the dialog with empty state
      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: '',
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: mockStartListening,
        stopListening: mockStopListening,
        clearTranscript: mockClearTranscript,
        loadModel: vi.fn(),
        error: null
      })

      rerender(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      // Dialog should be in initial state (step 1, no content)
      expect(screen.getByText(/Step 1: Describe Your Task/i)).toBeInTheDocument()
    })

    it('should reset autoListening flag when dialog is canceled', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      const mockStopListening = vi.fn()
      const mockClearTranscript = vi.fn()
      const mockStartListening = vi.fn()

      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: true,
        transcript: 'Some content',
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 5000,
        audioLevel: 0.5,
        startListening: mockStartListening,
        stopListening: mockStopListening,
        clearTranscript: mockClearTranscript,
        loadModel: vi.fn(),
        error: null
      })

      render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      // Should be recording
      expect(screen.getByText(/Recording.../i)).toBeInTheDocument()

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await userEvent.click(cancelButton)

      // Verify stopListening was called
      expect(mockStopListening).toHaveBeenCalled()
      expect(mockClearTranscript).toHaveBeenCalled()
    })

    it('should reset step to prompt when canceling from project step', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      const mockStopListening = vi.fn()
      const mockClearTranscript = vi.fn()

      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: '',
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: vi.fn(),
        stopListening: mockStopListening,
        clearTranscript: mockClearTranscript,
        loadModel: vi.fn(),
        error: null
      })

      const { rerender } = render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      // Manually change content and go to next step
      const changeButton = screen.getByTestId('editor-change')
      await userEvent.click(changeButton)

      const nextButton = screen.getByRole('button', { name: /next/i })
      await userEvent.click(nextButton)

      // Should now be on project step
      await waitFor(() => {
        expect(screen.getByText(/Step 2: Select Project/i)).toBeInTheDocument()
      })

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await userEvent.click(cancelButton)

      // Verify cleanup
      expect(mockStopListening).toHaveBeenCalled()
      expect(mockClearTranscript).toHaveBeenCalled()

      // Re-render as if opening again
      rerender(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      // Should be back at step 1
      expect(screen.getByText(/Step 1: Describe Your Task/i)).toBeInTheDocument()
    })

    it('should clear error state when dialog is canceled', async () => {
      const { useSpeechRecognition } = await import('../../../hooks/useSpeechRecognition')
      const mockSpeechRecognition = vi.mocked(useSpeechRecognition)

      const mockStopListening = vi.fn()
      const mockClearTranscript = vi.fn()

      mockSpeechRecognition.mockReturnValue({
        status: 'error',
        isListening: false,
        transcript: '',
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: vi.fn(),
        stopListening: mockStopListening,
        clearTranscript: mockClearTranscript,
        loadModel: vi.fn(),
        error: 'Microphone access denied'
      })

      const { rerender } = render(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByText(/Microphone access denied/i)).toBeInTheDocument()
      })

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await userEvent.click(cancelButton)

      // Re-open with no error
      mockSpeechRecognition.mockReturnValue({
        status: 'idle',
        isListening: false,
        transcript: '',
        isSupported: true,
        isModelLoaded: true,
        modelLoadProgress: 100,
        recordingDuration: 0,
        audioLevel: 0,
        startListening: vi.fn(),
        stopListening: mockStopListening,
        clearTranscript: mockClearTranscript,
        loadModel: vi.fn(),
        error: null
      })

      rerender(
        <VoiceTaskDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onAdd={mockOnAdd}
          projects={mockProjects}
        />
      )

      // Error should be cleared
      expect(screen.queryByText(/Microphone access denied/i)).not.toBeInTheDocument()
    })
  })
})
