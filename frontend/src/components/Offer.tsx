import { ArrowSquareOutIcon } from '@phosphor-icons/react/dist/csr/ArrowSquareOut'
import { CaretRightIcon } from '@phosphor-icons/react/dist/csr/CaretRight'
import { currency, isDiscounted } from '../lib/catalogue'
import { ProductImage, StoreLogo } from './ProductImage'
import type { NearbyOffer } from '../types'
import { AddToListButton } from './ShoppingList'

export function MissingOfferData({ offer }: { offer: NearbyOffer }) {
  if (!offer.missingFields?.length) return null
  return (
    <small className="missing-backend">
      Missing backend: {offer.missingFields.join(' · ')}
    </small>
  )
}

export function Price({ offer }: { offer: NearbyOffer }) {
  return (
    <div className={`price-line ${isDiscounted(offer) ? 'on-sale' : ''}`}>
      <strong>{currency(offer.price)}</strong>
      {isDiscounted(offer) ? (
        <del aria-label={`Regular price ${currency(offer.regularPrice!)}`}>
          {currency(offer.regularPrice!)}
        </del>
      ) : null}
    </div>
  )
}

export function Merchant({
  offer,
  compact = false,
}: {
  offer: NearbyOffer
  compact?: boolean
}) {
  return (
    <div className={`merchant ${compact ? 'merchant-compact' : ''}`}>
      <span className={`merchant-logo ${offer.storeId}`}>
        <StoreLogo src={offer.store.logo} name={offer.store.name} />
      </span>
      <div>
        <span className="merchant-name">{offer.store.name}</span>
        <span className="merchant-distance">
          {Number.isFinite(offer.distance)
            ? `${offer.distance.toFixed(1)} km`
            : ''}
        </span>
      </div>
    </div>
  )
}

export function Expiry({ offer }: { offer: NearbyOffer }) {
  return (
    <span className="expiry">
      {isDiscounted(offer) ? (
        offer.saleEnd ? (
          <>
            Valid until{' '}
            <time dateTime={offer.saleEnd!}>
              {new Intl.DateTimeFormat('en-CA', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(`${offer.saleEnd!}T12:00:00Z`))}
            </time>
          </>
        ) : (
          'On sale'
        )
      ) : (
        'Regular price'
      )}
    </span>
  )
}

export function FlyerButton({
  offer,
  onOpen,
}: {
  offer: NearbyOffer
  onOpen: (offer: NearbyOffer) => void
}) {
  return (
    <button
      className="flyer-button"
      onClick={() => onOpen(offer)}
      aria-label={`View ${offer.source ? 'grocery' : isDiscounted(offer) ? 'flyer' : 'regular price'} offer for ${offer.name} at ${offer.store.name}`}
    >
      {offer.source
        ? 'View offer'
        : isDiscounted(offer)
          ? 'View flyer'
          : 'View offer'}{' '}
      <ArrowSquareOutIcon size={18} aria-hidden="true" />
    </button>
  )
}

export function OfferCard({
  offer,
  onOpen,
}: {
  offer: NearbyOffer
  onOpen: (offer: NearbyOffer) => void
}) {
  return (
    <article className="offer-card">
      <button
        className="product-image-button"
        onClick={() => onOpen(offer)}
        aria-label={`View ${offer.name} offer`}
      >
        <ProductImage
          className="product-image"
          src={offer.image}
          alt={offer.name}
          width={300}
          height={230}
        />
      </button>
      <h3>
        <button className="text-button" onClick={() => onOpen(offer)}>
          {offer.name}
        </button>
      </h3>
      <p className="pack">{offer.pack || 'Package size missing'}</p>
      <MissingOfferData offer={offer} />
      <Price offer={offer} />
      <p className="unit-price">{offer.unitPrice}</p>
      <Merchant offer={offer} />
      <Expiry offer={offer} />
      <FlyerButton offer={offer} onOpen={onOpen} />
      <AddToListButton offer={offer} />
    </article>
  )
}

export function OfferTable({
  offers,
  onOpen,
}: {
  offers: NearbyOffer[]
  onOpen: (offer: NearbyOffer) => void
}) {
  return (
    <>
      <table className="offer-table">
        <caption className="sr-only">Grocery offers at nearby stores</caption>
        <thead>
          <tr>
            <th>Product</th>
            <th>Store &amp; distance</th>
            <th>Price</th>
            <th>Unit price</th>
            <th>Offer expiry</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer) => (
            <tr key={offer.id}>
              <td>
                <div className="table-product">
                  <button
                    className="product-image-button"
                    onClick={() => onOpen(offer)}
                    aria-label={`View ${offer.name} at ${offer.store.name}`}
                  >
                    <ProductImage
                      src={offer.image}
                      alt={offer.name}
                      width={100}
                      height={100}
                    />
                  </button>
                  <div>
                    <button
                      className="text-button product-title"
                      onClick={() => onOpen(offer)}
                    >
                      {offer.name}
                    </button>
                    <p className="pack">
                      {offer.pack || 'Package size missing'}
                    </p>
                    <MissingOfferData offer={offer} />
                  </div>
                </div>
              </td>
              <td>
                <Merchant offer={offer} compact />
              </td>
              <td>
                <Price offer={offer} />
              </td>
              <td className="table-unit">{offer.unitPrice}</td>
              <td>
                <Expiry offer={offer} />
              </td>
              <td>
                <div className="table-actions">
                  <FlyerButton offer={offer} onOpen={onOpen} />
                  <AddToListButton offer={offer} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mobile-results">
        {offers.map((offer) => (
          <article className="result-row" key={offer.id}>
            <button
              className="result-open"
              onClick={() => onOpen(offer)}
              aria-label={`${offer.name}, ${currency(offer.price)}, ${offer.store.name}. View offer`}
            >
              <ProductImage
                className="result-image"
                src={offer.image}
                alt=""
                width={100}
                height={100}
              />
              <span className="result-details">
                <strong className="product-title">{offer.name}</strong>
                <span className="pack">
                  {offer.pack || 'Package size missing'}
                </span>
                <MissingOfferData offer={offer} />
                <Price offer={offer} />
                <span className="unit-price">{offer.unitPrice}</span>
                <Merchant offer={offer} compact />
                <Expiry offer={offer} />
              </span>
              <CaretRightIcon
                className="result-chevron"
                size={20}
                aria-hidden="true"
              />
            </button>
            <AddToListButton offer={offer} />
          </article>
        ))}
      </div>
    </>
  )
}
