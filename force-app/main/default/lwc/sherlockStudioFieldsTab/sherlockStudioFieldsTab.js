import { LightningElement, api, track } from 'lwc';
import getObjectFields from '@salesforce/apex/SherlockCpeHelper.getObjectFields';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class SherlockStudioFieldsTab extends LightningElement {
    @api targetObjectLabel = '';
    @api targetObject = '';

    @api fieldOptions = [];
    @api searchFields = [];
    @api resultColumns = [];
    @api parentFieldLabels = {};

    @api childRelOptions = [];
    @api childRelationValue = '';
    @api childObjectApiName = '';
    @api childObjectLabel = '';
    @api childRelationshipField = '';
    @api childFieldOptions = [];
    @api childFields = [];
    @api childParentFields = [];

    // Local UI State
    fieldSearchTerm = '';
    columnSearchTerm = '';
    childColumnSearchTerm = '';
    childParentFieldSearchTerm = '';

    // Step 2 Parent Field Explorer State
    selectedLookup = '';
    lookupSearchTerm = '';
    showLookupDropdown = false;
    @track parentFields = [];
    selectedParentField = '';
    parentSearchTerm = '';
    showParentDropdown = false;
    isLoadingParentFields = false;

    // Child Relation State
    childRelSearchTerm = '';
    showChildRelDropdown = false;

    // Step 3 Child Parent Field Explorer State
    selectedStep3Lookup = '';
    step3LookupSearchTerm = '';
    showStep3LookupDropdown = false;
    @track step3ParentFields = [];
    selectedStep3ParentField = '';
    step3ParentSearchTerm = '';
    showStep3ParentDropdown = false;
    isLoadingStep3ParentFields = false;

    // --- Getters ---

    get allFieldOptions() {
        const options = [...(this.fieldOptions || [])];
        const existingValues = new Set(options.map(o => o.value));

        const addIfMissing = (fieldName) => {
            if (fieldName && fieldName.includes('.') && !existingValues.has(fieldName)) {
                const parts = fieldName.split('.');
                const displayLabel = this.parentFieldLabels[fieldName] || `${parts[0]}.${parts[parts.length - 1]}`;
                options.push({
                    label: `${displayLabel} (${fieldName})`,
                    value: fieldName,
                    type: 'STRING'
                });
                existingValues.add(fieldName);
            }
        };

        (this.searchFields || []).forEach(addIfMissing);
        (this.resultColumns || []).forEach(addIfMissing);

        return options;
    }

    get filteredFieldOptions() {
        const options = this.allFieldOptions;
        if (!this.fieldSearchTerm) return options;
        const lowSearch = this.fieldSearchTerm.toLowerCase();
        return options.filter(opt => 
            (this.searchFields && this.searchFields.includes(opt.value)) || 
            opt.label.toLowerCase().includes(lowSearch)
        );
    }

    get filteredColumnOptions() {
        const options = this.allFieldOptions;
        if (!this.columnSearchTerm) return options;
        const lowSearch = this.columnSearchTerm.toLowerCase();
        return options.filter(opt => 
            (this.resultColumns && this.resultColumns.includes(opt.value)) || 
            opt.label.toLowerCase().includes(lowSearch)
        );
    }

    get lookupFieldOptions() {
        return (this.fieldOptions || [])
            .filter(f => f.type === 'REFERENCE' && f.relationshipName)
            .map(f => ({ label: f.label, value: f.value }));
    }

    get parentDropdownClass() {
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.showParentDropdown ? 'slds-is-open' : ''}`;
    }

    get parentDropdownPlaceholder() {
        return this.isLoadingParentFields ? '項目を読み込み中...' : '親レコードの項目を検索...';
    }

    get filteredParentFieldOptions() {
        if (!this.parentSearchTerm) return this.parentFields;
        const lowSearch = this.parentSearchTerm.toLowerCase();
        return this.parentFields.filter(f => 
            f.label.toLowerCase().includes(lowSearch) || 
            f.value.toLowerCase().includes(lowSearch)
        );
    }

    get noParentFieldsFound() {
        return this.parentFields.length > 0 && this.filteredParentFieldOptions.length === 0;
    }

    get lookupDropdownClass() {
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.showLookupDropdown ? 'slds-is-open' : ''}`;
    }

    get filteredLookupFieldOptions() {
        const options = this.lookupFieldOptions;
        if (!this.lookupSearchTerm) return options;
        const lowSearch = this.lookupSearchTerm.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(lowSearch));
    }

    get childRelDropdownClass() {
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.showChildRelDropdown ? 'slds-is-open' : ''}`;
    }

    get filteredChildRelOptions() {
        const options = this.childRelOptions || [];
        if (!this.childRelSearchTerm) return options;
        const lowSearch = this.childRelSearchTerm.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(lowSearch));
    }

    get step3LookupDropdownClass() {
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.showStep3LookupDropdown ? 'slds-is-open' : ''}`;
    }

    get filteredStep3LookupFieldOptions() {
        const options = this.lookupFieldOptions;
        if (!this.step3LookupSearchTerm) return options;
        const lowSearch = this.step3LookupSearchTerm.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(lowSearch));
    }

    get isAddParentDisabled() {
        return !this.selectedParentField;
    }

    get isParentFieldDisabled() {
        return !this.selectedLookup;
    }

    /* Child Drilldown Getters */

    get filteredChildColumnOptions() {
        const options = this.childFieldOptions || [];
        if (!this.childColumnSearchTerm) return options;
        const lowSearch = this.childColumnSearchTerm.toLowerCase();
        return options.filter(opt =>
            (this.childFields && this.childFields.includes(opt.value)) ||
            opt.label.toLowerCase().includes(lowSearch)
        );
    }

    get filteredChildParentFieldOptions() {
        const options = this.allFieldOptions;
        if (!this.childParentFieldSearchTerm) return options;
        const lowSearch = this.childParentFieldSearchTerm.toLowerCase();
        return options.filter(opt =>
            (this.childParentFields && this.childParentFields.includes(opt.value)) ||
            opt.label.toLowerCase().includes(lowSearch)
        );
    }

    get childStep2Label() {
        if (!this.childObjectLabel || !this.childObjectApiName) return 'Step 2: 子レコードの表示列';
        return `Step 2: ${this.childObjectLabel} (${this.childObjectApiName})の表示列`;
    }

    get childStep3Label() {
        const objLabel = this.targetObjectLabel || '親レコード';
        return `Step 3: ${objLabel}の強調表示項目 (最大5つ)`;
    }

    get step3DropdownClass() {
        return `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click ${this.showStep3ParentDropdown ? 'slds-is-open' : ''}`;
    }

    get filteredStep3ParentFieldOptions() {
        if (!this.step3ParentSearchTerm) return this.step3ParentFields;
        const lowSearch = this.step3ParentSearchTerm.toLowerCase();
        return this.step3ParentFields.filter(opt => opt.label.toLowerCase().includes(lowSearch));
    }

    get isAddStep3ParentDisabled() {
        return !this.selectedStep3Lookup || !this.selectedStep3ParentField;
    }

    get parentSearchPlaceholder() {
        return this.isLoadingStep3ParentFields ? '項目を読み込み中...' : '親レコードの項目を検索...';
    }


    // --- Handlers ---

    handleFieldSearchChange(event) {
        this.fieldSearchTerm = event.target.value;
    }

    handleSearchFieldsChange(event) {
        this.dispatchConfigChange('searchFields', event.detail.value);
    }

    handleColumnSearchChange(event) {
        this.columnSearchTerm = event.target.value;
    }

    handleResultColumnsChange(event) {
        this.dispatchConfigChange('resultColumns', event.detail.value);
    }

    handleLookupSearchInput(event) {
        this.lookupSearchTerm = event.target.value;
        this.showLookupDropdown = true;
    }

    handleLookupFocus() {
        this.showLookupDropdown = true;
    }

    handleLookupBlur() {
        setTimeout(() => {
            this.showLookupDropdown = false;
        }, 200);
    }

    handleLookupSelect(event) {
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        this.selectedLookup = value;
        this.lookupSearchTerm = label;
        this.showLookupDropdown = false;

        this.selectedParentField = '';
        this.parentSearchTerm = '';
        this.parentFields = [];
        
        const lookupInfo = (this.fieldOptions || []).find(f => f.value === this.selectedLookup);
        if (lookupInfo && lookupInfo.referenceTo) {
            this.isLoadingParentFields = true;
            getObjectFields({ objectApiName: lookupInfo.referenceTo })
                .then(result => {
                    this.parentFields = result;
                })
                .catch(error => {
                    this.showToast('エラー', '親レコード項目の取得に失敗しました', 'error');
                })
                .finally(() => {
                    this.isLoadingParentFields = false;
                });
        }
    }

    handleParentSearchInput(event) {
        this.parentSearchTerm = event.target.value;
        this.showParentDropdown = true;
    }

    handleParentFocus() {
        this.showParentDropdown = true;
    }

    handleParentBlur() {
        setTimeout(() => {
            this.showParentDropdown = false;
        }, 200);
    }

    handleParentSelect(event) {
        this.selectedParentField = event.currentTarget.dataset.value;
        this.parentSearchTerm = event.currentTarget.dataset.label;
        this.showParentDropdown = false;
    }

    handleAddParentField() {
        if (!this.selectedLookup || !this.selectedParentField) return;

        const lookupInfo = (this.fieldOptions || []).find(f => f.value === this.selectedLookup);
        const parentFieldInfo = this.parentFields.find(f => f.value === this.selectedParentField);

        if (lookupInfo && parentFieldInfo) {
            const relationshipName = lookupInfo.relationshipName;
            const fullApiName = `${relationshipName}.${parentFieldInfo.value}`;
            
            const lookupLabel = lookupInfo.label.split(' (')[0].replace(' ID', '');
            const fieldLabel = parentFieldInfo.label.split(' (')[0];
            const displayLabel = `${lookupLabel}.${fieldLabel}`;
            
            let newResultColumns = [...(this.resultColumns || [])];
            let newParentFieldLabels = { ...(this.parentFieldLabels || {}) };

            if (!newResultColumns.includes(fullApiName)) {
                newParentFieldLabels[fullApiName] = displayLabel;
                newResultColumns.push(fullApiName);
                
                this.dispatchConfigChange('parentFieldLabels', newParentFieldLabels);
                this.dispatchConfigChange('resultColumns', newResultColumns);
                this.showToast('成功', `表示列に ${displayLabel} (${fullApiName}) を追加しました`, 'success');
            } else {
                this.showToast('情報', 'この項目はすでに追加されています', 'info');
            }
        }
    }

    handleChildRelSearchInput(event) {
        this.childRelSearchTerm = event.target.value;
        this.showChildRelDropdown = true;
    }

    handleChildRelFocus() {
        this.showChildRelDropdown = true;
    }

    handleChildRelBlur() {
        setTimeout(() => {
            this.showChildRelDropdown = false;
        }, 200);
    }

    handleChildRelSelect(event) {
        const val = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        this.childRelSearchTerm = label;
        this.showChildRelDropdown = false;

        this.dispatchConfigChange('childRelationValue', val);
        if (val) {
            const selectedOpt = (this.childRelOptions || []).find(o => o.value === val);
            if (selectedOpt) {
                this.dispatchConfigChange('childObjectApiName', selectedOpt.childObjectApiName);
                this.dispatchConfigChange('childObjectLabel', selectedOpt.label.split(' (')[0]);
                this.dispatchConfigChange('childRelationshipField', selectedOpt.childRelationshipField);
            }
        } else {
            this.dispatchConfigChange('childObjectApiName', '');
            this.dispatchConfigChange('childObjectLabel', '');
            this.dispatchConfigChange('childRelationshipField', '');
        }
    }

    handleChildColumnSearchChange(event) {
        this.childColumnSearchTerm = event.target.value;
    }

    handleChildFieldsChange(event) {
        this.dispatchConfigChange('childFields', event.detail.value);
    }

    handleChildParentSearchChange(event) {
        this.childParentFieldSearchTerm = event.target.value;
    }

    handleChildParentFieldsChange(event) {
        const val = event.detail.value;
        if (val.length > 5) {
            this.showToast('警告', '親レコードの強調表示項目は最大5つまでです。保存できません。', 'warning');
        }
        this.dispatchConfigChange('childParentFields', val);
    }

    handleStep3LookupSearchInput(event) {
        this.step3LookupSearchTerm = event.target.value;
        this.showStep3LookupDropdown = true;
    }

    handleStep3LookupFocus() {
        this.showStep3LookupDropdown = true;
    }

    handleStep3LookupBlur() {
        setTimeout(() => {
            this.showStep3LookupDropdown = false;
        }, 200);
    }

    handleStep3LookupSelect(event) {
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        this.selectedStep3Lookup = value;
        this.step3LookupSearchTerm = label;
        this.showStep3LookupDropdown = false;

        this.selectedStep3ParentField = '';
        this.step3ParentSearchTerm = '';
        if (this.selectedStep3Lookup) {
            this.fetchStep3ParentFields();
        } else {
            this.step3ParentFields = [];
        }
    }

    fetchStep3ParentFields() {
        this.isLoadingStep3ParentFields = true;
        const lookupField = (this.fieldOptions || []).find(f => f.value === this.selectedStep3Lookup);
        if (lookupField && lookupField.referenceTo) {
            getObjectFields({ objectApiName: lookupField.referenceTo })
                .then(result => {
                    this.step3ParentFields = result;
                })
                .catch(error => {
                    this.showToast('エラー', '親オブジェクト項目の取得に失敗しました', 'error');
                })
                .finally(() => {
                    this.isLoadingStep3ParentFields = false;
                });
        }
    }

    handleStep3ParentSearchInput(event) {
        this.step3ParentSearchTerm = event.target.value;
        if (this.selectedStep3ParentField && this.step3ParentSearchTerm !== this.selectedStep3ParentField) {
            this.selectedStep3ParentField = '';
        }
        this.showStep3ParentDropdown = true;
    }

    handleStep3ParentFocus() {
        this.showStep3ParentDropdown = true;
    }

    handleStep3ParentBlur() {
        setTimeout(() => {
            this.showStep3ParentDropdown = false;
        }, 200);
    }

    handleStep3ParentSelect(event) {
        this.selectedStep3ParentField = event.currentTarget.dataset.value;
        this.step3ParentSearchTerm = event.currentTarget.dataset.label;
        this.showStep3ParentDropdown = false;
    }

    handleAddStep3ParentField() {
        if (!this.selectedStep3Lookup || !this.selectedStep3ParentField) return;

        const lookupInfo = (this.fieldOptions || []).find(f => f.value === this.selectedStep3Lookup);
        const parentFieldInfo = this.step3ParentFields.find(f => f.value === this.selectedStep3ParentField);

        if (lookupInfo && parentFieldInfo) {
            const relationshipName = lookupInfo.relationshipName;
            const fullApiName = `${relationshipName}.${parentFieldInfo.value}`;
            
            const lookupLabel = lookupInfo.label.split(' (')[0].replace(' ID', '');
            const fieldLabel = parentFieldInfo.label.split(' (')[0];
            const displayLabel = `${lookupLabel}.${fieldLabel}`;
            
            let newChildParentFields = [...(this.childParentFields || [])];
            let newParentFieldLabels = { ...(this.parentFieldLabels || {}) };

            if (!newChildParentFields.includes(fullApiName)) {
                newParentFieldLabels[fullApiName] = displayLabel;
                newChildParentFields.push(fullApiName);
                
                this.dispatchConfigChange('parentFieldLabels', newParentFieldLabels);
                this.dispatchConfigChange('childParentFields', newChildParentFields);
                this.showToast('成功', `強調表示に ${displayLabel} (${fullApiName}) を追加しました`, 'success');
            } else {
                this.showToast('情報', 'この項目はすでに追加されています', 'info');
            }
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    dispatchConfigChange(property, value) {
        this.dispatchEvent(new CustomEvent('configchange', {
            detail: { property, value }
        }));
    }
}
