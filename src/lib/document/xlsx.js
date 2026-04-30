// Excel .xls / .xlsx extraction via SheetJS. Each sheet renders as a CSV-ish
// block under a "## Sheet: <name>" header so the LLM can tell sheets apart.

export async function extractXlsx(file) {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const blocks = wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name]
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    return `## Sheet: ${name}\n\n${csv.trim()}`
  })
  return blocks.filter((b) => b.split('\n\n')[1]).join('\n\n').trim()
}
