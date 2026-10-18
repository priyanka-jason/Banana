import { BasketIcon } from '@phosphor-icons/react/dist/csr/Basket'
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
  return src ? (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading="lazy"
    />
  ) : (
    <span
      className={`product-placeholder ${className}`}
      role={alt ? 'img' : undefined}
      aria-label={alt ? `${alt}: image unavailable` : undefined}
      aria-hidden={!alt}
    >
      <BasketIcon size={40} aria-hidden="true" />
    </span>
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
