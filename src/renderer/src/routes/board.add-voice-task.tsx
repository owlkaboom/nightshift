import { createFileRoute } from '@tanstack/react-router'
import { BoardView } from '@/views'

export const Route = createFileRoute('/board/add-voice-task')({
  component: BoardView
})
