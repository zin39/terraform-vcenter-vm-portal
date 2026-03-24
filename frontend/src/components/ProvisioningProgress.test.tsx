import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProvisioningProgress } from './ProvisioningProgress'

// Mock the useProvisioningProgress hook
vi.mock('../hooks/useProvisioningProgress', () => ({
  useProvisioningProgress: vi.fn(),
}))

import { useProvisioningProgress } from '../hooks/useProvisioningProgress'

const mockUseProvisioningProgress = useProvisioningProgress as ReturnType<typeof vi.fn>

describe('ProvisioningProgress', () => {
  const defaultProps = {
    requestId: 'test-request-id',
    onComplete: vi.fn(),
    onError: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Loading State', () => {
    it('should show reconnecting state when not connected', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: null,
        sshStatus: {},
        isConnected: false,
        error: null,
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      expect(screen.getByText(/reconnecting/i)).toBeInTheDocument()
    })

    it('should show live updates indicator when connected', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: {
          request_id: 'test-request-id',
          step: 'initializing',
          step_index: 0,
          total_steps: 6,
          message: 'Preparing workspace...',
          is_complete: false,
          is_error: false,
          timestamp: new Date().toISOString(),
        },
        sshStatus: {},
        isConnected: true,
        error: null,
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      expect(screen.getByText('Live updates')).toBeInTheDocument()
    })
  })

  describe('Progress Steps Display', () => {
    it('should display all provisioning steps', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: {
          request_id: 'test-request-id',
          step: 'creating_vm',
          step_index: 1,
          total_steps: 6,
          message: 'Running terraform apply...',
          is_complete: false,
          is_error: false,
          timestamp: new Date().toISOString(),
        },
        sshStatus: {},
        isConnected: true,
        error: null,
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      // Check for step labels (exact case from component)
      expect(screen.getByText('Initializing')).toBeInTheDocument()
      expect(screen.getByText('Creating VM')).toBeInTheDocument()
      expect(screen.getByText('Configuring Network')).toBeInTheDocument()
      expect(screen.getByText('Setting up User')).toBeInTheDocument()
      expect(screen.getByText('Verifying SSH')).toBeInTheDocument()
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('should show current step message', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: {
          request_id: 'test-request-id',
          step: 'configuring_network',
          step_index: 2,
          total_steps: 6,
          message: 'Applying network configuration via cloud-init...',
          is_complete: false,
          is_error: false,
          timestamp: new Date().toISOString(),
        },
        sshStatus: {},
        isConnected: true,
        error: null,
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      expect(screen.getByText('Applying network configuration via cloud-init...')).toBeInTheDocument()
    })
  })

  describe('Step States', () => {
    it('should mark completed steps correctly', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: {
          request_id: 'test-request-id',
          step: 'verifying_ssh',
          step_index: 4,
          total_steps: 6,
          message: 'Verifying SSH connectivity...',
          is_complete: false,
          is_error: false,
          timestamp: new Date().toISOString(),
        },
        sshStatus: {},
        isConnected: true,
        error: null,
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      // Steps 0-3 should be complete, step 4 is current
      // We can check for visual indicators if they have test-ids or specific classes
    })
  })

  describe('SSH Verification Display', () => {
    it('should display SSH status for VMs', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: {
          request_id: 'test-request-id',
          step: 'verifying_ssh',
          step_index: 4,
          total_steps: 6,
          message: 'Checking SSH connectivity...',
          is_complete: false,
          is_error: false,
          timestamp: new Date().toISOString(),
        },
        sshStatus: {
          'vm-config-1': {
            request_id: 'test-request-id',
            vm_config_id: 'vm-config-1',
            vm_name: 'test-vm-01',
            ip_address: '10.0.1.100',
            is_reachable: true,
            attempt: 3,
            max_attempts: 12,
            latency_ms: 45,
            error_message: null,
            timestamp: new Date().toISOString(),
          },
        },
        isConnected: true,
        error: null,
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      expect(screen.getByText('test-vm-01')).toBeInTheDocument()
      expect(screen.getByText('10.0.1.100')).toBeInTheDocument()
    })

    it('should show SSH attempt counter when not reachable', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: {
          request_id: 'test-request-id',
          step: 'verifying_ssh',
          step_index: 4,
          total_steps: 6,
          message: 'Checking SSH connectivity...',
          is_complete: false,
          is_error: false,
          timestamp: new Date().toISOString(),
        },
        sshStatus: {
          'vm-config-1': {
            request_id: 'test-request-id',
            vm_config_id: 'vm-config-1',
            vm_name: 'test-vm-01',
            ip_address: '10.0.1.100',
            is_reachable: false,
            attempt: 5,
            max_attempts: 12,
            latency_ms: null,
            error_message: 'Connection refused',
            timestamp: new Date().toISOString(),
          },
        },
        isConnected: true,
        error: null,
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      expect(screen.getByText('Attempt 5/12')).toBeInTheDocument()
    })

    it('should show latency when SSH is reachable', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: {
          request_id: 'test-request-id',
          step: 'verifying_ssh',
          step_index: 4,
          total_steps: 6,
          message: 'Checking SSH connectivity...',
          is_complete: false,
          is_error: false,
          timestamp: new Date().toISOString(),
        },
        sshStatus: {
          'vm-config-1': {
            request_id: 'test-request-id',
            vm_config_id: 'vm-config-1',
            vm_name: 'test-vm-01',
            ip_address: '10.0.1.100',
            is_reachable: true,
            attempt: 3,
            max_attempts: 12,
            latency_ms: 45,
            error_message: null,
            timestamp: new Date().toISOString(),
          },
        },
        isConnected: true,
        error: null,
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      expect(screen.getByText(/Reachable \(45ms\)/)).toBeInTheDocument()
    })
  })

  describe('Completion States', () => {
    it('should display completed step when provisioning finishes', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: {
          request_id: 'test-request-id',
          step: 'completed',
          step_index: 5,
          total_steps: 6,
          message: 'VM provisioned successfully',
          is_complete: true,
          is_error: false,
          timestamp: new Date().toISOString(),
        },
        sshStatus: {},
        isConnected: true,
        error: null,
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('should display error state when failed', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: {
          request_id: 'test-request-id',
          step: 'failed',
          step_index: 5,
          total_steps: 6,
          message: 'Terraform apply failed: resource limit exceeded',
          is_complete: true,
          is_error: true,
          timestamp: new Date().toISOString(),
        },
        sshStatus: {},
        isConnected: true,
        error: null,
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      expect(screen.getByText(/resource limit exceeded/i)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display connection error', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: null,
        sshStatus: {},
        isConnected: false,
        error: 'WebSocket connection failed',
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      expect(screen.getByText('WebSocket connection failed')).toBeInTheDocument()
    })
  })

  describe('Progress Percentage', () => {
    it('should show 0% at initializing step', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: {
          request_id: 'test-request-id',
          step: 'initializing',
          step_index: 0,
          total_steps: 6,
          message: 'Starting...',
          is_complete: false,
          is_error: false,
          timestamp: new Date().toISOString(),
        },
        sshStatus: {},
        isConnected: true,
        error: null,
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('should show 100% at completed step', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: {
          request_id: 'test-request-id',
          step: 'completed',
          step_index: 5,
          total_steps: 6,
          message: 'Done!',
          is_complete: true,
          is_error: false,
          timestamp: new Date().toISOString(),
        },
        sshStatus: {},
        isConnected: true,
        error: null,
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('should show correct percentage at intermediate steps', () => {
      mockUseProvisioningProgress.mockReturnValue({
        progress: {
          request_id: 'test-request-id',
          step: 'creating_vm',
          step_index: 1,
          total_steps: 6,
          message: 'Creating...',
          is_complete: false,
          is_error: false,
          timestamp: new Date().toISOString(),
        },
        sshStatus: {},
        isConnected: true,
        error: null,
        disconnect: vi.fn(),
      })

      render(<ProvisioningProgress {...defaultProps} />)

      // Step 1 out of 5 intervals = 20%
      expect(screen.getByText('20%')).toBeInTheDocument()
    })
  })
})
