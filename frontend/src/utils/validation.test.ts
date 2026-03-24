import { describe, it, expect } from 'vitest'

// ============================================================================
// Validation Functions (copied from form logic for testing)
// ============================================================================

const isValidIpAddress = (ip: string): boolean => {
  if (!ip) return false
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  return parts.every((part) => {
    const num = parseInt(part, 10)
    return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString()
  })
}

const isValidVmName = (name: string): { valid: boolean; message?: string } => {
  if (!name) return { valid: false, message: 'VM name is required' }
  if (name.length < 3) return { valid: false, message: 'VM name must be at least 3 characters' }
  if (name.length > 63) return { valid: false, message: 'VM name must be under 63 characters' }
  if (!/^[a-zA-Z][a-zA-Z0-9-_]*$/.test(name)) {
    return { valid: false, message: 'Must start with a letter, then letters, numbers, hyphens, or underscores' }
  }
  if (name.endsWith('-') || name.endsWith('_')) {
    return { valid: false, message: 'Cannot end with a hyphen or underscore' }
  }
  return { valid: true }
}

// ============================================================================
// IP Address Validation Tests
// ============================================================================

describe('IP Address Validation', () => {
  describe('Valid IP Addresses', () => {
    it('should accept standard private network IPs', () => {
      expect(isValidIpAddress('10.0.1.100')).toBe(true)
      expect(isValidIpAddress('192.168.1.1')).toBe(true)
      expect(isValidIpAddress('172.16.0.1')).toBe(true)
    })

    it('should accept boundary values', () => {
      expect(isValidIpAddress('0.0.0.0')).toBe(true)
      expect(isValidIpAddress('255.255.255.255')).toBe(true)
    })

    it('should accept localhost', () => {
      expect(isValidIpAddress('127.0.0.1')).toBe(true)
    })

    it('should accept single digit octets', () => {
      expect(isValidIpAddress('1.2.3.4')).toBe(true)
      expect(isValidIpAddress('0.0.0.1')).toBe(true)
    })

    it('should accept double digit octets', () => {
      expect(isValidIpAddress('10.20.30.40')).toBe(true)
      expect(isValidIpAddress('99.99.99.99')).toBe(true)
    })

    it('should accept triple digit octets', () => {
      expect(isValidIpAddress('100.200.150.250')).toBe(true)
      expect(isValidIpAddress('192.168.100.200')).toBe(true)
    })
  })

  describe('Invalid IP Addresses', () => {
    it('should reject empty string', () => {
      expect(isValidIpAddress('')).toBe(false)
    })

    it('should reject null/undefined patterns', () => {
      expect(isValidIpAddress(undefined as unknown as string)).toBe(false)
      expect(isValidIpAddress(null as unknown as string)).toBe(false)
    })

    it('should reject wrong number of octets', () => {
      expect(isValidIpAddress('10.10.40')).toBe(false)
      expect(isValidIpAddress('10.10')).toBe(false)
      expect(isValidIpAddress('10')).toBe(false)
      expect(isValidIpAddress('10.0.1.100.50')).toBe(false)
    })

    it('should reject octets over 255', () => {
      expect(isValidIpAddress('10.0.1.256')).toBe(false)
      expect(isValidIpAddress('256.0.0.1')).toBe(false)
      expect(isValidIpAddress('10.256.40.100')).toBe(false)
      expect(isValidIpAddress('999.999.999.999')).toBe(false)
    })

    it('should reject negative values', () => {
      expect(isValidIpAddress('-1.0.0.1')).toBe(false)
      expect(isValidIpAddress('10.0.1.-1')).toBe(false)
    })

    it('should reject non-numeric characters', () => {
      expect(isValidIpAddress('abc.def.ghi.jkl')).toBe(false)
      expect(isValidIpAddress('10.0.1.abc')).toBe(false)
      expect(isValidIpAddress('10a.10.40.100')).toBe(false)
    })

    it('should reject leading zeros in octets', () => {
      expect(isValidIpAddress('010.0.1.100')).toBe(false)
      expect(isValidIpAddress('10.010.40.100')).toBe(false)
      expect(isValidIpAddress('10.10.040.100')).toBe(false)
      expect(isValidIpAddress('10.0.1.0100')).toBe(false)
    })

    it('should reject spaces', () => {
      expect(isValidIpAddress('10.0.1. 100')).toBe(false)
      expect(isValidIpAddress(' 10.0.1.100')).toBe(false)
      expect(isValidIpAddress('10.0.1.100 ')).toBe(false)
    })

    it('should reject other separators', () => {
      expect(isValidIpAddress('10,10,40,100')).toBe(false)
      expect(isValidIpAddress('10:10:40:100')).toBe(false)
      expect(isValidIpAddress('10-10-40-100')).toBe(false)
    })
  })
})

// ============================================================================
// VM Name Validation Tests
// ============================================================================

describe('VM Name Validation', () => {
  describe('Valid VM Names', () => {
    it('should accept standard naming conventions', () => {
      expect(isValidVmName('dev-server-01').valid).toBe(true)
      expect(isValidVmName('web-prod-01').valid).toBe(true)
      expect(isValidVmName('database-primary').valid).toBe(true)
    })

    it('should accept names with underscores', () => {
      expect(isValidVmName('dev_server_01').valid).toBe(true)
      expect(isValidVmName('web_prod').valid).toBe(true)
    })

    it('should accept names with mixed case', () => {
      expect(isValidVmName('DevServer01').valid).toBe(true)
      expect(isValidVmName('WebPROD').valid).toBe(true)
      expect(isValidVmName('Database').valid).toBe(true)
    })

    it('should accept names with numbers', () => {
      expect(isValidVmName('server1').valid).toBe(true)
      expect(isValidVmName('vm123').valid).toBe(true)
      expect(isValidVmName('web01dev').valid).toBe(true)
    })

    it('should accept minimum length (3 characters)', () => {
      expect(isValidVmName('abc').valid).toBe(true)
      expect(isValidVmName('vm1').valid).toBe(true)
      expect(isValidVmName('web').valid).toBe(true)
    })

    it('should accept maximum length (63 characters)', () => {
      const maxName = 'a'.repeat(63)
      expect(isValidVmName(maxName).valid).toBe(true)
    })

    it('should accept mixed valid characters', () => {
      expect(isValidVmName('Dev-VM_01-Prod').valid).toBe(true)
      expect(isValidVmName('a-b_c-d_e').valid).toBe(true)
    })
  })

  describe('Invalid VM Names - Length', () => {
    it('should reject empty string', () => {
      const result = isValidVmName('')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('VM name is required')
    })

    it('should reject single character', () => {
      const result = isValidVmName('a')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('VM name must be at least 3 characters')
    })

    it('should reject two characters', () => {
      const result = isValidVmName('ab')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('VM name must be at least 3 characters')
    })

    it('should reject names over 63 characters', () => {
      const longName = 'a'.repeat(64)
      const result = isValidVmName(longName)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('VM name must be under 63 characters')
    })
  })

  describe('Invalid VM Names - Starting Character', () => {
    it('should reject names starting with a number', () => {
      const result = isValidVmName('1server')
      expect(result.valid).toBe(false)
      expect(result.message).toContain('start with a letter')
    })

    it('should reject names starting with a hyphen', () => {
      const result = isValidVmName('-server')
      expect(result.valid).toBe(false)
    })

    it('should reject names starting with an underscore', () => {
      const result = isValidVmName('_server')
      expect(result.valid).toBe(false)
    })

    it('should reject names starting with special characters', () => {
      expect(isValidVmName('@server').valid).toBe(false)
      expect(isValidVmName('#server').valid).toBe(false)
      expect(isValidVmName('$server').valid).toBe(false)
    })
  })

  describe('Invalid VM Names - Ending Character', () => {
    it('should reject names ending with hyphen', () => {
      const result = isValidVmName('server-')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Cannot end with a hyphen or underscore')
    })

    it('should reject names ending with underscore', () => {
      const result = isValidVmName('server_')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('Cannot end with a hyphen or underscore')
    })
  })

  describe('Invalid VM Names - Invalid Characters', () => {
    it('should reject names with spaces', () => {
      expect(isValidVmName('dev server').valid).toBe(false)
      expect(isValidVmName('web prod 01').valid).toBe(false)
    })

    it('should reject names with dots', () => {
      expect(isValidVmName('server.name').valid).toBe(false)
      expect(isValidVmName('web.prod.01').valid).toBe(false)
    })

    it('should reject names with special characters', () => {
      expect(isValidVmName('server@host').valid).toBe(false)
      expect(isValidVmName('server$1').valid).toBe(false)
      expect(isValidVmName('server#1').valid).toBe(false)
      expect(isValidVmName('server!').valid).toBe(false)
      expect(isValidVmName('server%').valid).toBe(false)
      expect(isValidVmName('server&').valid).toBe(false)
      expect(isValidVmName('server*').valid).toBe(false)
    })

    it('should reject names with unicode characters', () => {
      expect(isValidVmName('servér').valid).toBe(false)
      expect(isValidVmName('сервер').valid).toBe(false)
      expect(isValidVmName('サーバー').valid).toBe(false)
    })
  })
})

// ============================================================================
// Resource Calculation Tests
// ============================================================================

describe('Resource Calculations', () => {
  interface VmConfig {
    cpu_cores: number
    ram_gb: number
    storage_gb: number
  }

  const calculateTotals = (vms: VmConfig[]) => ({
    totalCpu: vms.reduce((sum, vm) => sum + vm.cpu_cores, 0),
    totalRam: vms.reduce((sum, vm) => sum + vm.ram_gb, 0),
    totalStorage: vms.reduce((sum, vm) => sum + vm.storage_gb, 0),
  })

  it('should calculate totals for single VM', () => {
    const vms: VmConfig[] = [
      { cpu_cores: 2, ram_gb: 4, storage_gb: 50 }
    ]
    const totals = calculateTotals(vms)

    expect(totals.totalCpu).toBe(2)
    expect(totals.totalRam).toBe(4)
    expect(totals.totalStorage).toBe(50)
  })

  it('should calculate totals for multiple VMs', () => {
    const vms: VmConfig[] = [
      { cpu_cores: 2, ram_gb: 4, storage_gb: 50 },
      { cpu_cores: 4, ram_gb: 8, storage_gb: 100 },
      { cpu_cores: 8, ram_gb: 16, storage_gb: 500 },
    ]
    const totals = calculateTotals(vms)

    expect(totals.totalCpu).toBe(14)
    expect(totals.totalRam).toBe(28)
    expect(totals.totalStorage).toBe(650)
  })

  it('should handle empty array', () => {
    const vms: VmConfig[] = []
    const totals = calculateTotals(vms)

    expect(totals.totalCpu).toBe(0)
    expect(totals.totalRam).toBe(0)
    expect(totals.totalStorage).toBe(0)
  })

  it('should format storage correctly', () => {
    const formatStorage = (gb: number): string => {
      if (gb >= 1000) {
        return `${(gb / 1000).toFixed(1)} TB`
      }
      return `${gb} GB`
    }

    expect(formatStorage(500)).toBe('500 GB')
    expect(formatStorage(999)).toBe('999 GB')
    expect(formatStorage(1000)).toBe('1.0 TB')
    expect(formatStorage(1500)).toBe('1.5 TB')
    expect(formatStorage(2000)).toBe('2.0 TB')
  })
})

// ============================================================================
// OS Template Validation Tests
// ============================================================================

describe('OS Template Validation', () => {
  const osTemplates = [
    { name: 'ubuntu-22.04', min_storage_gb: 20 },
    { name: 'ubuntu-24.04', min_storage_gb: 25 },
    { name: 'windows-server-2022', min_storage_gb: 50 },
    { name: 'rhel-9', min_storage_gb: 30 },
    { name: 'debian-12', min_storage_gb: 20 },
  ]

  const getMinStorage = (osType: string): number => {
    const template = osTemplates.find(t => t.name === osType)
    return template?.min_storage_gb || 20
  }

  const getStorageOptions = (osType: string): number[] => {
    const minStorage = getMinStorage(osType)
    const allOptions = [20, 30, 40, 50, 80, 100, 150, 200, 300, 500, 1000, 2000]
    return allOptions.filter(s => s >= minStorage)
  }

  it('should return correct minimum storage for each OS', () => {
    expect(getMinStorage('ubuntu-22.04')).toBe(20)
    expect(getMinStorage('ubuntu-24.04')).toBe(25)
    expect(getMinStorage('windows-server-2022')).toBe(50)
    expect(getMinStorage('rhel-9')).toBe(30)
    expect(getMinStorage('debian-12')).toBe(20)
  })

  it('should return default minimum for unknown OS', () => {
    expect(getMinStorage('unknown-os')).toBe(20)
    expect(getMinStorage('')).toBe(20)
  })

  it('should filter storage options by minimum', () => {
    const ubuntuOptions = getStorageOptions('ubuntu-22.04')
    expect(ubuntuOptions[0]).toBe(20)

    const windowsOptions = getStorageOptions('windows-server-2022')
    expect(windowsOptions[0]).toBe(50)
    expect(windowsOptions).not.toContain(20)
    expect(windowsOptions).not.toContain(30)
    expect(windowsOptions).not.toContain(40)
  })

  it('should include all larger storage options', () => {
    const options = getStorageOptions('ubuntu-22.04')
    expect(options).toContain(100)
    expect(options).toContain(500)
    expect(options).toContain(1000)
    expect(options).toContain(2000)
  })
})

// ============================================================================
// Unique Validation Tests
// ============================================================================

describe('Unique Field Validation', () => {
  const isUnique = (value: string, values: string[]): boolean => {
    const count = values.filter(v => v.toLowerCase() === value.toLowerCase()).length
    return count <= 1
  }

  it('should pass when value is unique', () => {
    const values = ['vm-1', 'vm-2', 'vm-3']
    expect(isUnique('vm-4', values)).toBe(true)
  })

  it('should pass when value appears exactly once', () => {
    const values = ['vm-1', 'vm-2', 'vm-3']
    expect(isUnique('vm-1', values)).toBe(true)
  })

  it('should fail when value appears more than once', () => {
    const values = ['vm-1', 'vm-1', 'vm-3']
    expect(isUnique('vm-1', values)).toBe(false)
  })

  it('should be case insensitive', () => {
    const values = ['VM-1', 'vm-1', 'vm-3']
    expect(isUnique('VM-1', values)).toBe(false)
    expect(isUnique('vm-1', values)).toBe(false)
  })

  it('should handle empty values array', () => {
    expect(isUnique('vm-1', [])).toBe(true)
  })

  // IP address uniqueness
  it('should detect duplicate IP addresses', () => {
    const ips = ['10.0.1.100', '10.0.1.101', '10.0.1.100']
    expect(isUnique('10.0.1.100', ips)).toBe(false)
  })
})

// ============================================================================
// Pagination Tests
// ============================================================================

describe('Pagination Logic', () => {
  const calculatePagination = (page: number, perPage: number, total: number) => ({
    offset: (Math.max(1, page) - 1) * Math.min(perPage, 100),
    totalPages: Math.ceil(total / perPage),
    showing: {
      from: (page - 1) * perPage + 1,
      to: Math.min(page * perPage, total),
    },
  })

  it('should calculate correct offset', () => {
    expect(calculatePagination(1, 20, 100).offset).toBe(0)
    expect(calculatePagination(2, 20, 100).offset).toBe(20)
    expect(calculatePagination(3, 20, 100).offset).toBe(40)
  })

  it('should calculate correct total pages', () => {
    expect(calculatePagination(1, 20, 100).totalPages).toBe(5)
    expect(calculatePagination(1, 20, 101).totalPages).toBe(6)
    expect(calculatePagination(1, 20, 99).totalPages).toBe(5)
    expect(calculatePagination(1, 10, 100).totalPages).toBe(10)
  })

  it('should calculate correct showing range', () => {
    expect(calculatePagination(1, 20, 100).showing).toEqual({ from: 1, to: 20 })
    expect(calculatePagination(2, 20, 100).showing).toEqual({ from: 21, to: 40 })
    expect(calculatePagination(5, 20, 100).showing).toEqual({ from: 81, to: 100 })
  })

  it('should handle last page with partial results', () => {
    expect(calculatePagination(6, 20, 105).showing).toEqual({ from: 101, to: 105 })
  })

  it('should cap per_page at 100', () => {
    expect(calculatePagination(2, 200, 500).offset).toBe(100)
  })

  it('should handle page 0 as page 1', () => {
    expect(calculatePagination(0, 20, 100).offset).toBe(0)
  })
})
