# Secure Inventory Management Setup Guide

This guide shows how to set up secure Google Sheets inventory updates using Google Apps Script, keeping your API keys safe.

## 🔒 Security Approach

Instead of exposing API keys in the frontend, we use Google Apps Script as a secure backend that handles all Google Sheets operations internally.

**Benefits:**
- ✅ No API keys exposed to users
- ✅ Server-side execution within Google's infrastructure  
- ✅ Automatic authentication using your Google account
- ✅ Free and reliable

## 📋 Setup Instructions

### Step 1: Create Google Apps Script

1. **Open Google Apps Script**
   - Go to [script.google.com](https://script.google.com)
   - Click "New project"

2. **Replace the default code**
   - Delete everything in `Code.gs`
   - Copy and paste the entire content from `google-apps-script.js` in this repository

3. **Update the Spreadsheet ID**
   - Find this line: `const SPREADSHEET_ID = '1yn3yPWW5ThhPvHzYiSkwwNztVnAQLD2Rk_QEQJwlr2k';`
   - Replace with your actual spreadsheet ID (found in the Google Sheets URL)

4. **Save the project**
   - Click 💾 Save
   - Give it a name like "SPFM Inventory Manager"

### Step 2: Deploy as Web App

1. **Click Deploy**
   - Click "Deploy" button (top right)
   - Choose "New deployment"

2. **Configure deployment settings**
   - **Type**: Web app
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone
   - **Description**: "SPFM Inventory API"

3. **Authorize the app**
   - Click "Deploy"
   - Click "Authorize access" 
   - Choose your Google account
   - Click "Advanced" → "Go to [project name] (unsafe)" if warned
   - Click "Allow"

4. **Copy the Web App URL**
   - Copy the URL that looks like:
   ```
   https://script.google.com/macros/s/ABC123xyz789/exec
   ```
   - You'll need this for Step 3

### Step 3: Update Frontend Code

1. **Open `/js/inventory.js`**

2. **Find this line** (around line 156):
   ```javascript
   const APPS_SCRIPT_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";
   ```

3. **Replace YOUR_SCRIPT_ID** with your actual script ID from the URL you copied:
   ```javascript
   const APPS_SCRIPT_URL = "https://script.google.com/macros/s/ABC123xyz789/exec";
   ```

4. **Find the second occurrence** (around line 198) and update it the same way.

### Step 4: Initialize Inventory Sheet

1. **Go back to Google Apps Script**

2. **Run the initialization function**
   - In the function dropdown, select `initializeInventorySheet`
   - Click ▶️ Run
   - This creates the Inventory sheet if it doesn't exist and sets up headers

3. **Verify the setup**
   - Check your Google Sheets - you should see an "Inventory" tab
   - It should have headers: Small Boxes, Large Boxes, Last Updated, Updated By, Timestamp

## 🧪 Testing

### Test from Apps Script Editor

1. **Test getting inventory**
   - Select `testGetInventory` function
   - Click ▶️ Run
   - Check the logs (View → Logs) for results

2. **Test updating inventory**
   - Select `testUpdateInventory` function  
   - Click ▶️ Run
   - Check your Inventory sheet to see if values changed

### Test from Web App

1. **Test GET request** (in browser):
   ```
   https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=getInventory
   ```
   - Should return JSON with current inventory

2. **Test POST request** (use tool like Postman):
   ```
   POST: https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   Content-Type: application/json
   
   {
     "action": "updateInventory",
     "smallBoxes": 100,
     "largeBoxes": 50,
     "lastUpdated": "Test Update",
     "updatedBy": "Test User"
   }
   ```

## 🔧 Troubleshooting

### "Script not found" error
- Check that the Web App URL is correct
- Make sure the script is deployed (not just saved)

### "Permission denied" error  
- Re-run the authorization process
- Make sure "Execute as: Me" is selected
- Check that your Google account has access to the spreadsheet

### "Sheet not found" error
- Run `initializeInventorySheet` function
- Verify the Inventory sheet exists in your spreadsheet
- Check that the SPREADSHEET_ID is correct

### Data not updating
- Check the Google Apps Script logs (View → Logs)
- Verify the sheet range (A2:E2) matches your data layout
- Make sure the Inventory sheet has the correct headers

## 🔄 How It Works

1. **Frontend** calls Apps Script URL (no API key needed)
2. **Apps Script** authenticates using your Google account automatically
3. **Apps Script** reads/writes Google Sheets directly
4. **Apps Script** returns JSON response to frontend
5. **Frontend** updates local storage and displays results

## 📊 Data Format

The Inventory sheet uses this format:

| Column | Description |
|--------|-------------|
| A | Small Boxes (number) |
| B | Large Boxes (number) |  
| C | Last Updated (timestamp) |
| D | Updated By (name) |
| E | System Timestamp (ISO string) |

Row 1: Headers  
Row 2: Current inventory data

## 🔐 Security Notes

- ✅ **API keys never exposed** to frontend users
- ✅ **Apps Script runs server-side** within Google's secure infrastructure
- ✅ **Authentication handled automatically** by Google
- ✅ **HTTPS encryption** for all communications
- ✅ **Access controls** managed through Google Apps Script permissions

This approach is much more secure than embedding API keys in frontend JavaScript!