export function csvText(rows: (string | number | null | undefined)[][]) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    let text = typeof value === 'number' ? String(value).replace('.', ',') : String(value ?? '')
    if (typeof value !== 'number' && /^[\s]*[=+\-@]|^[\t\r]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }).join(';')).join('\r\n')
}
export function downloadCsv(filename: string, rows: Parameters<typeof csvText>[0]) {
  const url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
