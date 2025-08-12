/**
 * SPFM Routes - Google Apps Script for Secure Inventory Management
 *
 * This script provides secure API endpoints for inventory operations
 * without exposing API keys to the frontend.
 *
 * SETUP INSTRUCTIONS:
 * 1. Open Google Apps Script (script.google.com)
 * 2. Create new project
 * 3. Replace Code.gs with this content
 * 4. Deploy as web app with these settings:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the web app URL and replace YOUR_SCRIPT_ID in inventory.js
 */

// Configuration - Update with your spreadsheet ID
const SPREADSHEET_ID = '1yn3yPWW5ThhPvHzYiSkwwNztVnAQLD2Rk_QEQJwlr2k';

/**
 * Main entry point for web app requests
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    switch (action) {
      case 'getInventory':
        return getInventory();
      default:
        return createResponse(false, 'Invalid action', null);
    }
  } catch (error) {
    console.error('Error in doGet:', error);
    return createResponse(false, error.toString(), null);
  }
}

/**
 * Handle POST requests for data updates
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    switch (action) {
      case 'updateInventory':
        return updateInventory(data);
      default:
        return createResponse(false, 'Invalid action', null);
    }
  } catch (error) {
    console.error('Error in doPost:', error);
    return createResponse(false, error.toString(), null);
  }
}

/**
 * Get current inventory data from the Inventory sheet
 */
function getInventory() {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Inventory');

    if (!sheet) {
      return createResponse(false, 'Inventory sheet not found', null);
    }

    // Get data from row 2 (assuming row 1 has headers)
    const range = sheet.getRange('A2:E2');
    const values = range.getValues();

    if (values.length === 0 || !values[0]) {
      return createResponse(false, 'No inventory data found', null);
    }

    const row = values[0];
    const inventoryData = {
      smallBoxes: parseInt(row[0]) || 0,
      largeBoxes: parseInt(row[1]) || 0,
      lastUpdated: row[2] || '',
      updatedBy: row[3] || '',
      timestamp: row[4] || ''
    };

    console.log('Successfully retrieved inventory:', inventoryData);
    return createResponse(true, 'Inventory retrieved successfully', inventoryData);

  } catch (error) {
    console.error('Error getting inventory:', error);
    return createResponse(false, error.toString(), null);
  }
}

/**
 * Update inventory data in the Inventory sheet
 */
function updateInventory(data) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Inventory');

    if (!sheet) {
      return createResponse(false, 'Inventory sheet not found', null);
    }

    // Prepare the data row
    const newData = [
      parseInt(data.smallBoxes) || 0,
      parseInt(data.largeBoxes) || 0,
      data.lastUpdated || '',
      data.updatedBy || '',
      data.timestamp || new Date().toISOString()
    ];

    // Update row 2 with the new data
    const range = sheet.getRange('A2:E2');
    range.setValues([newData]);

    // Log the update
    console.log('Inventory updated:', {
      smallBoxes: newData[0],
      largeBoxes: newData[1],
      updatedBy: newData[3],
      timestamp: newData[4]
    });

    return createResponse(true, 'Inventory updated successfully', {
      smallBoxes: newData[0],
      largeBoxes: newData[1],
      lastUpdated: newData[2],
      updatedBy: newData[3],
      timestamp: newData[4]
    });

  } catch (error) {
    console.error('Error updating inventory:', error);
    return createResponse(false, error.toString(), null);
  }
}

/**
 * Create standardized response object
 */
function createResponse(success, message, data) {
  const response = {
    success: success,
    message: message,
    data: data,
    timestamp: new Date().toISOString()
  };

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function for development - can be run from Apps Script editor
 */
function testGetInventory() {
  const result = getInventory();
  console.log('Test result:', result.getContent());
}

/**
 * Test function for development - can be run from Apps Script editor
 */
function testUpdateInventory() {
  const testData = {
    action: 'updateInventory',
    smallBoxes: 150,
    largeBoxes: 75,
    lastUpdated: 'Monday, Aug 11, 2025, 08:00 PM',
    updatedBy: 'Test User',
    timestamp: new Date().toISOString()
  };

  const result = updateInventory(testData);
  console.log('Test update result:', result.getContent());
}

/**
 * Initialize the inventory sheet if it doesn't exist
 * Run this once after setting up the script
 */
function initializeInventorySheet() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = spreadsheet.getSheetByName('Inventory');

    if (!sheet) {
      // Create the sheet if it doesn't exist
      sheet = spreadsheet.insertSheet('Inventory');
      console.log('Created Inventory sheet');
    }

    // Set up headers if the sheet is empty
    const range = sheet.getRange('A1:E1');
    const headers = [['Small Boxes', 'Large Boxes', 'Last Updated', 'Updated By', 'Timestamp']];
    range.setValues(headers);

    // Set up initial data if row 2 is empty
    const dataRange = sheet.getRange('A2:E2');
    const existingData = dataRange.getValues();

    if (!existingData[0] || !existingData[0][0]) {
      const initialData = [
        [0, 0, 'Never', 'System', new Date().toISOString()]
      ];
      dataRange.setValues(initialData);
      console.log('Initialized inventory with default values');
    }

    console.log('Inventory sheet initialization complete');

  } catch (error) {
    console.error('Error initializing inventory sheet:', error);
  }
}
