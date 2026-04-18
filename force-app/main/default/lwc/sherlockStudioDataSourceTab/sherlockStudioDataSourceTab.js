import { LightningElement, api } from 'lwc';

export default class SherlockStudioDataSourceTab extends LightningElement {
    @api allObjects = [];
    @api targetObject = '';
    @api targetObjectLabel = '';
    @api searchTerm = '';

    showDropdown = false;

    get dropdownClass() {
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.showDropdown ? 'slds-is-open' : ''}`;
    }

    get filteredOptions() {
        if (!this.allObjects || this.allObjects.length === 0) return [];
        const safeTerm = this.searchTerm || '';
        
        if (safeTerm.length < 3) {
            // Suggest major objects
            return this.allObjects.filter(obj => obj.isMajor === 'true');
        } else {
            const lowSearch = safeTerm.toLowerCase();
            return this.allObjects.filter(obj => 
                obj.label.toLowerCase().includes(lowSearch) || 
                obj.value.toLowerCase().includes(lowSearch)
            );
        }
    }

    handleSearchInput(event) {
        const newValue = event.target.value;
        this.dispatchConfigChange('searchTerm', newValue);
        
        // Invalidate selections if the user edits or clears the selected label
        if (this.targetObject && newValue !== this.targetObjectLabel) {
            this.dispatchConfigChange('targetObject', '');
        }
        
        this.showDropdown = true;
    }

    handleInputFocus() {
        this.showDropdown = true;
    }

    handleBlur() {
        // Delay closing to allow click event on option
        setTimeout(() => {
            this.showDropdown = false;
        }, 200);
    }

    handleOptionSelect(event) {
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        
        this.dispatchConfigChange('targetObject', value);
        this.dispatchConfigChange('targetObjectLabel', label);
        this.dispatchConfigChange('searchTerm', label);
        
        this.showDropdown = false;
    }

    dispatchConfigChange(property, value) {
        this.dispatchEvent(new CustomEvent('configchange', {
            detail: { property, value }
        }));
    }
}
