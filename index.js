const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());


// Load credentials from base64
const base64 = process.env.GOOGLE_CREDENTIALS_BASE64;
if (!base64) throw new Error('Missing GOOGLE_CREDENTIALS_BASE64 env variable');

let credentials;
try {
  credentials = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
} catch (err) {
  throw new Error('Failed to load Google credentials: ' + err.message);
}

// Google Auth
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ]
});



const TEMPLATE_SPREADSHEET_ID = '1fRoDmMx8ZZzIyIvy3Ee72zmMnHMS8LRFi9zPODV4ej8';
const DESTINATION_FOLDER_ID = null;

app.post('/generate', async (req, res) => {
  try {
    const client = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: client });
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Copy the template
    const copy = await drive.files.copy({
      fileId: TEMPLATE_SPREADSHEET_ID,
      requestBody: {
        name: `EDI Plan - ${req.body.customerName}`,
        parents: DESTINATION_FOLDER_ID ? [DESTINATION_FOLDER_ID] : undefined
      }
    });

		const newSheetId = copy.data.id;

		// Share the new sheet with 3 users as Editors
		const shareWith = [
		  'pramnath.adibagavane@nmb-minebea.com',
		];

		for (const email of shareWith) {
		  await drive.permissions.create({
			fileId: newSheetId,
			requestBody: {
			  type: 'user',
			  role: 'writer', // 'writer' = Editor access
			  emailAddress: email
			}
		  });
		}

    // Write general project metadata
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: newSheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: 'Sheet1!C3', values: [[req.body.projectTitle]] },
          { range: 'Sheet1!C4', values: [[req.body.customerName]] },
          { range: 'Sheet1!C5', values: [[req.body.contactEmail]] },
          { range: 'Sheet1!C6', values: [[req.body.ticketNumber]] },
          { range: 'Sheet1!C7', values: [[req.body.channel]] },
          { range: 'Sheet1!C8', values: [[req.body.startDate]] },
          { range: 'Sheet1!C9', values: [[req.body.goLiveDate]] },
          { range: 'Sheet1!C10', values: [[req.body.ediDocs]] }
        ]
      }
    });

    // Write all 7 phase details
    const phaseData = [];
    for (let i = 1; i <= 7; i++) {
      phaseData.push([
        req.body[`phase_start_${i}`],
        req.body[`phase_end_${i}`],
        req.body[`phase_owner_${i}`],
        req.body[`phase_status_${i}`],
        req.body[`phase_comment_${i}`]
      ]);
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: newSheetId,
      range: 'Sheet1!C13:G19', // Adjust this to where your phase table begins
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: phaseData
      }
    });

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${newSheetId}`;
    res.json({ sheetUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
