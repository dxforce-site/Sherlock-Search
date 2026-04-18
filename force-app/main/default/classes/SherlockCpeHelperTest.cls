@IsTest
private class SherlockCpeHelperTest {

    @IsTest
    static void testGetAvailableObjects() {
        Test.startTest();
        List<Map<String, String>> objects = SherlockCpeHelper.getAvailableObjects();
        Test.stopTest();
        
        Assert.isFalse(objects.isEmpty(), 'Objects list should not be empty');
        
        Boolean foundAccount = false;
        for (Map<String, String> obj : objects) {
            if (obj.get('value') == 'Account') {
                foundAccount = true;
                Assert.areEqual('true', obj.get('isMajor'), 'Account should be major');
                break;
            }
        }
        Assert.isTrue(foundAccount, 'Account should be in the list');
    }

    @IsTest
    static void testGetObjectFields() {
        Test.startTest();
        List<Map<String, Object>> fields = SherlockCpeHelper.getObjectFields('Account');
        Test.stopTest();
        
        Assert.isFalse(fields.isEmpty(), 'Fields list should not be empty');
        
        Boolean foundName = false;
        Boolean foundType = false;
        for (Map<String, Object> field : fields) {
            if (field.get('value') == 'Name') foundName = true;
            if (field.get('value') == 'Type') {
                foundType = true;
                Assert.isNotNull(field.get('options'), 'Picklist should have options');
            }
        }
        Assert.isTrue(foundName, 'Name field should be found');
        Assert.isTrue(foundType, 'Type field should be found');
    }

    @IsTest
    static void testGetAvailableFlows() {
        // This might return empty in a scratch org/test env without flows,
        // but we test that the query runs without error.
        Test.startTest();
        List<Map<String, String>> flows = SherlockCpeHelper.getAvailableFlows();
        Test.stopTest();
        
        Assert.isNotNull(flows, 'Flows list should not be null');
    }

    @IsTest
    static void testGetChildRelationships() {
        Test.startTest();
        List<Map<String, String>> relationships = SherlockCpeHelper.getChildRelationships('Account');
        Test.stopTest();
        
        Assert.isFalse(relationships.isEmpty(), 'Account should have child relationships (e.g., Contacts)');
        
        Boolean foundContacts = false;
        for (Map<String, String> rel : relationships) {
            if (rel.get('childObjectApiName') == 'Contact') {
                foundContacts = true;
                Assert.isNotNull(rel.get('childRelationshipField'));
                break;
            }
        }
        Assert.isTrue(foundContacts, 'Contact relationship should be found');
    }

    @IsTest
    static void testGetChildRelationships_Invalid() {
        Test.startTest();
        List<Map<String, String>> relationships = SherlockCpeHelper.getChildRelationships('NonExistentObject__c');
        Test.stopTest();
        
        Assert.isTrue(relationships.isEmpty(), 'Should return empty for invalid object');
    }
}
