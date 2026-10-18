import { BasketIcon } from '@phosphor-icons/react/dist/csr/Basket'
import { productImageName } from '../lib/productImages.ts'
export function ProductImage({
  src,
  alt = '',
  className = '',
  width = 100,
  height = 100,
}: {
  src: string
  alt?: string
  className?: string
  width?: number
  height?: number
}) {
  if (!src)
    return (
      <span
        className={`product-placeholder ${className}`}
        role={alt ? 'img' : undefined}
        aria-label={alt ? `${alt}: image unavailable` : undefined}
        aria-hidden={!alt}
      >
        <BasketIcon size={40} aria-hidden="true" />
      </span>
    )
  const img = (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
    />
  )
  // Product pictures come in AVIF and WebP at 240 and 480 px: the browser takes the first
  // format it supports and the width that suits the screen.
  const name = productImageName(src)
  if (!name) return img
  const base = `/images/products/${name}`
  return (
    <picture style={{ display: 'contents' }}>
      <source
        type="image/avif"
        srcSet={`${base}-240.avif 240w, ${base}-480.avif 480w`}
        sizes="240px"
      />
      <source
        type="image/webp"
        srcSet={`${base}-240.webp 240w, ${base}-480.webp 480w`}
        sizes="240px"
      />
      {img}
    </picture>
  )
}
export function StoreLogo({ src, name }: { src: string; name: string }) {
  return src ? (
    <img src={src} alt="" width="44" height="44" />
  ) : (
    <span className="store-initials" aria-label={name}>
      {name.slice(0, 2)}
    </span>
  )
}
