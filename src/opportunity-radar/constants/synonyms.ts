/** Applied to raw text BEFORE tokenisation — replaces multi-word phrases with a single token */
export const PHRASE_SYNONYMS: Record<string, string> = {
  'google sheets':   'spreadsheet',
  'microsoft excel': 'spreadsheet',
  'takes forever':   'slow',
  'not working':     'broken',
  "doesn't work":    'broken',
  "can't afford":    'costly',
  'copy paste':      'manual',
  'by hand':         'manual',
}

/** Applied to individual tokens AFTER tokenisation */
export const TOKEN_SYNONYMS: Record<string, string> = {
  'hate':       'dislike',
  'terrible':   'bad',
  'awful':      'bad',
  'frustrated': 'annoyed',
  'annoying':   'annoyed',
  'nightmare':  'bad',
  'excel':      'spreadsheet',
  'sheets':     'spreadsheet',
  'laggy':      'slow',
  'slow':       'slow',
  'broken':     'broken',
  'overpriced': 'costly',
  'expensive':  'costly',
  'manual':     'manual',
}
