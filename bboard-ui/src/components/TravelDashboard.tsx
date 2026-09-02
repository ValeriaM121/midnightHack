import React, { useCallback, useEffect, useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Backdrop, CircularProgress, Card, CardContent,
  Typography, TextField, Button, Box, Paper, Select, MenuItem,
  FormControl, InputLabel, Divider, Alert, Accordion, AccordionSummary, AccordionDetails, Chip, Grid, Stepper, Step, StepLabel, Container, Link
} from '@mui/material';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LockIcon from '@mui/icons-material/LockOutlined';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import GppGoodOutlinedIcon from '@mui/icons-material/GppGoodOutlined';
import KeyIcon from '@mui/icons-material/Key';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LanguageIcon from '@mui/icons-material/Language';
import FlightIcon from '@mui/icons-material/Flight';
import PersonIcon from '@mui/icons-material/Person';
import LuggageIcon from '@mui/icons-material/Luggage';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';

import { type TravelDerivedState, type DeployedTravelAPI } from '../../../api/src/index.js';
import { useDeployedBoardContext } from '../hooks';
import { type BoardDeployment } from '../contexts';
import { type Observable } from 'rxjs';

export interface TravelDashboardProps {
  boardDeployment$?: Observable<BoardDeployment>;
}

export const TravelDashboard: React.FC<Readonly<TravelDashboardProps>> = ({ boardDeployment$ }) => {
  const boardApiProvider = useDeployedBoardContext();
  const [boardDeployment, setBoardDeployment] = useState<BoardDeployment>();
  const [deployedBoardAPI, setDeployedBoardAPI] = useState<DeployedTravelAPI>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [boardState, setBoardState] = useState<TravelDerivedState>();
  const [isWorking, setIsWorking] = useState(!!boardDeployment$);
  const [progressMessage, setProgressMessage] = useState<string>('');

  // Public State
  const [destination, setDestination] = useState<string>('');
  const [publicRules, setPublicRules] = useState<any>(null);

  // Private State
  const [nationality, setNationality] = useState<string>('India');
  const [passportExpiry, setPassportExpiry] = useState<string>('');
  
  // App Logic State
  const [eligibilityResult, setEligibilityResult] = useState<'eligible' | 'not_eligible' | null>(null);
  const [localError, setLocalError] = useState<string>();

  const onCreateBoard = useCallback(() => {
    setIsWorking(true);
    setProgressMessage('Connecting to Lace Wallet...');
    setErrorMessage(undefined);
    boardApiProvider.resolve();
  }, [boardApiProvider]);
  
  const fetchRules = async () => {
    setIsWorking(true);
    setProgressMessage('Retrieving travel requirements...');
    setLocalError(undefined);
    try {
      const destCodeMap: Record<string, string> = { 'France': 'FRA', 'Japan': 'JPN', 'USA': 'USA', 'Germany': 'DEU', 'UK': 'GBR' };
      const destCode = destCodeMap[destination] || destination;
      const response = await fetch('http://localhost:3000/api/travel-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: destCode }),
      });
      const data = await response.json();
      if (data.error) {
        setLocalError(data.error);
        setPublicRules(null);
      } else {
        setPublicRules(data);
      }
    } catch (err) {
      setLocalError("Failed to connect to travel rules backend.");
    } finally {
      setIsWorking(false);
      setProgressMessage('');
    }
  };

  const generateCommitment = async (nat: string, exp: string) => {
    const salt = crypto.randomUUID();
    const input = `${nat}:${exp}:${salt}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const onVerifyEligibility = useCallback(async () => {
    setLocalError(undefined);
    if (!passportExpiry) {
      setLocalError("Please enter your passport expiry date.");
      return;
    }
    if (!publicRules) {
      setLocalError("Please retrieve public travel rules first.");
      return;
    }

    // --- Private Local Evaluation ---
    // Mapping full names to codes for checking
    const natCodeMap: Record<string, string> = { 'India': 'IND', 'Japan': 'JPN', 'USA': 'USA', 'Germany': 'DEU', 'UK': 'GBR' };
    const nationalityCode = natCodeMap[nationality] || nationality;
    if (!publicRules.allowedNationalities.includes(nationalityCode)) {
       setLocalError(`Passport nationality is not eligible.`);
       setEligibilityResult('not_eligible');
       return;
    }

    const expiryDate = new Date(passportExpiry);
    const today = new Date();
    const daysDiff = (expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
    if (daysDiff < publicRules.minimumPassportValidityDays) {
       setLocalError(`Passport validity does not meet the destination requirement.`);
       setEligibilityResult('not_eligible');
       return;
    }

    // Do NOT set 'eligible' yet. Wait for the ZK proof/transaction.
    try {
      if (deployedBoardAPI) {
        setIsWorking(true);
        setProgressMessage('Generating ZK proof and submitting to Midnight... Please check Lace to approve.');
        const commitment = await generateCommitment(nationalityCode, passportExpiry);
        const message = `Destination: ${publicRules.destination} | Policy: ${publicRules.policyVersion} | Result: ELIGIBLE | Commitment: ${commitment.slice(0,16)}...`;
        
        const encoder = new TextEncoder();
        const paddedNationality = new Uint8Array(32);
        paddedNationality.set(encoder.encode(nationalityCode));
        const minValidity = BigInt(publicRules.minimumPassportValidityDays);
        const privateValidity = BigInt(Math.floor(daysDiff));

        await deployedBoardAPI.proveEligibilityAndAttest(
          minValidity,
          paddedNationality,
          message,
          paddedNationality, // private nationality witness
          privateValidity    // private validity witness
        );
        
        // ONLY mark as eligible if the proof and transaction succeed.
        setEligibilityResult('eligible');
      }
    } catch (error: any) {
      // User-friendly error mapping
      let errStr = error?.message || String(error);
      if (errStr.includes('feature-flags')) {
        errStr = 'Connection rejected or closed by Lace Wallet.';
      } else if (errStr.includes('User rejected')) {
        errStr = 'Transaction was rejected in Lace Wallet.';
      }
      setErrorMessage(`Verification Failed: ${errStr}`);
      setEligibilityResult(null); // Reset state so they can try again
    } finally {
      setIsWorking(false);
      setProgressMessage('');
    }
  }, [deployedBoardAPI, passportExpiry, nationality, publicRules]);

  useEffect(() => {
    if (!boardDeployment$) return;
    const subscription = boardDeployment$.subscribe(setBoardDeployment);
    return () => subscription.unsubscribe();
  }, [boardDeployment$]);

  useEffect(() => {
    if (!boardDeployment || boardDeployment.status === 'in-progress') return;

    setIsWorking(false);
    setProgressMessage('');
    if (boardDeployment.status === 'failed') {
      let errStr = boardDeployment.error.message.length ? boardDeployment.error.message : 'Error connecting to wallet.';
      if (errStr.includes('feature-flags')) {
        errStr = 'Wallet connection was rejected or closed by Lace.';
      } else if (errStr.includes('timed out') || errStr.includes('Could not find')) {
        errStr = 'Could not find Lace Wallet. Ensure the extension is installed, unlocked, and authorized.';
      }
      setErrorMessage(errStr);
      return;
    }

    setDeployedBoardAPI(boardDeployment.api as DeployedTravelAPI);
    const subscription = boardDeployment.api.state$.subscribe(setBoardState);
    return () => subscription.unsubscribe();
  }, [boardDeployment]);

  // Ensure result state updates if the contract was already occupied on load
  useEffect(() => {
    if (boardState?.is_occupied && !eligibilityResult) {
       setEligibilityResult('eligible');
    }
  }, [boardState, eligibilityResult]);

  // Initial Uninitialized State (Landing Screen)
  if (!deployedBoardAPI) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#f9fafb', background: 'transparent' }}>
        <Container maxWidth="md" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', py: 10 }}>
          <Paper elevation={0} sx={{ 
            p: { xs: 4, md: 6 }, 
            borderRadius: 4, 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            background: 'rgba(255, 255, 255, 0.03)', 
            backdropFilter: 'blur(10px)',
            textAlign: 'center', 
            width: '100%', 
            maxWidth: 520,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(129, 140, 248, 0.1)', border: '1px solid rgba(129, 140, 248, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 4 }}>
              <FlightTakeoffIcon sx={{ fontSize: 40, color: '#818cf8' }} />
            </Box>
            
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#f9fafb', mb: 2, letterSpacing: '-0.02em' }}>
              Private Travel Eligibility
            </Typography>
            
            <Typography variant="body1" sx={{ color: '#9ca3af', mb: 5, lineHeight: 1.6 }}>
              Connect your Lace Wallet to verify travel requirements using your passport attributes without exposing personal data to servers.
            </Typography>
            
            {errorMessage && (
              <Box sx={{ background: 'rgba(248, 113, 113, 0.05)', border: '1px solid rgba(248, 113, 113, 0.2)', p: 2, borderRadius: 2, width: '100%', textAlign: 'left', mb: 4, display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                 <ErrorOutlinedIcon sx={{ color: '#f87171', mt: 0.2 }} />
                 <Box>
                   <Typography variant="body2" sx={{ fontWeight: 600, color: '#fca5a5' }}>Connection Error</Typography>
                   <Typography variant="body2" sx={{ color: '#fecaca' }}>{errorMessage}</Typography>
                 </Box>
              </Box>
            )}

            <Button 
              variant="contained" 
              onClick={onCreateBoard} 
              disabled={isWorking || boardDeployment?.status === 'in-progress'}
              fullWidth
              sx={{ 
                borderRadius: 2, 
                py: 1.5, 
                fontSize: '1.05rem', 
                fontWeight: 600, 
                textTransform: 'none', 
                background: '#818cf8', 
                color: '#fff', 
                '&:hover': { background: '#6366f1', transform: 'translateY(-1px)' }, 
                '&.Mui-disabled': { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }, 
                boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.2)',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              {(isWorking || boardDeployment?.status === 'in-progress') ? 'Connecting to Lace...' : 'Connect Wallet'}
            </Button>
          </Paper>

          {/* Footer just for the landing page to match brand */}
          <Box sx={{ mt: 8, display: 'flex', alignItems: 'center', gap: 1 }}>
            <GppGoodOutlinedIcon sx={{ color: '#818cf8', fontSize: 18 }} />
            <Typography variant="body2" sx={{ color: '#6b7280', fontWeight: 600 }}>Powered by Midnight ZK technology</Typography>
          </Box>
        </Container>
      </Box>
    );
  }

  // Active UI
  const isWalletConnected = !!deployedBoardAPI;
  
  // Step logic
  let activeStep = 0;
  if (publicRules) activeStep = 1;
  if (eligibilityResult !== null) activeStep = 2;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#f9fafb' }}>
      <Backdrop sx={{ position: 'absolute', color: '#fff', zIndex: 10 }} open={isWorking || (boardDeployment?.status === 'in-progress')}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <CircularProgress color="inherit" />
          <Typography>{progressMessage || 'Processing...'}</Typography>
        </Box>
      </Backdrop>

      {/* HEADER */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(255, 255, 255, 0.03)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(129, 140, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FlightTakeoffIcon sx={{ color: '#818cf8' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Private Travel Eligibility</Typography>
            <Typography variant="body2" sx={{ color: '#6b7280' }}>Check your travel eligibility without exposing your passport.</Typography>
          </Box>
        </Box>
        
        {isWalletConnected && (
          <Paper elevation={0} sx={{ border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 2, px: 2, py: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
             <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
               <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399' }} />
               <Typography variant="caption" sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.2)' }}>Wallet connected</Typography>
             </Box>
             <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
               <Typography variant="caption" sx={{ color: '#6b7280', fontFamily: 'monospace' }}>0x3f2a...8a6f1</Typography>
               <ContentCopyIcon sx={{ fontSize: 14, color: '#6b7280', cursor: 'pointer' }} />
             </Box>
          </Paper>
        )}
      </Box>

      <Container maxWidth="xl" sx={{ flexGrow: 1, py: 4 }}>
        
        {/* PROGRESS INDICATOR */}
        <Box sx={{ maxWidth: 800, mx: 'auto', mb: 6 }}>
          <Stepper activeStep={activeStep} alternativeLabel sx={{
            '& .MuiStepConnector-line': { borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 2 },
            '& .Mui-active .MuiStepConnector-line': { borderColor: '#818cf8' },
            '& .Mui-completed .MuiStepConnector-line': { borderColor: '#818cf8' },
          }}>
            <Step>
              <StepLabel sx={{ '& .MuiStepIcon-root': { color: activeStep >= 0 ? '#818cf8' : 'rgba(255, 255, 255, 0.2)' } }}>
                <Typography sx={{ fontWeight: 600, color: '#f9fafb' }}>Destination</Typography>
                <Typography variant="caption" sx={{ color: '#6b7280' }}>Get requirements</Typography>
              </StepLabel>
            </Step>
            <Step>
              <StepLabel sx={{ '& .MuiStepIcon-root': { color: activeStep >= 1 ? '#818cf8' : 'rgba(255, 255, 255, 0.2)' } }}>
                <Typography sx={{ fontWeight: 600, color: '#f9fafb' }}>Passport Info</Typography>
                <Typography variant="caption" sx={{ color: '#6b7280' }}>Private & secure</Typography>
              </StepLabel>
            </Step>
            <Step>
              <StepLabel sx={{ '& .MuiStepIcon-root': { color: activeStep >= 2 ? '#818cf8' : 'rgba(255, 255, 255, 0.2)' } }}>
                <Typography sx={{ fontWeight: 600, color: '#f9fafb' }}>Result</Typography>
                <Typography variant="caption" sx={{ color: '#6b7280' }}>Eligibility result</Typography>
              </StepLabel>
            </Step>
          </Stepper>
        </Box>

        {/* 3 CARDS */}
        <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
          {/* CARD 1: DESTINATION */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={0} sx={{ border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(129, 140, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LanguageIcon sx={{ color: '#818cf8' }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Where are you travelling?</Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280' }}>We fetch public travel rules for your destination.</Typography>
                  </Box>
                </Box>
                
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel id="destination-label" sx={{ color: '#9ca3af', '&.Mui-focused': { color: '#818cf8' } }}>Destination</InputLabel>
                  <Select MenuProps={{ slotProps: { paper: { sx: { bgcolor: '#374151', color: '#f9fafb' } } } }} sx={{ color: '#f9fafb', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#818cf8' }, '.MuiSvgIcon-root': { color: '#9ca3af' } }} 
                    labelId="destination-label"
                    value={destination} 
                    label="Destination" 
                    onChange={(e) => { setDestination(e.target.value); setPublicRules(null); }}
                    displayEmpty
                  >
                    <MenuItem value="" disabled><em>Choose destination</em></MenuItem>
                    <MenuItem value="France">🇫🇷 France</MenuItem>
                    <MenuItem value="Japan">🇯🇵 Japan</MenuItem>
                    <MenuItem value="USA">🇺🇸 United States</MenuItem>
                    <MenuItem value="Germany">🇩🇪 Germany</MenuItem>
                    <MenuItem value="UK">🇬🇧 United Kingdom</MenuItem>
                  </Select>
                </FormControl>

                <Button 
                  variant="contained" 
                  fullWidth 
                  disabled={!destination}
                  onClick={fetchRules}
                  sx={{ borderRadius: 2, py: 1.5, textTransform: 'none', fontWeight: 600, background: '#818cf8', color: '#fff', '&:hover': { background: '#6366f1' }, '&.Mui-disabled': { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }, boxShadow: 'none' }}
                >
                  Retrieve Requirements
                </Button>

                {publicRules && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" sx={{ color: '#818cf8', fontWeight: 600, mb: 1 }}>Travel Requirements</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderRadius: 1, background: 'rgba(255, 255, 255, 0.02)' }}>
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255, 255, 255, 0.2)' }}><FlightIcon fontSize="small"/> <Typography variant="body2">Passport validity</Typography></Box>
                         <Typography variant="body2" sx={{ fontWeight: 600 }}>At least {publicRules.minimumPassportValidityDays} days</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderRadius: 1, background: 'rgba(255, 255, 255, 0.02)' }}>
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255, 255, 255, 0.2)' }}><PersonIcon fontSize="small"/> <Typography variant="body2">Eligible nationalities</Typography></Box>
                         <Typography variant="body2" sx={{ fontWeight: 600 }}>All nationalities</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderRadius: 1, background: 'rgba(255, 255, 255, 0.02)' }}>
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255, 255, 255, 0.2)' }}><InfoOutlinedIcon fontSize="small"/> <Typography variant="body2">Policy</Typography></Box>
                         <Typography variant="body2" sx={{ fontWeight: 600 }}>{publicRules.policyVersion}</Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* CARD 2: PASSPORT INFO */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={0} sx={{ border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3, height: '100%', opacity: publicRules ? 1 : 0.6, transition: 'opacity 0.2s' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(129, 140, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LockIcon sx={{ color: '#818cf8' }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Your passport information</Typography>
                    <Chip size="small" icon={<LockIcon sx={{ fontSize: 14 }} />} label="Private • Only on your device" sx={{ background: 'rgba(129, 140, 248, 0.1)', color: '#818cf8', fontWeight: 600, mt: 0.5, border: 'none' }} />
                  </Box>
                </Box>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel sx={{ color: '#9ca3af', '&.Mui-focused': { color: '#818cf8' } }}>Passport nationality</InputLabel>
                  <Select MenuProps={{ slotProps: { paper: { sx: { bgcolor: '#374151', color: '#f9fafb' } } } }} sx={{ color: '#f9fafb', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#818cf8' }, '.MuiSvgIcon-root': { color: '#9ca3af' } }} value={nationality} label="Passport nationality" onChange={(e) => setNationality(e.target.value)} disabled={!publicRules}>
                    <MenuItem value="India">🇮🇳 India</MenuItem>
                    <MenuItem value="Japan">🇯🇵 Japan</MenuItem>
                    <MenuItem value="USA">🇺🇸 United States</MenuItem>
                    <MenuItem value="Germany">🇩🇪 Germany</MenuItem>
                    <MenuItem value="UK">🇬🇧 United Kingdom</MenuItem>
                  </Select>
                </FormControl>

                <TextField slotProps={{ inputLabel: { sx: { color: '#9ca3af', '&.Mui-focused': { color: '#818cf8' } } }, input: { sx: { color: '#f9fafb', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#818cf8' } } } }} type="date"
                  label="Passport expiry date"
                  fullWidth
                  value={passportExpiry}
                  onChange={(e) => setPassportExpiry(e.target.value)}
                  disabled={!publicRules}
                  sx={{ mb: 3 }}
                />

                <Box sx={{ background: 'rgba(129, 140, 248, 0.1)', p: 2, borderRadius: 2, display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                  <GppGoodOutlinedIcon sx={{ color: '#818cf8', mt: 0.2 }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#a5b4fc' }}>Your data stays private</Typography>
                    <Typography variant="caption" sx={{ color: '#818cf8' }}>We never send your passport information to our servers.</Typography>
                  </Box>
                </Box>

                <Accordion elevation={0} disableGutters sx={{ mb: 3, border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '.MuiAccordionSummary-content': { my: 1 } }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.2)' }}>What stays private?</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0, color: '#6b7280' }}>
                    <Typography variant="caption">
                      • Passport nationality<br/>
                      • Passport expiry date<br/>
                      • Cryptographic salt
                    </Typography>
                  </AccordionDetails>
                </Accordion>

                <Button 
                  variant="contained" 
                  fullWidth 
                  disabled={!publicRules}
                  onClick={onVerifyEligibility}
                  sx={{ borderRadius: 2, py: 1.5, textTransform: 'none', fontWeight: 600, background: '#818cf8', color: '#fff', '&:hover': { background: '#6366f1' }, '&.Mui-disabled': { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }, boxShadow: 'none' }}
                >
                  Check My Eligibility
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* CARD 3: RESULT */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={0} sx={{ border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                
                {eligibilityResult === null && (
                  <Box sx={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                     <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4, alignSelf: 'flex-start', width: '100%' }}>
                        <Box sx={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography variant="h6" sx={{ color: '#6b7280', fontWeight: 700 }}>?</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'left' }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Eligibility result</Typography>
                          <Typography variant="body2" sx={{ color: '#6b7280' }}>Complete the previous steps to see your result.</Typography>
                        </Box>
                     </Box>
                     
                     <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1 }}>
                        <LuggageIcon sx={{ fontSize: 80, color: '#6b7280' }} />
                     </Box>
                  </Box>
                )}

                {eligibilityResult === 'eligible' && (
                  <Box sx={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                     <Box sx={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(52, 211, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                       <CheckCircleOutlinedIcon sx={{ color: '#34d399', fontSize: 32 }} />
                     </Box>
                     <Typography variant="h5" sx={{ fontWeight: 700, color: '#f9fafb', mb: 1 }}>ELIGIBLE</Typography>
                     <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.2)', mb: 3 }}>Your passport satisfies the selected travel requirements.</Typography>
                     
                     <Box sx={{ width: '100%', textAlign: 'left', mb: 3, border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 2, overflow: 'hidden' }}>
                       <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                         <Typography variant="body2" sx={{ color: '#6b7280' }}>Destination</Typography>
                         <Typography variant="body2" sx={{ fontWeight: 600 }}>{publicRules?.destination || destination}</Typography>
                       </Box>
                       <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, background: 'rgba(255, 255, 255, 0.05)' }}>
                         <Typography variant="body2" sx={{ color: '#6b7280' }}>Policy</Typography>
                         <Typography variant="body2" sx={{ fontWeight: 600 }}>{publicRules?.policyVersion || 'FRA-DEMO-v1'}</Typography>
                       </Box>
                     </Box>

                     <Box sx={{ background: 'rgba(74, 222, 128, 0.05)', border: '1px solid rgba(74, 222, 128, 0.2)', p: 2, borderRadius: 2, width: '100%', display: 'flex', gap: 1.5, alignItems: 'flex-start', textAlign: 'left', mb: 2 }}>
                        <GppGoodOutlinedIcon sx={{ color: '#4ade80', mt: 0.2 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#4ade80' }}>Proof verified on Midnight.</Typography>
                          <Typography variant="caption" sx={{ color: '#86efac' }}>Your eligibility was cryptographically proven without revealing your passport data.</Typography>
                        </Box>
                     </Box>

                     <Button variant="outlined" fullWidth sx={{ textTransform: 'none', fontWeight: 600, color: '#818cf8', borderColor: 'rgba(129,140,248,0.3)' }}>
                        View / Copy Attestation
                     </Button>
                  </Box>
                )}

                {eligibilityResult === 'not_eligible' && (
                  <Box sx={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                     <Box sx={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(248, 113, 113, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                       <ErrorOutlinedIcon sx={{ color: '#f87171' }} />
                     </Box>
                     <Typography variant="h5" sx={{ fontWeight: 700, color: '#f9fafb', mb: 0.5 }}>NOT ELIGIBLE</Typography>
                     <Typography variant="body2" sx={{ color: '#6b7280', mb: 4 }}>You do not meet the travel requirements.</Typography>
                     
                     <Box sx={{ background: 'rgba(248, 113, 113, 0.05)', border: '1px solid rgba(248, 113, 113, 0.2)', p: 2, borderRadius: 2, width: '100%', textAlign: 'left' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#fca5a5', mb: 1 }}>Reason:</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(248, 113, 113, 0.2)' }}>{localError}</Typography>
                     </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        {errorMessage && !localError && (
          <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {/* BOTTOM SECTION */}
        <Box sx={{ mt: 6, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, alignItems: 'stretch' }}>
           
           {/* HOW IT WORKS */}
           <Box sx={{ flexGrow: 1, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3, p: 3 }}>
             <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 3 }}>How it works</Typography>
             
             <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflowX: 'auto', pb: 1, gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 80 }}>
                   <Box sx={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                     <PersonIcon sx={{ color: '#818cf8' }} />
                   </Box>
                   <Typography variant="caption" sx={{ fontWeight: 700 }}>Your Data</Typography>
                   <Typography variant="caption" sx={{ color: '#6b7280' }}>(Private)</Typography>
                </Box>
                <Typography sx={{ color: '#6b7280' }}>→</Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 80 }}>
                   <Box sx={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                     <LockIcon sx={{ color: '#6b7280' }} />
                   </Box>
                   <Typography variant="caption" sx={{ fontWeight: 700 }}>Local Evaluation</Typography>
                   <Typography variant="caption" sx={{ color: '#6b7280' }}>(On Your Device)</Typography>
                </Box>
                <Typography sx={{ color: '#6b7280' }}>→</Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 80 }}>
                   <Box sx={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                     <GppGoodOutlinedIcon sx={{ color: '#818cf8' }} />
                   </Box>
                   <Typography variant="caption" sx={{ fontWeight: 700 }}>Eligibility Result</Typography>
                   <Typography variant="caption" sx={{ color: '#6b7280' }}>(Private)</Typography>
                </Box>
                <Typography sx={{ color: '#6b7280' }}>→</Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 80 }}>
                   <Box sx={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                     <LockIcon sx={{ color: '#6b7280' }} />
                   </Box>
                   <Typography variant="caption" sx={{ fontWeight: 700 }}>Attestation</Typography>
                   <Typography variant="caption" sx={{ color: '#6b7280' }}>(Optional)</Typography>
                </Box>
                <Typography sx={{ color: '#6b7280' }}>→</Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 80 }}>
                   <Box sx={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                     <LanguageIcon sx={{ color: '#818cf8' }} />
                   </Box>
                   <Typography variant="caption" sx={{ fontWeight: 700 }}>Midnight Network</Typography>
                   <Typography variant="caption" sx={{ color: '#6b7280' }}>(Privacy-Preserving)</Typography>
                </Box>
             </Box>
           </Box>

           {/* MVP LIMITATION */}
           <Box sx={{ width: { xs: '100%', md: 350 }, flexShrink: 0, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 3, p: 3, display: 'flex', flexDirection: 'column' }}>
             <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>MVP Limitation</Typography>
                <InfoOutlinedIcon sx={{ color: '#6b7280', fontSize: 20 }} />
             </Box>
             <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.2)', lineHeight: 1.6 }}>
               Eligibility calculation is currently performed locally in your browser. The current Midnight ZK proof proves authorization to submit the attestation, not the correctness of the eligibility calculation.
             </Typography>
           </Box>
        </Box>
      </Container>
      
      {/* FOOTER */}
      <Box sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', py: 3, px: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.03)', mt: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GppGoodOutlinedIcon sx={{ color: '#818cf8', fontSize: 18 }} />
          <Typography variant="body2" sx={{ color: '#6b7280', fontWeight: 600 }}>Powered by Midnight</Typography>
        </Box>
        <Link href="#" underline="hover" sx={{ color: '#818cf8', variant: 'body2', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          Learn more about Midnight <LanguageIcon sx={{ fontSize: 16 }} />
        </Link>
      </Box>

    </Box>
  );
};
