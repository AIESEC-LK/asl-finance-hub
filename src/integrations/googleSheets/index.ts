/**
 * Google Sheets Integration - Public API
 */

export { fetchSheetData, fetchSheetDataMultiple, getSheetMetadata } from "./client";
export { mapSheetRowToMetric, mapSheetRowToRevenueStreams, autoDetectColumns, DEFAULT_CONFIG } from "./mapper";
export { syncSheetData, createSyncEndpoint } from "./sync";
export type { MapperConfig } from "./mapper";
export type { SyncResult } from "./sync";
