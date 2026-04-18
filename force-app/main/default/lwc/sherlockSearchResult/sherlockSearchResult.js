import { LightningElement, api, wire, track } from 'lwc';
import { subscribe, publish, MessageContext, APPLICATION_SCOPE } from 'lightning/messageService';
import SHERLOCK_SEARCH_CHANNEL from '@salesforce/messageChannel/SherlockSearchChannel__c';
import FORM_FACTOR from '@salesforce/client/formFactor';
import { NavigationMixin } from 'lightning/navigation';
import { showToast } from 'c/sherlockToastUtils';

import updateRecords from '@salesforce/apex/SherlockSearchController.updateRecords';
import deleteRecord from '@salesforce/apex/SherlockSearchController.deleteRecord';
import executeSearch from '@salesforce/apex/SherlockSearchController.executeSearch';
import getChildRecords from '@salesforce/apex/SherlockSearchController.getChildRecords';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { setupColumns, setupChildColumns, flattenData, generateAndDownloadCSV } from './sherlockDataUtils';

export default class SherlockSearchResult extends NavigationMixin(LightningElement) {
    @api instanceId = 'Search_A';
    @api selectedRecordIds = [];

    @wire(MessageContext)
    messageContext;

    subscription = null;

    @track columns = [];
    @track flattenedData = [];
    @track draftValues = [];

    // --- Child Drilldown State ---
    @track isViewingChild = false;
    @track isFetchingChild = false;
    @track selectedParentRecordId = null;
    @track flattenedChildData = [];
    @track childColumns = [];
    
    // Config values
    targetObject = '';
    childObjectApiName = '';
    childRelationshipField = '';
    @track childFields = [];
    @track childParentFields = [];
    
    @track viewMode = FORM_FACTOR === 'Small' ? 'tile' : 'list';
    isLoadingMore = false;
    isSaving = false;
    enableInfiniteLoading = true;

    // Track total loaded to smartly disable scroll if no more data comes in
    lastLoadedCount = 0;
    
    @track showScrollIndicator = false;
    @track showChildScrollIndicator = false;
    
    // Bulk Flow State
    @track showFlowModal = false;
    bulkFlowApiName = '';
    bulkFlowButtonLabel = '';
    bulkFlowIcon = '';

    // Component Title
    @track resultsTitle = '検索結果パネル';

    // Wired Object Info for Dynamic Labels
    @wire(getObjectInfo, { objectApiName: '$targetObject' })
    wiredParentObjectInfo;

    @wire(getObjectInfo, { objectApiName: '$childObjectApiName' })
    wiredChildObjectInfo;

    // CSV Export State
    @track showExportModal = false;

    enableExport = false;
    exportLimit = 1000;
    exportFileName = '';
    lastSearchCriteria = null;
    isExporting = false;

    get isMobile() {
        return FORM_FACTOR === 'Small';
    }
    
    get isDesktop() {
        return !this.isMobile;
    }
    
    get isTileView() {
        return this.viewMode === 'tile' || this.isMobile;
    }

    get isListView() {
        return !this.isTileView;
    }

    get showBulkActionButton() {
        return !!this.bulkFlowApiName;
    }

    get showExportButton() {
        return this.enableExport && this.hasData;
    }

    get isBulkActionDisabled() {
        return !this.isListView || this.selectedRecordIds.length === 0;
    }

    get flowInputVariables() {
        return [
            {
                name: 'ids',
                type: 'String',
                value: this.selectedRecordIds
            }
        ];
    }

    get hasData() {
        return this.flattenedData && this.flattenedData.length > 0;
    }

    get toggleIconName() {
        return this.viewMode === 'list' ? 'utility:apps' : 'utility:list';
    }
    
    get toggleIconTitle() {
        return this.viewMode === 'list' ? 'タイル形式に切り替え' : 'リスト形式に切り替え';
    }

    get hasChildData() {
        return this.flattenedChildData && this.flattenedChildData.length > 0;
    }

    get scrollIndicatorClass() {
        return `scroll-hint-badge ${this.showScrollIndicator ? '' : 'hidden'}`;
    }

    get childScrollIndicatorClass() {
        return `scroll-hint-badge ${this.showChildScrollIndicator ? '' : 'hidden'}`;
    }

    get exportOptions() {
        const options = [
            { label: `条件に一致するすべての結果 (最大 ${this.exportLimit} 件)`, value: 'all' },
            { label: `現在読み込み済みのデータ (${this.flattenedData.length} 件)`, value: 'loaded' }
        ];
        if (this.selectedRecordIds && this.selectedRecordIds.length > 0) {
            options.unshift({ label: `選択中レコード (${this.selectedRecordIds.length} 件)`, value: 'selected' });
        }
        return options;
    }

    get parentHighlightLabel() {
        const label = this.wiredParentObjectInfo?.data?.label || this.targetObject || 'レコード';
        return `${label} 概要`;
    }

    get childListLabel() {
        const label = this.wiredChildObjectInfo?.data?.label || this.childObjectApiName || '子レコード';
        return `${label} の一覧`;
    }

    get currentObjectApiName() {
        return this.isViewingChild ? this.childObjectApiName : this.targetObject;
    }

    get parentHighlights() {
        if (!this.selectedParentRecordId || !this.childParentFields || this.childParentFields.length === 0) return [];
        
        const parentRecord = this.flattenedData.find(row => row.Id === this.selectedParentRecordId);
        if (!parentRecord) return [];
        
        return this.childParentFields.map(field => {
            const fieldName = (typeof field === 'string') ? field : field.fieldName;
            const label = (typeof field === 'string') ? field : field.label;
            let value = parentRecord[fieldName];
            
            // Handle boolean display
            if (typeof value === 'boolean') {
                value = value ? 'True' : 'False';
            }
            
            return {
                label: label,
                value: value || '-'
            };
        });
    }

    connectedCallback() {
        this.subscribeToMessageChannel();
    }

    subscribeToMessageChannel() {
        if (!this.subscription) {
            this.subscription = subscribe(
                this.messageContext,
                SHERLOCK_SEARCH_CHANNEL,
                (message) => this.handleMessage(message),
                { scope: APPLICATION_SCOPE }
            );
        }
    }

    handleMessage(message) {
        if (!message || !message.context || message.context.instanceId !== this.instanceId) {
            return;
        }

        if (message.context.type === 'CONFIG_AND_DATA') {
            if (message.config) {
                // Set config data FIRST before setting up columns
                this.configData = message.config;
                this.targetObject = message.config.targetObject;

                if (message.config.columns) {
                    this.columns = setupColumns(message.config.columns, this.configData);
                }

                // Child Drilldown Config
                this.childObjectApiName = message.config.childObjectApiName || '';
                this.childRelationshipField = message.config.childRelationshipField || '';
                this.childFields = message.config.childFields || [];
                this.childParentFields = message.config.childParentFields || [];
                if (this.childObjectApiName && this.childFields.length > 0) {
                    this.childColumns = setupChildColumns(this.childFields);
                } else {
                    this.childColumns = [];
                }

                // If configuration contains new search or payload changes, reset child view
                this.isViewingChild = false;
                this.selectedParentRecordId = null;

                // Capture Bulk Flow Config
                this.bulkFlowApiName = message.config.bulkFlowApiName || '';
                this.bulkFlowButtonLabel = message.config.bulkFlowButtonLabel || 'フロー実行';
                this.bulkFlowIcon = message.config.bulkFlowButtonIcon || 'utility:play';
                
                // Capture Export Config
                this.enableExport = message.config.enableExport || false;
                this.exportLimit = message.config.exportLimit || 1000;
                this.exportFileName = message.config.exportFileName || '';

                // Capture Title Config
                this.resultsTitle = message.config.resultsTitle || '検索結果パネル';
            }

            if (message.searchCriteria) {
                this.lastSearchCriteria = message.searchCriteria;
            }

            if (message.data && message.data.length > 0) {
                this.flattenedData = flattenData(message.data, this.columns);
                this.lastLoadedCount = message.data.length;
                this.enableInfiniteLoading = message.data.length >= 50; // assuming limit is 50
            } else {
                this.flattenedData = [];
                this.enableInfiniteLoading = false;
            }
            
            // Allow table to reset its loading status
            this.isLoadingMore = false;
        } 
        else if (message.context.type === 'TRIGGER_SEARCH') {
            this.isViewingChild = false;
            this.selectedParentRecordId = null;
        }
        else if (message.context.type === 'APPEND_DATA') {
            if (message.data && message.data.length > 0) {
                const newData = flattenData(message.data, this.columns);
                this.flattenedData = [...this.flattenedData, ...newData];
                this.lastLoadedCount = message.data.length;
                // If we got less than requested (assuming 50 limit), stop infinite loading
                this.enableInfiniteLoading = message.data.length >= 50;
            } else {
                this.enableInfiniteLoading = false;
            }
            this.isLoadingMore = false;
        }

        // Show scroll indicator if data exists and there are many columns (heuristical)
        if (this.hasData && this.columns && this.columns.length > 3) {
            this.showScrollIndicator = true;
        }
    }

    hideScrollIndicator() {
        this.showScrollIndicator = false;
    }

    hideChildScrollIndicator() {
        this.showChildScrollIndicator = false;
    }

    setupColumns(configColumns) {
        // Deep clone the columns Array to avoid mutation errors
        let enrichedColumns = JSON.parse(JSON.stringify(configColumns));

        enrichedColumns = enrichedColumns.map(col => {
            // Self-healing: if type is missing, try to find it in searchFields
            if (!col.type && !col.sfdcType && this.configData && this.configData.searchFields) {
                const matchingSearchField = this.configData.searchFields.find(f => f.fieldName === col.fieldName);
                if (matchingSearchField && matchingSearchField.type) {
                    col.type = matchingSearchField.type;
                }
            }

            // Support both old 'sfdcType' and new 'type' property
            const rawType = (col.sfdcType || col.type || '').toUpperCase();
            
            // Default type is text
            col.type = 'text';

            // Map Salesforce types to datatable-compatible types
            if (rawType === 'BOOLEAN') col.type = 'boolean';
            else if (rawType === 'DATE') col.type = 'date';
            else if (rawType === 'DATETIME') col.type = 'date'; 
            else if (rawType === 'NUMBER' || rawType === 'DOUBLE' || rawType === 'INTEGER' || rawType === 'LONG' || rawType === 'DECIMAL') col.type = 'number';
            else if (rawType === 'CURRENCY') col.type = 'currency';
            else if (rawType === 'PERCENT') col.type = 'percent';
            else if (rawType === 'EMAIL') col.type = 'email';
            else if (rawType === 'PHONE') col.type = 'phone';
            else if (rawType === 'URL') col.type = 'url';

            // Apply inline editing to scalar fields automatically
            if (col.fieldName && !col.fieldName.includes('.')) {
                // Ensure ID is never editable just in case it was added manually
                if (col.fieldName.toLowerCase() !== 'id') {
                    col.editable = true;
                }
            }

            // Set initial widths based on type to ensure visibility and trigger horizontal scroll if needed
            if (!col.initialWidth) {
                if (col.type === 'number' || col.type === 'boolean') col.initialWidth = 100;
                else if (col.type === 'date' || col.type === 'percent') col.initialWidth = 150;
                else if (col.type === 'currency') col.initialWidth = 160;
                else if (col.type === 'email' || col.type === 'phone') col.initialWidth = 200;
                else if (col.type === 'url') col.initialWidth = 250;
                else col.initialWidth = 180; // default for text/unspecified
            }
            return col;
        });

        // Add Detail Link Column at the beginning
        enrichedColumns.unshift({
            type: 'button-icon',
            initialWidth: 50,
            typeAttributes: {
                iconName: 'utility:record_alt',
                name: 'view_details',
                variant: 'bare',
                alternativeText: '詳細を開く',
                title: '詳細を開く'
            }
        });

        // Add Drilldown Column if Drilldown is configured
        if (this.configData && this.configData.childObjectApiName && this.configData.childRelationshipField) {
            enrichedColumns.splice(1, 0, {
                type: 'button-icon',
                initialWidth: 50,
                typeAttributes: {
                    iconName: 'utility:hierarchy',
                    name: 'drilldown',
                    variant: 'bare',
                    alternativeText: '関連レコードを表示',
                    title: '関連レコードを表示'
                }
            });
        }

        // Add Row Actions
        const rowActions = [
            { label: '編集', name: 'edit' },
            { label: '削除', name: 'delete' }
        ];

        enrichedColumns.push({
            type: 'action',
            typeAttributes: { rowActions: rowActions }
        });

        return enrichedColumns;
    }

    setupChildColumns(configChildFields) {
        let childCols = JSON.parse(JSON.stringify(configChildFields));
        childCols = childCols.map(col => {
            const rawType = (col.type || '').toUpperCase();
            col.type = 'text';

            if (rawType === 'BOOLEAN') col.type = 'boolean';
            else if (rawType === 'DATE') col.type = 'date';
            else if (rawType === 'DATETIME') col.type = 'date'; 
            else if (rawType === 'NUMBER' || rawType === 'DOUBLE' || rawType === 'INTEGER' || rawType === 'LONG' || rawType === 'DECIMAL') col.type = 'number';
            else if (rawType === 'CURRENCY') col.type = 'currency';
            else if (rawType === 'PERCENT') col.type = 'percent';
            else if (rawType === 'EMAIL') col.type = 'email';
            else if (rawType === 'PHONE') col.type = 'phone';
            else if (rawType === 'URL') col.type = 'url';
            
            if (!col.initialWidth) {
                if (col.type === 'number' || col.type === 'boolean') col.initialWidth = 100;
                else if (col.type === 'date' || col.type === 'percent') col.initialWidth = 150;
                else if (col.type === 'currency') col.initialWidth = 160;
                else if (col.type === 'email' || col.type === 'phone') col.initialWidth = 200;
                else if (col.type === 'url') col.initialWidth = 250;
                else col.initialWidth = 180;
            }
            return col;
        });

        // Detail Link
        childCols.unshift({
            type: 'button-icon',
            initialWidth: 50,
            typeAttributes: {
                iconName: 'utility:record_alt',
                name: 'view_details',
                variant: 'bare',
                alternativeText: '詳細を開く',
                title: '詳細を開く'
            }
        });
        
        // Row actions
        const rowActions = [
            { label: '編集', name: 'edit' },
            { label: '削除', name: 'delete' }
        ];

        childCols.push({
            type: 'action',
            typeAttributes: { rowActions: rowActions }
        });

        this.childColumns = childCols;
    }

    handleToggleView() {
        this.viewMode = this.viewMode === 'list' ? 'tile' : 'list';
    }

    handleLoadMore(event) {
        if (!this.enableInfiniteLoading) {
            event.target.isLoading = false;
            return;
        }

        this.isLoadingMore = true;
        if (event.target) {
            event.target.isLoading = true;
        }

        const payload = {
            context: {
                instanceId: this.instanceId,
                type: 'FETCH_MORE'
            }
        };
        publish(this.messageContext, SHERLOCK_SEARCH_CHANNEL, payload);
    }
    
    // --- Flow and Actions ---

    handleRowSelection(event) {
        const selectedRows = event.detail.selectedRows;
        this.selectedRecordIds = selectedRows.map(row => row.Id);
    }

    handleRunBulkFlow() {
        if (!this.bulkFlowApiName || this.selectedRecordIds.length === 0) return;
        this.showFlowModal = true;
    }

    closeFlowModal() {
        this.showFlowModal = false;
    }

    handleFlowStatusChange(event) {
        if (event.detail.status === 'FINISHED' || event.detail.status === 'FINISHED_SCREEN') {
            showToast(this, '成功', 'フローが正常に完了しました。', 'success');

            this.closeFlowModal();
            this.requestRefresh();
        } else if (event.detail.status === 'ERROR') {
            showToast(this, 'エラー', 'フロー実行中にエラーが発生しました。', 'error');

        }
    }

    handleCancel() {
        this.draftValues = [];
    }

    async handleSave(event) {
        const updatedFields = event.detail.draftValues;
        
        if (!updatedFields || updatedFields.length === 0) return;

        this.isSaving = true;
        
        // Prepare records for update
        const recordInputs = updatedFields.map(draft => {
            let sObj = { Id: draft.Id };
            // Assign fields
            Object.assign(sObj, draft);
            return sObj;
        });

        try {
            await updateRecords({ records: recordInputs });
            showToast(this, '成功', 'レコードを更新しました。', 'success');

            this.draftValues = []; // clear drafts
            this.requestRefresh();
        } catch (error) {
            showToast(this, 'エラー', '更新に失敗しました: ' + (error?.body?.message || error.message), 'error');

        } finally {
            this.isSaving = false;
        }
    }

    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        const objName = this.currentObjectApiName;
        if (actionName === 'view_details') {
            this.navigateToRecord(row.Id, objName, 'view');
        } else if (actionName === 'drilldown') {
            this.handleDrilldown(row.Id);
        } else {
            this.processAction(actionName, row.Id);
        }
    }

    handleTileAction(event) {
        const actionName = event.detail.actionValue;
        const recordId = event.detail.recordId;
        this.processAction(actionName, recordId);
    }

    handleTileDrilldown(event) {
        const recordId = event.detail.recordId;
        this.handleDrilldown(recordId);
    }

    handleDrilldown(recordId) {
        this.selectedParentRecordId = recordId;
        this.fetchChildData(recordId);
    }

    handleBackToMain() {
        this.isViewingChild = false;
        this.selectedParentRecordId = null;
        this.flattenedChildData = [];
    }

    async fetchChildData(parentId) {
        this.isFetchingChild = true;
        this.flattenedChildData = [];
        this.isViewingChild = true; // Switch view immediately to show spinner/loading state

        try {
            const request = {
                parentRecordId: parentId,
                childObjectApiName: this.childObjectApiName,
                childRelationshipField: this.childRelationshipField,
                childFields: this.childFields.map(f => f.fieldName)
            };
            
            const results = await getChildRecords({ request: request });
            // Uses same flatten logic, but passes childColumns for tile generation
            this.flattenedChildData = flattenData(results, this.childColumns);

            // Show scroll indicator if many columns
            if (this.childColumns && this.childColumns.length > 3) {
                this.showChildScrollIndicator = true;
            }
        } catch (error) {
            showToast(this, 'エラー', '子レコードの取得に失敗しました: ' + (error?.body?.message || error?.message), 'error');

        } finally {
            this.isFetchingChild = false;
        }
    }

    processAction(actionName, recordId) {
        const objName = this.currentObjectApiName;
        if (actionName === 'edit') {
            this.navigateToRecord(recordId, objName, 'edit');
        } else if (actionName === 'delete') {
            this.handleDelete(recordId);
        }
    }

    handleRecordNavigate(event) {
        event.preventDefault();
        const recordId = event.detail.recordId;
        this.navigateToRecord(recordId, this.currentObjectApiName, 'view');
    }

    navigateToRecord(recordId, objectApiName, actionName = 'view') {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: recordId,
                objectApiName: objectApiName,
                actionName: actionName
            }
        });
    }

    async handleDelete(recordId) {
        try {
            await deleteRecord({ recordId: recordId });
            showToast(this, '成功', 'レコードを削除しました。', 'success');

            this.requestRefresh();
        } catch (error) {
            showToast(this, 'エラー', '削除に失敗しました: ' + (error?.body?.message || error.message), 'error');

        }
    }
    
    requestRefresh() {
        const payload = {
            context: {
                instanceId: this.instanceId,
                type: 'FETCH_REFRESH'
            }
        };
        publish(this.messageContext, SHERLOCK_SEARCH_CHANNEL, payload);
    }

    handleExportClick() {
        this.showExportModal = true;
    }

    handleCancelExport() {
        this.showExportModal = false;
    }



    async executeExport(event) {
        const exportScope = event.detail.exportScope;
        this.isExporting = true;
        try {
            let dataToExport = [];
            
            if (exportScope === 'selected') {
                dataToExport = this.flattenedData.filter(row => this.selectedRecordIds.includes(row.Id));
            } 
            else if (exportScope === 'loaded') {
                dataToExport = this.flattenedData;
            } 
            else if (exportScope === 'all') {
                if (!this.lastSearchCriteria) {
                    throw new Error('検索条件が見つかりません。一度検索を実行してください。');
                }
                const request = { 
                    ...this.lastSearchCriteria, 
                    recordLimit: this.exportLimit, 
                    recordOffset: 0 
                };
                const results = await executeSearch({ request: request });
                dataToExport = flattenData(results, this.columns);
            }

            if (dataToExport.length === 0) {
                showToast(this, '情報', '出力対象のデータがありません。', 'info');

                return;
            }

            const success = generateAndDownloadCSV(dataToExport, this.columns, this.targetObject, this.exportFileName);
            if (success) {
                this.showExportModal = false;
                showToast(this, '成功', `${dataToExport.length} 件のエクスポートを開始しました。`, 'success');
            } else {
                showToast(this, 'エラー', 'エクスポートに失敗しました。', 'error');
            }

        } catch (error) {
            console.error('Export Error:', error);
            const errorMessage = error?.body?.message || error?.message || String(error);
            showToast(this, 'エラー', 'エクスポートに失敗しました: ' + errorMessage, 'error');

        } finally {
            this.isExporting = false;
        }
    }

    generateAndDownloadCSV(data) {
        // Filter out action or other internal columns that do not have a fieldName
        const exportColumns = this.columns ? this.columns.filter(col => col.fieldName) : [];
        if (exportColumns.length === 0) {
            showToast(this, 'エラー', 'エクスポート可能な項目がありません。', 'error');

            return;
        }

        const headers = exportColumns.map(col => col.label || col.fieldName);
        const columnFields = exportColumns.map(col => col.fieldName);

        const csvRows = [];
        csvRows.push(headers.join(','));

        data.forEach(row => {
            const values = columnFields.map(field => {
                let val = row[field];
                if (val === undefined || val === null) val = '';
                // Escape quotes and wrap in quotes if contains comma
                val = String(val).replace(/"/g, '""');
                return val.includes(',') ? `"${val}"` : val;
            });
            csvRows.push(values.join(','));
        });

        const csvString = csvRows.join('\r\n');
        // Add BOM for Excel compatibility (UTF-8)
        const BOM = '\uFEFF';
        
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(BOM + csvString);
            link.setAttribute('href', encodedUri);
            const fileName = `Export_${this.lastSearchCriteria?.targetObject || 'Records'}_${new Date().getTime()}.csv`;
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // Flattens nested object structures e.g. { Account: { Name: 'X'} } -> { 'Account.Name': 'X' }
    // If cols is provided, it uses specific logic for child rows, otherwise falls back to this.columns
    flattenData(dataArray, cols = this.columns) {
        if (!dataArray || !Array.isArray(dataArray)) return [];

        return dataArray.map(record => {
            let result = {};
            
            const recurse = (current, propertySource) => {
                if (Object(current) !== current) {
                    result[propertySource] = current;
                } else if (Array.isArray(current)) {
                    result[propertySource] = current.join(', ');
                } else {
                    let isEmpty = true;
                    for (let p in current) {
                        isEmpty = false;
                        recurse(current[p], propertySource ? propertySource + '.' + p : p);
                    }
                    if (isEmpty && propertySource) {
                        result[propertySource] = {};
                    }
                }
            };
            
            recurse(record, '');
            
            // Build dynamic display array for tile view based on columns
            const displayColumns = cols.filter(col => col.type !== 'action' && col.fieldName);
            
            // Set header to first visible column value, or Id as fallback
            result._tileHeader = displayColumns.length > 0 ? (result[displayColumns[0].fieldName] || record.Id) : record.Id;

            result._tileFields = displayColumns.map(col => {
                return {
                    label: col.label,
                    value: result[col.fieldName] || ''
                };
            });

            return result;
        });
    }
}