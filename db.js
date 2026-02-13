/**
 * ENPLASE — Module IndexedDB
 * Gère toute la persistance des données
 */

const DB_NAME = 'ENPLASE_DB';
const DB_VERSION = 1;

const STORES = {
    POTS: 'pots',
    POTS_HISTORIQUE: 'pots_historique',
    SEMIS: 'semis',
    SEMIS_HISTORIQUE: 'semis_historique',
    CONSEILS: 'conseils'
};

let db = null;

/**
 * Ouvre / Initialise la base de données
 */
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            if (!database.objectStoreNames.contains(STORES.POTS)) {
                const potStore = database.createObjectStore(STORES.POTS, { keyPath: 'id', autoIncrement: true });
                potStore.createIndex('nom', 'nom', { unique: false });
            }

            if (!database.objectStoreNames.contains(STORES.POTS_HISTORIQUE)) {
                const histStore = database.createObjectStore(STORES.POTS_HISTORIQUE, { keyPath: 'id', autoIncrement: true });
                histStore.createIndex('potId', 'potId', { unique: false });
                histStore.createIndex('date', 'date', { unique: false });
            }

            if (!database.objectStoreNames.contains(STORES.SEMIS)) {
                const semisStore = database.createObjectStore(STORES.SEMIS, { keyPath: 'id', autoIncrement: true });
                semisStore.createIndex('nom', 'nom', { unique: false });
            }

            if (!database.objectStoreNames.contains(STORES.SEMIS_HISTORIQUE)) {
                const semisHistStore = database.createObjectStore(STORES.SEMIS_HISTORIQUE, { keyPath: 'id', autoIncrement: true });
                semisHistStore.createIndex('semisId', 'semisId', { unique: false });
                semisHistStore.createIndex('date', 'date', { unique: false });
            }

            if (!database.objectStoreNames.contains(STORES.CONSEILS)) {
                database.createObjectStore(STORES.CONSEILS, { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            reject('Erreur ouverture IndexedDB : ' + event.target.error);
        };
    });
}

// ===== HELPERS GÉNÉRIQUES =====

function getStore(storeName, mode) {
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
}

function dbAdd(storeName, data) {
    return new Promise((resolve, reject) => {
        const store = getStore(storeName, 'readwrite');
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbPut(storeName, data) {
    return new Promise((resolve, reject) => {
        const store = getStore(storeName, 'readwrite');
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbGet(storeName, id) {
    return new Promise((resolve, reject) => {
        const store = getStore(storeName, 'readonly');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbGetAll(storeName) {
    return new Promise((resolve, reject) => {
        const store = getStore(storeName, 'readonly');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbDelete(storeName, id) {
    return new Promise((resolve, reject) => {
        const store = getStore(storeName, 'readwrite');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function dbGetByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
        const store = getStore(storeName, 'readonly');
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbDeleteByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.openCursor(IDBKeyRange.only(value));

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function dbClearStore(storeName) {
    return new Promise((resolve, reject) => {
        const store = getStore(storeName, 'readwrite');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ===== POTS =====

function createPot(potData) {
    return dbAdd(STORES.POTS, potData);
}

function updatePot(potData) {
    return dbPut(STORES.POTS, potData);
}

function getPot(id) {
    return dbGet(STORES.POTS, id);
}

function getAllPots() {
    return dbGetAll(STORES.POTS);
}

function deletePot(id) {
    return Promise.all([
        dbDelete(STORES.POTS, id),
        dbDeleteByIndex(STORES.POTS_HISTORIQUE, 'potId', id)
    ]);
}

// ===== HISTORIQUE POTS =====

function addPotHistorique(entry) {
    return dbAdd(STORES.POTS_HISTORIQUE, entry);
}

function getPotHistorique(potId) {
    return dbGetByIndex(STORES.POTS_HISTORIQUE, 'potId', potId);
}

function updatePotHistorique(entry) {
    return dbPut(STORES.POTS_HISTORIQUE, entry);
}

function resetPotHistorique(potId) {
    return dbDeleteByIndex(STORES.POTS_HISTORIQUE, 'potId', potId);
}

// ===== SEMIS =====

function createSemis(semisData) {
    return dbAdd(STORES.SEMIS, semisData);
}

function updateSemis(semisData) {
    return dbPut(STORES.SEMIS, semisData);
}

function getSemis(id) {
    return dbGet(STORES.SEMIS, id);
}

function getAllSemis() {
    return dbGetAll(STORES.SEMIS);
}

function deleteSemis(id) {
    return Promise.all([
        dbDelete(STORES.SEMIS, id),
        dbDeleteByIndex(STORES.SEMIS_HISTORIQUE, 'semisId', id)
    ]);
}

// ===== HISTORIQUE SEMIS =====

function addSemisHistorique(entry) {
    return dbAdd(STORES.SEMIS_HISTORIQUE, entry);
}

function getSemisHistorique(semisId) {
    return dbGetByIndex(STORES.SEMIS_HISTORIQUE, 'semisId', semisId);
}

function updateSemisHistorique(entry) {
    return dbPut(STORES.SEMIS_HISTORIQUE, entry);
}

function resetSemisHistorique(semisId) {
    return dbDeleteByIndex(STORES.SEMIS_HISTORIQUE, 'semisId', semisId);
}

// ===== CONSEILS =====

function addConseil(conseilData) {
    return dbAdd(STORES.CONSEILS, conseilData);
}

function getAllConseils() {
    return dbGetAll(STORES.CONSEILS);
}

function getConseilById(id) {
    return dbGet(STORES.CONSEILS, id);
}

function updateConseil(conseilData) {
    return dbPut(STORES.CONSEILS, conseilData);
}

function deleteConseil(id) {
    return dbDelete(STORES.CONSEILS, id);
}

// ===== EXPORT / IMPORT =====

async function exportAllData() {
    const data = {
        version: '0.01',
        exportDate: new Date().toISOString(),
        pots: await dbGetAll(STORES.POTS),
        potsHistorique: await dbGetAll(STORES.POTS_HISTORIQUE),
        semis: await dbGetAll(STORES.SEMIS),
        semisHistorique: await dbGetAll(STORES.SEMIS_HISTORIQUE),
        conseils: await dbGetAll(STORES.CONSEILS)
    };
    return data;
}

async function importAllData(data) {
    // Vider tous les stores
    await dbClearStore(STORES.POTS);
    await dbClearStore(STORES.POTS_HISTORIQUE);
    await dbClearStore(STORES.SEMIS);
    await dbClearStore(STORES.SEMIS_HISTORIQUE);
    await dbClearStore(STORES.CONSEILS);

    // Réinsérer toutes les données
    if (data.pots) {
        for (const item of data.pots) {
            await dbPut(STORES.POTS, item);
        }
    }
    if (data.potsHistorique) {
        for (const item of data.potsHistorique) {
            await dbPut(STORES.POTS_HISTORIQUE, item);
        }
    }
    if (data.semis) {
        for (const item of data.semis) {
            await dbPut(STORES.SEMIS, item);
        }
    }
    if (data.semisHistorique) {
        for (const item of data.semisHistorique) {
            await dbPut(STORES.SEMIS_HISTORIQUE, item);
        }
    }
    if (data.conseils) {
        for (const item of data.conseils) {
            await dbPut(STORES.CONSEILS, item);
        }
    }
}
