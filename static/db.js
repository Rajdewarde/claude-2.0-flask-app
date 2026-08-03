const DB_NAME = 'Claude2AppDB';
const DB_VERSION = 1;

export class StorageDB {
    static async open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('chats')) {
                    db.createObjectStore('chats', { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    static async getAllChats() {
        const db = await this.open();
        return new Promise((resolve) => {
            const tx = db.transaction('chats', 'readonly');
            const req = tx.objectStore('chats').getAll();
            req.onsuccess = () => resolve(req.result.sort((a, b) => b.updatedAt - a.updatedAt));
        });
    }

    static async saveChat(chat) {
        const db = await this.open();
        return new Promise((resolve) => {
            const tx = db.transaction('chats', 'readwrite');
            tx.objectStore('chats').put(chat);
            tx.oncomplete = () => resolve();
        });
    }

    static async deleteChat(id) {
        const db = await this.open();
        return new Promise((resolve) => {
            const tx = db.transaction('chats', 'readwrite');
            tx.objectStore('chats').delete(id);
            tx.oncomplete = () => resolve();
        });
    }
}