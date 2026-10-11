// Las áreas y sus categorías proceden del catálogo guardado en el JSON.
export function groupCategories(categories) {
  const groups = new Map()
  for (const category of categories) {
    const name = category.group || 'Otros servicios'
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(category)
  }
  return [...groups].map(([name, categories]) => ({ name, categories }))
}
