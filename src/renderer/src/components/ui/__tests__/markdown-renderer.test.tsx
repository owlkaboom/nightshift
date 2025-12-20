import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownRenderer } from '@/components/ui/markdown-renderer'

describe('MarkdownRenderer', () => {
  it('renders plain text without HTML tags', () => {
    const { container } = render(
      <MarkdownRenderer content="Simple plain text" />
    )
    expect(container.textContent).toBe('Simple plain text')
  })

  it('renders HTML content from TipTap correctly', () => {
    const htmlContent = '<p>This is a paragraph</p>'
    const { container } = render(
      <MarkdownRenderer content={htmlContent} />
    )
    // Should render the paragraph without showing the <p> tags as text
    expect(container.textContent).toBe('This is a paragraph')
    expect(container.querySelector('p')).toBeInTheDocument()
  })

  it('renders HTML with bold text', () => {
    const htmlContent = '<p>This is <strong>bold</strong> text</p>'
    const { container } = render(
      <MarkdownRenderer content={htmlContent} />
    )
    expect(container.textContent).toBe('This is bold text')
    expect(container.querySelector('strong')).toBeInTheDocument()
  })

  it('renders markdown content', () => {
    const markdownContent = '## This is a heading\n\nThis is a paragraph'
    const { container } = render(
      <MarkdownRenderer content={markdownContent} />
    )
    expect(container.querySelector('h2')).toBeInTheDocument()
    expect(container.textContent).toContain('This is a heading')
  })

  it('applies line clamp correctly for HTML', () => {
    const htmlContent = '<p>Line 1</p><p>Line 2</p><p>Line 3</p>'
    const { container } = render(
      <MarkdownRenderer content={htmlContent} lineClamp={2} />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.webkitLineClamp).toBe('2')
    expect(wrapper.style.display).toBe('-webkit-box')
  })

  it('applies line clamp correctly for plain text', () => {
    const plainText = 'Line 1\nLine 2\nLine 3'
    const { container } = render(
      <MarkdownRenderer content={plainText} lineClamp={2} />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.webkitLineClamp).toBe('2')
  })

  it('handles empty content gracefully', () => {
    const { container } = render(
      <MarkdownRenderer content="" />
    )
    expect(container.textContent).toBe('')
  })
})
