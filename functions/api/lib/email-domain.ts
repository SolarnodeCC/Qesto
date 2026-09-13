/**
 * email-domain.ts — ADR-0074 signup hygiene for the free-access window.
 *
 * Opening the full product to anyone who signs up makes throwaway addresses
 * worth creating. This rejects known disposable-mail domains at signup so the
 * account numbers the promo is measured on mean something.
 *
 * Deliberately NOT a spam oracle: free webmail (gmail, outlook, proton…) is
 * allowed, because solo facilitators and consultants are a real segment. The
 * list covers services whose entire purpose is a self-destructing inbox.
 *
 * Off by default — `SIGNUP_BLOCK_DISPOSABLE_DOMAINS = 'true'` turns it on.
 * `SIGNUP_BLOCKED_EMAIL_DOMAINS_EXTRA` (comma-separated) extends it without a
 * code change when a new service shows up in the signup logs.
 */

import { getFlag } from './flags'
import type { Env } from '../types'

/** Known disposable / self-destructing inbox providers. */
export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  '0-mail.com',
  '10minutemail.com',
  '20minutemail.com',
  'anonbox.net',
  'burnermail.io',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamail.info',
  'guerrillamail.net',
  'inboxbear.com',
  'jetable.org',
  'mail-temporaire.fr',
  'mailcatch.com',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'mintemail.com',
  'mohmal.com',
  'moakt.com',
  'mytemp.email',
  'sharklasers.com',
  'spam4.me',
  'spamgourmet.com',
  'temp-mail.org',
  'tempmail.dev',
  'tempmailo.com',
  'tempr.email',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.de',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
])

export type EmailDomainEnv = Pick<Env, 'SIGNUP_BLOCK_DISPOSABLE_DOMAINS' | 'SIGNUP_BLOCKED_EMAIL_DOMAINS_EXTRA'>

/** Lower-cased domain part of an address, or null when it isn't parseable. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 1 || at === email.length - 1) return null
  return email.slice(at + 1).toLowerCase().trim()
}

/**
 * Whether signup should be refused for this address.
 *
 * Matches the domain and any parent domain, so `foo.mailinator.com` is caught
 * by the `mailinator.com` entry — subdomain wildcards are the standard way
 * these services hand out fresh inboxes.
 */
export function isDisposableEmail(env: EmailDomainEnv, email: string): boolean {
  if (!getFlag(env, 'SIGNUP_BLOCK_DISPOSABLE_DOMAINS')) return false

  const domain = emailDomain(email)
  if (!domain) return false

  const extra = (env.SIGNUP_BLOCKED_EMAIL_DOMAINS_EXTRA ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)

  const labels = domain.split('.')
  for (let i = 0; i < labels.length - 1; i++) {
    const candidate = labels.slice(i).join('.')
    if (DISPOSABLE_EMAIL_DOMAINS.has(candidate) || extra.includes(candidate)) return true
  }
  return false
}

/** Shared refusal copy — says what to do, not just what failed. */
export const DISPOSABLE_EMAIL_MESSAGE =
  'Please sign up with a permanent email address — disposable inboxes are not accepted.'
