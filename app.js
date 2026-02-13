/**
 * ENPLASE v0.01 — Application principale
 * Plante 🌱 · Arrose 💧 · Récolte 🧺
 */

// ===== VARIABLES GLOBALES =====
let currentPotId = null;
let currentSemisId = null;
let initialDetailValues = {}; // Pour détecter les modifications

// ===== INITIALISATION =====

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await openDB();
    } catch (e) {
        console.error('Erreur openDB :', e);
        showToast('Erreur lors du chargement');
        return;
    }

    try {
        initNavigation();
    } catch (e) {
        console.error('Erreur initNavigation :', e);
    }

    try {
        initPlantes();
        await loadPotsList();
    } catch (e) {
        console.error('Erreur initPlantes :', e);
    }

    try {
        initSemis();
        await loadSemisList();
    } catch (e) {
        console.error('Erreur initSemis :', e);
    }

    try {
        initAstuces();
        await loadConseilsList();
    } catch (e) {
        console.error('Erreur initAstuces :', e);
    }
});

// ===== UTILITAIRES =====

function formatDate(dateStr) {
    if (!dateStr) return 'Aucune';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function todayISO() {
    return new Date().toISOString().split('T')[0];
}

function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function showModal(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('modal-message').textContent = message;
    modal.classList.remove('hidden');

    const btnOk = document.getElementById('modal-confirm');
    const btnCancel = document.getElementById('modal-cancel');

    const cleanup = () => {
        modal.classList.add('hidden');
        btnOk.removeEventListener('click', handleConfirm);
        btnCancel.removeEventListener('click', handleCancel);
    };

    const handleConfirm = () => { cleanup(); onConfirm(); };
    const handleCancel = () => { cleanup(); };

    btnOk.addEventListener('click', handleConfirm);
    btnCancel.addEventListener('click', handleCancel);
}

function getGrilleFromDOM(semis) {
    const grille = JSON.parse(JSON.stringify(semis.grille));
    document.querySelectorAll('#detail-semis-grid .semis-cell').forEach(div => {
        const r = parseInt(div.dataset.row);
        const c = parseInt(div.dataset.col);
        const classes = div.className;
        const match = classes.match(/etat-(\w+)/);
        if (match) {
            grille[r][c].etat = match[1];
        }
    });
    return grille;
}

// ===== NAVIGATION =====

function initNavigation() {
    // Menu principal
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const menu = btn.dataset.menu;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.menu-section').forEach(s => s.classList.remove('active'));
            document.getElementById('menu-' + menu).classList.add('active');
        });
    });

    // Boutons retour
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.back;
            if (target) {
                navigateToView(target);
            }
        });
    });

    // Sous-onglets astuces
    document.querySelectorAll('.sub-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.subtab;
            document.querySelectorAll('.sub-nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.subtab').forEach(t => t.classList.remove('active'));
            document.getElementById('subtab-' + tab).classList.add('active');
        });
    });
}

function navigateToView(viewId) {
    const section = document.getElementById(viewId).closest('.menu-section');
    section.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

// ==============================
// MENU 1 : LES PLANTES
// ==============================

function initPlantes() {
    // Bouton ajouter pot
    document.getElementById('btn-add-pot').addEventListener('click', () => {
        resetFormCreationPot();
        navigateToView('plantes-creation-view');
    });

    // Formulaire création
    document.getElementById('form-creation-pot').addEventListener('submit', handleCreationPot);

    // Bouton ajouter plante (création)
    document.getElementById('btn-add-plante-creation').addEventListener('click', () => {
        addPlanteEntry('creation-plantes-container');
    });

    // Bouton enregistrer entretien
    document.getElementById('btn-enregistrer-entretien').addEventListener('click', handleEnregistrerEntretien);

    // Bouton modifier
    document.getElementById('btn-modifier-pot').addEventListener('click', handleOpenModifierPot);

    // Formulaire modification
    document.getElementById('form-modifier-pot').addEventListener('submit', handleModifierPot);

    // Bouton ajouter plante (modification)
    document.getElementById('btn-add-plante-modifier').addEventListener('click', () => {
        addPlanteEntry('modifier-plantes-container');
    });

    // Bouton reset historique
    document.getElementById('btn-reset-historique-pot').addEventListener('click', () => {
        showModal('Remettre à zéro tout l\'historique de ce pot/bac ? Cette action est irréversible.', async () => {
            await resetPotHistorique(currentPotId);
            showToast('Historique remis à zéro');
            openPotDetail(currentPotId);
        });
    });

    // Bouton supprimer pot
    document.getElementById('btn-supprimer-pot').addEventListener('click', () => {
        showModal('Supprimer définitivement ce pot/bac et tout son historique ?', async () => {
            await deletePot(currentPotId);
            showToast('Pot/bac supprimé');
            await loadPotsList();
            navigateToView('plantes-liste-view');
        });
    });
}

// ----- Liste des pots -----

async function loadPotsList() {
    const pots = await getAllPots();
    const container = document.getElementById('pots-list');

    if (pots.length === 0) {
        container.innerHTML = '<div class="list-item-empty">Aucun pot/bac. Appuyez sur + pour en créer un.</div>';
        return;
    }

    // Trier par nom
    pots.sort((a, b) => a.nom.localeCompare(b.nom));

    let html = '';
    for (const pot of pots) {
        const historique = await getPotHistorique(pot.id);
        let lastDate = 'Aucun contrôle';
        if (historique.length > 0) {
            historique.sort((a, b) => new Date(b.date) - new Date(a.date));
            lastDate = 'Dernier contrôle : ' + formatDate(historique[0].date);
        }
        html += `
            <div class="list-item" data-pot-id="${pot.id}">
                <span class="list-item-name">${pot.nom}</span>
                <span class="list-item-date">${lastDate}</span>
            </div>
        `;
    }
    container.innerHTML = html;

    // Events clic
    container.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = Number(item.dataset.potId);
            openPotDetail(id);
        });
    });
}

// ----- Création pot -----

function resetFormCreationPot() {
    document.getElementById('form-creation-pot').reset();
    const container = document.getElementById('creation-plantes-container');
    container.innerHTML = `
        <div class="plante-entry" data-index="0">
            <div class="plante-entry-fields">
                <input type="text" class="plante-nom" placeholder="Nom de la plante" required>
                <input type="date" class="plante-date" title="Date de plantation">
            </div>
        </div>
    `;
}

function addPlanteEntry(containerId) {
    const container = document.getElementById(containerId);
    const index = container.querySelectorAll('.plante-entry').length;
    const div = document.createElement('div');
    div.className = 'plante-entry';
    div.dataset.index = index;
    div.innerHTML = `
        <div class="plante-entry-fields">
            <input type="text" class="plante-nom" placeholder="Nom de la plante" required>
            <input type="date" class="plante-date" title="Date de plantation">
        </div>
        <button type="button" class="btn-remove" title="Supprimer">×</button>
    `;
    div.querySelector('.btn-remove').addEventListener('click', () => div.remove());
    container.appendChild(div);
}

async function handleCreationPot(e) {
    e.preventDefault();

    const nom = document.getElementById('pot-nom').value.trim();
    if (!nom) return;

    const plantes = [];
    document.querySelectorAll('#creation-plantes-container .plante-entry').forEach(entry => {
        const nomPlante = entry.querySelector('.plante-nom').value.trim();
        const datePlante = entry.querySelector('.plante-date').value || null;
        if (nomPlante) {
            plantes.push({
                nom: nomPlante,
                datePlantation: datePlante,
                etat: 'Sain'
            });
        }
    });

    if (plantes.length === 0) {
        showToast('Ajoutez au moins une plante');
        return;
    }

    const potData = {
        nom: nom,
        lieu: document.getElementById('pot-lieu').value.trim() || '',
        litrage: document.getElementById('pot-litrage').value.trim() || '',
        exposition: document.getElementById('pot-exposition').value || '',
        plantes: plantes,
        terre: '',
        derniereArrosage: null,
        dernierEngrais: null,
        serre: '',
        serreDate: null,
        dateCreation: todayISO()
    };

    await createPot(potData);
    showToast('Pot/bac créé !');
    await loadPotsList();
    navigateToView('plantes-liste-view');
}

// ----- Détail / Entretien pot -----

async function openPotDetail(potId) {
    currentPotId = potId;
    const pot = await getPot(potId);
    if (!pot) return;

    navigateToView('plantes-detail-view');

    // Titre
    document.getElementById('detail-pot-titre').textContent = pot.nom;

    // Infos
    let infosHtml = '';
    if (pot.lieu) infosHtml += `<p><strong>Lieu :</strong> ${pot.lieu}</p>`;
    if (pot.litrage) infosHtml += `<p><strong>Litrage :</strong> ${pot.litrage}</p>`;
    if (pot.exposition) infosHtml += `<p><strong>Exposition :</strong> ${pot.exposition}</p>`;
    infosHtml += `<p><strong>Plantes :</strong> ${pot.plantes.map(p => p.nom).join(', ')}</p>`;
    document.getElementById('detail-pot-infos').innerHTML = infosHtml;

    // Récupérer historique
    const historique = await getPotHistorique(potId);

    // ===== ÉTAT DE LA TERRE (affichage dernier contrôle) =====
    const terreEntries = historique.filter(h => h.terre);
    terreEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
    let dernierControleTerreText = '<strong>Dernier contrôle :</strong> Aucun';
    if (terreEntries.length > 0) {
        dernierControleTerreText = `<strong>Dernier contrôle :</strong> ${formatDate(terreEntries[0].date)} (${terreEntries[0].terre})`;
    }
    document.getElementById('detail-dernier-controle-terre').innerHTML = dernierControleTerreText;
    document.getElementById('detail-terre').value = '';

    // ===== ARROSAGE =====
    const arrosages = historique.filter(h => h.arrosageType);
    arrosages.sort((a, b) => new Date(b.date) - new Date(a.date));

    let dernierArrosageText = '<strong>Dernier arrosage :</strong> Aucun';
    let prochainArrosageText = '';

    if (arrosages.length > 0) {
        const dernierA = arrosages[0];
        dernierArrosageText = `<strong>Dernier arrosage :</strong> ${formatDate(dernierA.date)} (${dernierA.arrosageType}${dernierA.arrosageQuantite ? ' - ' + dernierA.arrosageQuantite : ''})`;

        if (arrosages.length >= 2) {
            let totalJours = 0;
            for (let i = 0; i < arrosages.length - 1; i++) {
                const d1 = new Date(arrosages[i].date);
                const d2 = new Date(arrosages[i + 1].date);
                totalJours += (d1 - d2) / (1000 * 60 * 60 * 24);
            }
            const moyenneJours = Math.round(totalJours / (arrosages.length - 1));
            const prochainDate = new Date(arrosages[0].date);
            prochainDate.setDate(prochainDate.getDate() + moyenneJours);
            prochainArrosageText = `<strong>Prochain arrosage estimé :</strong> <span class="highlight">${formatDate(prochainDate.toISOString())} (≈ tous les ${moyenneJours} jours)</span>`;
        } else {
            prochainArrosageText = '<strong>Prochain arrosage estimé :</strong> Pas assez de données';
        }
    }

    document.getElementById('detail-dernier-arrosage').innerHTML = dernierArrosageText;
    document.getElementById('detail-prochain-arrosage').innerHTML = prochainArrosageText;
    document.getElementById('detail-arrosage-type').value = '';
    document.getElementById('detail-arrosage-quantite').value = '';

    // ===== ENGRAIS =====
    const engraisEntries = historique.filter(h => h.engrais);
    engraisEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
    let engraisText = '<strong>Dernier engrais :</strong> Aucun';
    if (engraisEntries.length > 0) {
        engraisText = `<strong>Dernier engrais :</strong> ${formatDate(engraisEntries[0].date)}`;
    }
    document.getElementById('detail-dernier-engrais').innerHTML = engraisText;
    document.getElementById('detail-engrais-ajout').checked = false;

    // ===== SERRE =====
    let serreText = '<strong>En serre :</strong> Non renseigné';
    if (pot.serre) {
        serreText = `<strong>En serre :</strong> ${pot.serre} (depuis le ${formatDate(pot.serreDate)})`;
    }
    document.getElementById('detail-serre-info').innerHTML = serreText;
    document.getElementById('detail-serre').value = '';

    // ===== ÉTAT DES PLANTES =====
    let plantesHtml = '';
    pot.plantes.forEach((plante, index) => {
        plantesHtml += `
            <div class="plante-etat-row">
                <span class="plante-name">🌿 ${plante.nom}</span>
                <select class="plante-etat-select" data-plante-index="${index}">
                    <option value="">-- Ne pas modifier --</option>
                    <option value="Sain" ${plante.etat === 'Sain' ? 'selected' : ''}>Sain</option>
                    <option value="En croissance" ${plante.etat === 'En croissance' ? 'selected' : ''}>En croissance</option>
                    <option value="Au repos" ${plante.etat === 'Au repos' ? 'selected' : ''}>Au repos</option>
                    <option value="En reprise" ${plante.etat === 'En reprise' ? 'selected' : ''}>En reprise</option>
                    <option value="Stressé" ${plante.etat === 'Stressé' ? 'selected' : ''}>Stressé</option>
                    <option value="Parasité" ${plante.etat === 'Parasité' ? 'selected' : ''}>Parasité</option>
                    <option value="Malade" ${plante.etat === 'Malade' ? 'selected' : ''}>Malade</option>
                    <option value="Mort" ${plante.etat === 'Mort' ? 'selected' : ''}>Mort</option>
                </select>
            </div>
        `;
    });
    document.getElementById('detail-plantes-etat').innerHTML = plantesHtml;

    // Sauvegarder les valeurs initiales pour détecter les modifications
    saveInitialValues(pot);
}

function saveInitialValues(pot) {
    initialDetailValues = {
        terre: '',
        arrosageType: '',
        arrosageQuantite: '',
        engrais: false,
        serre: '',
        plantesEtats: pot.plantes.map(p => p.etat || '')
    };
}

function hasModifications() {
    if (document.getElementById('detail-terre').value !== initialDetailValues.terre) return true;
    if (document.getElementById('detail-arrosage-type').value !== initialDetailValues.arrosageType) return true;
    if (document.getElementById('detail-arrosage-quantite').value !== initialDetailValues.arrosageQuantite) return true;
    if (document.getElementById('detail-engrais-ajout').checked !== initialDetailValues.engrais) return true;
    if (document.getElementById('detail-serre').value !== initialDetailValues.serre) return true;

    const selects = document.querySelectorAll('.plante-etat-select');
    for (let i = 0; i < selects.length; i++) {
        if (selects[i].value !== initialDetailValues.plantesEtats[i]) return true;
    }

    return false;
}

async function handleEnregistrerEntretien() {
    if (!hasModifications()) {
        showToast('Aucune modification à enregistrer');
        return;
    }

    const pot = await getPot(currentPotId);
    if (!pot) return;

    const today = todayISO();
    let histEntry = {
        potId: currentPotId,
        date: today
    };

    let hasEntryData = false;
    let isUpdate = false;                                     // ← AJOUT

    // Vérifier si une entrée existe déjà pour aujourd'hui    // ← AJOUT
    const historiques = await getPotHistorique(currentPotId); // ← AJOUT
    const existante = historiques.find(h => h.date === today); // ← AJOUT
    if (existante) {                                           // ← AJOUT
        histEntry = existante;                                 // ← AJOUT
        isUpdate = true;                                       // ← AJOUT
    }                                                          // ← AJOUT

    // Terre — seulement si modifié
    const terre = document.getElementById('detail-terre').value;
    if (terre && terre !== initialDetailValues.terre) {
        pot.terre = terre;
        histEntry.terre = terre;
        hasEntryData = true;
    }

    // Arrosage — seulement si modifié
    const arrosageType = document.getElementById('detail-arrosage-type').value;
    if (arrosageType && arrosageType !== initialDetailValues.arrosageType) {
        histEntry.arrosageType = arrosageType;
        histEntry.arrosageQuantite = document.getElementById('detail-arrosage-quantite').value.trim() || '';
        pot.derniereArrosage = today;
        hasEntryData = true;
    }

    // Engrais — seulement si coché
    if (document.getElementById('detail-engrais-ajout').checked && !initialDetailValues.engrais) {
        histEntry.engrais = true;
        pot.dernierEngrais = today;
        hasEntryData = true;
    }

    // Serre — seulement si modifié
    const serre = document.getElementById('detail-serre').value;
    if (serre && serre !== initialDetailValues.serre && serre !== pot.serre) {
        pot.serre = serre;
        pot.serreDate = today;
        histEntry.serre = serre;
        hasEntryData = true;
    }

    // États des plantes — seulement si modifié
    let plantesModifiees = false;
    document.querySelectorAll('.plante-etat-select').forEach((sel, index) => {
        const newEtat = sel.value;
        if (newEtat && newEtat !== '' && newEtat !== initialDetailValues.plantesEtats[index] && pot.plantes[index]) {
            pot.plantes[index].etat = newEtat;
            plantesModifiees = true;
        }
    });
    if (plantesModifiees) {
        histEntry.plantesEtats = pot.plantes.map(p => ({ nom: p.nom, etat: p.etat }));
        hasEntryData = true;
    }

    if (hasEntryData) {
        await updatePot(pot);
        if (isUpdate) {                                       // ← CHANGÉ
            await updatePotHistorique(histEntry);             // ← CHANGÉ
        } else {                                              // ← CHANGÉ
            await addPotHistorique(histEntry);                // ← CHANGÉ
        }                                                     // ← CHANGÉ
        showToast('Entretien enregistré ✓');
        await loadPotsList();
        openPotDetail(currentPotId);
    } else {
        showToast('Aucune modification à enregistrer');
    }
}

// ----- Modification pot -----

async function handleOpenModifierPot() {
    const pot = await getPot(currentPotId);
    if (!pot) return;

    navigateToView('plantes-modifier-view');

    document.getElementById('modifier-pot-id').value = pot.id;
    document.getElementById('modifier-pot-nom').value = pot.nom;
    document.getElementById('modifier-pot-lieu').value = pot.lieu || '';
    document.getElementById('modifier-pot-litrage').value = pot.litrage || '';
    document.getElementById('modifier-pot-exposition').value = pot.exposition || '';

    // Plantes
    const container = document.getElementById('modifier-plantes-container');
    container.innerHTML = '';
    pot.plantes.forEach((plante, index) => {
        const div = document.createElement('div');
        div.className = 'plante-entry';
        div.dataset.index = index;
        div.innerHTML = `
            <div class="plante-entry-fields">
                <input type="text" class="plante-nom" value="${plante.nom}" placeholder="Nom de la plante" required>
                <input type="date" class="plante-date" value="${plante.datePlantation || ''}" title="Date de plantation">
            </div>
            ${pot.plantes.length > 1 ? '<button type="button" class="btn-remove" title="Supprimer">×</button>' : ''}
        `;
        if (div.querySelector('.btn-remove')) {
            div.querySelector('.btn-remove').addEventListener('click', () => div.remove());
        }
        container.appendChild(div);
    });
}

async function handleModifierPot(e) {
    e.preventDefault();

    const pot = await getPot(currentPotId);
    if (!pot) return;

    const nom = document.getElementById('modifier-pot-nom').value.trim();
    if (!nom) return;

    const plantes = [];
    document.querySelectorAll('#modifier-plantes-container .plante-entry').forEach(entry => {
        const nomPlante = entry.querySelector('.plante-nom').value.trim();
        const datePlante = entry.querySelector('.plante-date').value || null;
        if (nomPlante) {
            // Chercher si la plante existait pour garder son état
            const existante = pot.plantes.find(p => p.nom === nomPlante);
            plantes.push({
                nom: nomPlante,
                datePlantation: datePlante,
                etat: existante ? existante.etat : 'Sain'
            });
        }
    });

    if (plantes.length === 0) {
        showToast('Ajoutez au moins une plante');
        return;
    }

    pot.nom = nom;
    pot.lieu = document.getElementById('modifier-pot-lieu').value.trim() || '';
    pot.litrage = document.getElementById('modifier-pot-litrage').value.trim() || '';
    pot.exposition = document.getElementById('modifier-pot-exposition').value || '';
    pot.plantes = plantes;

    await updatePot(pot);
    showToast('Modifications enregistrées ✓');
    await loadPotsList();
    openPotDetail(currentPotId);
}

// ==============================
// MENU 2 : LES SEMIS
// ==============================

function getCellNumero(r, c, colonnes) {
    return r * colonnes + c + 1;
}

function initSemis() {
    // Bouton ajouter semis
    document.getElementById('btn-add-semis').addEventListener('click', () => {
        document.getElementById('form-creation-semis').reset();
        navigateToView('semis-creation-view');
    });

    // Formulaire création
    document.getElementById('form-creation-semis').addEventListener('submit', handleCreationSemis);

        // Bouton générer aperçu grille
    document.getElementById('btn-generer-grille').addEventListener('click', () => {
        const lignes = parseInt(document.getElementById('semis-lignes').value) || 4;
        const colonnes = parseInt(document.getElementById('semis-colonnes').value) || 6;

        // Grille aperçu
        const grilleContainer = document.getElementById('creation-grille');
        grilleContainer.style.gridTemplateColumns = `repeat(${colonnes}, 52px)`;
        grilleContainer.innerHTML = '';
        for (let r = 0; r < lignes; r++) {
            for (let c = 0; c < colonnes; c++) {
                const num = getCellNumero(r, c, colonnes);
                const div = document.createElement('div');
                div.className = 'semis-cell-static';
                div.textContent = num;
                grilleContainer.appendChild(div);
            }
        }

        // Champs noms
        const nomsContainer = document.getElementById('creation-noms-liste');
        nomsContainer.innerHTML = '';
        for (let r = 0; r < lignes; r++) {
            for (let c = 0; c < colonnes; c++) {
                const num = getCellNumero(r, c, colonnes);
                const div = document.createElement('div');
                div.className = 'grid-name-row';
                div.innerHTML = `
                    <span class="cell-label">${num} —</span>
                    <input type="text" data-row="${r}" data-col="${c}" placeholder="Nom (facultatif)">
                `;
                nomsContainer.appendChild(div);
            }
        }

        // Afficher les sections
        document.getElementById('creation-grille-section').classList.remove('hidden');
        document.getElementById('creation-noms-section').classList.remove('hidden');
    });

    // Bouton enregistrer entretien semis
    document.getElementById('btn-enregistrer-semis').addEventListener('click', handleEnregistrerEntretienSemis);

    // Bouton modifier semis
    document.getElementById('btn-modifier-semis').addEventListener('click', handleOpenModifierSemis);

    // Formulaire modification semis
    document.getElementById('form-modifier-semis').addEventListener('submit', handleModifierSemis);

    // Bouton reset historique semis
    document.getElementById('btn-reset-historique-semis').addEventListener('click', () => {
        showModal('Remettre à zéro tout l\'historique de ce bac de semis ? Cette action est irréversible.', async () => {
            await resetSemisHistorique(currentSemisId);
            showToast('Historique remis à zéro');
            openSemisDetail(currentSemisId);
        });
    });

    // Bouton supprimer semis
    document.getElementById('btn-supprimer-semis').addEventListener('click', () => {
        showModal('Supprimer définitivement ce bac de semis et tout son historique ?', async () => {
            await deleteSemis(currentSemisId);
            showToast('Bac de semis supprimé');
            await loadSemisList();
            navigateToView('semis-liste-view');
        });
    });
}

// ----- Liste des semis -----

async function loadSemisList() {
    const semis = await getAllSemis();
    const container = document.getElementById('semis-list');

    if (semis.length === 0) {
        container.innerHTML = '<div class="list-item-empty">Aucun bac de semis. Appuyez sur + pour en créer un.</div>';
        return;
    }

    semis.sort((a, b) => a.nom.localeCompare(b.nom));

    let html = '';
    for (const s of semis) {
        const historique = await getSemisHistorique(s.id);
        let lastDate = 'Aucun contrôle';
        if (historique.length > 0) {
            historique.sort((a, b) => new Date(b.date) - new Date(a.date));
            lastDate = 'Dernier contrôle : ' + formatDate(historique[0].date);
        }
        html += `
            <div class="list-item" data-semis-id="${s.id}">
                <span class="list-item-name">🌾 ${s.nom}</span>
                <span class="list-item-date">${lastDate}</span>
            </div>
        `;
    }
    container.innerHTML = html;

    container.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = Number(item.dataset.semisId);
            openSemisDetail(id);
        });
    });
}

// ----- Création semis -----

async function handleCreationSemis(e) {
    e.preventDefault();

    const nom = document.getElementById('semis-nom').value.trim();
    if (!nom) return;

    const lignes = parseInt(document.getElementById('semis-lignes').value) || 4;
    const colonnes = parseInt(document.getElementById('semis-colonnes').value) || 6;

        // Créer la grille : chaque cellule a un état et un nom
    const grille = [];
    for (let r = 0; r < lignes; r++) {
        const row = [];
        for (let c = 0; c < colonnes; c++) {
            row.push({
                nom: '',
                etat: 'attente'
            });
        }
        grille.push(row);
    }

    // Récupérer les noms si l'aperçu a été généré
    document.querySelectorAll('#creation-noms-liste input').forEach(input => {
        const r = parseInt(input.dataset.row);
        const c = parseInt(input.dataset.col);
        if (r < lignes && c < colonnes) {
            grille[r][c].nom = input.value.trim();
        }
    });

    const semisData = {
        nom: nom,
        lieu: document.getElementById('semis-lieu').value.trim() || '',
        exposition: document.getElementById('semis-exposition').value || '',
        lignes: lignes,
        colonnes: colonnes,
        grille: grille,
        terre: '',
        derniereArrosage: null,
        dernierEngrais: null,
        serre: '',
        serreDate: null,
        dateCreation: todayISO()
    };

    await createSemis(semisData);
    showToast('Bac de semis créé !');
    await loadSemisList();
    navigateToView('semis-liste-view');
}

// ----- Détail / Entretien semis -----

let initialSemisValues = {};

async function openSemisDetail(semisId) {
    currentSemisId = semisId;
    const semis = await getSemis(semisId);
    if (!semis) return;

    navigateToView('semis-detail-view');

    // Titre
    document.getElementById('detail-semis-titre').textContent = semis.nom;

    // Infos
    let infosHtml = '';
    if (semis.lieu) infosHtml += `<p><strong>Lieu :</strong> ${semis.lieu}</p>`;
    if (semis.exposition) infosHtml += `<p><strong>Exposition :</strong> ${semis.exposition}</p>`;
    infosHtml += `<p><strong>Grille :</strong> ${semis.lignes} × ${semis.colonnes}</p>`;
    document.getElementById('detail-semis-infos').innerHTML = infosHtml;

    // Récupérer historique
    const historique = await getSemisHistorique(semisId);

    // ===== ÉTAT DE LA TERRE (affichage dernier contrôle) =====
    const terreEntries = historique.filter(h => h.terre);
    terreEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
    let dernierControleTerreText = '<strong>Dernier contrôle :</strong> Aucun';
    if (terreEntries.length > 0) {
        dernierControleTerreText = `<strong>Dernier contrôle :</strong> ${formatDate(terreEntries[0].date)} (${terreEntries[0].terre})`;
    }
    document.getElementById('detail-semis-dernier-controle-terre').innerHTML = dernierControleTerreText;
    document.getElementById('detail-semis-terre').value = '';

    // ===== ARROSAGE =====
    const arrosages = historique.filter(h => h.arrosageType);
    arrosages.sort((a, b) => new Date(b.date) - new Date(a.date));

    let dernierArrosageText = '<strong>Dernier arrosage :</strong> Aucun';
    let prochainArrosageText = '';

    if (arrosages.length > 0) {
        const dernierA = arrosages[0];
        dernierArrosageText = `<strong>Dernier arrosage :</strong> ${formatDate(dernierA.date)} (${dernierA.arrosageType}${dernierA.arrosageQuantite ? ' - ' + dernierA.arrosageQuantite : ''})`;

        if (arrosages.length >= 2) {
            let totalJours = 0;
            for (let i = 0; i < arrosages.length - 1; i++) {
                const d1 = new Date(arrosages[i].date);
                const d2 = new Date(arrosages[i + 1].date);
                totalJours += (d1 - d2) / (1000 * 60 * 60 * 24);
            }
            const moyenneJours = Math.round(totalJours / (arrosages.length - 1));
            const prochainDate = new Date(arrosages[0].date);
            prochainDate.setDate(prochainDate.getDate() + moyenneJours);
            prochainArrosageText = `<strong>Prochain arrosage estimé :</strong> <span class="highlight">${formatDate(prochainDate.toISOString())} (≈ tous les ${moyenneJours} jours)</span>`;
        } else {
            prochainArrosageText = '<strong>Prochain arrosage estimé :</strong> Pas assez de données';
        }
    }

    document.getElementById('detail-semis-dernier-arrosage').innerHTML = dernierArrosageText;
    document.getElementById('detail-semis-prochain-arrosage').innerHTML = prochainArrosageText;
    document.getElementById('detail-semis-arrosage-type').value = '';
    document.getElementById('detail-semis-arrosage-quantite').value = '';

    // ===== ENGRAIS =====
    const engraisEntries = historique.filter(h => h.engrais);
    engraisEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
    let engraisText = '<strong>Dernier engrais :</strong> Aucun';
    if (engraisEntries.length > 0) {
        engraisText = `<strong>Dernier engrais :</strong> ${formatDate(engraisEntries[0].date)}`;
    }
    document.getElementById('detail-semis-dernier-engrais').innerHTML = engraisText;
    document.getElementById('detail-semis-engrais-ajout').checked = false;

    // ===== SERRE =====
    let serreText = '<strong>En serre :</strong> Non renseigné';
    if (semis.serre) {
        serreText = `<strong>En serre :</strong> ${semis.serre} (depuis le ${formatDate(semis.serreDate)})`;
    }
    document.getElementById('detail-semis-serre-info').innerHTML = serreText;
    document.getElementById('detail-semis-serre').value = '';

    // ===== GRILLE =====
    renderSemisGrid(semis);

    // Sauvegarder valeurs initiales
    saveSemisInitialValues(semis);
}

function renderSemisGrid(semis) {
    const container = document.getElementById('detail-semis-grid');
    container.style.gridTemplateColumns = `repeat(${semis.colonnes}, 52px)`;
    container.innerHTML = '';

    for (let r = 0; r < semis.lignes; r++) {
        for (let c = 0; c < semis.colonnes; c++) {
            const cell = semis.grille[r][c];
            const num = getCellNumero(r, c, semis.colonnes);
            const div = document.createElement('div');
            div.className = `semis-cell etat-${cell.etat}`;
            div.dataset.row = r;
            div.dataset.col = c;

            // Fonction pour remplir le contenu de la cellule
            function fillCell(el, numero, nom) {
                el.innerHTML = '';
                const numSpan = document.createElement('span');
                numSpan.style.fontSize = '0.85rem';
                numSpan.style.fontWeight = '700';
                numSpan.textContent = numero;
                el.appendChild(numSpan);

                if (nom) {
                    const mots = nom.split(' ');
                    const lignes = [];
                    let ligne = '';
                    for (let i = 0; i < mots.length; i++) {
                        if (ligne === '') {
                            ligne = mots[i];
                        } else if (mots[i].length <= 3) {
                            ligne += ' ' + mots[i];
                        } else {
                            lignes.push(ligne);
                            ligne = mots[i];
                        }
                    }
                    if (ligne) lignes.push(ligne);

                    lignes.forEach(l => {
                        const nomSpan = document.createElement('span');
                        nomSpan.style.fontSize = '0.6rem';
                        nomSpan.style.lineHeight = '1.1';
                        nomSpan.lang = 'fr';
                        nomSpan.textContent = l;
                        el.appendChild(nomSpan);
                    });
                }
            }

            fillCell(div, num, cell.nom);
            div.title = `${cell.nom || 'Case ' + num} (${cell.etat}) — Cliquer pour changer`;

            // Cycle au clic : attente → leve → replante → mort → attente
            div.addEventListener('click', () => {
                const etats = ['attente', 'leve', 'replante', 'mort'];
                const currentIndex = etats.indexOf(cell.etat);
                const nextIndex = (currentIndex + 1) % etats.length;
                cell.etat = etats[nextIndex];
                div.className = `semis-cell etat-${cell.etat}`;
                fillCell(div, num, cell.nom);
                div.title = `${cell.nom || 'Case ' + num} (${cell.etat}) — Cliquer pour changer`;
            });

            container.appendChild(div);
        }
    }
}

function saveSemisInitialValues(semis) {
    initialSemisValues = {
        terre: '',
        arrosageType: '',
        arrosageQuantite: '',
        engrais: false,
        serre: '',
        grille: JSON.stringify(semis.grille)
    };
}

async function handleEnregistrerEntretienSemis() {
    const semis = await getSemis(currentSemisId);
    if (!semis) return;

    // ← AJOUT : appliquer l'état de la grille depuis le DOM
    semis.grille = getGrilleFromDOM(semis);

    if (!hasSemisModifications(semis)) {
        showToast('Aucune modification à enregistrer');
        return;
    }

    const today = todayISO();
    let histEntry = {
        semisId: currentSemisId,
        date: today
    };
    let hasEntryData = false;
    let isUpdate = false;                                      // ← AJOUT

    // Vérifier si une entrée existe déjà pour aujourd'hui     // ← AJOUT
    const historiques = await getSemisHistorique(currentSemisId); // ← AJOUT
    const existante = historiques.find(h => h.date === today);    // ← AJOUT
    if (existante) {                                              // ← AJOUT
        histEntry = existante;                                    // ← AJOUT
        isUpdate = true;                                          // ← AJOUT
    }                                                             // ← AJOUT

    // Terre — seulement si modifié
    const terre = document.getElementById('detail-semis-terre').value;
    if (terre && terre !== initialSemisValues.terre) {
        semis.terre = terre;
        histEntry.terre = terre;
        hasEntryData = true;
    }

    // Arrosage — seulement si modifié
    const arrosageType = document.getElementById('detail-semis-arrosage-type').value;
    if (arrosageType && arrosageType !== initialSemisValues.arrosageType) {
        histEntry.arrosageType = arrosageType;
        histEntry.arrosageQuantite = document.getElementById('detail-semis-arrosage-quantite').value.trim() || '';
        semis.derniereArrosage = today;
        hasEntryData = true;
    }

    // Engrais — seulement si coché
    if (document.getElementById('detail-semis-engrais-ajout').checked && !initialSemisValues.engrais) {
        histEntry.engrais = true;
        semis.dernierEngrais = today;
        hasEntryData = true;
    }

    // Serre — seulement si modifié
    const serre = document.getElementById('detail-semis-serre').value;
    if (serre && serre !== initialSemisValues.serre && serre !== semis.serre) {
        semis.serre = serre;
        semis.serreDate = today;
        histEntry.serre = serre;
        hasEntryData = true;
    }

    // Grille — sauvegarder si modifiée
    if (JSON.stringify(semis.grille) !== initialSemisValues.grille) {
        histEntry.grilleSnapshot = JSON.parse(JSON.stringify(semis.grille));
        hasEntryData = true;
    }

    if (hasEntryData) {
        await updateSemis(semis);
        if (isUpdate) {                                        // ← CHANGÉ
            await updateSemisHistorique(histEntry);            // ← CHANGÉ
        } else {                                               // ← CHANGÉ
            await addSemisHistorique(histEntry);               // ← CHANGÉ
        }                                                      // ← CHANGÉ
        showToast('Entretien enregistré ✓');
        await loadSemisList();
        openSemisDetail(currentSemisId);
    }
}

function hasSemisModifications(semis) {
    if (document.getElementById('detail-semis-terre').value !== initialSemisValues.terre) return true;
    if (document.getElementById('detail-semis-arrosage-type').value !== initialSemisValues.arrosageType) return true;
    if (document.getElementById('detail-semis-arrosage-quantite').value !== initialSemisValues.arrosageQuantite) return true;
    if (document.getElementById('detail-semis-engrais-ajout').checked !== initialSemisValues.engrais) return true;
    if (document.getElementById('detail-semis-serre').value !== initialSemisValues.serre) return true;
    // Vérifier la grille depuis le DOM
    if (JSON.stringify(getGrilleFromDOM(semis)) !== initialSemisValues.grille) return true;
    return false;
}

// ----- Modification semis -----

async function handleOpenModifierSemis() {
    const semis = await getSemis(currentSemisId);
    if (!semis) return;

    navigateToView('semis-modifier-view');

    document.getElementById('modifier-semis-id').value = semis.id;
    document.getElementById('modifier-semis-nom').value = semis.nom;
    document.getElementById('modifier-semis-lieu').value = semis.lieu || '';
    document.getElementById('modifier-semis-exposition').value = semis.exposition || '';
    document.getElementById('modifier-semis-lignes').value = semis.lignes;
    document.getElementById('modifier-semis-colonnes').value = semis.colonnes;

    // Noms des cases
    const container = document.getElementById('modifier-semis-noms');
    container.innerHTML = '';
    for (let r = 0; r < semis.lignes; r++) {
        for (let c = 0; c < semis.colonnes; c++) {
            const cell = semis.grille[r][c];
            const div = document.createElement('div');
            div.className = 'grid-name-row';
                        const num = getCellNumero(r, c, semis.colonnes);
            div.innerHTML = `
                <span class="cell-label">${num} —</span>
                <input type="text" data-row="${r}" data-col="${c}" value="${cell.nom || ''}" placeholder="Nom (facultatif)">
            `;
            container.appendChild(div);
        }
    }
}

async function handleModifierSemis(e) {
    e.preventDefault();

    const semis = await getSemis(currentSemisId);
    if (!semis) return;

    const nom = document.getElementById('modifier-semis-nom').value.trim();
    if (!nom) return;

    const newLignes = parseInt(document.getElementById('modifier-semis-lignes').value) || semis.lignes;
    const newColonnes = parseInt(document.getElementById('modifier-semis-colonnes').value) || semis.colonnes;

    // Recréer la grille si dimensions changées
    if (newLignes !== semis.lignes || newColonnes !== semis.colonnes) {
        const newGrille = [];
        for (let r = 0; r < newLignes; r++) {
            const row = [];
            for (let c = 0; c < newColonnes; c++) {
                if (r < semis.lignes && c < semis.colonnes) {
                    row.push(semis.grille[r][c]);
                } else {
                    row.push({ nom: '', etat: 'attente' });
                }
            }
            newGrille.push(row);
        }
        semis.grille = newGrille;
        semis.lignes = newLignes;
        semis.colonnes = newColonnes;
    }

    // Mettre à jour les noms des cases
    document.querySelectorAll('#modifier-semis-noms input').forEach(input => {
        const r = parseInt(input.dataset.row);
        const c = parseInt(input.dataset.col);
        if (r < semis.lignes && c < semis.colonnes) {
            semis.grille[r][c].nom = input.value.trim();
        }
    });

    semis.nom = nom;
    semis.lieu = document.getElementById('modifier-semis-lieu').value.trim() || '';
    semis.exposition = document.getElementById('modifier-semis-exposition').value || '';

    await updateSemis(semis);
    showToast('Modifications enregistrées ✓');
    await loadSemisList();
    openSemisDetail(currentSemisId);
}

// ==============================
// MENU 3 : ASTUCES & INFORMATIONS
// ==============================

function initAstuces() {
    // --- Sous-navigation (onglets Astuces / Ajouter Conseils) ---
    document.querySelectorAll('#menu-astuces .sub-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#menu-astuces .sub-nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.dataset.subtab;
            document.querySelectorAll('#menu-astuces .subtab').forEach(t => t.classList.remove('active'));
            document.getElementById('subtab-' + target).classList.add('active');
            // Réafficher la vue liste quand on revient sur l'onglet conseils
            if (target === 'ajout-conseil') {
                showConseilView('liste');
            }
        });
    });

    // --- Bouton "+" ajouter conseil ---
    document.getElementById('btn-add-conseil').addEventListener('click', () => {
        document.getElementById('form-creation-conseil').reset();
        showConseilView('creation');
    });

    // --- Boutons retour dans les vues conseil ---
    document.querySelectorAll('.btn-back-conseil').forEach(btn => {
        btn.addEventListener('click', () => {
            showConseilView('liste');
        });
    });

    // --- Formulaire création conseil ---
    document.getElementById('form-creation-conseil').addEventListener('submit', handleCreationConseil);

    // --- Formulaire édition conseil ---
    document.getElementById('form-edition-conseil').addEventListener('submit', handleEditionConseil);

    // --- Export ---
    document.getElementById('btn-export').addEventListener('click', handleExport);

    // --- Import ---
    document.getElementById('import-file').addEventListener('change', handleImport);
}

// ===== Navigation entre vues conseil =====

function showConseilView(viewName) {
    // Masquer toutes les vues
    document.querySelectorAll('#subtab-ajout-conseil .conseil-view').forEach(v => {
        v.classList.remove('active');
    });
    // Afficher la vue demandée
    document.getElementById('conseil-' + viewName + '-view').classList.add('active');
    // Recharger la liste si on revient dessus
    if (viewName === 'liste') {
        loadConseilsList();
    }
}

// ===== Liste des conseils (bulles avec aperçu) =====

async function loadConseilsList() {
    const conseils = await getAllConseils();
    const container = document.getElementById('conseils-list');

    if (!conseils || conseils.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucun conseil ajouté pour le moment</p>';
        return;
    }

    container.innerHTML = conseils.map(c => `
        <div class="conseil-bulle" data-id="${c.id}">
            <div class="conseil-bulle-content">
                <h3 class="conseil-bulle-titre">${escapeHTML(c.titre)}</h3>
                <p class="conseil-bulle-apercu">${escapeHTML(c.texte)}</p>
            </div>
            <div class="conseil-bulle-actions">
                <button class="btn-edit-conseil" data-id="${c.id}" title="Modifier">✏️</button>
                <button class="btn-delete-conseil" data-id="${c.id}" title="Supprimer">🗑️</button>
            </div>
        </div>
    `).join('');

    // Clic sur la bulle → vue détail
    container.querySelectorAll('.conseil-bulle').forEach(bulle => {
        bulle.addEventListener('click', (e) => {
            // Ne pas ouvrir le détail si on clique sur un bouton action
            if (e.target.closest('.conseil-bulle-actions')) return;
            const id = Number(bulle.dataset.id);
            openConseilDetail(id);
        });
    });

    // Boutons supprimer
    container.querySelectorAll('.btn-delete-conseil').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = Number(btn.dataset.id);
            showModal('Supprimer ce conseil ?', async () => {
                await deleteConseil(id);
                showToast('Conseil supprimé ✓');
                await loadConseilsList();
            });
        });
    });

    // Boutons modifier
    container.querySelectorAll('.btn-edit-conseil').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = Number(btn.dataset.id);
            openEditionConseil(id);
        });
    });
}

// ===== Vue détail d'un conseil =====

async function openConseilDetail(id) {
    const c = await getConseilById(id);
    if (!c) {
        showToast('Conseil introuvable');
        return;
    }

    document.getElementById('detail-conseil-titre').textContent = c.titre;
    document.getElementById('detail-conseil-texte').textContent = c.texte;

    const lienEl = document.getElementById('detail-conseil-lien');
    if (c.lien) {
        lienEl.innerHTML = `<a href="${escapeHTML(c.lien)}" target="_blank" rel="noopener">🔗 Voir le lien</a>`;
    } else {
        lienEl.innerHTML = '';
    }

    const sourceEl = document.getElementById('detail-conseil-source');
    if (c.source) {
        sourceEl.textContent = `Source : ${c.source}`;
    } else {
        sourceEl.textContent = '';
    }

    showConseilView('detail');
}

// ===== Édition d'un conseil =====

async function openEditionConseil(id) {
    const conseil = await getConseilById(id);
    if (!conseil) {
        showToast('Conseil introuvable');
        return;
    }

    document.getElementById('edit-conseil-id').value = conseil.id;
    document.getElementById('edit-conseil-titre').value = conseil.titre;
    document.getElementById('edit-conseil-texte').value = conseil.texte;
    document.getElementById('edit-conseil-lien').value = conseil.lien || '';
    document.getElementById('edit-conseil-source').value = conseil.source || '';

    showConseilView('edition');
}

async function handleEditionConseil(e) {
    e.preventDefault();

    const id = Number(document.getElementById('edit-conseil-id').value);
    const titre = document.getElementById('edit-conseil-titre').value.trim();
    const texte = document.getElementById('edit-conseil-texte').value.trim();

    if (!titre || !texte) {
        showToast('Remplissez le titre et le contenu');
        return;
    }

    const existant = await getConseilById(id);

    const conseilData = {
        id: id,
        titre: titre,
        texte: texte,
        lien: document.getElementById('edit-conseil-lien').value.trim() || '',
        source: document.getElementById('edit-conseil-source').value.trim() || '',
        dateCreation: existant ? existant.dateCreation : todayISO()
    };

    await updateConseil(conseilData);
    showToast('Conseil modifié ✓');
    showConseilView('liste');
}

// ===== Création d'un conseil =====

async function handleCreationConseil(e) {
    e.preventDefault();

    const titre = document.getElementById('conseil-titre').value.trim();
    const texte = document.getElementById('conseil-texte').value.trim();

    if (!titre || !texte) {
        showToast('Remplissez le titre et le conseil');
        return;
    }

    const conseilData = {
        titre: titre,
        texte: texte,
        lien: document.getElementById('conseil-lien').value.trim() || '',
        source: document.getElementById('conseil-source').value.trim() || '',
        dateCreation: todayISO()
    };

    await addConseil(conseilData);
    showToast('Conseil ajouté ✓');
    showConseilView('liste');
}

// ===== Utilitaire échappement HTML =====

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ----- Export / Import -----

async function handleExport() {
    try {
        const data = await exportAllData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const today = todayISO().replace(/-/g, '/');
        const filename = `ENPLASE_${today}_Save.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Sauvegarde exportée ✓');
    } catch (e) {
        console.error('Erreur export :', e);
        showToast('Erreur lors de l\'export');
    }
}

async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    showModal('Importer cette sauvegarde ? Toutes les données actuelles seront remplacées.', async () => {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.pots && !data.semis && !data.conseils) {
                showToast('Fichier invalide');
                return;
            }

            await importAllData(data);
            showToast('Sauvegarde importée ✓');

            await loadPotsList();
            await loadSemisList();
            await loadConseilsList();
        } catch (err) {
            console.error('Erreur import :', err);
            showToast('Erreur lors de l\'import');
        }
    });

    e.target.value = '';
}

async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    showModal('Importer cette sauvegarde ? Toutes les données actuelles seront remplacées.', async () => {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.pots && !data.semis && !data.conseils) {
                showToast('Fichier invalide');
                return;
            }

            await importAllData(data);
            showToast('Sauvegarde importée ✓');

            // Recharger tout
            await loadPotsList();
            await loadSemisList();
            await loadConseilsList();
        } catch (err) {
            console.error('Erreur import :', err);
            showToast('Erreur lors de l\'import');
        }
    });

    // Reset input
    e.target.value = '';
}
