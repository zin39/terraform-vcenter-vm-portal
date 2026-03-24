import { useState, useEffect, useCallback, useRef } from 'react'

export interface ProvisioningUpdate {
  request_id: string
  step: string
  step_index: number
  total_steps: number
  message: string
  is_complete: boolean
  is_error: boolean
  timestamp: string
}

export interface SshVerificationUpdate {
  request_id: string
  vm_config_id: string
  vm_name: string
  ip_address: string
  is_reachable: boolean
  attempt: number
  max_attempts: number
  latency_ms: number | null
  error_message: string | null
  timestamp: string
}

export interface ProgressMessage {
  type: 'provisioning_update' | 'ssh_verification_update' | 'error' | 'connected'
  request_id?: string
  message?: string
}

export interface SshStatus {
  [vmConfigId: string]: SshVerificationUpdate
}

interface UseProvisioningProgressOptions {
  requestId: string | null
  enabled?: boolean
  onComplete?: () => void
  onError?: (error: string) => void
}

export function useProvisioningProgress({
  requestId,
  enabled = true,
  onComplete,
  onError,
}: UseProvisioningProgressOptions) {
  const [progress, setProgress] = useState<ProvisioningUpdate | null>(null)
  const [sshStatus, setSshStatus] = useState<SshStatus>({})
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const baseReconnectDelay = 1000

  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  }, [onComplete, onError])

  const connect = useCallback(() => {
    const token = localStorage.getItem('token')
    if (!requestId || !token || !enabled) return

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, '') || window.location.host
    const wsUrl = `${protocol}//${host}/api/ws/provisioning/${requestId}?token=${token}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      setError(null)
      reconnectAttempts.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ProgressMessage & ProvisioningUpdate & SshVerificationUpdate

        if (data.type === 'connected') {
          console.log('WebSocket connected for request:', data.request_id)
        } else if (data.type === 'provisioning_update') {
          setProgress(data)

          if (data.is_complete) {
            if (data.is_error) {
              onErrorRef.current?.(data.message)
            } else {
              onCompleteRef.current?.()
            }
          }
        } else if (data.type === 'ssh_verification_update') {
          setSshStatus((prev) => ({
            ...prev,
            [data.vm_config_id]: data,
          }))
        } else if (data.type === 'error') {
          setError(data.message || 'Unknown error')
          onErrorRef.current?.(data.message || 'Unknown error')
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    ws.onclose = (event) => {
      setIsConnected(false)
      wsRef.current = null

      // Don't reconnect if closed normally or if progress is complete
      if (event.code === 1000 || progress?.is_complete) return

      // Exponential backoff reconnection
      if (reconnectAttempts.current < maxReconnectAttempts && enabled) {
        const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current)
        reconnectAttempts.current++

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Reconnecting to WebSocket (attempt ${reconnectAttempts.current})...`)
          connect()
        }, delay)
      }
    }

    ws.onerror = () => {
      setError('WebSocket connection error')
    }
  }, [requestId, enabled, progress?.is_complete])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted')
      }
    }
  }, [connect])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manually disconnected')
    }
    setIsConnected(false)
  }, [])

  return {
    progress,
    sshStatus,
    isConnected,
    error,
    disconnect,
  }
}
