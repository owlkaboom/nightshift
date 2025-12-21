/**
 * Note types for Nightshift
 *
 * Notes serve as an idea capture system that can reference
 * projects/tags via inline mentions (@project, #tag)
 * and integrate with task planning workflows.
 */

/**
 * Status of a note
 */
export type NoteStatus = 'draft' | 'active' | 'archived' | 'converted'

/**
 * Available Lucide icon names for notes
 * A curated subset focused on note-taking, ideas, and documentation
 */
export const NOTE_ICONS = [
  // Note-taking & Writing
  'StickyNote',
  'FileText',
  'Notebook',
  'NotebookPen',
  'NotebookTabs',
  'NotebookText',
  'Scroll',
  'ScrollText',
  'Pen',
  'PenLine',
  'PenTool',
  'Pencil',
  'PencilLine',
  'FilePen',
  'FilePenLine',
  'Edit',
  'Edit2',
  'Edit3',
  'FileEdit',

  // Ideas & Creativity
  'Lightbulb',
  'LightbulbOff',
  'Sparkles',
  'Sparkle',
  'Wand',
  'Wand2',
  'WandSparkles',
  'Zap',
  'Flame',
  'Star',
  'Stars',

  // Lists & Tasks
  'ListTodo',
  'ListChecks',
  'List',
  'ListOrdered',
  'CheckSquare',
  'CheckCircle',
  'CircleCheck',
  'SquareCheck',

  // Books & Documentation
  'Book',
  'BookOpen',
  'BookOpenText',
  'BookMarked',
  'BookText',
  'BookType',
  'Books',
  'Library',
  'LibraryBig',

  // Organization
  'Folder',
  'FolderOpen',
  'Tag',
  'Tags',
  'Bookmark',
  'BookmarkPlus',
  'Pin',
  'Flag',
  'Hash',

  // Communication & Messages
  'MessageSquare',
  'MessageSquareText',
  'MessageSquarePlus',
  'MessageCircle',
  'MessagesSquare',
  'Mail',
  'MailOpen',

  // Files
  'File',
  'FilePlus',
  'FileStack',
  'Files',
  'FileType',
  'FileCode',
  'FileJson',

  // Symbols & Markers
  'Circle',
  'CircleDot',
  'Square',
  'SquareDot',
  'Triangle',
  'Diamond',
  'Heart',
  'Star',
  'Gem',

  // Arrows & Direction
  'ArrowRight',
  'ArrowUpRight',
  'CornerDownRight',
  'TrendingUp',

  // Time & Calendar
  'Clock',
  'Calendar',
  'CalendarDays',
  'AlarmClock',
  'Timer',

  // Other
  'Archive',
  'Inbox',
  'Clipboard',
  'ClipboardList',
  'Layers',
  'Component',
  'Info',
  'AlertCircle',
  'HelpCircle',
  'Brain',
  'Target',
  'Award',
  'Trophy',
  'Palette',
  'Image',
  'Camera',
  'Code',
  'Terminal',
  'Database',
  'Cloud',
  'Globe'
] as const

/**
 * A group for organizing notes (folder-like structure)
 */
export interface NoteGroup {
  /** Unique group identifier */
  id: string

  /** Group name */
  name: string

  /** Custom icon (Lucide icon name) */
  icon: string | null

  /** Custom color for the group */
  color: string | null

  /** Order in the groups list (lower numbers appear first) */
  order: number

  /** Whether the group is collapsed in the UI */
  isCollapsed: boolean

  /** When the group was created (ISO string) */
  createdAt: string

  /** When the group was last updated (ISO string) */
  updatedAt: string
}

/**
 * Data required to create a new note group
 */
export interface CreateNoteGroupData {
  /** Group name */
  name: string

  /** Optional icon */
  icon?: string | null

  /** Optional color */
  color?: string | null
}

/**
 * A single note in the system
 */
export interface Note {
  /** Unique note identifier (e.g., note_abc123) */
  id: string

  /** Note title (auto-derived from content or manual) */
  title: string

  /** Raw markdown content */
  content: string

  /** Cached HTML from Tiptap editor */
  htmlContent: string

  /** Plain text preview (~200 chars) */
  excerpt: string

  /** Note status */
  status: NoteStatus

  /** Project IDs referenced via @mentions */
  projectRefs: string[]

  /** Group IDs referenced via #mentions (legacy, for backward compatibility) */
  groupRefs: string[]

  /** Tag IDs referenced via #mentions */
  tagRefs: string[]

  /** User-defined tags */
  tags: string[]

  /** Primary project association (optional) */
  primaryProjectId: string | null

  /** Task IDs created from this note */
  linkedTaskIds: string[]

  /** Planning session IDs using this note as context */
  linkedPlanningIds: string[]

  /** Custom icon - either a Lucide icon name or a file path/URL to an image */
  icon: string | null

  /** When the note was created (ISO string) */
  createdAt: string

  /** When the note was last updated (ISO string) */
  updatedAt: string

  /** Whether the note is pinned */
  isPinned: boolean

  /** Word count of the note content */
  wordCount: number

  /** Group this note belongs to (optional) */
  groupId: string | null

  /** Order within the group or in the main list (lower numbers appear first) */
  order: number
}

/**
 * Data required to create a new note
 */
export interface CreateNoteData {
  /** Initial content (optional) */
  content?: string

  /** Title (optional - derived from content if not provided) */
  title?: string

  /** Primary project to associate with */
  primaryProjectId?: string | null

  /** Initial tags */
  tags?: string[]
}

/**
 * Generate a unique note ID
 */
export function generateNoteId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `note_${timestamp}${random}`
}

/**
 * Extract an excerpt from content
 * Returns first ~200 characters of plain text
 */
export function extractExcerpt(content: string, maxLength = 200): string {
  // Strip markdown syntax for plain text preview
  const plainText = content
    .replace(/#{1,6}\s+/g, '') // Headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
    .replace(/\*([^*]+)\*/g, '$1') // Italic
    .replace(/`([^`]+)`/g, '$1') // Inline code
    .replace(/```[\s\S]*?```/g, '') // Code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Images
    .replace(/^\s*[-*+]\s+/gm, '') // List items
    .replace(/^\s*\d+\.\s+/gm, '') // Numbered list items
    .replace(/^\s*>\s+/gm, '') // Blockquotes
    .replace(/\n+/g, ' ') // Newlines to spaces
    .trim()

  if (plainText.length <= maxLength) {
    return plainText
  }

  // Truncate at word boundary
  const truncated = plainText.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...'
}

/**
 * Extract a title from content
 * Uses the first line or first N characters
 */
export function extractTitleFromContent(content: string, maxLength = 50): string {
  const firstLine = content.split('\n')[0].trim()
  // Remove markdown header syntax
  const cleanLine = firstLine.replace(/^#{1,6}\s+/, '')

  if (cleanLine.length <= maxLength) {
    return cleanLine || 'Untitled Note'
  }
  return cleanLine.slice(0, maxLength - 3) + '...'
}

/**
 * Count words in content
 */
export function countWords(content: string): number {
  const words = content.trim().split(/\s+/)
  return words.filter((w) => w.length > 0).length
}

/**
 * Extract project mentions from content
 * Matches @project-name patterns
 */
export function extractProjectMentions(content: string): string[] {
  const pattern = /@([\w-]+)/g
  const matches: string[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(content)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1])
    }
  }

  return matches
}

/**
 * Extract group mentions from content (legacy)
 * Matches #group-name patterns
 */
export function extractGroupMentions(content: string): string[] {
  const pattern = /#([\w-]+)/g
  const matches: string[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(content)) !== null) {
    if (!matches.includes(match[1])) {
      matches.push(match[1])
    }
  }

  return matches
}

/**
 * Extract tag mentions from content
 * Matches #tag-name patterns
 */
export function extractTagMentions(content: string): string[] {
  // Same implementation as extractGroupMentions
  // We use the same pattern since tags also use # prefix
  return extractGroupMentions(content)
}

/**
 * Create a new note
 */
export function createNote(data: CreateNoteData = {}): Note {
  const now = new Date().toISOString()
  const content = data.content ?? ''
  const title = data.title ?? extractTitleFromContent(content)

  return {
    id: generateNoteId(),
    title,
    content,
    htmlContent: '',
    excerpt: extractExcerpt(content),
    status: 'draft',
    projectRefs: [],
    groupRefs: [],
    tagRefs: [],
    tags: data.tags ?? [],
    primaryProjectId: data.primaryProjectId ?? null,
    linkedTaskIds: [],
    linkedPlanningIds: [],
    icon: null,
    createdAt: now,
    updatedAt: now,
    isPinned: false,
    wordCount: countWords(content),
    groupId: null,
    order: 0
  }
}

/**
 * Generate a unique note group ID
 */
export function generateNoteGroupId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 7)
  return `notegroup_${timestamp}${random}`
}

/**
 * Create a new note group
 */
export function createNoteGroup(data: CreateNoteGroupData): NoteGroup {
  const now = new Date().toISOString()

  return {
    id: generateNoteGroupId(),
    name: data.name,
    icon: data.icon ?? 'Folder',
    color: data.color ?? null,
    order: 0,
    isCollapsed: false,
    createdAt: now,
    updatedAt: now
  }
}
