import { LightningElement, api } from 'lwc';

export default class SherlockFlowModal extends LightningElement {
    @api isOpen = false;
    @api flowApiName = '';
    @api flowInputVariables = [];
    @api flowButtonLabel = '';

    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleStatusChange(event) {
        this.dispatchEvent(new CustomEvent('statuschange', {
            detail: { status: event.detail.status }
        }));
    }
}
