export const COURSES = [
  'HEALTHCARE ASSISTANT',
  'PROFESSIONAL CLEANING & DOMESTIC SERVICE',
  'WAREHOUSING & LOGISTICS',
] as const

export const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple choice (pick one)' },
  { value: 'true_false', label: 'True / False' },
  { value: 'yes_no', label: 'Yes / No' },
] as const

export type QuestionType = (typeof QUESTION_TYPES)[number]['value']

export function questionTypeLabel(type?: string) {
  return QUESTION_TYPES.find((t) => t.value === type)?.label || 'Multiple choice'
}

export function defaultOptionsForType(type: QuestionType): string[] {
  if (type === 'true_false') return ['True', 'False']
  if (type === 'yes_no') return ['Yes', 'No']
  return ['', '']
}
