import { LightningElement, wire, track } from 'lwc';
import { publish, MessageContext } from 'lightning/messageService';
import SHERLOCK_SEARCH_CHANNEL from '@salesforce/messageChannel/SherlockSearchChannel__c';
import getAvailableObjects from '@salesforce/apex/SherlockCpeHelper.getAvailableObjects';
import getObjectFields from '@salesforce/apex/SherlockCpeHelper.getObjectFields';
import saveConfig from '@salesforce/apex/SherlockSearchController.saveConfig';
import getConfig from '@salesforce/apex/SherlockSearchController.getConfig';
import getAllInstanceIds from '@salesforce/apex/SherlockSearchController.getAllInstanceIds';
import deleteConfig from '@salesforce/apex/SherlockSearchController.deleteConfig';
import getAvailableFlows from '@salesforce/apex/SherlockCpeHelper.getAvailableFlows';
import getChildRelationships from '@salesforce/apex/SherlockCpeHelper.getChildRelationships';
import { showToast as commonShowToast } from 'c/sherlockToastUtils';

import { refreshApex } from '@salesforce/apex';
import LightningConfirm from 'lightning/confirm';

export default class SherlockStudio extends LightningElement {
    
    @wire(MessageContext)
    messageContext;

    @track allObjects = [];
    @track filteredOptions = [];
    @track fieldOptions = [];
    @track isDirty = false;

    instanceId = '';
    @track allInstanceIds = [];
    _wiredInstanceIdsResult;
    
    isSaveModalOpen = false;
    saveType = 'overwrite';
    newSettingsId = '';

    targetObject = '';
    targetObjectLabel = ''; // To show the label in the search box
    searchTerm = '';
    
    searchFields = [];
    resultColumns = [];
    hiddenFilter = '';
    searchFormColumns = '1';
    showInlineSearchButton = true;
    panelButtonLabel = '検索';
    panelButtonVariant = 'brand';
    standaloneButtonLabel = '検索';
    standaloneButtonVariant = 'brand';

    panelTitle = '検索パネル';
    resultsTitle = '検索結果パネル';

    // Cache for parent field labels: { 'Account.Name': '取引先.名前' }
    @track parentFieldLabels = {};

    @track availableFlows = [];
    @track flowSearchTerm = '';
    bulkFlowApiName = '';
    bulkFlowButtonLabel = 'フロー実行';
    bulkFlowButtonIcon = 'utility:play';

    enableExport = false;
    exportLimit = 1000;
    exportFileName = '';

    // --- Child Drilldown Settings ---
    @track childRelOptions = [];
    @track childFieldOptions = [];
    childRelationValue = ''; // Stores childObjectApiName::childRelationshipField
    childObjectApiName = '';
    childObjectLabel = '';
    childRelationshipField = '';
    childFields = [];
    childParentFields = [];

    message = '';

    @wire(getAvailableObjects)
    wiredObjects({ error, data }) {
        if (data) {
            this.allObjects = data;
        } else if (error) {
            this.showToast('エラー', 'オブジェクトの取得に失敗しました', 'error');
        }
    }

    @wire(getAllInstanceIds)
    wiredInstanceIds(result) {
        this._wiredInstanceIdsResult = result;
        const { error, data } = result;
        if (data) {
            this.allInstanceIds = data;
        } else if (error) {
            console.error('Error fetching instance IDs', error);
        }
    }

    @wire(getAvailableFlows)
    wiredFlows({ error, data }) {
        if (data) {
            this.availableFlows = data;
            // Resolve label if API name is already set
            if (this.bulkFlowApiName) {
                const flow = this.availableFlows.find(f => f.value === this.bulkFlowApiName);
                if (flow) this.flowSearchTerm = flow.label;
            }
        } else if (error) {
            console.error('Error fetching flows', error);
        }
    }

    get isLoadDisabled() {
        return !this.instanceId;
    }

    get isSaveDisabled() {
        const requiredFieldsOk = this.targetObject && this.searchFields.length > 0 && this.resultColumns.length > 0;
        return !requiredFieldsOk || !this.isDirty;
    }

    get showTabs() {
        return !!(this.instanceId || this.targetObject);
    }

    get idOptions() {
        return this.allInstanceIds.map(id => ({ label: id, value: id }));
    }

    get allFieldOptions() {
        // Merge standard fields with any custom/parent fields already in selection
        const options = [...this.fieldOptions];
        const existingValues = new Set(options.map(o => o.value));

        const addIfMissing = (fieldName) => {
            if (fieldName && fieldName.includes('.') && !existingValues.has(fieldName)) {
                const parts = fieldName.split('.');
                // Use cached label if available, otherwise fallback to relationship.field
                const displayLabel = this.parentFieldLabels[fieldName] || `${parts[0]}.${parts[parts.length - 1]}`;
                options.push({
                    label: `${displayLabel} (${fieldName})`,
                    value: fieldName,
                    type: 'STRING'
                });
                existingValues.add(fieldName);
            }
        };

        this.searchFields.forEach(addIfMissing);
        this.resultColumns.forEach(addIfMissing);

        return options;
    }

    resetStudioState() {
        this.instanceId = '';
        this.targetObject = '';
        this.targetObjectLabel = '';
        this.searchTerm = '';
        this.searchFields = [];
        this.resultColumns = [];
        this.hiddenFilter = '';
        this.searchFormColumns = '1';
        this.showInlineSearchButton = true;
        this.panelButtonLabel = '検索';
        this.panelButtonVariant = 'brand';
        this.standaloneButtonLabel = '検索';
        this.standaloneButtonVariant = 'brand';
        this.panelTitle = '検索パネル';
        this.resultsTitle = '検索結果パネル';
        this.fieldOptions = [];
        this.bulkFlowApiName = '';
        this.flowSearchTerm = '';
        this.enableExport = false;
        this.exportLimit = 1000;
        this.exportFileName = '';
        this.newSettingsId = '';
        this.parentFieldLabels = {};
        this.childRelationValue = '';
        this.childObjectApiName = '';
        this.childRelationshipField = '';
        this.childFields = [];
        this.childParentFields = [];
        this.childRelOptions = [];
        this.childFieldOptions = [];
        this.isDirty = false;
    }

    handleSettingsChange(event) {
        this.instanceId = event.detail.value;
        if (this.instanceId) {
            this.handleLoadConfig();
        } else {
            this.resetStudioState();
        }
    }

    async handleDeleteConfig() {
        if (!this.instanceId) return;
        
        const result = await LightningConfirm.open({
            message: `設定 '${this.instanceId}' を削除してもよろしいですか？`,
            variant: 'headerless',
            label: '削除の確認',
            theme: 'error'
        });
        
        if (result) {
            try {
                await deleteConfig({ instanceId: this.instanceId });
                this.showToast('成功', '設定を削除しました', 'success');
                this.resetStudioState();
                await refreshApex(this._wiredInstanceIdsResult);
            } catch (error) {
                this.showToast('エラー', '設定の削除に失敗しました: ' + (error?.body?.message || error?.message || '不明なエラー'), 'error');
            }
        }
    }

    openSaveModal() {
        this.saveType = this.instanceId ? 'overwrite' : 'new';
        this.newSettingsId = '';
        this.isSaveModalOpen = true;
    }

    closeSaveModal() {
        this.isSaveModalOpen = false;
    }

    handleSaveTypeChange(event) {
        this.saveType = event.detail.value;
    }

    handleNewSettingsIdChange(event) {
        this.newSettingsId = event.detail.value;
    }

    get saveOptions() {
        return [
            { label: '既存の設定を上書き', value: 'overwrite' },
            { label: '名前をつけて保存', value: 'new' }
        ];
    }

    get isSaveAsNew() {
        return this.saveType === 'new' || !this.instanceId;
    }

    get isModalSaveDisabled() {
        // Child parent fields length check (Max 5)
        if (this.childParentFields && this.childParentFields.length > 5) {
            return true;
        }

        if (this.isSaveAsNew) {
            return !this.newSettingsId || this.newSettingsId.trim().length < 3 || this.isSaveDisabled;
        }
        return this.isSaveDisabled;
    }

    handleGeneralConfigChange(event) {
        const { property, value } = event.detail;
        this.isDirty = true;
        if (property === 'targetObject') {
            this.targetObject = value;
            this.fieldOptions = [];
            this.searchFields = [];
            this.resultColumns = [];
            this.parentFieldLabels = {};
            this.childRelOptions = [];
            this.childRelationValue = '';
            this.childObjectApiName = '';
            this.childObjectLabel = '';
            this.childRelationshipField = '';
            if (value) {
                this.fetchFields();
                this.fetchChildRelationships();
            }
        } else {
            this[property] = value;
            if (property === 'childRelationValue' && value) {
                this.childFields = [];
                this.fetchChildFields();
            } else if (property === 'childRelationValue' && !value) {
                this.childFields = [];
                this.childFieldOptions = [];
            }
        }
    }

    fetchFields() {
        if (!this.targetObject) return;
        getObjectFields({ objectApiName: this.targetObject })
            .then(result => {
                this.fieldOptions = result;
            })
            .catch(error => {
                this.showToast('エラー', '項目の取得に失敗しました', 'error');
            });
    }

    fetchChildRelationships() {
        if (!this.targetObject) return;
        getChildRelationships({ objectApiName: this.targetObject })
            .then(result => {
                this.childRelOptions = result;
                // If we already have a selected value (e.g. from load), update label
                if (this.childRelationValue) {
                    const opt = this.childRelOptions.find(o => o.value === this.childRelationValue);
                    if (opt) this.childObjectLabel = opt.label.split(' (')[0];
                }
            })
            .catch(error => {
                this.showToast('エラー', '子リレーションの取得に失敗しました: ' + (error?.body?.message || ''), 'error');
            });

        // Reset Step 3 explorer state
        this.selectedStep3Lookup = '';
        this.step3ParentFields = [];
        this.selectedStep3ParentField = '';
        this.step3ParentSearchTerm = '';
    }

    fetchChildFields() {
        if (!this.childObjectApiName) {
            this.childFieldOptions = [];
            return;
        }
        getObjectFields({ objectApiName: this.childObjectApiName })
            .then(result => {
                this.childFieldOptions = result;
            })
            .catch(error => {
                this.showToast('エラー', '子オブジェクト項目の取得に失敗しました', 'error');
            });
    }

    handleLoadConfig(suppressToast = false) {
        if (!this.instanceId) return;
        
        getConfig({ instanceId: this.instanceId })
            .then(result => {
                if (result) {
                    const parsed = JSON.parse(result);
                    this.targetObject = parsed.targetObject || '';
                    this.hiddenFilter = parsed.hiddenFilter || '';
                    this.searchFormColumns = parsed.searchFormColumns || '1';
                    this.showInlineSearchButton = (parsed.showInlineSearchButton !== undefined) ? parsed.showInlineSearchButton : true;
                    this.panelButtonLabel = parsed.panelButtonLabel || parsed.buttonLabel || 'Search Now'; // Fallback to old property
                    this.panelButtonVariant = parsed.panelButtonVariant || parsed.buttonVariant || 'brand';
                    this.standaloneButtonLabel = parsed.standaloneButtonLabel || 'Search';
                    this.standaloneButtonVariant = parsed.standaloneButtonVariant || 'brand';
                    this.bulkFlowApiName = parsed.bulkFlowApiName || '';
                    this.bulkFlowButtonLabel = parsed.bulkFlowButtonLabel || 'Run Flow';
                    this.bulkFlowButtonIcon = parsed.bulkFlowButtonIcon || 'utility:play';
                    this.enableExport = parsed.enableExport || false;
                    this.exportLimit = parsed.exportLimit || 1000;
                    this.exportFileName = parsed.exportFileName || '';
                    this.panelTitle = parsed.panelTitle || 'Sherlock Search Panel';
                    this.resultsTitle = parsed.resultsTitle || 'Sherlock Search Results';
                    this.hiddenFilter = parsed.hiddenFilter || '';

                    // Resolve flow label if API name exists
                    if (this.bulkFlowApiName && this.availableFlows.length > 0) {
                        const flow = this.availableFlows.find(f => f.value === this.bulkFlowApiName);
                        if (flow) this.flowSearchTerm = flow.label;
                    } else if (this.bulkFlowApiName) {
                        this.flowSearchTerm = this.bulkFlowApiName;
                    } else {
                        this.flowSearchTerm = '';
                    }
                    
                    if (this.targetObject) {
                        const obj = this.allObjects.find(o => o.value === this.targetObject);
                        this.targetObjectLabel = obj ? obj.label : this.targetObject;
                        this.searchTerm = this.targetObjectLabel;
                        this.fetchFields();
                    }

                    // Restore Labels for Parent Fields from Saved Config
                    if (parsed.columns) {
                        parsed.columns.forEach(col => {
                            if (col.fieldName && col.fieldName.includes('.')) {
                                this.parentFieldLabels[col.fieldName] = col.label;
                            }
                        });
                    }

                    // Restore searchFields (handle both old string[] and new object[])
                    if (parsed.searchFields) {
                        this.searchFields = parsed.searchFields.map(f => typeof f === 'string' ? f : f.fieldName);
                    } else {
                        this.searchFields = [];
                    }

                    if (parsed.columns) {
                        this.resultColumns = parsed.columns.map(c => c.fieldName);
                    } else {
                        this.resultColumns = [];
                    }

                    // Restore Child Drilldown Settings
                    this.childObjectApiName = parsed.childObjectApiName || '';
                    this.childRelationshipField = parsed.childRelationshipField || '';
                    if (this.childObjectApiName && this.childRelationshipField) {
                        this.childRelationValue = `${this.childObjectApiName}::${this.childRelationshipField}`;
                        this.fetchChildFields();
                        // Recover childObjectLabel from childRelOptions if possible, or wait for next fetch
                        if (this.childRelOptions.length > 0) {
                            const opt = this.childRelOptions.find(o => o.value === this.childRelationValue);
                            if (opt) this.childObjectLabel = opt.label.split(' (')[0];
                        }
                    } else {
                        this.childRelationValue = '';
                        this.childObjectLabel = '';
                    }
                    if (parsed.childFields) {
                        this.childFields = parsed.childFields.map(c => typeof c === 'string' ? c : c.fieldName);
                    } else {
                        this.childFields = [];
                    }
                    if (parsed.childParentFields) {
                        this.childParentFields = parsed.childParentFields.map(c => {
                            if (typeof c === 'string') return c;
                            if (c.fieldName && c.fieldName.includes('.')) {
                                this.parentFieldLabels[c.fieldName] = c.label;
                            }
                            return c.fieldName;
                        });
                    } else {
                        this.childParentFields = [];
                    }

                    this.fetchChildRelationships();
                    
                    this.isDirty = false;
                    if (!suppressToast) {
                        this.showToast('成功', '設定を読み込みました', 'success');
                    }
                } else {
                    this.showToast('情報', '該当する設定が見つかりませんでした', 'info');
                }
            })
            .catch(error => {
                this.showToast('エラー', '設定の読み込みに失敗しました: ' + (error?.body?.message || error?.message || '不明なエラー'), 'error');
            });
    }

    async executeSaveSettings() {
        const targetId = this.isSaveAsNew ? this.newSettingsId.trim() : this.instanceId;

        // Enriched search fields with labels and types (Self-healing logic)
        const searchFieldsData = this.searchFields.map(fName => {
            const fieldInfo = this.allFieldOptions.find(f => f.value === fName);
            const labelStr = fieldInfo ? fieldInfo.label.split(' (')[0] : fName;
            const typeStr = fieldInfo ? fieldInfo.type : 'STRING';
            const options = fieldInfo ? fieldInfo.options : undefined;
            const referenceTo = fieldInfo ? fieldInfo.referenceTo : undefined;
            return { label: labelStr, fieldName: fName, type: typeStr, options: options, referenceTo: referenceTo };
        });

        // Enriched result columns (Self-healing logic)
        const columnsData = this.resultColumns.map(fName => {
            const fieldInfo = this.allFieldOptions.find(f => f.value === fName);
            const labelStr = fieldInfo ? fieldInfo.label.split(' (')[0] : fName;
            const typeStr = fieldInfo ? fieldInfo.type : 'STRING';
            return { label: labelStr, fieldName: fName, type: typeStr }; 
        });

        const childFieldsData = this.childFields.map(fName => {
            const fieldInfo = this.childFieldOptions.find(f => f.value === fName);
            const labelStr = fieldInfo ? fieldInfo.label.split(' (')[0] : fName;
            const typeStr = fieldInfo ? fieldInfo.type : 'STRING';
            return { label: labelStr, fieldName: fName, type: typeStr };
        });

        const childParentFieldsData = this.childParentFields.map(fName => {
            const fieldInfo = this.allFieldOptions.find(f => f.value === fName);
            const labelStr = fieldInfo ? fieldInfo.label.split(' (')[0] : (this.parentFieldLabels[fName] || fName);
            const typeStr = fieldInfo ? fieldInfo.type : 'STRING';
            return { label: labelStr, fieldName: fName, type: typeStr };
        });

        const payload = {
            targetObject: this.targetObject,
            panelTitle: this.panelTitle,
            resultsTitle: this.resultsTitle,
            searchFields: searchFieldsData,
            columns: columnsData,
            hiddenFilter: this.hiddenFilter,
            searchFormColumns: this.searchFormColumns,
            showInlineSearchButton: this.showInlineSearchButton,
            panelButtonLabel: this.panelButtonLabel,
            panelButtonVariant: this.panelButtonVariant,
            standaloneButtonLabel: this.standaloneButtonLabel,
            standaloneButtonVariant: this.standaloneButtonVariant,
            bulkFlowApiName: this.bulkFlowApiName,
            bulkFlowButtonLabel: this.bulkFlowButtonLabel,
            bulkFlowButtonIcon: this.bulkFlowButtonIcon,
            enableExport: this.enableExport,
            exportLimit: this.exportLimit,
            exportFileName: this.exportFileName,
            childObjectApiName: this.childObjectApiName,
            childRelationshipField: this.childRelationshipField,
            childFields: childFieldsData,
            childParentFields: childParentFieldsData
        };

        try {
            await saveConfig({ instanceId: targetId, configJson: JSON.stringify(payload) });
            this.showToast('成功', '設定を保存しました', 'success');
            
            // Notify other components (like Search Panel) to reload config
            publish(this.messageContext, SHERLOCK_SEARCH_CHANNEL, {
                context: {
                    instanceId: targetId,
                    type: 'CONFIG_UPDATED'
                }
            });

            this.instanceId = targetId;
            await refreshApex(this._wiredInstanceIdsResult);
            this.closeSaveModal();
            // Automatically reload the config to ensure the UI is fresh (suppressing the extra toast)
            this.handleLoadConfig(true);
            this.isDirty = false;
        } catch (error) {
            this.showToast('エラー', '設定の保存に失敗しました: ' + (error?.body?.message || error?.message || '不明なエラー'), 'error');
            console.error(error);
        }
    }

    showToast(title, message, variant) {
        commonShowToast(this, title, message, variant);
    }

}