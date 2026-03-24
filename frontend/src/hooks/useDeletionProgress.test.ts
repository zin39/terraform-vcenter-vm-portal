import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeletionProgress } from './useDeletionProgress'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send = vi.fn()
  close = vi.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason }))
    }
  })

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    if (this.onopen) {
      this.onopen(new Event('open'))
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'))
    }
  }

  simulateClose(code: number = 1000, reason: string = '') {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }))
    }
  }
}

// @ts-ignore
global.WebSocket = MockWebSocket

describe('useDeletionProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.instances = []
    mockLocalStorage.getItem.mockReturnValue('test-token')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Connection', () => {
    it('should not connect when vmId is null', () => {
      renderHook(() => useDeletionProgress({
        vmId: null,
        enabled: true,
      }))

      expect(MockWebSocket.instances.length).toBe(0)
    })

    it('should not connect when enabled is false', () => {
      renderHook(() => useDeletionProgress({
        vmId: 'test-vm-id',
        enabled: false,
      }))

      expect(MockWebSocket.instances.length).toBe(0)
    })

    it('should not connect when no token', () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      renderHook(() => useDeletionProgress({
        vmId: 'test-vm-id',
        enabled: true,
      }))

      expect(MockWebSocket.instances.length).toBe(0)
    })

    it('should connect with correct URL', () => {
      renderHook(() => useDeletionProgress({
        vmId: 'test-vm-id',
        enabled: true,
      }))

      expect(MockWebSocket.instances.length).toBe(1)
      expect(MockWebSocket.instances[0].url).toContain('/api/ws/deletion/test-vm-id')
      expect(MockWebSocket.instances[0].url).toContain('token=test-token')
    })
  })

  describe('Message Handling', () => {
    it('should handle deletion_update message', () => {
      const { result } = renderHook(() => useDeletionProgress({
        vmId: 'test-vm-id',
        enabled: true,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateMessage({
          type: 'deletion_update',
          vm_id: 'test-vm-id',
          step: 'destroying_infrastructure',
          step_index: 1,
          total_steps: 4,
          message: 'Running terraform destroy...',
          is_complete: false,
          is_error: false,
          timestamp: new Date().toISOString(),
        })
      })

      expect(result.current.progress).not.toBeNull()
      expect(result.current.progress?.step).toBe('destroying_infrastructure')
      expect(result.current.progress?.step_index).toBe(1)
      expect(result.current.progress?.total_steps).toBe(4)
    })

    it('should call onComplete when deletion completes', () => {
      const onComplete = vi.fn()

      renderHook(() => useDeletionProgress({
        vmId: 'test-vm-id',
        enabled: true,
        onComplete,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateMessage({
          type: 'deletion_update',
          vm_id: 'test-vm-id',
          step: 'completed',
          step_index: 3,
          total_steps: 4,
          message: 'VM deleted successfully',
          is_complete: true,
          is_error: false,
          timestamp: new Date().toISOString(),
        })
      })

      expect(onComplete).toHaveBeenCalled()
    })

    it('should call onError when deletion fails', () => {
      const onError = vi.fn()

      renderHook(() => useDeletionProgress({
        vmId: 'test-vm-id',
        enabled: true,
        onError,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateMessage({
          type: 'deletion_update',
          vm_id: 'test-vm-id',
          step: 'failed',
          step_index: 3,
          total_steps: 4,
          message: 'Terraform destroy failed',
          is_complete: true,
          is_error: true,
          timestamp: new Date().toISOString(),
        })
      })

      expect(onError).toHaveBeenCalledWith('Terraform destroy failed')
    })

    it('should track all deletion steps in sequence', () => {
      const { result } = renderHook(() => useDeletionProgress({
        vmId: 'test-vm-id',
        enabled: true,
      }))

      const steps = [
        { step: 'initializing', step_index: 0, message: 'Preparing to delete...' },
        { step: 'destroying_infrastructure', step_index: 1, message: 'Running terraform destroy...' },
        { step: 'releasing_resources', step_index: 2, message: 'Releasing IP address...' },
        { step: 'completed', step_index: 3, message: 'VM deleted successfully' },
      ]

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      for (const stepData of steps) {
        act(() => {
          MockWebSocket.instances[0].simulateMessage({
            type: 'deletion_update',
            vm_id: 'test-vm-id',
            ...stepData,
            total_steps: 4,
            is_complete: stepData.step === 'completed',
            is_error: false,
            timestamp: new Date().toISOString(),
          })
        })

        expect(result.current.progress?.step).toBe(stepData.step)
        expect(result.current.progress?.step_index).toBe(stepData.step_index)
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle WebSocket error', () => {
      const { result } = renderHook(() => useDeletionProgress({
        vmId: 'test-vm-id',
        enabled: true,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateError()
      })

      expect(result.current.error).toBe('WebSocket connection error')
    })

    it('should handle error message from server', () => {
      const onError = vi.fn()
      const { result } = renderHook(() => useDeletionProgress({
        vmId: 'test-vm-id',
        enabled: true,
        onError,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateMessage({
          type: 'error',
          message: 'VM not found',
        })
      })

      expect(result.current.error).toBe('VM not found')
      expect(onError).toHaveBeenCalledWith('VM not found')
    })

    it('should handle malformed JSON', () => {
      renderHook(() => useDeletionProgress({
        vmId: 'test-vm-id',
        enabled: true,
      }))

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        if (MockWebSocket.instances[0].onmessage) {
          MockWebSocket.instances[0].onmessage(
            new MessageEvent('message', { data: 'invalid json' })
          )
        }
      })

      expect(consoleError).toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })

  describe('Cleanup', () => {
    it('should close connection on unmount', () => {
      const { unmount } = renderHook(() => useDeletionProgress({
        vmId: 'test-vm-id',
        enabled: true,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      unmount()

      expect(MockWebSocket.instances[0].close).toHaveBeenCalled()
    })

    it('should clear reconnect timeout on unmount', () => {
      const { unmount } = renderHook(() => useDeletionProgress({
        vmId: 'test-vm-id',
        enabled: true,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateClose(1006)
      })

      unmount()

      // No error should occur from orphaned timeout
      act(() => {
        vi.advanceTimersByTime(10000)
      })
    })
  })
})
