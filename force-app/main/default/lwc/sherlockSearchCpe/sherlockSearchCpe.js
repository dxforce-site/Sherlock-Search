import { LightningElement, api, wire, track } from 'lwc';
import getAvailableObjects from '@salesforce/apex/SherlockCpeHelper.getAvailableObjects';
import getObjectFields from '@salesforce/apex/SherlockCpeHelper.getObjectFields';

export default class SherlockSearchCpe extends LightningElement {
    @api builderContext;
    @track inputVariables = [];
    
    @track objectOptions = [];
    @track fieldOptions = [];

    // Local state for properties
    instanceId;
    targetObject;
    searchFields = [];
    resultColumns = [];

    @wire(getAvailableObjects)
    wiredObjects({ error, data }) {
        if (data) {
            this.objectOptions = data;
        } else if (error) {
            console.error('Error fetching objects', error);
        }
    }

    @api
    get value() {
        return this.inputVariables;
    }
    set value(variables) {
        this.inputVariables = variables || [];
        this.parseInputVariables();
    }

    parseInputVariables() {
        if (!this.inputVariables) return;
        this.inputVariables.forEach(v => {
            if (v.name === 'instanceId') this.instanceId = v.value;
            if (v.name === 'targetObject') this.targetObject = v.value;
            if (v.name === 'searchFields') {
                this.searchFields = v.value ? v.value.split(',') : [];
            }
            if (v.name === 'resultColumns') {
                try {
                    let parsed = JSON.parse(v.value);
                    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
                        this.resultColumns = parsed.map(c => c.fieldName);
                    } else if (Array.isArray(parsed)) {
                        this.resultColumns = parsed;
                    }
                } catch(e) {
                    this.resultColumns = v.value ? v.value.split(',') : [];
                }
            }
        });

        if (this.targetObject && this.fieldOptions.length === 0) {
            this.fetchFields();
        }
    }

    fetchFields() {
        if (!this.targetObject) return;
        getObjectFields({ objectApiName: this.targetObject })
            .then(result => {
                this.fieldOptions = result;
            })
            .catch(error => {
                console.error('Error fetching fields', error);
            });
    }

    handleInstanceIdChange(event) {
        this.instanceId = event.target.value;
        this.dispatchChangeEvent('instanceId', this.instanceId, 'String');
    }

    handleObjectChange(event) {
        this.targetObject = event.detail.value;
        this.dispatchChangeEvent('targetObject', this.targetObject, 'String');
        
        // Reset fields
        this.searchFields = [];
        this.resultColumns = [];
        this.dispatchChangeEvent('searchFields', '', 'String');
        this.dispatchChangeEvent('resultColumns', '', 'String');

        this.fetchFields();
    }

    handleSearchFieldsChange(event) {
        this.searchFields = event.detail.value;
        this.dispatchChangeEvent('searchFields', this.searchFields.join(','), 'String');
    }

    handleResultColumnsChange(event) {
        this.resultColumns = event.detail.value;
        const columnsData = this.resultColumns.map(fName => {
            const fieldInfo = this.fieldOptions.find(f => f.value === fName);
            const labelStr = fieldInfo ? fieldInfo.label.split(' (')[0] : fName;
            return { label: labelStr, fieldName: fName, type: 'text' }; // simplify type for now
        });
        
        this.dispatchChangeEvent('resultColumns', JSON.stringify(columnsData), 'String');
    }

    dispatchChangeEvent(name, newValue, dataType) {
        const valueChangeEvent = new CustomEvent('valuechange', {
            detail: {
                name: name,
                newValue: newValue,
                newValueDataType: dataType
            }
        });
        this.dispatchEvent(valueChangeEvent);
    }
}