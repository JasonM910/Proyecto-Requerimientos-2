// Clases completas para que Tailwind detecte cada color de data/db.json.
export const categoryStyles = {
  blue: 'bg-category-blue text-category-blue-foreground',
  yellow: 'bg-category-yellow text-category-yellow-foreground',
  purple: 'bg-category-purple text-category-purple-foreground',
  green: 'bg-category-green text-category-green-foreground',
  orange: 'bg-category-orange text-category-orange-foreground',
  pink: 'bg-category-pink text-category-pink-foreground',
  gray: 'bg-category-gray text-category-gray-foreground',
}

export function categoryStyle(color) {
  return categoryStyles[color] || categoryStyles.gray
}
