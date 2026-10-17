import { describe, expect, it } from 'vitest';
import { distanceKm, isValidLatLng } from './geo';

describe('distanceKm', () => {
  it('is zero between a point and itself', () => {
    expect(distanceKm({ lat: 49.28, lng: -123.12 }, { lat: 49.28, lng: -123.12 })).toBe(0);
  });

  it('is the same in both directions', () => {
    const a = { lat: 49.2827, lng: -123.1207 };
    const b = { lat: 49.2488, lng: -122.9805 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 9);
  });

  it('gives about 111 km for one degree of latitude', () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });

  it('gives a sensible Metro Vancouver distance (downtown to Burnaby, roughly 11 km)', () => {
    const km = distanceKm({ lat: 49.2827, lng: -123.1207 }, { lat: 49.2488, lng: -122.9805 });
    expect(km).toBeGreaterThan(10.6);
    expect(km).toBeLessThan(11.1);
  });

  it('goes the short way across the 180 degree line', () => {
    expect(distanceKm({ lat: 0, lng: 179 }, { lat: 0, lng: -179 })).toBeCloseTo(222.39, 0);
  });

  it('gives half the way round the Earth for opposite points', () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(20015, 0);
  });
});

describe('isValidLatLng', () => {
  it('accepts points on Earth, including the edges', () => {
    expect(isValidLatLng(0, 0)).toBe(true);
    expect(isValidLatLng(49.28, -123.12)).toBe(true);
    expect(isValidLatLng(90, 180)).toBe(true);
    expect(isValidLatLng(-90, -180)).toBe(true);
  });

  it('rejects points off Earth', () => {
    expect(isValidLatLng(90.1, 0)).toBe(false);
    expect(isValidLatLng(0, -180.1)).toBe(false);
  });

  it('rejects things that are not real numbers', () => {
    expect(isValidLatLng(Number.NaN, 0)).toBe(false);
    expect(isValidLatLng(0, Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidLatLng('49.28', '-123.12')).toBe(false);
    expect(isValidLatLng(undefined, 0)).toBe(false);
    expect(isValidLatLng(null, null)).toBe(false);
  });
});
