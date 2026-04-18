import { LightningElement, api, wire, track } from 'lwc';
import { publish, subscribe, MessageContext, APPLICATION_SCOPE } from 'lightning/messageService';
import SHERLOCK_SEARCH_CHANNEL from '@salesforce/messageChannel/SherlockSearchChannel__c';
import getConfig from '@salesforce/apex/SherlockSearchController.getConfig';
import executeSearch from '@salesforce/apex/SherlockSearchController.executeSearch';
import getFavorites from '@salesforce/apex/SherlockSearchController.getFavorites';
import saveFavorite from '@salesforce/apex/SherlockSearchController.saveFavorite';
import deleteFavorite from '@salesforce/apex/SherlockSearchController.deleteFavorite';
import { showToast as commonShowToast } from 'c/sherlockToastUtils';

import { refreshApex } from '@salesforce/apex';
import LightningConfirm from 'lightning/confirm';

export default class SherlockSearchPanel extends LightningElement {
    @api instanceId = 'Search_A';

    @track configData = null;
    @track favorites = [];
    selectedFavoriteId = '';
    isLoading = false;
    @track searchKeyword = '';
    
    // Custom Logic State
    @track customLogic = '';
    @track sortCriteria = [];
    sortKeyCounter = 0;
    showAdvancedSearch = false;

    get panelTitle() {
        return this.configData?.panelTitle || 'Sherlock Search';
    }





    get favoriteOptions() {
        return [
            { label: '-- お気に入り検索条件を選択 --', value: '' },
            ...this.favorites.map(f => ({ label: f.Name, value: f.Id }))
        ];
    }



    // Dynamic Form State
    @track formValues = {};
    debounceTimer;

    // Pagination
    currentOffset = 0;
    recordLimit = 50;
    subscription = null;

    @wire(MessageContext)
    messageContext;

    get isSearchDisabled() {
        return !this.configData;
    }

    get hasSearchFields() {
        return this.configData && this.configData.searchFields && this.configData.searchFields.length > 0;
    }

    /**
     * Internal helper to normalize fields for SOQL building (logic moved from public getter)
     */
    _getNormalizedFields() {
        if (!this.configData || !this.configData.searchFields) return [];
        return this.configData.searchFields.map((f, index) => {
            const fieldName = (typeof f === 'string') ? f : f.fieldName;
            const sType = (f.type || '').toUpperCase();
            const isRange = ['PERCENT', 'DOUBLE', 'NUMBER', 'CURRENCY', 'DATE', 'DATETIME', 'TIME'].includes(sType);
            return {
                fieldName: fieldName,
                type: (typeof f === 'string') ? 'text' : f.type,
                isRange: isRange,
                isPicklist: !!(f.options && f.options.length > 0),
                conditionIndex: index + 1
            };
        });
    }

    connectedCallback() {
        if (this.instanceId) {
            this.subscribeToMessageChannel();
            this.loadConfiguration();
            this.loadFavorites();
        }
    }

    loadFavorites() {
        return getFavorites({ instanceId: this.instanceId })
            .then(result => {
                this.favorites = result || [];
            })
            .catch(error => {
                console.error('Failed to load favorites', error);
                throw error;
            });
    }

    resetSearchConditions() {
        this.searchKeyword = '';
        this.formValues = {};
        this.customLogic = '';
        this.sortCriteria = [];
        this.currentOffset = 0;
        this.performSearch('CONFIG_AND_DATA');
    }

    handleFavoriteChange(event) {
        const favId = event.detail.id;
        this.selectedFavoriteId = favId;
        
        if (favId) {
            const fav = this.favorites.find(f => f.Id === favId);
            if (fav && fav.Criteria_JSON__c) {
                try {
                    const criteria = JSON.parse(fav.Criteria_JSON__c);
                    if (criteria.formValues) {
                        // New format with searchKeyword and customLogic
                        this.formValues = { ...criteria.formValues };
                        this.searchKeyword = criteria.searchKeyword ?? '';
                        this.customLogic = criteria.customLogic ?? '';
                        if (criteria.sortCriteria) {
                            this.sortCriteria = criteria.sortCriteria.map(sc => {
                                return { ...sc, id: `sort-${this.sortKeyCounter++}` };
                            });
                        } else {
                            this.sortCriteria = [];
                        }
                        if (this.customLogic || this.sortCriteria.length > 0) {
                            this.showAdvancedSearch = true;
                        }
                    } else {
                        // Legacy format (fallback)
                        this.formValues = { ...criteria };
                        this.customLogic = '';
                        this.sortCriteria = [];
                    }
                    this.performSearch('CONFIG_AND_DATA');
                } catch (e) {
                    this.showToast('エラー', '保存された条件の解析に失敗しました', 'error');
                }
            }
        } else {
            this.resetSearchConditions();
        }
    }



    executeSaveFavorite(event) {
        const { saveType, newFavoriteName } = event.detail;
        const isOverwrite = saveType === 'overwrite' && this.selectedFavoriteId;
        const name = isOverwrite ? 
            this.favorites.find(f => f.Id === this.selectedFavoriteId)?.Name : 
            newFavoriteName;

        if (!name) return;

        this.isLoading = true;
        const criteria = {
            searchKeyword: this.searchKeyword,
            customLogic: this.customLogic,
            sortCriteria: this.sortCriteria,
            formValues: this.formValues
        };

        const favId = isOverwrite ? this.selectedFavoriteId : null;

        saveFavorite({ 
            request: {
                instanceId: this.instanceId, 
                name: name, 
                criteriaJson: JSON.stringify(criteria),
                favoriteId: favId
            }
        })
            .then(newId => {
                this.showToast('成功', 'お気に入り検索条件を保存しました: ' + name, 'success');
                this.template.querySelector('c-sherlock-favorite-manager')?.closeModal();
                this.selectedFavoriteId = newId;
                return this.loadFavorites();
            })
            .catch(error => {
                this.showToast('エラー', 'お気に入り検索条件の保存に失敗しました: ' + (error?.body?.message || error?.message), 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    async handleDeleteFavorite(event) {
        const favId = event.detail.id;
        if (!favId) return;

        const fav = this.favorites.find(f => f.Id === favId);
        const favName = fav ? fav.Name : '';

        const result = await LightningConfirm.open({
            message: `お気に入り検索条件 '${favName}' を削除してもよろしいですか？`,
            variant: 'headerless',
            label: '削除の確認',
            theme: 'error'
        });

        if (result) {
            deleteFavorite({ favoriteId: favId })
                .then(() => {
                    this.showToast('成功', 'お気に入り検索条件を削除しました', 'success');
                    this.selectedFavoriteId = '';
                    this.resetSearchConditions();
                    this.loadFavorites();
                })
                .catch(error => {
                    this.showToast('エラー', 'お気に入り検索条件の削除に失敗しました', 'error');
                });
        }
    }

    handleConditionChange(event) {
        const detail = event.detail;
        const type = detail.type;

        switch (type) {
            case 'keyword':
                this.searchKeyword = detail.value;
                break;
            case 'form':
                if (detail.rangeType) {
                    const currentObj = this.formValues[detail.fieldName] && typeof this.formValues[detail.fieldName] === 'object' 
                        ? { ...this.formValues[detail.fieldName] } 
                        : {};
                    currentObj[detail.rangeType] = detail.value;
                    this.formValues = { ...this.formValues, [detail.fieldName]: currentObj };
                } else {
                    this.formValues = { ...this.formValues, [detail.fieldName]: detail.value };
                }
                break;
            case 'toggleAdvanced':
                this.showAdvancedSearch = !this.showAdvancedSearch;
                break;
            case 'customLogic':
                this.customLogic = detail.value;
                break;
            case 'sortAdd':
                if (this.sortCriteria.length >= 5) {
                    this.showToast('情報', '最大5つまで並び替え条件を指定できます。', 'info');
                    return;
                }
                this.sortCriteria.push({
                    id: `sort-${this.sortKeyCounter++}`,
                    fieldName: '',
                    direction: 'ASC'
                });
                break;
            case 'sortRemove':
                this.sortCriteria = this.sortCriteria.filter(sc => sc.id !== detail.id);
                break;
            case 'sortField':
                const fieldRow = this.sortCriteria.find(sc => sc.id === detail.id);
                if (fieldRow) fieldRow.fieldName = detail.value;
                break;
            case 'sortDirection':
                const dirRow = this.sortCriteria.find(sc => sc.id === detail.id);
                if (dirRow) dirRow.direction = detail.value;
                break;
            default:
                break;
        }

        if (type !== 'customLogic') {
            this.handleAutoSearch();
        }
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
        if (message && message.context && message.context.instanceId === this.instanceId) {
            if (message.context.type === 'FETCH_MORE') {
                this.loadMoreData();
            } else if (message.context.type === 'FETCH_REFRESH') {
                this.currentOffset = 0;
                this.performSearch('CONFIG_AND_DATA');
            } else if (message.context.type === 'TRIGGER_SEARCH') {
                this.handleSearchClick();
            } else if (message.context.type === 'CONFIG_UPDATED') {
                this.loadConfiguration();
            }
        }
    }

    loadConfiguration() {
        this.isLoading = true;
        getConfig({ instanceId: this.instanceId })
            .then(result => {
                if (result) {
                    this.configData = JSON.parse(result);
                    this.currentOffset = 0;
                    this.performSearch('CONFIG_AND_DATA'); 
                } else {
                    this.showToast('警告', '設定IDが見つかりません: ' + this.instanceId, 'warning');
                }
            })
            .catch(error => {
                this.showToast('エラー', '設定の読み込みに失敗しました。', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }



    handleAutoSearch() {
        clearTimeout(this.debounceTimer);
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.debounceTimer = setTimeout(() => {
            this.handleSearchClick();
        }, 500); // 500ms debounce
    }

    handleSearchClick() {
        this.currentOffset = 0;
        this.performSearch('CONFIG_AND_DATA');
    }

    loadMoreData() {
        this.currentOffset += this.recordLimit;
        this.performSearch('APPEND_DATA');
    }

    // --- Advanced Search & Validation Logic ---


    validateCustomLogic() {
        if (!this.customLogic) return true;

        // 1. Check for invalid characters (allow only numbers, spaces, AND, OR, NOT, parentheses)
        const upperLogic = this.customLogic.toUpperCase();
        const invalidCharRegex = /[^0-9\s()ANDORNOT]/g;
        if (invalidCharRegex.test(upperLogic)) {
            // Further inspection to be safe, maybe they typed "AND " normally.
            // A simpler strict regex: only digits, spaces, 'AND', 'OR', 'NOT', '(', ')'
            const tokenRegex = /^(\s*\d+\s*|\s*AND\s*|\s*OR\s*|\s*NOT\s*|\s*\(\s*|\s*\)\s*)*$/;
            if (!tokenRegex.test(upperLogic)) {
                this.showToast('検証エラー', 'カスタムロジックに無効な文字が含まれています。数字、AND、OR、NOT、括弧のみ使用可能です。', 'error');
                return false;
            }
        }

        // 2. Check parenthesis matching
        let openParenCount = 0;
        for (let i = 0; i < this.customLogic.length; i++) {
            if (this.customLogic[i] === '(') openParenCount++;
            if (this.customLogic[i] === ')') openParenCount--;
            if (openParenCount < 0) {
                this.showToast('検証エラー', '括弧の対応が正しくありません（閉じ括弧が先行しています）。', 'error');
                return false;
            }
        }
        if (openParenCount !== 0) {
            this.showToast('検証エラー', '閉じられていない括弧があります。', 'error');
            return false;
        }

        return true;
    }

    performSearch(publishType) {
        if (!this.configData) return;

        if (!this.validateCustomLogic()) {
            this.isLoading = false;
            return;
        }
        
        this.isLoading = true;

        const allSearchFields = this._getNormalizedFields();

        // Build SOQL Filters from dynamic form using conditionIndex
        const filters = [];
        allSearchFields.forEach(fieldMeta => {
            const val = this.formValues[fieldMeta.fieldName];
            
            if (fieldMeta.isRange && val && typeof val === 'object') {
                const hasMin = val.min !== undefined && val.min !== null && val.min !== '';
                const hasMax = val.max !== undefined && val.max !== null && val.max !== '';
                
                if (hasMin || hasMax) {
                    filters.push({
                        conditionIndex: fieldMeta.conditionIndex,
                        fieldName: fieldMeta.fieldName,
                        operator: 'RANGE',
                        value: JSON.stringify(val)
                    });
                }
            } else if (val !== undefined && val !== null && val !== '') {
                let operator = '=';
                const sType = (fieldMeta.type || '').toUpperCase();
                if (!fieldMeta.isPicklist && (sType === 'STRING' || sType === 'TEXTAREA' || sType === 'EMAIL')) {
                    operator = 'LIKE';
                }
                
                filters.push({
                    conditionIndex: fieldMeta.conditionIndex,
                    fieldName: fieldMeta.fieldName,
                    operator: operator,
                    value: val
                });
            }
        });

        // Collect fields to SELECT (Columns + Search Fields)
        const selectFieldsSet = new Set();
        if (this.configData.columns) {
            this.configData.columns.forEach(c => selectFieldsSet.add(c.fieldName));
        }
        allSearchFields.forEach(f => selectFieldsSet.add(f.fieldName));
        
        // Also include fields used in Child Drilldown Highlights (Step 3)
        if (this.configData.childParentFields) {
            this.configData.childParentFields.forEach(fName => {
                const fieldName = (typeof fName === 'string') ? fName : fName.fieldName;
                if (fieldName) selectFieldsSet.add(fieldName);
            });
        }

        const request = {
            targetObject: this.configData.targetObject,
            selectFields: Array.from(selectFieldsSet),
            keywordTerm: this.searchKeyword,
            soqlFilters: filters,
            customLogic: this.customLogic || '',
            sortCriteria: this.sortCriteria.filter(sc => sc.fieldName),
            hiddenFilter: this.configData.hiddenFilter || '',
            recordLimit: this.recordLimit,
            recordOffset: this.currentOffset
        };

        executeSearch({ request: request })
            .then(results => {
                const payload = {
                    context: {
                        instanceId: this.instanceId,
                        type: publishType
                    },
                    config: {
                        ...this.configData
                    },
                    searchCriteria: request,
                    data: results
                };
                publish(this.messageContext, SHERLOCK_SEARCH_CHANNEL, payload);
            })
            .catch(error => {
                if (this.instanceId) {
                    this.showToast('エラー', '検索に失敗しました: ' + (error?.body?.message || error?.message), 'error');
                }
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    showToast(title, message, variant) {
        commonShowToast(this, title, message, variant);
    }

}