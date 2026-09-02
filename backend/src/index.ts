import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Chuba Backend with ZK' });
});

app.post('/api/travel-rules', async (req, res) => {
  try {
    const { destination } = req.body;

    if (!destination) {
      return res.status(400).json({ error: 'Missing destination' });
    }

    console.log(`[Chuba] Retrieving rules for destination: ${destination}`);

    // Mock policy database for Demo
    const rulesDb: Record<string, any> = {
      FRA: {
        destination: 'FRA',
        policyVersion: 'FRA-DEMO-v1',
        visaRequired: false,
        allowedNationalities: ['IND', 'USA', 'GBR', 'JPN', 'DEU'],
        minimumPassportValidityDays: 180,
        message: 'France requires 6 months passport validity.'
      },
      JPN: {
        destination: 'JPN',
        policyVersion: 'JPN-DEMO-v1',
        visaRequired: false,
        allowedNationalities: ['IND', 'USA', 'GBR', 'FRA', 'DEU'],
        minimumPassportValidityDays: 180,
        message: 'Japan requires 6 months passport validity. Select nationalities are allowed.'
      },
      USA: {
        destination: 'USA',
        policyVersion: 'USA-DEMO-v1',
        visaRequired: true,
        allowedNationalities: ['GBR', 'FRA', 'DEU'], // IND needs a visa in this mock scenario
        minimumPassportValidityDays: 180,
        message: 'USA requires a visa for unlisted nationalities and 6 months validity.'
      },
      IND: {
        destination: 'IND',
        policyVersion: 'IND-DEMO-v1',
        visaRequired: false,
        allowedNationalities: ['USA', 'GBR', 'JPN', 'DEU', 'FRA'],
        minimumPassportValidityDays: 180,
        message: 'India allows select nationalities with 6 months validity.'
      },
      DEU: {
        destination: 'DEU',
        policyVersion: 'DEU-DEMO-v1',
        visaRequired: false,
        allowedNationalities: ['USA', 'GBR', 'JPN', 'FRA', 'IND'],
        minimumPassportValidityDays: 90,
        message: 'Germany allows these nationalities with 3 months validity.'
      },
      GBR: {
        destination: 'GBR',
        policyVersion: 'GBR-DEMO-v1',
        visaRequired: false,
        allowedNationalities: ['USA', 'JPN', 'FRA', 'DEU'], // IND needs a visa here
        minimumPassportValidityDays: 180,
        message: 'UK allows these nationalities with 6 months validity.'
      },
      FRA: {
        destination: 'FRA',
        policyVersion: 'FRA-DEMO-v1',
        visaRequired: false,
        allowedNationalities: ['IND', 'USA', 'GBR', 'JPN', 'DEU'],
        minimumPassportValidityDays: 90,
        message: 'France allows these nationalities with 3 months validity.'
      }
    };

    const rules = rulesDb[destination];

    if (!rules) {
      return res.status(404).json({ error: 'Rules not found for this destination' });
    }

    const response = {
      ...rules,
      source: 'mock',
      timestamp: new Date().toISOString(),
    };

    res.json(response);

  } catch (error: any) {
    console.error('[Chuba] Error:', error.message);
    res.status(500).json({
      error: 'Failed to verify eligibility',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`[Chuba] Backend running on http://localhost:${PORT}`);
  console.log(`[Chuba] Midnight ZK Contract: Simulated mode`);
});
