import { LightningElement, api } from 'lwc';

export default class SherlockStudioDesignTab extends LightningElement {
    @api panelTitle = '検索パネル';
    @api resultsTitle = '検索結果パネル';
    @api searchFormColumns = '1';
    @api showInlineSearchButton = false;
    @api panelButtonLabel = '検索';
    @api panelButtonVariant = 'brand';
    @api standaloneButtonLabel = '検索';
    @api standaloneButtonVariant = 'brand';

    get columnOptions() {
        return [
            { label: '1列', value: '1' },
            { label: '2列', value: '2' }
        ];
    }

    get variantOptions() {
        return [
            { label: 'Brand', value: 'brand' },
            { label: 'Base', value: 'base' },
            { label: 'Neutral', value: 'neutral' },
            { label: 'Brand Outline', value: 'brand-outline' },
            { label: 'Destructive', value: 'destructive' },
            { label: 'Destructive Text', value: 'destructive-text' },
            { label: 'Inverse', value: 'inverse' },
            { label: 'Success', value: 'success' }
        ];
    }

    handlePanelTitleChange(event) {
        this.dispatchConfigChange('panelTitle', event.target.value);
    }
    handleResultsTitleChange(event) {
        this.dispatchConfigChange('resultsTitle', event.target.value);
    }
    handleColumnChange(event) {
        this.dispatchConfigChange('searchFormColumns', event.detail.value);
    }
    handleShowButtonChange(event) {
        this.dispatchConfigChange('showInlineSearchButton', event.target.checked);
    }
    handlePanelButtonLabelChange(event) {
        this.dispatchConfigChange('panelButtonLabel', event.target.value);
    }
    handlePanelButtonVariantChange(event) {
        this.dispatchConfigChange('panelButtonVariant', event.detail.value);
    }
    handleStandaloneButtonLabelChange(event) {
        this.dispatchConfigChange('standaloneButtonLabel', event.target.value);
    }
    handleStandaloneButtonVariantChange(event) {
        this.dispatchConfigChange('standaloneButtonVariant', event.detail.value);
    }

    dispatchConfigChange(property, value) {
        this.dispatchEvent(new CustomEvent('configchange', {
            detail: { property, value }
        }));
    }
}
