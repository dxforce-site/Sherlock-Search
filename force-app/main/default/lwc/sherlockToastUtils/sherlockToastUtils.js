import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { publish } from 'lightning/messageService';
import TOAST_CHANNEL from '@salesforce/messageChannel/SherlockToastChannel__c';
import isCommunitySite from '@salesforce/apex/SherlockSearchController.isCommunitySite';

/**
 * Dispatches a toast notification. 
 * In LEX, uses standard ShowToastEvent.
 * In Community (LWR), publishes to SherlockToastChannel.
 * 
 * @param {LightningElement} comp - The component calling this (needed for dispatchEvent and messageContext)
 * @param {string} title - Toast title
 * @param {string} message - Toast message
 * @param {string} variant - Toast variant (success, error, warning, info)
 */
export async function showToast(comp, title, message, variant = 'info') {
    try {
        const isComm = await isCommunitySite();
        
        if (isComm) {
            // LWR: Use LMS
            if (comp.messageContext) {
                publish(comp.messageContext, TOAST_CHANNEL, {
                    title,
                    message,
                    variant
                });
            } else {
                console.error('MessageContext is required for sherlockToastUtils in community context.');
            }
        } else {
            // LEX: Use standard event
            comp.dispatchEvent(new ShowToastEvent({
                title,
                message,
                variant
            }));
        }
    } catch (error) {
        // Fallback to standard if Apex fails
        comp.dispatchEvent(new ShowToastEvent({
            title,
            message,
            variant
        }));
    }
}