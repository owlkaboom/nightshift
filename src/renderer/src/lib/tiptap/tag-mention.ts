/**
 * Tiptap extension for #tag mentions
 */

import Mention from '@tiptap/extension-mention'
import { ReactRenderer } from '@tiptap/react'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import { MentionSuggestion } from '@/components/notes/MentionSuggestion'
import {
  createFloatingSuggestion,
  type FloatingSuggestionInstance
} from './floating-suggestion'

export interface TagItem {
  id: string
  name: string
  color?: string
}

export interface TagMentionOptions {
  getTags: () => Promise<TagItem[]>
}

export const TagMention = Mention.extend({
  name: 'tagMention'
}).configure({
  HTMLAttributes: {
    class: 'mention mention-tag'
  },
  suggestion: {
    char: '#',
    allowSpaces: true,
    allowedPrefixes: null
  } as Partial<SuggestionOptions>
})

/**
 * Create tag mention suggestion configuration
 */
export function createTagMentionSuggestion(
  getTags: () => Promise<TagItem[]>
): Partial<SuggestionOptions> {
  return {
    char: '#',
    allowSpaces: true,
    // Only trigger after a word character or space to avoid conflict with heading shortcuts
    // This allows "# " at start of line to become a heading, while "text #" triggers mention
    allowedPrefixes: [' ', '\u00A0'],

    items: async ({ query }: { query: string }) => {
      const tags = await getTags()
      return tags
        .filter((item) =>
          item.name.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5)
    },

    render: () => {
      let component: ReactRenderer | null = null
      let popup: FloatingSuggestionInstance | null = null

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(MentionSuggestion, {
            props: {
              ...props,
              type: 'tag'
            },
            editor: props.editor
          })

          if (!props.clientRect) {
            return
          }

          popup = createFloatingSuggestion({
            getReferenceClientRect: props.clientRect as () => DOMRect,
            content: component.element,
            placement: 'bottom-start'
          })
        },

        onUpdate(props: SuggestionProps) {
          component?.updateProps({
            ...props,
            type: 'tag'
          })

          if (!props.clientRect) {
            return
          }

          popup?.setReferenceRect(props.clientRect as () => DOMRect)
        },

        onKeyDown(props: { event: KeyboardEvent }) {
          if (props.event.key === 'Escape') {
            popup?.hide()
            return true
          }

          return (component?.ref as { onKeyDown?: (props: { event: KeyboardEvent }) => boolean })?.onKeyDown?.(props) ?? false
        },

        onExit() {
          popup?.destroy()
          component?.destroy()
        }
      }
    }
  }
}
