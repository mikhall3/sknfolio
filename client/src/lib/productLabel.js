export function productLabel(product) {
  if (!product) return ''
  return product.brand ? `${product.brand} ${product.name}` : product.name
}
