const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Google API Auth
const auth = new google.auth.GoogleAuth({
  keyFile: 'nmb-edi-project-timeline-08fa9df1454e.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
});

const TEMPLATE_SPREADSHEET_ID = '1fRoDmMx8ZZzIyIvy3Ee72zmMnHMS8LRFi9zPODV4ej8'; // Replace with your template's sheet ID
const DESTINATION_FOLDER_ID = 'YOUR_GOOGLE_DRIVE_FOLDER_ID'; // Optional

app.post('/generate', async (req, res) => {
  try {
    const client = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: client });
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Copy the template
    const copy = await drive.files.copy({
      fileId: 1fRoDmMx8ZZzIyIvy3Ee72zmMnHMS8LRFi9zPODV4ej8,
      requestBody: {
        name: `EDI Plan - ${req.body.customerName}`,
        parents: DESTINATION_FOLDER_ID ? [DESTINATION_FOLDER_ID] : undefined
      }
    });

    const newSheetId = copy.data.id;

    // You can now fill in metadata or phases
    // Example: write customer name
    await sheets.spreadsheets.values.update({
      spreadsheetId: newSheetId,
      range: 'Sheet1!C3', // adjust based on your template
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[req.body.customerName]]
      }
    });

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}`;
    res.json({ sheetUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
