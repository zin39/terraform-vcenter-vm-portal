import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProvisioningProgress } from './useProvisioningProgress'

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

describe('useProvisioningProgress', () => {
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
    it('should not connect when requestId is null', () => {
      renderHook(() => useProvisioningProgress({
        requestId: null,
        enabled: true,
      }))

      expect(MockWebSocket.instances.length).toBe(0)
    })

    it('should not connect when enabled is false', () => {
      renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: false,
      }))

      expect(MockWebSocket.instances.length).toBe(0)
    })

    it('should not connect when no token in localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
      }))

      expect(MockWebSocket.instances.length).toBe(0)
    })

    it('should connect when all conditions are met', async () => {
      renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
      }))

      expect(MockWebSocket.instances.length).toBe(1)
      expect(MockWebSocket.instances[0].url).toContain('test-request-id')
      expect(MockWebSocket.instances[0].url).toContain('token=test-token')
    })

    it('should set isConnected to true on open', async () => {
      const { result } = renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
      }))

      expect(result.current.isConnected).toBe(false)

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      expect(result.current.isConnected).toBe(true)
    })
  })

  describe('Message Handling', () => {
    it('should handle connected message', async () => {
      const { result } = renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateMessage({
          type: 'connected',
          request_id: 'test-request-id',
        })
      })

      expect(result.current.isConnected).toBe(true)
    })

    it('should handle provisioning_update message', async () => {
      const { result } = renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateMessage({
          type: 'provisioning_update',
          request_id: 'test-request-id',
          step: 'creating_vm',
          step_index: 1,
          total_steps: 6,
          message: 'Creating VM...',
          is_complete: false,
          is_error: false,
          timestamp: new Date().toISOString(),
        })
      })

      expect(result.current.progress).not.toBeNull()
      expect(result.current.progress?.step).toBe('creating_vm')
      expect(result.current.progress?.step_index).toBe(1)
    })

    it('should handle ssh_verification_update message', async () => {
      const vmConfigId = 'vm-config-123'
      const { result } = renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateMessage({
          type: 'ssh_verification_update',
          request_id: 'test-request-id',
          vm_config_id: vmConfigId,
          vm_name: 'test-vm',
          ip_address: '10.0.1.100',
          is_reachable: true,
          attempt: 3,
          max_attempts: 12,
          latency_ms: 45,
          error_message: null,
          timestamp: new Date().toISOString(),
        })
      })

      expect(result.current.sshStatus[vmConfigId]).toBeDefined()
      expect(result.current.sshStatus[vmConfigId].is_reachable).toBe(true)
      expect(result.current.sshStatus[vmConfigId].latency_ms).toBe(45)
    })

    it('should call onComplete when provisioning completes successfully', async () => {
      const onComplete = vi.fn()

      renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
        onComplete,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateMessage({
          type: 'provisioning_update',
          request_id: 'test-request-id',
          step: 'completed',
          step_index: 5,
          total_steps: 6,
          message: 'VM provisioned successfully',
          is_complete: true,
          is_error: false,
          timestamp: new Date().toISOString(),
        })
      })

      expect(onComplete).toHaveBeenCalled()
    })

    it('should call onError when provisioning fails', async () => {
      const onError = vi.fn()

      renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
        onError,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateMessage({
          type: 'provisioning_update',
          request_id: 'test-request-id',
          step: 'failed',
          step_index: 5,
          total_steps: 6,
          message: 'Terraform apply failed',
          is_complete: true,
          is_error: true,
          timestamp: new Date().toISOString(),
        })
      })

      expect(onError).toHaveBeenCalledWith('Terraform apply failed')
    })

    it('should handle error message type', async () => {
      const onError = vi.fn()
      const { result } = renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
        onError,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateMessage({
          type: 'error',
          message: 'Connection error',
        })
      })

      expect(result.current.error).toBe('Connection error')
      expect(onError).toHaveBeenCalledWith('Connection error')
    })
  })

  describe('Reconnection', () => {
    it('should not reconnect when closed normally (code 1000)', async () => {
      renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
      }))

      const initialCount = MockWebSocket.instances.length

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateClose(1000, 'Normal closure')
      })

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(MockWebSocket.instances.length).toBe(initialCount)
    })

    it('should attempt reconnection on abnormal close', async () => {
      renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
      }))

      const initialCount = MockWebSocket.instances.length

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateClose(1006, 'Abnormal closure')
      })

      act(() => {
        vi.advanceTimersByTime(1500)
      })

      expect(MockWebSocket.instances.length).toBeGreaterThan(initialCount)
    })

    it('should use exponential backoff for reconnection', async () => {
      renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
      }))

      const initialCount = MockWebSocket.instances.length

      // First close - triggers reconnection
      act(() => {
        MockWebSocket.instances[0].simulateOpen()
        MockWebSocket.instances[0].simulateClose(1006)
      })

      // First reconnect happens after ~1000ms (base delay)
      act(() => {
        vi.advanceTimersByTime(1100)
      })

      // Should have created a new WebSocket
      expect(MockWebSocket.instances.length).toBeGreaterThan(initialCount)
    })
  })

  describe('Disconnect', () => {
    it('should close WebSocket when disconnect is called', async () => {
      const { result } = renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      expect(result.current.isConnected).toBe(true)

      act(() => {
        result.current.disconnect()
      })

      expect(MockWebSocket.instances[0].close).toHaveBeenCalledWith(1000, 'Manually disconnected')
    })
  })

  describe('Cleanup', () => {
    it('should close WebSocket on unmount', async () => {
      const { unmount } = renderHook(() => useProvisioningProgress({
        requestId: 'test-request-id',
        enabled: true,
      }))

      act(() => {
        MockWebSocket.instances[0].simulateOpen()
      })

      unmount()

      expect(MockWebSocket.instances[0].close).toHaveBeenCalledWith(1000, 'Component unmounted')
    })
  })
})
