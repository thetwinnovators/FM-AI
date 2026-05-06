import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SuggestedPrompts from '../SuggestedPrompts.jsx'

const defaultProps = {
  questions: ['Tell me more', 'What are the key points?', 'How does this connect?'],
  actions: ['save-as-note'],
  onSend: vi.fn(),
  onAction: vi.fn(),
}

describe('SuggestedPrompts', () => {
  it('renders all question chips', () => {
    render(<SuggestedPrompts {...defaultProps} />)
    expect(screen.getByText('Tell me more')).toBeTruthy()
    expect(screen.getByText('What are the key points?')).toBeTruthy()
    expect(screen.getByText('How does this connect?')).toBeTruthy()
  })

  it('renders action chip with display label', () => {
    render(<SuggestedPrompts {...defaultProps} />)
    expect(screen.getByText('Save as note')).toBeTruthy()
  })

  it('calls onSend with question text when question chip is clicked', () => {
    const onSend = vi.fn()
    render(<SuggestedPrompts {...defaultProps} onSend={onSend} />)
    fireEvent.click(screen.getByText('Tell me more'))
    expect(onSend).toHaveBeenCalledWith('Tell me more')
  })

  it('calls onAction with action key when action chip is clicked', () => {
    const onAction = vi.fn()
    render(<SuggestedPrompts {...defaultProps} onAction={onAction} />)
    fireEvent.click(screen.getByText('Save as note'))
    expect(onAction).toHaveBeenCalledWith('save-as-note')
  })

  it('renders nothing when questions array is empty', () => {
    const { container } = render(
      <SuggestedPrompts {...defaultProps} questions={[]} actions={[]} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders generate-summary action with correct label', () => {
    render(<SuggestedPrompts {...defaultProps} actions={['generate-summary']} />)
    expect(screen.getByText('Generate summary')).toBeTruthy()
  })

  it('renders generate-content-ideas action with correct label', () => {
    render(<SuggestedPrompts {...defaultProps} actions={['generate-content-ideas']} />)
    expect(screen.getByText('Content ideas')).toBeTruthy()
  })
})
