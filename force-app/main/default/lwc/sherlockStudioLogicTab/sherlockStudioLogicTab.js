import { LightningElement, api } from 'lwc';

export default class SherlockStudioLogicTab extends LightningElement {
    @api hiddenFilter = '';
    @api enableExport = false;
    @api exportLimit = 1000;
    @api exportFileName = '';

    handleHiddenFilterChange(event) {
        this.dispatchConfigChange('hiddenFilter', event.target.value);
    }

    handleEnableExportChange(event) {
        this.dispatchConfigChange('enableExport', event.target.checked);
    }

    handleExportLimitChange(event) {
        this.dispatchConfigChange('exportLimit', parseInt(event.detail.value, 10));
    }
    
    handleExportFileNameChange(event) {
        this.dispatchConfigChange('exportFileName', event.target.value);
    }

    dispatchConfigChange(property, value) {
        this.dispatchEvent(new CustomEvent('configchange', {
            detail: { property, value }
        }));
    }
}
