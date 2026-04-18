@IsTest
private class SherlockConfigServiceTest {

    @TestSetup
    static void setup() {
        // Create config in system context
        SherlockTestFactory.createConfig('inst1', '{"test": "json"}', true);
        
        // Create test user and assign permission set
        User testUser = SherlockTestFactory.createTestUser('sadmin', true);
        SherlockTestFactory.assignPermissionSet(testUser.Id, 'Sherlock_Search_Admin');
    }

    private static User getTestUser() {
        return [SELECT Id FROM User WHERE Alias = 'sadmin' LIMIT 1];
    }

    @IsTest
    static void testGetConfig() {
        User u = getTestUser();
        System.runAs(u) {
            Test.startTest();
            String json = SherlockConfigService.getConfig('inst1');
            String nonExistent = SherlockConfigService.getConfig('none');
            Test.stopTest();
            
            Assert.areEqual('{"test": "json"}', json);
            Assert.isNull(nonExistent);
        }
    }

    @IsTest
    static void testSaveConfig_New() {
        User u = getTestUser();
        System.runAs(u) {
            Test.startTest();
            SherlockConfigService.saveConfig('inst2', '{"new": "data"}');
            Test.stopTest();
            
            String json = SherlockConfigService.getConfig('inst2');
            Assert.areEqual('{"new": "data"}', json);
        }
    }

    @IsTest
    static void testSaveConfig_Update() {
        User u = getTestUser();
        System.runAs(u) {
            Test.startTest();
            SherlockConfigService.saveConfig('inst1', '{"updated": "data"}');
            Test.stopTest();
            
            String json = SherlockConfigService.getConfig('inst1');
            Assert.areEqual('{"updated": "data"}', json);
        }
    }

    @IsTest
    static void testDeleteConfig() {
        User u = getTestUser();
        System.runAs(u) {
            Test.startTest();
            SherlockConfigService.deleteConfig('inst1');
            Test.stopTest();
            
            String json = SherlockConfigService.getConfig('inst1');
            Assert.isNull(json);
        }
    }

    @IsTest
    static void testGetAllInstanceIds() {
        User u = getTestUser();
        System.runAs(u) {
            SherlockTestFactory.createConfig('inst2', '{}', true);
            
            Test.startTest();
            List<String> ids = SherlockConfigService.getAllInstanceIds();
            Test.stopTest();
            
            Assert.isTrue(ids.contains('inst1'));
            Assert.isTrue(ids.contains('inst2'));
            Assert.isTrue(ids.size() >= 2);
        }
    }

    @IsTest
    static void testGetConfig_Error() {
        User u = getTestUser();
        System.runAs(u) {
            try {
                Test.startTest();
                SherlockConfigService.saveConfig('X'.repeat(300), '{}');
                Test.stopTest();
                Assert.fail('Should have failed with standard Exception');
            } catch (Exception e) {
                Assert.isFalse(e instanceof AuraHandledException, 'Should not throw AuraHandledException from service layer');
            }
        }
    }
}
