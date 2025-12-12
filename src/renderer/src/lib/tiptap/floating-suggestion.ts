/**
 * Lightweight floating element utility for Tiptap suggestions
 * Replaces tippy.js for programmatic popover positioning
 */

export interface FloatingSuggestionInstance {
  element: HTMLDivElement
  setReferenceRect: (getReferenceClientRect: () => DOMRect) => void
  hide: () => void
  destroy: () => void
}

export interface FloatingSuggestionOptions {
  getReferenceClientRect: () => DOMRect
  content: HTMLElement
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
}

/**
 * Creates a floating element positioned relative to a reference rect.
 * Used for Tiptap suggestion menus (mentions, etc.)
 */
export function createFloatingSuggestion(
  options: FloatingSuggestionOptions
): FloatingSuggestionInstance {
  const { getReferenceClientRect, content, placement = 'bottom-start' } = options

  // Create wrapper element
  const wrapper = document.createElement('div')
  wrapper.style.position = 'fixed'
  wrapper.style.zIndex = '9999'
  wrapper.style.pointerEvents = 'auto'
  wrapper.appendChild(content)

  // Position the element
  const updatePosition = (getRect: () => DOMRect): void => {
    const rect = getRect()
    const isTop = placement.startsWith('top')
    const isEnd = placement.endsWith('end')

    wrapper.style.left = isEnd ? 'auto' : `${rect.left}px`
    wrapper.style.right = isEnd ? `${window.innerWidth - rect.right}px` : 'auto'

    if (isTop) {
      wrapper.style.bottom = `${window.innerHeight - rect.top}px`
      wrapper.style.top = 'auto'
    } else {
      wrapper.style.top = `${rect.bottom}px`
      wrapper.style.bottom = 'auto'
    }
  }

  updatePosition(getReferenceClientRect)
  document.body.appendChild(wrapper)

  return {
    element: wrapper,

    setReferenceRect(getRect: () => DOMRect): void {
      updatePosition(getRect)
    },

    hide(): void {
      wrapper.style.display = 'none'
    },

    destroy(): void {
      wrapper.remove()
    }
  }
}
