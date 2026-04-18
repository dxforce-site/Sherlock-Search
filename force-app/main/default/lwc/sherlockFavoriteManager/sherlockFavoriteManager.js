import { LightningElement, api, track } from 'lwc';

export default class SherlockFavoriteManager extends LightningElement {
    @api favoriteOptions = [];
    @api selectedFavoriteId = '';
    @api isLoading = false;

    // Internal Modal State
    @track isSaveModalOpen = false;
    @track saveType = 'overwrite';
    @track newFavoriteName = '';

    get saveOptions() {
        return [
            { label: '現在の条件を上書き', value: 'overwrite' },
            { label: '名前をつけて保存', value: 'new' }
        ];
    }

    get isSaveAsNew() {
        return this.saveType === 'new' || !this.selectedFavoriteId;
    }

    get isSaveDisabled() {
        if (this.isSaveAsNew && !this.newFavoriteName) return true;
        return this.isLoading;
    }

    // --- Modal Control ---

    @api
    openSaveModal() {
        this.saveType = this.selectedFavoriteId ? 'overwrite' : 'new';
        this.newFavoriteName = '';
        this.isSaveModalOpen = true;
    }

    closeSaveModal() {
        this.isSaveModalOpen = false;
    }

    // --- Handlers & Events (Actions Up) ---

    handleFavoriteSelectionChange(event) {
        const id = event.detail.value;
        this.dispatchEvent(new CustomEvent('favoritechange', {
            detail: { id: id }
        }));
    }

    handleDeleteRequest(event) {
        const id = event.target.dataset.id;
        this.dispatchEvent(new CustomEvent('deletefavorite', {
            detail: { id: id }
        }));
    }

    handleSaveTypeChange(event) {
        this.saveType = event.detail.value;
    }

    handleNewFavoriteNameChange(event) {
        this.newFavoriteName = event.target.value;
    }

    handleSaveExecute() {
        this.dispatchEvent(new CustomEvent('savefavorite', {
            detail: { 
                saveType: this.saveType, 
                newFavoriteName: this.newFavoriteName 
            }
        }));
        // Note: The parent component should call closeSaveModal via @api or we can close it locally
        // after dispatching, depending on the UX. 
        // Here, we wait for the parent to process, so we don't close it instantly 
        // if there's an error. But actually, for a "Dumb" component, 
        // we might just close it and let the parent handle the toast/error.
        // However, standard LWC practice is to close it here if the action was "Accepted".
    }

    @api
    closeModal() {
        this.isSaveModalOpen = false;
    }
}
