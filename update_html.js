const fs = require('fs');
const path = require('path');

const files = ['panelA.html', 'panelB.html', 'panelC.html', 'panelD.html'];
const dir = '/home/kareltestspecial/0-IT/5-Personal/extensies/newtaborganizer/new-tab-organizer/';

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Inject i18n.js
    if (!content.includes('js/i18n.js')) {
        content = content.replace('<script src="js/bookmarks.js"></script>', '<script src="js/i18n.js"></script>\n    <script src="js/bookmarks.js"></script>');
    }

    // Settings
    content = content.replace(/<h2 style="margin-bottom: 20px;">Settings<\/h2>/, '<h2 style="margin-bottom: 20px;" data-i18n="settings_title">Settings</h2>');
    
    // Replace text inside language selection (we will add language selection soon)
    
    content = content.replace(/<h3>Visual Settings<\/h3>/, '<h3 data-i18n="settings_visual">Visual Settings</h3>');
    content = content.replace(/<label>Background Color:<\/label>/, '<label data-i18n="settings_bg_color">Background Color:</label>');
    content = content.replace(/<label>Text Color:<\/label>/, '<label data-i18n="settings_text_color">Text Color:</label>');
    content = content.replace(/<label>Accent Color:<\/label>/, '<label data-i18n="settings_accent_color">Accent Color:</label>');
    content = content.replace(/<label>Date Font Size:<\/label>/, '<label data-i18n="settings_date_font_size">Date Font Size:</label>');
    content = content.replace(/<label style="cursor: pointer;">\s*<input type="checkbox" id="battery-toggle">\s*Show Battery Status\s*<\/label>/, '<label style="cursor: pointer;">\n                        <input type="checkbox" id="battery-toggle">\n                        <span data-i18n="settings_show_battery">Show Battery Status</span>\n                    </label>');
    
    content = content.replace(/<h3>Startup Views<\/h3>/, '<h3 data-i18n="settings_startup_views">Startup Views</h3>');
    content = content.replace(/<p style="font-size: 0.85rem; color: #777; margin-bottom: 10px;">Select which views to open in new tabs when Chrome starts:<\/p>/, '<p style="font-size: 0.85rem; color: #777; margin-bottom: 10px;" data-i18n="settings_startup_desc">Select which views to open in new tabs when Chrome starts:</p>');
    
    content = content.replace(/<label for="sidebar-folder-select" style="display: block; margin-bottom: 5px;">Select Sidebar Bookmarks Folder:<\/label>/, '<label for="sidebar-folder-select" style="display: block; margin-bottom: 5px;" data-i18n="settings_sidebar_folder">Select Sidebar Bookmarks Folder:</label>');

    content = content.replace(/<h3 style="margin-top: 30px;">Folders & Syncing<\/h3>/, '<h3 style="margin-top: 30px;" data-i18n="settings_folders">Folders & Syncing</h3>');
    content = content.replace(/<label style="display: block; margin-bottom: 5px;">Waar wil je dat wij de Organizer mappen plaatsen\?<\/label>/, '<label style="display: block; margin-bottom: 5px;" data-i18n="settings_root_folder">Waar wil je dat wij de Organizer mappen plaatsen?</label>');
    content = content.replace(/Maak 4 mappen in Chrome Bookmarks : Organizer A , Organizer B , Organizer C , Organizer D/, '<span data-i18n="settings_toggle_folders">Maak 4 mappen in Chrome Bookmarks : Organizer A , Organizer B , Organizer C , Organizer D</span>');
    content = content.replace(/Zet je dit uit, dan stopt het automatisch verplaatsen\. Bestaande mappen in Chrome blijven behouden\./, '<span data-i18n="settings_toggle_desc">Zet je dit uit, dan stopt het automatisch verplaatsen. Bestaande mappen in Chrome blijven behouden.</span>');
    
    content = content.replace(/<h3 style="margin-top: 30px; margin-bottom: 10px;">Swap Organizers<\/h3>/, '<h3 style="margin-top: 30px; margin-bottom: 10px;" data-i18n="settings_swap">Swap Organizers</h3>');
    content = content.replace(/<p style="font-size: 0.85rem; color: #777; margin-bottom: 10px;">Safely swap the contents of two Organizers\.<\/p>/, '<p style="font-size: 0.85rem; color: #777; margin-bottom: 10px;" data-i18n="settings_swap_desc">Safely swap the contents of two Organizers.</p>');
    content = content.replace(/Swap content between/, '<span data-i18n="settings_swap_btn">Swap content between</span>');
    
    content = content.replace(/<h3 style="margin-top: 30px;">Backup & Import<\/h3>/, '<h3 style="margin-top: 30px;" data-i18n="settings_backup">Backup & Import</h3>');
    content = content.replace(/Export Layout \(Current View\)/, '<span data-i18n="settings_export">Export Layout (Current View)</span>');
    content = content.replace(/Import Layout \(Current View\)/, '<span data-i18n="settings_import">Import Layout (Current View)</span>');
    content = content.replace(/Save and Close/, '<span data-i18n="settings_save">Save and Close</span>');
    
    // Add Bookmark Modal
    content = content.replace(/<h2 style="margin-bottom: 20px;">Add New Bookmark Panel<\/h2>/, '<h2 style="margin-bottom: 20px;" data-i18n="add_bookmark_title">Add New Bookmark Panel</h2>');
    content = content.replace(/placeholder="Naam nieuwe map"/, 'data-i18n-placeholder="add_bookmark_new_folder_placeholder" placeholder="Naam nieuwe map"');
    content = content.replace(/>Maak Nieuwe Map</, ' data-i18n="add_bookmark_new_folder">Maak Nieuwe Map<');
    content = content.replace(/<label style="display: block; margin-bottom: 10px; font-weight: bold;">Select one or more bookmark folders to display as panels:<\/label>/, '<label style="display: block; margin-bottom: 10px; font-weight: bold;" data-i18n="add_bookmark_select_desc">Select one or more bookmark folders to display as panels:</label>');
    content = content.replace(/Also import subfolders inside the selected folders\?/, '<span data-i18n="add_bookmark_recursive_desc">Also import subfolders inside the selected folders?</span>');
    content = content.replace(/<button type="submit" class="settings-btn-item" style="padding: 10px; font-weight: bold;">Add Bookmarks Panel<\/button>/, '<button type="submit" class="settings-btn-item" style="padding: 10px; font-weight: bold;" data-i18n="add_bookmark_btn">Add Bookmarks Panel</button>');
    content = content.replace(/<button type="button" class="cancel-modal-btn settings-btn-item" style="padding: 10px;">Cancel<\/button>/g, '<button type="button" class="cancel-modal-btn settings-btn-item" style="padding: 10px;" data-i18n="add_bookmark_cancel">Cancel</button>');
    
    // Add Notes Modal
    content = content.replace(/<h2 style="margin-bottom: 20px;">Add Notes Panel<\/h2>/, '<h2 style="margin-bottom: 20px;" data-i18n="add_notes_title">Add Notes Panel</h2>');
    content = content.replace(/placeholder="Enter title for notes panel\.\.\."/, 'data-i18n-placeholder="add_notes_placeholder" placeholder="Enter title for notes panel..."');
    content = content.replace(/<button type="submit" class="settings-btn-item" style="padding: 10px; font-weight: bold;">Add Notes Panel<\/button>/, '<button type="submit" class="settings-btn-item" style="padding: 10px; font-weight: bold;" data-i18n="add_notes_btn">Add Notes Panel</button>');
    
    // Upgrade Modal
    content = content.replace(/<h2 style="margin-bottom: 20px;">Nieuwe Functie: Organizer Mappen<\/h2>/, '<h2 style="margin-bottom: 20px;" data-i18n="upgrade_title">Nieuwe Functie: Organizer Mappen</h2>');
    content = content.replace(/<p><strong>Upgrade:<\/strong> Vanaf nu werkt de extensie met speciale mappen! <strong>We hanteren het principe: Wat je in de extensie ziet, is wat je in Chrome hebt\.<\/strong><\/p>/, '<p data-i18n="upgrade_desc1"><strong>Upgrade:</strong> Vanaf nu werkt de extensie met speciale mappen! <strong>We hanteren het principe: Wat je in de extensie ziet, is wat je in Chrome hebt.</strong></p>');
    content = content.replace(/<p>Elke Organizer \(A, B, C en D\) krijgt zijn eigen fysieke map in je Chrome bladwijzers\. Dit houdt alles netjes gescheiden\. Wanneer je straks een bladwijzerpaneel verplaatst \(via het rechtermuisklik-menu of door inhoud te wisselen in de instellingen\), zal de extensie ook automatisch de bijbehorende fysieke map in Chrome verplaatsen\.<\/p>/, '<p data-i18n="upgrade_desc2">Elke Organizer (A, B, C en D) krijgt zijn eigen fysieke map in je Chrome bladwijzers. Dit houdt alles netjes gescheiden. Wanneer je straks een bladwijzerpaneel verplaatst (via het rechtermuisklik-menu of door inhoud te wisselen in de instellingen), zal de extensie ook automatisch de bijbehorende fysieke map in Chrome verplaatsen.</p>');
    content = content.replace(/<p style="margin-bottom: 15px;">Waar wil je dat wij de 4 hoofdmappen voor jou aanmaken\?<\/p>/, '<p style="margin-bottom: 15px;" data-i18n="upgrade_where">Waar wil je dat wij de 4 hoofdmappen voor jou aanmaken?</p>');
    content = content.replace(/>Maak Mappen & Start</, ' data-i18n="upgrade_btn_ok">Maak Mappen & Start<');
    content = content.replace(/>Niet nu</, ' data-i18n="upgrade_btn_cancel">Niet nu<');

    // Language Toggle addition
    const langSelectHtml = `
                <div class="form-group">
                    <label data-i18n="settings_language">Taal (Language)</label>
                    <select id="language-select" class="settings-select">
                        <option value="auto" data-i18n="settings_language_auto">Auto (Browser Default)</option>
                        <option value="en">English</option>
                        <option value="nl">Nederlands</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="es">Español</option>
                    </select>
                </div>
    `;
    if (!content.includes('id="language-select"')) {
        content = content.replace(/<div class="settings-section">[\s\S]*?<h3 data-i18n="settings_visual">Visual Settings<\/h3>/, `<div class="settings-section">\n${langSelectHtml}\n                <h3 data-i18n="settings_visual">Visual Settings</h3>`);
    }

    fs.writeFileSync(filePath, content);
    console.log('Updated ' + file);
});
