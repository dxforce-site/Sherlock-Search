import { LightningElement, track, wire } from 'lwc';
import { subscribe, MessageContext, unsubscribe } from 'lightning/messageService';
import TOAST_CHANNEL from '@salesforce/messageChannel/SherlockToastChannel__c';

const AUTO_HIDE_TIME = 5000;

export default class SherlockToast extends LightningElement {
    @track toasts = [];
    subscription = null;

    @wire(MessageContext)
    messageContext;

    connectedCallback() {
        this.subscribeToMessageChannel();
    }

    disconnectedCallback() {
        this.unsubscribeToMessageChannel();
    }

    subscribeToMessageChannel() {
        if (!this.subscription) {
            this.subscription = subscribe(
                this.messageContext,
                TOAST_CHANNEL,
                (message) => this.handleMessage(message)
            );
        }
    }

    unsubscribeToMessageChannel() {
        unsubscribe(this.subscription);
        this.subscription = null;
    }

    handleMessage(message) {
        const id = Date.now();
        const { title, message: body, variant } = message;
        
        const toast = {
            id,
            title,
            message: body,
            variant,
            containerClass: this.calculateContainerClass(variant),
            iconName: this.getIconName(variant),
            iconClass: this.calculateIconClass(variant)
        };

        this.toasts = [...this.toasts, toast];

        setTimeout(() => {
            this.removeToast(id);
        }, AUTO_HIDE_TIME);
    }

    calculateContainerClass(variant) {
        let themeClass = 'slds-theme_info';
        if (variant === 'success') themeClass = 'slds-theme_success';
        else if (variant === 'error') themeClass = 'slds-theme_error';
        else if (variant === 'warning') themeClass = 'slds-theme_warning';
        
        return `slds-notify slds-notify_toast ${themeClass} slds-var-m-bottom_small`;
    }

    calculateIconClass(variant) {
        let iconUtilClass = 'slds-icon-utility-info';
        if (variant === 'success') iconUtilClass = 'slds-icon-utility-success';
        else if (variant === 'error') iconUtilClass = 'slds-icon-utility-error';
        else if (variant === 'warning') iconUtilClass = 'slds-icon-utility-warning';

        return `slds-icon_container ${iconUtilClass} slds-m-right_small slds-no-flex slds-align-top`;
    }

    getIconName(variant) {
        switch (variant) {
            case 'success': return 'utility:success';
            case 'error': return 'utility:error';
            case 'warning': return 'utility:warning';
            case 'info': return 'utility:info';
            default: return 'utility:info';
        }
    }


    handleClose(event) {
        const id = event.target.dataset.id;
        this.removeToast(Number(id));
    }

    removeToast(id) {
        this.toasts = this.toasts.filter(toast => toast.id !== id);
    }
}