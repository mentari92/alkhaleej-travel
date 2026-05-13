const fs = require('fs');
const path = require('path');
const code = `placeholder`;
fs.writeFileSync(path.join(__dirname, '../src/components/admin/SettingsForm.tsx'), code, 'utf8');
console.log('written');
