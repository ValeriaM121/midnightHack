const fs = require('fs');
let content = fs.readFileSync('bboard-ui/src/components/TravelDashboard.tsx', 'utf8');

// Replace light text with dark theme text
content = content.replace(/#111827/g, '#f9fafb');
content = content.replace(/#4b5563/g, '#d1d5db');
content = content.replace(/#6b7280/g, '#9ca3af');
content = content.replace(/#374151/g, '#d1d5db');
content = content.replace(/#9ca3af/g, '#6b7280'); 

// Replace backgrounds
content = content.replace(/background: 'white'/g, "background: 'rgba(255, 255, 255, 0.03)'");
content = content.replace(/background: '#ffffff'/g, "background: 'rgba(255, 255, 255, 0.05)'");
content = content.replace(/background: '#f9fafb'/g, "background: 'rgba(255, 255, 255, 0.02)'");
content = content.replace(/background: '#f3f4f6'/g, "background: 'rgba(255, 255, 255, 0.05)'");

// Blue accents
content = content.replace(/#2563eb/g, '#818cf8');
content = content.replace(/#1d4ed8/g, '#6366f1');
content = content.replace(/#eff6ff/g, 'rgba(129, 140, 248, 0.1)');
content = content.replace(/#e0e7ff/g, 'rgba(129, 140, 248, 0.15)');
content = content.replace(/#1e40af/g, '#a5b4fc');
content = content.replace(/#3b82f6/g, '#818cf8');

// Green accents
content = content.replace(/#10b981/g, '#34d399');
content = content.replace(/#16a34a/g, '#4ade80');
content = content.replace(/#15803d/g, '#86efac');
content = content.replace(/#d1fae5/g, 'rgba(52, 211, 153, 0.1)');
content = content.replace(/#f0fdf4/g, 'rgba(74, 222, 128, 0.05)');
content = content.replace(/#bbf7d0/g, 'rgba(74, 222, 128, 0.2)');

// Red accents
content = content.replace(/#ef4444/g, '#f87171');
content = content.replace(/#b91c1c/g, '#fca5a5');
content = content.replace(/#991b1b/g, '#fecaca');
content = content.replace(/#fee2e2/g, 'rgba(248, 113, 113, 0.1)');
content = content.replace(/#fef2f2/g, 'rgba(248, 113, 113, 0.05)');
content = content.replace(/#fecaca/g, 'rgba(248, 113, 113, 0.2)');

// Borders
content = content.replace(/border: '1px solid #e5e7eb'/g, "border: '1px solid rgba(255, 255, 255, 0.1)'");
content = content.replace(/borderBottom: '1px solid #e5e7eb'/g, "borderBottom: '1px solid rgba(255, 255, 255, 0.1)'");
content = content.replace(/borderTop: '1px solid #e5e7eb'/g, "borderTop: '1px solid rgba(255, 255, 255, 0.1)'");
content = content.replace(/borderColor: '#e5e7eb'/g, "borderColor: 'rgba(255, 255, 255, 0.1)'");
content = content.replace(/#d1d5db/g, 'rgba(255, 255, 255, 0.2)');

// Fix Select and Dropdowns
content = content.replace(
  /<Select /g,
  `<Select MenuProps={{ PaperProps: { sx: { bgcolor: '#374151', color: '#f9fafb' } } }} sx={{ color: '#f9fafb', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#818cf8' }, '.MuiSvgIcon-root': { color: '#9ca3af' } }} `
);

// Fix InputLabel
content = content.replace(
  /<InputLabel([^>]*)>/g,
  `<InputLabel$1 sx={{ color: '#9ca3af', '&.Mui-focused': { color: '#818cf8' } }}>`
);

// Fix TextField
content = content.replace(
  /<TextField\s*/g,
  `<TextField InputLabelProps={{ sx: { color: '#9ca3af', '&.Mui-focused': { color: '#818cf8' } } }} InputProps={{ sx: { color: '#f9fafb', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#818cf8' } } }} `
);

// Fix Buttons
content = content.replace(
  /background: '#818cf8', '&:hover': \{ background: '#6366f1' \}/g,
  `background: '#818cf8', color: '#fff', '&:hover': { background: '#6366f1' }, '&.Mui-disabled': { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }`
);
content = content.replace(/color: '#2563eb'/g, "color: '#818cf8'");
content = content.replace(/borderColor: '#bfdbfe'/g, "borderColor: 'rgba(129,140,248,0.3)'");

// Empty Result State
content = content.replace(/opacity: 0.3/g, "opacity: 0.1");
content = content.replace(/fontSize: 120/g, "fontSize: 80");

// Accordion
content = content.replace(
  /border: '1px solid rgba\\(255, 255, 255, 0.1\\)', borderRadius: '8px !important', '&:before': \{ display: 'none' \}/g,
  `border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px !important', background: 'transparent', color: '#f9fafb', '&:before': { display: 'none' }`
);

// Stepper StepLabels
content = content.replace(
  /<StepLabel sx=\{\{ '& \.MuiStepIcon-root': \{ color: activeStep >= 0 \? '#818cf8' : 'rgba\\(255, 255, 255, 0.2\\)' \} \}\}>/g,
  `<StepLabel sx={{ '& .MuiStepIcon-root': { color: activeStep >= 0 ? '#818cf8' : 'rgba(255,255,255,0.2)' }, '& .MuiStepLabel-label': { color: activeStep >= 0 ? '#f9fafb !important' : '#9ca3af !important' } }}>`
);
content = content.replace(
  /<StepLabel sx=\{\{ '& \.MuiStepIcon-root': \{ color: activeStep >= 1 \? '#818cf8' : 'rgba\\(255, 255, 255, 0.2\\)' \} \}\}>/g,
  `<StepLabel sx={{ '& .MuiStepIcon-root': { color: activeStep >= 1 ? '#818cf8' : 'rgba(255,255,255,0.2)' }, '& .MuiStepLabel-label': { color: activeStep >= 1 ? '#f9fafb !important' : '#9ca3af !important' } }}>`
);
content = content.replace(
  /<StepLabel sx=\{\{ '& \.MuiStepIcon-root': \{ color: activeStep >= 2 \? '#818cf8' : 'rgba\\(255, 255, 255, 0.2\\)' \} \}\}>/g,
  `<StepLabel sx={{ '& .MuiStepIcon-root': { color: activeStep >= 2 ? '#818cf8' : 'rgba(255,255,255,0.2)' }, '& .MuiStepLabel-label': { color: activeStep >= 2 ? '#f9fafb !important' : '#9ca3af !important' } }}>`
);

// Grid and spacing
content = content.replace(/<Grid container spacing=\{3\}>/g, `<Grid container spacing={3} alignItems="stretch">`);
content = content.replace(/flexDirection: \{ xs: 'column', md: 'row' \}, gap: 4, alignItems: 'flex-start'/g, `flexDirection: { xs: 'column', md: 'row' }, gap: 4, alignItems: 'stretch'`);


fs.writeFileSync('bboard-ui/src/components/TravelDashboard.tsx', content);
console.log('Update complete');
