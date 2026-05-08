export const LANGUAGES = [
  { id: 'html',   label: 'HTML',   color: '#e34c26', desc: 'The building blocks of web pages' },
  { id: 'css',    label: 'CSS',    color: '#264de4', desc: 'Make web pages look beautiful' },
  { id: 'python', label: 'Python', color: '#3572A5', desc: 'Automate, build scripts, work with data' },
]

export const CONCEPTS_BY_LANGUAGE = {
  html: [
    'Headings and paragraphs',
    'Links and images',
    'Lists (ordered and unordered)',
    'Forms and inputs',
    'Divs and spans',
    'Tables',
    'Semantic elements',
    'HTML structure (head and body)',
  ],
  css: [
    'Selectors',
    'Colors and backgrounds',
    'Fonts and text',
    'Box model (padding, margin, border)',
    'Flexbox layout',
    'Width and height',
    'Classes and IDs',
    'Hover effects',
  ],
  python: [
    'Variables',
    'Print and input',
    'Numbers and math',
    'Strings',
    'Lists',
    'If and else',
    'Loops (for and while)',
    'Functions',
  ],
}

export const GOALS = [
  { label: 'Build a simple web page',       language: 'html',   concept: 'HTML structure (head and body)' },
  { label: 'Add links and images to HTML',   language: 'html',   concept: 'Links and images' },
  { label: 'Create an HTML form',            language: 'html',   concept: 'Forms and inputs' },
  { label: 'Style a card layout',            language: 'css',    concept: 'Box model (padding, margin, border)' },
  { label: 'Center things with Flexbox',     language: 'css',    concept: 'Flexbox layout' },
  { label: 'Change colors and fonts',        language: 'css',    concept: 'Fonts and text' },
  { label: 'Learn Python for beginners',     language: 'python', concept: 'Variables' },
  { label: 'Write a simple Python script',   language: 'python', concept: 'Print and input' },
  { label: 'Work with lists in Python',      language: 'python', concept: 'Lists' },
]
