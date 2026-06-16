/**
 * LEARN-TEMPLATES-01 (ADR-0058) — L&D session template gallery.
 *
 * Curated assessment/engagement templates for corporate L&D: a pre-quiz to set a
 * baseline, an in-session formative knowledge-check, and a post-assessment.
 * Templates are config-as-data (no per-template code) so instructors clone and
 * customise. Pure catalog + lookup helpers; the route serves them read-only.
 */

export type LearnTemplateKind = 'pre_quiz' | 'formative_check' | 'post_assessment'

export type LearnTemplateQuestion = {
  kind: 'poll' | 'ranking' | 'consent_vote' | 'open_question'
  prompt: string
  /** Default scoring weight (LEARN-SCORING-01); 0 for ungraded engagement items. */
  weight: number
}

export type LearnTemplate = {
  id: string
  kind: LearnTemplateKind
  name: string
  description: string
  /** i18n key root so LEARN-I18N-01 (S95) can localise names/descriptions. */
  i18nKey: string
  questions: LearnTemplateQuestion[]
}

export const LEARN_TEMPLATES: readonly LearnTemplate[] = [
  {
    id: 'learn-pre-quiz',
    kind: 'pre_quiz',
    name: 'Pre-course baseline quiz',
    description: 'Measure prior knowledge before training to baseline learning gain.',
    i18nKey: 'learn.templates.pre_quiz',
    questions: [
      { kind: 'poll', prompt: 'How would you rate your current familiarity with this topic?', weight: 0 },
      { kind: 'poll', prompt: 'Baseline knowledge check (single best answer)', weight: 1 },
      { kind: 'poll', prompt: 'Baseline knowledge check (select all that apply)', weight: 1 },
    ],
  },
  {
    id: 'learn-formative-check',
    kind: 'formative_check',
    name: 'In-session formative check',
    description: 'Quick mid-session knowledge check to confirm understanding before moving on.',
    i18nKey: 'learn.templates.formative_check',
    questions: [
      { kind: 'poll', prompt: 'Which of the following best describes the concept just covered?', weight: 1 },
      { kind: 'consent_vote', prompt: 'I feel confident applying this in my work.', weight: 0 },
    ],
  },
  {
    id: 'learn-post-assessment',
    kind: 'post_assessment',
    name: 'Post-course assessment',
    description: 'Graded end-of-course assessment with passback-ready scoring weights.',
    i18nKey: 'learn.templates.post_assessment',
    questions: [
      { kind: 'poll', prompt: 'Assessment question 1', weight: 1 },
      { kind: 'poll', prompt: 'Assessment question 2 (select all that apply)', weight: 2 },
      { kind: 'ranking', prompt: 'Rank these steps in the correct order', weight: 2 },
      { kind: 'open_question', prompt: 'Briefly explain how you would apply this.', weight: 0 },
    ],
  },
] as const

export function listLearnTemplates(): readonly LearnTemplate[] {
  return LEARN_TEMPLATES
}

export function getLearnTemplate(id: string): LearnTemplate | null {
  return LEARN_TEMPLATES.find((t) => t.id === id) ?? null
}
