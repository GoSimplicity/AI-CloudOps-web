/** RFC 4180 quoting plus spreadsheet formula injection protection. */
export function encodeCsv(rows: unknown[][]): string {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            const text = value == null ? '' : String(value);
            const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text)
              ? `'${text}`
              : text;
            return `"${safe.replaceAll('"', '""')}"`;
          })
          .join(','),
      )
      .join('\r\n')
  );
}

export function downloadCsv(filename: string, rows: unknown[][]): void {
  const url = URL.createObjectURL(
    new Blob([encodeCsv(rows)], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
