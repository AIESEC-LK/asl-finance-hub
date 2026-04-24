/**
 * Google Sheets API v4 Client
 * 
 * Setup required:
 * 1. Create API key: https://console.cloud.google.com/apis/credentials
 * 2. Enable Google Sheets API
 * 3. Add VITE_GOOGLE_SHEETS_API_KEY to .env
 */

interface SheetRange {
  values: any[][];
}

/**
 * Fetch raw data from Google Sheet by range
 * @param spreadsheetId - The sheet ID
 * @param range - A1 notation (e.g., "Sheet1!A1:Z1000")
 * @returns Array of rows
 */
export async function fetchSheetData(
  spreadsheetId: string,
  range: string
): Promise<any[][]> {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VITE_GOOGLE_SHEETS_API_KEY not found in .env. Please add your Google Sheets API key."
    );
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  
  try {
    const response = await fetch(`${url}?key=${apiKey}`);
    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.statusText}`);
    }

    const data: SheetRange = await response.json();
    return data.values || [];
  } catch (error) {
    console.error("Failed to fetch sheet data:", error);
    throw error;
  }
}

/**
 * Fetch multiple ranges from same sheet
 * @param spreadsheetId - The sheet ID
 * @param ranges - Array of A1 notation ranges
 * @returns Map of range -> rows
 */
export async function fetchSheetDataMultiple(
  spreadsheetId: string,
  ranges: string[]
): Promise<Map<string, any[][]>> {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GOOGLE_SHEETS_API_KEY not found in .env");
  }

  const rangesParam = ranges.map(r => encodeURIComponent(r)).join("&ranges=");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=${rangesParam}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = new Map<string, any[][]>();

    data.valueRanges?.forEach((range: any, index: number) => {
      result.set(ranges[index], range.values || []);
    });

    return result;
  } catch (error) {
    console.error("Failed to fetch multiple sheet ranges:", error);
    throw error;
  }
}

/**
 * Get sheet metadata (sheet names, grid properties)
 */
export async function getSheetMetadata(spreadsheetId: string) {
  const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GOOGLE_SHEETS_API_KEY not found in .env");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Sheets API error: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch sheet metadata:", error);
    throw error;
  }
}
