// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { isNativeShell, nativePlatform, nativeSafeAreaClass } from '../../src/lib/native-shell'

describe('native-shell', () => {
  const original = window.Capacitor

  afterEach(() => {
    window.Capacitor = original
  })

  beforeEach(() => {
    delete window.Capacitor
  })

  it('detects browser as non-native', () => {
    expect(isNativeShell()).toBe(false)
    expect(nativePlatform()).toBe('web')
    expect(nativeSafeAreaClass()).toBe('')
  })

  it('detects Capacitor native platform', () => {
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'ios',
    }
    expect(isNativeShell()).toBe(true)
    expect(nativePlatform()).toBe('ios')
    expect(nativeSafeAreaClass()).toBe('native-safe-area')
  })
})
