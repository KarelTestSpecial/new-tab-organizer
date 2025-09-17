# Chrome Web Store Permission Justifications

Hieronder staan de rechtvaardigingen voor de permissies die deze extensie aanvraagt, bedoeld voor het CWS Developer Dashboard.

## 1. `bookmarks`

**Justification String:**
Deze permissie is essentieel voor de kernfunctionaliteit. De extensie stelt gebruikers in staat om hun bladwijzers direct vanaf de startpagina te bekijken, te organiseren, te bewerken en te verwijderen via speciale 'bookmark panels' en een configureerbare zijbalk.

## 2. `storage`

**Justification String:**
Deze permissie is noodzakelijk om de gepersonaliseerde lay-out, notities en instellingen van de gebruiker op te slaan (zoals thema, paneelposities, etc.). Zonder deze permissie zouden alle aanpassingen van de gebruiker verloren gaan bij het openen van een nieuw tabblad, wat de extensie onbruikbaar zou maken.

## 3. `tabs`

**Justification String:**
Deze permissie wordt uitsluitend gebruikt voor gebruiksvriendelijke navigatiefuncties: 1) Om bladwijzers en andere links (zoals de browsergeschiedenis) in nieuwe tabbladen te openen. 2) Om de navigatie tussen de meerdere 'Organizer'-weergaven (A, B, C) te beheren door te controleren of een weergave al open is om duplicaten te voorkomen. 3) Om tabbladen automatisch te herladen na acties die de inhoud van een andere weergave wijzigen (bv. het swappen van weergaven). De permissie wordt niet gebruikt om de browsegeschiedenis te lezen.
