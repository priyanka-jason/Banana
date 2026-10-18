import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import {
  productImage,
  productImageName,
  sizeSlug,
} from '../src/lib/productImages.ts'
import {
  PRODUCT_IMAGE_KEYS,
  PRODUCT_IMAGE_SIZES,
} from '../src/data/productImages.ts'

test('a pack size with its own picture gets it; other sizes use the main picture', () => {
  assert.equal(
    productImage('sim-milk-2-4l', '2 x 4 L'),
    '/images/products/milk-2-4l--2x4-l-480.webp',
  )
  assert.equal(
    productImage('sim-milk-2-4l', '4 L'),
    '/images/products/milk-2-4l-480.webp',
  )
  assert.equal(
    productImage('sim-toilet-paper', '40 rolls'),
    '/images/products/toilet-paper--40-rolls-480.webp',
  )
  assert.equal(
    productImage('sim-chicken-breast', 'per kg'),
    '/images/products/chicken-breast-480.webp',
  )
  assert.equal(productImage('sim-bananas'), '/images/products/bananas-480.webp')
})

test('unknown products get no picture, so the placeholder shows', () => {
  assert.equal(productImage('unknown', '1 kg'), '')
  assert.equal(productImage('real-sku-123'), '')
})

test('size names match the picture files', () => {
  assert.equal(sizeSlug('2 x 4 L'), '2x4-l')
  assert.equal(sizeSlug('1.36 kg'), '1_36-kg')
  assert.equal(sizeSlug('24 x 500 ml'), '24x500-ml')
  assert.equal(
    productImageName('/images/products/milk-2-4l-480.webp'),
    'milk-2-4l',
  )
  assert.equal(productImageName('/images/milk.webp'), undefined)
})

test('every listed picture exists in both formats and both widths', () => {
  const names = [
    ...PRODUCT_IMAGE_KEYS,
    ...Object.entries(PRODUCT_IMAGE_SIZES).flatMap(([key, sizes]) =>
      sizes.map((size) => `${key}--${size}`),
    ),
  ]
  assert.equal(names.length, 114)
  for (const name of names)
    for (const file of [
      `${name}-240.avif`,
      `${name}-480.avif`,
      `${name}-240.webp`,
      `${name}-480.webp`,
    ])
      assert.ok(
        existsSync(
          new URL(`../public/images/products/${file}`, import.meta.url),
        ),
        file,
      )
})
