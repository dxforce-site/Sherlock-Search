@isTest
private class SherlockSecurityUtilsTest {

    @isTest
    static void testIsFieldAccessible_StandardFields() {
        // Standard fields on Account are generally accessible to Admin
        Boolean isAccessible = SherlockSecurityUtils.isFieldAccessible('Account', 'Name');
        System.assertEquals(true, isAccessible, 'Account.Name should be accessible');

        Boolean isInvalid = SherlockSecurityUtils.isFieldAccessible('Account', 'InvalidField__c');
        System.assertEquals(false, isInvalid, 'Invalid field should return false');
    }

    @isTest
    static void testIsFieldAccessible_CrossObject() {
        // Contact.Account.Name
        Boolean isAccessible = SherlockSecurityUtils.isFieldAccessible('Contact', 'Account.Name');
        System.assertEquals(true, isAccessible, 'Contact.Account.Name should be accessible');

        Boolean isInvalid = SherlockSecurityUtils.isFieldAccessible('Contact', 'Account.InvalidField__c');
        System.assertEquals(false, isInvalid, 'Contact.Account.InvalidField__c should return false');
    }

    @isTest
    static void testFilterConfigForUser() {
        // Simulate a config JSON
        String jsonConfig = '{' +
            '"targetObject":"Contact",' +
            '"columns": [{"fieldName":"Name"},{"fieldName":"InvalidField__c"}],' +
            '"searchFields": [{"fieldName":"Email"},{"fieldName":"AnotherInvalid__c"}],' +
            '"sortOptions": [{"value":"Phone"},{"value":"BadSort__c"}],' +
            '"childObjectApiName":"Opportunity",' +
            '"childRelationshipField":"AccountId",' +
            '"childFields": [{"fieldName":"Name"},{"fieldName":"BadChildField__c"}],' +
            '"childParentFields": [{"fieldName":"Name"}]' +
        '}';

        String filteredJson = SherlockSecurityUtils.filterConfigForUser(jsonConfig);
        
        // Assertions
        Map<String, Object> resultMap = (Map<String, Object>) JSON.deserializeUntyped(filteredJson);
        
        List<Object> columns = (List<Object>) resultMap.get('columns');
        System.assertEquals(1, columns.size(), 'Only Name should remain in columns');
        
        List<Object> searchFields = (List<Object>) resultMap.get('searchFields');
        System.assertEquals(1, searchFields.size(), 'Only Email should remain in searchFields');

        List<Object> sortOptions = (List<Object>) resultMap.get('sortOptions');
        System.assertEquals(1, sortOptions.size(), 'Only Phone should remain in sortOptions');

        List<Object> childFields = (List<Object>) resultMap.get('childFields');
        System.assertEquals(1, childFields.size(), 'Only Name should remain in childFields');
    }

    @isTest
    static void testFilterConfigForUser_InaccessibleTarget() {
        // Target object is not accessible (fake object)
        String jsonConfig = '{"targetObject":"InvalidObject__c", "columns": [{"fieldName":"Name"}]}';
        
        String filteredJson = SherlockSecurityUtils.filterConfigForUser(jsonConfig);
        
        // Should return unmodified string if target object is invalid so caller can handle error
        System.assertEquals(jsonConfig, filteredJson, 'Config should be unchanged if target object is inaccessible');
    }
}
