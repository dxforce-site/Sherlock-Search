import { LightningElement, api, track } from 'lwc';

export default class SherlockExportModal extends LightningElement {
    @api isOpen = false;
    @api isExporting = false;
    @api exportOptions = [];

    @track exportScope = 'all';

    handleExportScopeChange(event) {
        this.exportScope = event.detail.value;
    }

    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleExport() {
        this.dispatchEvent(new CustomEvent('export', {
            detail: { exportScope: this.exportScope }
        }));
    }
}
