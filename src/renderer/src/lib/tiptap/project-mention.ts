/**
 * Tiptap extension for @project mentions
 */

import Mention from '@tiptap/extension-mention'
import { ReactRenderer } from '@tiptap/react'
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import { MentionSuggestion } from '@/components/notes/MentionSuggestion'
import {
  createFloatingSuggestion,
  type FloatingSuggestionInstance
} from './floating-suggestion'

export interface ProjectItem {
  id: string
  name: string
}

export interface ProjectMentionOptions {
  getProjects: () => Promise<ProjectItem[]>
}

export const ProjectMention = Mention.extend({
  name: 'projectMention'
}).configure({
  HTMLAttributes: {
    class: 'mention mention-project'
  },
  suggestion: {
    char: '@',
    allowSpaces: true,
    allowedPrefixes: null
  } as Partial<SuggestionOptions>
})

/**
 * Create project mention suggestion configuration
 */
export function createProjectMentionSuggestion(
  getProjects: () => Promise<ProjectItem[]>
): Partial<SuggestionOptions> {
  return {
    char: '@',
    allowSpaces: true,

    items: async ({ query }: { query: string }) => {
      const projects = await getProjects()
      return projects
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
              type: 'project'
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
            type: 'project'
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
