/**
 * Tiptap editor configuration and extensions
 */

import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import Mention from '@tiptap/extension-mention'
import { Markdown } from '@tiptap/markdown'
import type { SuggestionOptions } from '@tiptap/suggestion'
import type { Extensions } from '@tiptap/react'

export interface MentionItem {
  id: string
  name: string
  color?: string
}

export interface TiptapConfig {
  placeholder?: string
  projectSuggestion?: Partial<SuggestionOptions>
  groupSuggestion?: Partial<SuggestionOptions>
  tagSuggestion?: Partial<SuggestionOptions>
}

/**
 * Create configured Tiptap extensions
 */
export function createExtensions(config: TiptapConfig = {}): Extensions {
  const extensions: Extensions = [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3]
      },
      bulletList: {
        keepMarks: true,
        keepAttributes: false
      },
      orderedList: {
        keepMarks: true,
        keepAttributes: false
      },
      // Disable the default Link extension from StarterKit so we can configure it separately
      link: false
    }),

    // Enable native markdown support
    Markdown.configure({
      markedOptions: {
        gfm: true, // GitHub Flavored Markdown
        breaks: false // Don't treat single line breaks as <br>
      }
    }),

    Placeholder.configure({
      placeholder: config.placeholder ?? 'Start typing your note...'
    }),

    // Configure Link extension with custom settings
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      HTMLAttributes: {
        class: 'text-primary underline cursor-pointer'
      }
    }),

    TaskList.configure({
      HTMLAttributes: {
        class: 'not-prose pl-0'
      }
    }),

    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: 'flex items-start gap-2'
      }
    }),

    Highlight.configure({
      multicolor: false,
      HTMLAttributes: {
        class: 'bg-yellow-200 dark:bg-yellow-800'
      }
    }),

    Typography
  ]

  // Add project mention extension
  if (config.projectSuggestion) {
    extensions.push(
      Mention.extend({
        name: 'projectMention'
      }).configure({
        HTMLAttributes: {
          class: 'mention mention-project bg-primary/10 text-primary px-1 rounded'
        },
        suggestion: config.projectSuggestion
      })
    )
  }

  // Add group mention extension (legacy, for backward compatibility)
  if (config.groupSuggestion) {
    extensions.push(
      Mention.extend({
        name: 'groupMention'
      }).configure({
        HTMLAttributes: {
          class: 'mention mention-group bg-secondary/30 text-secondary-foreground px-1 rounded'
        },
        suggestion: config.groupSuggestion
      })
    )
  }

  // Add tag mention extension
  if (config.tagSuggestion) {
    extensions.push(
      Mention.extend({
        name: 'tagMention'
      }).configure({
        HTMLAttributes: {
          class: 'mention mention-tag bg-secondary/30 text-secondary-foreground px-1 rounded'
        },
        suggestion: config.tagSuggestion
      })
    )
  }

  return extensions
}

export { createProjectMentionSuggestion } from './project-mention'
export type { ProjectItem, ProjectMentionOptions } from './project-mention'
export { createGroupMentionSuggestion } from './group-mention'
export type { GroupItem, GroupMentionOptions } from './group-mention'
export { createTagMentionSuggestion } from './tag-mention'
export type { TagItem, TagMentionOptions } from './tag-mention'
