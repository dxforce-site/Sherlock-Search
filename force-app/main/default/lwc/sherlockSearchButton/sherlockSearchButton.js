import { LightningElement, api, wire, track } from 'lwc';
import { publish, MessageContext } from 'lightning/messageService';
import SHERLOCK_SEARCH_CHANNEL from '@salesforce/messageChannel/SherlockSearchChannel__c';
import getConfig from '@salesforce/apex/SherlockSearchController.getConfig';
import { showToast } from 'c/sherlockToastUtils';


export default class SherlockSearchButton extends LightningElement {
    @api instanceId = 'Search_A';

    @track displayLabel = '検索';
    @track displayVariant = 'brand';

    @wire(MessageContext)
    messageContext;

    connectedCallback() {
        if (this.instanceId) {
            this.loadConfiguration();
        }
    }

    loadConfiguration() {
        getConfig({ instanceId: this.instanceId })
            .then(result => {
                if (result) {
                    const parsed = JSON.parse(result);
                    this.displayLabel = parsed.standaloneButtonLabel || parsed.buttonLabel || 'Search';
                    this.displayVariant = parsed.standaloneButtonVariant || parsed.buttonVariant || 'brand';
                }
            })
            .catch(error => {
                showToast(this, 'Error', 'Failed to load configuration for standalone button.', 'error');

            });
    }

    /**
     * Publish a TRIGGER_SEARCH message via LMS to command the Panel to search.
     */
    handleSearchTrigger() {
        if (this.instanceId) {
            const payload = {
                context: {
                    instanceId: this.instanceId,
                    type: 'TRIGGER_SEARCH'
                }
            };
            publish(this.messageContext, SHERLOCK_SEARCH_CHANNEL, payload);
        }
    }
}