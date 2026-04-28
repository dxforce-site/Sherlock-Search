import { LightningElement, api } from 'lwc';

export default class SherlockSearchResultTable extends LightningElement {
    @api data = [];
    @api columns = [];
    @api isTileView = false;
    @api isLoadingMore = false;
    @api enableInfiniteLoading = false;
    @api draftValues = [];
    @api selectedRows = [];
    @api showScrollIndicator = false;
    @api showDrilldown = false; // Added to control the footer button visibility

    get scrollIndicatorClass() {
        return `scroll-hint-badge ${this.showScrollIndicator ? '' : 'hidden'}`;
    }

    // --- Event Handlers (Actions Up) ---

    handleRowSelection(event) {
        this.dispatchEvent(new CustomEvent('rowselection', {
            detail: { selectedRows: event.detail.selectedRows }
        }));
    }

    handleRowAction(event) {
        this.dispatchEvent(new CustomEvent('rowaction', {
            detail: { 
                action: event.detail.action, 
                row: event.detail.row 
            }
        }));
    }

    handleLoadMore(event) {
        this.dispatchEvent(new CustomEvent('loadmore', {
            detail: { target: event.target }
        }));
    }

    handleSave(event) {
        this.dispatchEvent(new CustomEvent('recordsave', {
            detail: { draftValues: event.detail.draftValues }
        }));
    }

    handleTileAction(event) {
        this.dispatchEvent(new CustomEvent('tileaction', {
            detail: { 
                actionValue: event.detail.value, 
                recordId: event.target.dataset.id 
            }
        }));
    }

    handleTileDrilldown(event) {
        this.dispatchEvent(new CustomEvent('tiledrilldown', {
            detail: { recordId: event.target.dataset.id }
        }));
    }

    handleRecordNavigate(event) {
        event.preventDefault();
        this.dispatchEvent(new CustomEvent('recordnavigate', {
            detail: { recordId: event.currentTarget.dataset.id }
        }));
    }

    handleHideIndicator() {
        this.dispatchEvent(new CustomEvent('hideindicator'));
    }
}
