import { describe, expect, it } from 'vitest';
import { mapToSharedCategory, type CategoryMap } from './categoryMap';

describe('mapToSharedCategory', () => {
  it('guesses from keywords when the map has no entry', () => {
    expect(mapToSharedCategory('walmart', ['Meat & Seafood', 'Fish'], {})).toEqual({ category: 'seafood', how: 'guess' });
  });

  it('tries the most specific name first', () => {
    expect(mapToSharedCategory('walmart', ['Fruits & Vegetables', 'Fresh Vegetables'], {})).toEqual({
      category: 'vegetables',
      how: 'guess',
    });
    expect(mapToSharedCategory('walmart', ['Fruits & Vegetables', 'Fresh Fruit'], {})).toEqual({
      category: 'fruits',
      how: 'guess',
    });
  });

  it('uses the map before guessing, ignoring case and extra spaces', () => {
    const map: CategoryMap = { walmart: { 'fresh fruit': 'snacks' } };
    expect(mapToSharedCategory('walmart', ['Fruits & Vegetables', '  Fresh FRUIT '], map)).toEqual({
      category: 'snacks',
      how: 'map',
    });
  });

  it('falls back to a broader mapped name when the specific one is not mapped', () => {
    const map: CategoryMap = { walmart: { 'meat & seafood': 'meat' } };
    expect(mapToSharedCategory('walmart', ['Meat & Seafood', 'Mystery cut'], map)).toEqual({ category: 'meat', how: 'map' });
  });

  it("does not use another chain's map entries", () => {
    const map: CategoryMap = { costco: { 'fresh fruit': 'snacks' } };
    expect(mapToSharedCategory('walmart', ['Fresh Fruit'], map)).toEqual({ category: 'fruits', how: 'guess' });
  });

  it("returns 'other' when nothing matches", () => {
    expect(mapToSharedCategory('walmart', ['Mystery aisle'], {})).toEqual({ category: 'other', how: 'none' });
    expect(mapToSharedCategory('walmart', [], {})).toEqual({ category: 'other', how: 'none' });
  });

  it('is not confused by names that look like JavaScript built-ins', () => {
    const map: CategoryMap = { walmart: {} };
    expect(mapToSharedCategory('walmart', ['constructor', '__proto__', 'toString'], map)).toEqual({
      category: 'other',
      how: 'none',
    });
    expect(mapToSharedCategory('constructor', ['Mystery'], map)).toEqual({ category: 'other', how: 'none' });
  });
});
