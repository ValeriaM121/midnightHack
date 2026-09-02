const fs = require('fs');
let content = fs.readFileSync('bboard-ui/src/components/TravelDashboard.tsx', 'utf8');

// Fix Grid alignItems
content = content.replace(
  /<Grid container spacing=\{3\} alignItems="stretch">/g,
  `<Grid container spacing={3} sx={{ alignItems: 'stretch' }}>`
);

// Fix Select MenuProps
content = content.replace(
  /MenuProps=\{\{ PaperProps: \{ sx: \{ bgcolor: '#374151', color: '#f9fafb' \} \} \}\}/g,
  `MenuProps={{ slotProps: { paper: { sx: { bgcolor: '#374151', color: '#f9fafb' } } } }}`
);

// Fix TextField props
content = content.replace(
  /InputLabelProps=\{\{ (sx: \{[^}]+\}) \}\} InputProps=\{\{ (sx: \{[^}]+\}) \}\}/g,
  `slotProps={{ inputLabel: { $1 }, input: { $2 } }}`
);

// Specifically handle the exact TextField string we generated earlier:
content = content.replace(
  /InputLabelProps=\{\{ sx: \{ color: '#9ca3af', '&\.Mui-focused': \{ color: '#818cf8' \} \} \}\} InputProps=\{\{ sx: \{ color: '#f9fafb', '\.MuiOutlinedInput-notchedOutline': \{ borderColor: 'rgba\(255,255,255,0\.2\)' \}, '&:hover \.MuiOutlinedInput-notchedOutline': \{ borderColor: 'rgba\(255,255,255,0\.3\)' \}, '&\.Mui-focused \.MuiOutlinedInput-notchedOutline': \{ borderColor: '#818cf8' \} \} \}\} /g,
  `slotProps={{ inputLabel: { sx: { color: '#9ca3af', '&.Mui-focused': { color: '#818cf8' } } }, input: { sx: { color: '#f9fafb', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#818cf8' } } } }} `
);


fs.writeFileSync('bboard-ui/src/components/TravelDashboard.tsx', content);
console.log('Fixes applied');
