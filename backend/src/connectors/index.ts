import { createCostcoConnector } from './costco';
import { createSaveOnFoodsConnector } from './saveOnFoods';
import type { StoreConnector } from './types';
import { createWalmartConnector } from './walmart';

export type { StoreConnector } from './types';

/**
 * Connectors that currently read made-up sample data.
 * The No Frills and Superstore connectors from the team can be added here too.
 */
export const sampleConnectors: StoreConnector[] = [
  createSaveOnFoodsConnector(),
  createWalmartConnector(),
  createCostcoConnector(),
];
