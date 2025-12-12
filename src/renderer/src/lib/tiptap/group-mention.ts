/**
 * Tiptap extension for #group mentions
 */

import Mention from '@tiptap/extension-mention'
import { ReactRenderer } from '@tiptap/react'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import { MentionSuggestion } from '@/components/notes/MentionSuggestion'
import {
  createFloatingSuggestion,
  type FloatingSuggestionInstance
} from './floating-suggestion'

export interface GroupItem {
  id: string
  name: string
  color?: string
}

export interface GroupMentionOptions {
  getGroups: () => Promise<GroupItem[]>
}

export const GroupMention = Mention.extend({
  name: 'groupMention'
}).configure({
  HTMLAttributes: {
    class: 'mention mention-group'
  },
  suggestion: {
    char: '#',
    allowSpaces: true,
    allowedPrefixes: null
  } as Partial<SuggestionOptions>
})

/**
 * Create group mention suggestion configuration
 */
export function createGroupMentionSuggestion(
  getGroups: () => Promise<GroupItem[]>
): Partial<SuggestionOptions> {
  return {
    char: '#',
    allowSpaces: true,
    // Only trigger after a word character or space to avoid conflict with heading shortcuts
    // This allows "# " at start of line to become a heading, while "text #" triggers mention
    allowedPrefixes: [' ', '\u00A0'],

    items: async ({ query }: { query: string }) => {
      const groups = await getGroups()
      return groups
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
              type: 'group'
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
            type: 'group'
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
