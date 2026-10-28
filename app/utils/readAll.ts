// Avanza por las filas recibidas, incluso si el servidor aplica un límite menor.
export async function readAll<T>(page: (offset: number, size: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 500): Promise<T[]> {
  const rows: T[] = []
  for (;;) {
    const result = await page(rows.length, size)
    if (result.error) throw result.error
    if (!result.data?.length) return rows
    rows.push(...result.data)
  }
}
