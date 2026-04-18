import { LightningElement, api } from 'lwc';

export default class SherlockStudioFlowTab extends LightningElement {
    @api flowSearchTerm = '';
    @api availableFlows = [];
    @api bulkFlowApiName = '';
    @api bulkFlowButtonLabel = 'フロー実行';
    @api bulkFlowButtonIcon = 'utility:play';

    showFlowDropdown = false;

    get flowDropdownClass() {
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.showFlowDropdown ? 'slds-is-open' : ''}`;
    }

    get filteredFlowOptions() {
        const noneOption = { label: '-- 指定なし --', value: '', displayLabel: '-- 指定なし --' };
        
        // Map flows to include a displayLabel like "Label (API Name)"
        const flowsWithDisplay = (this.availableFlows || []).map(f => ({
            ...f,
            displayLabel: `${f.label} (${f.value})`
        }));

        const term = this.flowSearchTerm;
        if (!term) return [noneOption, ...flowsWithDisplay];
        
        const lowSearch = term.toLowerCase();
        const filtered = flowsWithDisplay.filter(f => 
            f.label.toLowerCase().includes(lowSearch) || 
            f.value.toLowerCase().includes(lowSearch)
        );
        return [noneOption, ...filtered];
    }

    handleFlowSearchInput(event) {
        const value = event.target.value;
        this.dispatchConfigChange('flowSearchTerm', value);
        this.showFlowDropdown = true;
        if (!value) {
            this.dispatchConfigChange('bulkFlowApiName', '');
        }
    }

    handleFlowFocus() {
        this.showFlowDropdown = true;
    }

    handleFlowBlur() {
        setTimeout(() => {
            this.showFlowDropdown = false;
        }, 200);
    }

    handleFlowSelect(event) {
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        this.dispatchConfigChange('bulkFlowApiName', value);
        this.dispatchConfigChange('flowSearchTerm', label);
        this.showFlowDropdown = false;
    }

    handleBulkFlowLabelChange(event) {
        this.dispatchConfigChange('bulkFlowButtonLabel', event.target.value);
    }

    handleBulkFlowIconChange(event) {
        this.dispatchConfigChange('bulkFlowButtonIcon', event.target.value);
    }

    dispatchConfigChange(property, value) {
        this.dispatchEvent(new CustomEvent('configchange', {
            detail: { property, value }
        }));
    }
}
