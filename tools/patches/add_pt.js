const fs = require('fs');
const path = require('path');

const files = ['panelA.html', 'panelB.html', 'panelC.html', 'panelD.html'];
const dir = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/';

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (!content.includes('value="pt"')) {
        content = content.replace('<option value="es">Español</option>', '<option value="es">Español</option>\n                        <option value="pt">Português</option>');
        fs.writeFileSync(filePath, content);
        console.log('Added pt to ' + file);
    }
});
