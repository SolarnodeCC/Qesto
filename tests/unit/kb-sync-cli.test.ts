import { describe, expect, it } from 'vitest'
import { parseKbSyncCliArgs } from '../../scripts/kb-sync-cli'

describe('kb-sync CLI argument parsing', () => {
  it('defaults to sync when CI passes only --delete', () => {
    expect(parseKbSyncCliArgs(['--delete'])).toEqual({
      cmd: 'sync',
      hasDeleteFlag: true,
    })
  })

  it('uses the first non-flag argument as the command even when flags come first', () => {
    expect(parseKbSyncCliArgs(['--delete', 'status'])).toEqual({
      cmd: 'status',
      hasDeleteFlag: true,
    })
  })

  it('still exposes unknown non-flag commands for the usage error path', () => {
    expect(parseKbSyncCliArgs(['--delete', 'unknown'])).toEqual({
      cmd: 'unknown',
      hasDeleteFlag: true,
    })
  })

  it('supports the short delete flag with explicit commands', () => {
    expect(parseKbSyncCliArgs(['reset', '-d'])).toEqual({
      cmd: 'reset',
      hasDeleteFlag: true,
    })
  })
})
