import type { ReactNode } from 'react'

export interface SolutionFeature {
  icon: string
  title: string
  desc: string
  ai?: boolean
}

export interface SolutionScenario {
  title: string
  desc: string
}

export interface ProofMetric {
  label: string
  value: string
  note?: string
}

export interface ProofBadge {
  label: string
}

export interface ProofTestimonial {
  quote: string
  author: string
  role?: string
}

export interface PainPoint {
  icon: string
  title: string
  desc: string
}

export interface FaqItem {
  question: string
  answer: string
}

export interface RelatedLink {
  label: string
  href: string
  desc: string
}

export interface PlaybookStep {
  title: string
  desc: string
}

export interface SolutionPageProps {
  hero?: {
    badge?: string
    headline: string
    subheadline: string
    primaryCta: { label: string; href: string }
    secondaryCta?: { label: string; href: string }
    imageUrl?: string
    imageAlt?: string
    gallery?: Array<{ src: string; alt: string }>
  }
  painPoints?: {
    heading: string
    items: PainPoint[]
  }
  features?: {
    heading: string
    subheading?: string
    items: SolutionFeature[]
  }
  scenarios?: {
    heading: string
    items: SolutionScenario[]
  }
  playbook?: {
    heading: string
    intro: string
    steps: PlaybookStep[]
  }
  proof?: {
    heading: string
    metrics?: ProofMetric[]
    badges?: ProofBadge[]
    testimonial?: ProofTestimonial
  }
  related?: {
    heading: string
    links: RelatedLink[]
  }
  faq?: {
    heading: string
    items: FaqItem[]
  }
  bottomCta?: {
    heading: string
    subheading: string
    primaryCta: { label: string; href: string }
    secondaryCta?: { label: string; href: string }
  }
  navSlot?: ReactNode
}
