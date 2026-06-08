function normalizeCourseInput(str: string) {
  return String(str || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim()
}

const COURSE_LABELS: Record<string, string> = {
  'health care assistant': 'Healthcare Assistant',
  'healthcare assistant': 'Healthcare Assistant',
  'professional cleaning and domestic service': 'Professional Cleaning & Domestic Services',
  'professional cleaning and domestic services': 'Professional Cleaning & Domestic Services',
  'warehousing and logistics': 'Warehousing & Logistics',
}

export function titleCase(str: string) {
  return String(str || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function formatCourse(str: string) {
  const key = normalizeCourseInput(str)
  if (COURSE_LABELS[key]) return COURSE_LABELS[key]
  return titleCase(str)
}
