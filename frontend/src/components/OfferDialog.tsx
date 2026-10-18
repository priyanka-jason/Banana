import { useEffect, useRef } from 'react'
import { ArrowSquareOutIcon } from '@phosphor-icons/react/dist/csr/ArrowSquareOut'
import { XIcon } from '@phosphor-icons/react/dist/csr/X'
import { currency, isDiscounted } from '../lib/catalogue'
import { Expiry, Merchant, Price, MissingOfferData } from './Offer'
import { ProductImage } from './ProductImage'
import type { NearbyOffer } from '../types'

export function OfferDialog({
  offer,
  onClose,
}: {
  offer: NearbyOffer
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className="offer-dialog"
      aria-labelledby="offer-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="dialog-inner">
        <button
          className="icon-button dialog-close"
          aria-label="Close offer"
          onClick={onClose}
        >
          <XIcon size={23} />
        </button>
        <p className="dialog-kicker">
          {offer.source
            ? offer.simulated
              ? 'Simulated grocery offer'
              : 'Grocery offer'
            : 'Grocery offer'}
        </p>
        <ProductImage
          className="dialog-product-image"
          src={offer.image}
          alt={offer.name}
          width={240}
          height={200}
        />
        <h2 id="offer-title">{offer.name}</h2>
        <p className="pack">{offer.pack}</p>
        <MissingOfferData offer={offer} />
        <Price offer={offer} />
        <p className="unit-price">{offer.unitPrice}</p>
        {isDiscounted(offer) ? (
          <p className="offer-saving">
            Save {currency(offer.regularPrice! - offer.price)} on this offer
          </p>
        ) : null}
        <Merchant offer={offer} />
        <Expiry offer={offer} />
        <p className="sample-explanation">
          {offer.source
            ? offer.simulated
              ? 'This price is simulated demo data stored in Supabase. Check the store for current prices and availability.'
              : 'Price information comes from the shared catalogue. Check the store for current availability.'
            : 'This is a sample offer for exploring Banana. Prices, distances and availability are illustrative.'}
        </p>
        {offer.sourceUrl && (
          <a
            className="flyer-button store-link"
            href={offer.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View source / flyer{' '}
            <ArrowSquareOutIcon size={18} aria-hidden="true" />
          </a>
        )}
        {!offer.store.website && (
          <p className="missing-backend">Missing backend: store website link</p>
        )}
        {offer.store.website && (
          <a
            className="flyer-button store-link"
            href={offer.store.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit store website{' '}
            <ArrowSquareOutIcon size={18} aria-hidden="true" />
          </a>
        )}
      </div>
    </dialog>
  )
}
