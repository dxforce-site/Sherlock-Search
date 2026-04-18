import { LightningElement, api } from 'lwc';

/**
 * Dumb component for search keywords and dynamic form rendering.
 */
export default class SherlockSearchCondition extends LightningElement {
    /**
     * Raw configuration data from the parent.
     */
    @api config;

    /**
     * Current search keyword value.
     */
    @api searchKeyword;

    /**
     * Current form values for dynamic fields.
     */
    @api formValues = {};

    /**
     * Current custom logic string.
     */
    @api customLogic = '';

    /**
     * Current sort criteria array.
     */
    @api sortCriteria = [];

    /**
     * Whether advanced search section is expanded.
     */
    @api showAdvancedSearch = false;

    /**
     * Disabled state for all inputs.
     */
    @api disabled;

    // --- Dynamic UI Getters (Moved from parent) ---

    get advancedSearchIcon() {
        return this.showAdvancedSearch ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get hasSearchFields() {
        return this.config && this.config.searchFields && this.config.searchFields.length > 0;
    }

    /**
     * Normalizes search fields from config (handles both old string[] and new object[])
     */
    get normalizedSearchFields() {
        if (!this.config || !this.config.searchFields) return [];
        return this.config.searchFields.map((f, index) => {
            if (typeof f === 'string') {
                return { label: `${index + 1}. ${f}`, fieldName: f, type: 'text', inputType: 'text', isPicklist: false, conditionIndex: index + 1 };
            }
            
            // Map Salesforce types to lightning-input types
            let inputType = 'text';
            let isPicklist = false;
            let isLookup = false;
            let displayOptions = f.options ? [...f.options] : undefined;

            const sType = (f.type || '').toUpperCase();
            
            if (displayOptions) {
                isPicklist = true;
                // Add "All" option to the beginning
                displayOptions.unshift({ label: '-- すべて --', value: '' });
            } else if (sType === 'REFERENCE' && f.referenceTo) {
                isLookup = true;
            } else {
                if (sType === 'BOOLEAN') inputType = 'checkbox';
                else if (sType === 'DATE') inputType = 'date';
                else if (sType === 'DATETIME') inputType = 'datetime';
                else if (sType === 'TIME') inputType = 'time';
                else if (sType === 'DOUBLE' || sType === 'NUMBER' || sType === 'CURRENCY' || sType === 'PERCENT') inputType = 'number';
                else if (sType === 'EMAIL') inputType = 'email';
                else if (sType === 'PHONE') inputType = 'tel';
                else if (sType === 'URL') inputType = 'url';
            }
            
            const isRange = ['PERCENT', 'DOUBLE', 'NUMBER', 'CURRENCY', 'DATE', 'DATETIME', 'TIME'].includes(sType);
            const fieldName = f.fieldName || f;
            const currentValue = this.formValues[fieldName];
            
            let minVal = '', maxVal = '';
            let checkedVal = undefined;
            if (isRange && currentValue && typeof currentValue === 'object') {
                minVal = currentValue.min ?? '';
                maxVal = currentValue.max ?? '';
            } else {
                checkedVal = (inputType === 'checkbox' || inputType === 'toggle') ? !!currentValue : undefined;
            }

            return { 
                ...f, 
                label: `${index + 1}. ${f.label || fieldName || '不明な項目'}`, 
                fieldName: fieldName,
                value: isRange ? undefined : (currentValue ?? ''),
                valueMin: minVal,
                valueMax: maxVal,
                checked: checkedVal,
                inputType: inputType, 
                isPicklist: isPicklist,
                isLookup: isLookup,
                isRange: isRange,
                displayOptions: displayOptions,
                conditionIndex: index + 1
            };
        });
    }

    get gridClass() {
        const cols = this.config ? this.config.searchFormColumns : '1';
        return cols === '2' ? 'slds-size_1-of-1 slds-medium-size_1-of-2 slds-var-p-horizontal_xx-small slds-var-m-bottom_x-small' : 'slds-size_1-of-1 slds-var-p-horizontal_xx-small slds-var-m-bottom_x-small';
    }

    get sortFieldOptions() {
        if (!this.config || !this.config.columns) return [];
        return this.config.columns.map(col => {
            return { label: col.label, value: col.fieldName };
        });
    }

    get sortDirectionOptions() {
        return [
            { label: '昇順', value: 'ASC' },
            { label: '降順', value: 'DESC' }
        ];
    }
    
    get canAddSort() {
        return this.sortCriteria.length < 5;
    }

    get formattedSortCriteria() {
        return this.sortCriteria.map((sc, index) => {
            return {
                ...sc,
                priorityText: `第${index + 1}優先`
            };
        });
    }

    get isButtonVisible() {
        if (this.config && this.config.showInlineSearchButton === false) return false;
        return true;
    }

    get effectiveButtonLabel() {
        return (this.config?.panelButtonLabel) || (this.config?.buttonLabel) || '検索を実行';
    }

    get effectiveButtonVariant() {
        return (this.config?.panelButtonVariant) || (this.config?.buttonVariant) || 'brand';
    }

    // --- Dispatches ---

    handleKeywordChange(event) {
        this.dispatchEvent(new CustomEvent('conditionchange', {
            detail: {
                type: 'keyword',
                value: event.target.value
            }
        }));
    }

    handleFormInputChange(event) {
        const fieldName = event.target.dataset.id;
        const rangeType = event.target.dataset.rangeType;
        let value;

        if (event.target.tagName === 'LIGHTNING-RECORD-PICKER') {
            value = event.detail.recordId;
        } else {
            value = event.target.type === 'checkbox' || event.target.type === 'toggle'
                ? event.target.checked
                : event.target.value;
        }

        this.dispatchEvent(new CustomEvent('conditionchange', {
            detail: {
                type: 'form',
                fieldName: fieldName,
                rangeType: rangeType,
                value: value
            }
        }));
    }

    toggleAdvancedSearch(event) {
        event.preventDefault();
        this.dispatchEvent(new CustomEvent('conditionchange', {
            detail: {
                type: 'toggleAdvanced'
            }
        }));
    }

    handleCustomLogicChange(event) {
        this.dispatchEvent(new CustomEvent('conditionchange', {
            detail: {
                type: 'customLogic',
                value: event.target.value
            }
        }));
    }

    handleAddSort(event) {
        event.preventDefault();
        this.dispatchEvent(new CustomEvent('conditionchange', {
            detail: {
                type: 'sortAdd'
            }
        }));
    }

    handleRemoveSort(event) {
        event.preventDefault();
        const sortId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('conditionchange', {
            detail: {
                type: 'sortRemove',
                id: sortId
            }
        }));
    }

    handleSortFieldChange(event) {
        this.dispatchEvent(new CustomEvent('conditionchange', {
            detail: {
                type: 'sortField',
                id: event.target.dataset.id,
                value: event.detail.value
            }
        }));
    }

    handleSortDirectionChange(event) {
        this.dispatchEvent(new CustomEvent('conditionchange', {
            detail: {
                type: 'sortDirection',
                id: event.target.dataset.id,
                value: event.detail.value
            }
        }));
    }

    handleSearchClick() {
        this.dispatchEvent(new CustomEvent('search'));
    }
}

