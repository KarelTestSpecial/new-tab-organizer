const fs = require('fs');
const path = require('path');

const dir = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/';
const files = ['panelA.html', 'panelB.html', 'panelC.html', 'panelD.html'];

files.forEach(file => {
    const filePath = path.join(dir, file);
    let html = fs.readFileSync(filePath, 'utf8');

    // Notes modal fixes
    html = html.replace(/<h2>Add New Notes Panel<\/h2>/g, '<h2 data-i18n="add_notes_title">Add New Notes Panel</h2>');
    html = html.replace(/<label>Position<\/label>/g, '<label data-i18n="label_position">Position</label>');
    html = html.replace(/<input type="radio" name="notes-position" value="top">\s*Top/g, '<input type="radio" name="notes-position" value="top"> <span data-i18n="label_top">Top</span>');
    html = html.replace(/<input type="radio" name="notes-position" value="bottom" checked>\s*Bottom/g, '<input type="radio" name="notes-position" value="bottom" checked> <span data-i18n="label_bottom">Bottom</span>');

    fs.writeFileSync(filePath, html);
});

console.log('Finished final HTML translation patches');
