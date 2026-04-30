@IsTest
private class SherlockSearchControllerTest {

    @TestSetup
    static void setup() {
        // 1. Setup DML (User, PermissionSetAssignment)
        User testUser = SherlockTestFactory.createTestUser('sadmin', true);
        SherlockTestFactory.assignPermissionSet(testUser.Id, 'Sherlock_Search_Admin');
        
        // Grant standard object permissions for DML tests
        SherlockTestFactory.grantStandardObjectPermissions(testUser.Id, 'Account');
        SherlockTestFactory.grantStandardObjectPermissions(testUser.Id, 'Contact');
        
        // 2. Non-Setup DML (Data)
        System.runAs(testUser) {
            SherlockTestFactory.createAccounts(5, true);
            SherlockTestFactory.createConfig('inst1', '{"test": "json"}', true);
            SherlockTestFactory.createFavorite('inst1', 'My Favorite', '{"keyword": "test"}', true);
        }
    }

    private static User getTestUser() {
        return [SELECT Id FROM User WHERE Alias = 'sadmin' LIMIT 1];
    }

    @IsTest
    static void testExecuteSearch() {
        User u = getTestUser();
        System.runAs(u) {
            SherlockQueryBuilder.SearchRequest req = new SherlockQueryBuilder.SearchRequest();
            req.targetObject = 'Account';
            req.selectFields = new List<String>{'Name'};
            req.keywordTerm = 'Test';
            
            Test.startTest();
            List<SObject> results = SherlockSearchController.executeSearch(req);
            Test.stopTest();
            
            Assert.isFalse(results.isEmpty(), 'Search should return results');
        }
    }

    @IsTest
    static void testExecuteSearch_Error() {
        User u = getTestUser();
        System.runAs(u) {
            SherlockQueryBuilder.SearchRequest req = new SherlockQueryBuilder.SearchRequest();
            req.targetObject = 'Account';
            req.selectFields = new List<String>{'InvalidField__c'}; // Will cause exception
            
            try {
                Test.startTest();
                SherlockSearchController.executeSearch(req);
                Test.stopTest();
                Assert.fail('Should have failed');
            } catch (AuraHandledException e) {
                Assert.isTrue(e.getMessage().contains('検索'), '日本語のエラーメッセージが含まれていません: ' + e.getMessage());
            }
        }
    }

    @IsTest
    static void testGetChildRecords() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        SherlockSearchController.ChildSearchRequest req = new SherlockSearchController.ChildSearchRequest();
        req.parentRecordId = acc.Id;
        req.childObjectApiName = 'Contact';
        req.childRelationshipField = 'AccountId';
        req.childFields = new List<String>{'LastName'};
        
        // Add a contact
        insert new Contact(LastName = 'Worker', AccountId = acc.Id);

        Test.startTest();
        List<SObject> results = SherlockSearchController.getChildRecords(req);
        Test.stopTest();
        
        Assert.areEqual(1, results.size(), 'Should find one contact');
    }

    @IsTest
    static void testConfigOperations() {
        User u = getTestUser();
        System.runAs(u) {
            Test.startTest();
            // Get
            String json = SherlockSearchController.getConfig('inst1');
            Assert.areEqual('{"test": "json"}', json);
            
            // Save (Update)
            SherlockSearchController.saveConfig('inst1', '{"test": "updated"}');
            Assert.areEqual('{"test": "updated"}', SherlockSearchController.getConfig('inst1'));
            
            // Save (Insert)
            SherlockSearchController.saveConfig('inst2', '{"new": "config"}');
            Assert.isNotNull(SherlockSearchController.getConfig('inst2'));

            // Delete
            SherlockSearchController.deleteConfig('inst1');
            Assert.isNull(SherlockSearchController.getConfig('inst1'));
            Test.stopTest();
        }
    }

    @IsTest
    static void testFavoriteOperations() {
        User u = getTestUser();
        System.runAs(u) {
            Test.startTest();
            // Get
            List<Sherlock_Favorite__c> favs = SherlockSearchController.getFavorites('inst1');
            Assert.areEqual(1, favs.size());
            
            // Save (Update)
            Id favId = favs[0].Id;
            SherlockSearchController.FavoriteSaveRequest req1 = new SherlockSearchController.FavoriteSaveRequest();
            req1.instanceId = 'inst1';
            req1.name = 'Renamed';
            req1.criteriaJson = '{"new": "criteria"}';
            req1.favoriteId = favId;
            SherlockSearchController.saveFavorite(req1);
            
            // Save (Insert)
            SherlockSearchController.FavoriteSaveRequest req2 = new SherlockSearchController.FavoriteSaveRequest();
            req2.instanceId = 'inst1';
            req2.name = 'New Fav';
            req2.criteriaJson = '{"x": 1}';
            // req2.favoriteId is null by default
            Id newId = SherlockSearchController.saveFavorite(req2);
            Assert.isNotNull(newId);
            
            // Delete
            SherlockSearchController.deleteFavorite(newId);
            Assert.areEqual(1, SherlockSearchController.getFavorites('inst1').size());
            Test.stopTest();
        }
    }

    @IsTest
    static void testRecordDml() {
        User u = getTestUser();
        System.runAs(u) {
            Account acc = [SELECT Id, Name FROM Account LIMIT 1];
            acc.Name = 'Updated Name';
            
            Test.startTest();
            SherlockSearchController.updateRecords(new List<SObject>{acc});
            Account updatedAcc = [SELECT Name FROM Account WHERE Id = :acc.Id];
            Assert.areEqual('Updated Name', updatedAcc.Name);
            
            SherlockSearchController.deleteRecord(acc.Id);
            Integer count = [SELECT count() FROM Account WHERE Id = :acc.Id];
            Assert.areEqual(0, count);
            Test.stopTest();
        }
    }

    @IsTest
    static void testMeta() {
        User u = getTestUser();
        System.runAs(u) {
            Test.startTest();
            List<String> instanceIds = SherlockSearchController.getAllInstanceIds();
            Assert.isFalse(instanceIds.isEmpty());
            
            Boolean isComm = SherlockSearchController.isCommunitySite();
            // Site.getSiteId() is null in tests usually
            Assert.isFalse(isComm);
            Test.stopTest();
        }
    }

    @IsTest
    static void testConfigOperations_Error() {
        User u = getTestUser();
        System.runAs(u) {
            try {
                Test.startTest();
                // Trigger failure (e.g., long name for SObject)
                SherlockSearchController.saveConfig('X'.repeat(300), '{}');
                Test.stopTest();
                Assert.fail('Should have failed');
            } catch (AuraHandledException e) {
                Assert.isTrue(e.getMessage().contains('設定の保存に失敗しました'), 'Error message mismatch: ' + e.getMessage());
            }
        }
    }

    @IsTest
    static void testFavoriteOperations_Error() {
        User u = getTestUser();
        System.runAs(u) {
            try {
                Test.startTest();
                SherlockSearchController.FavoriteSaveRequest req = new SherlockSearchController.FavoriteSaveRequest();
                req.instanceId = 'X'.repeat(300); // Trigger DML error
                req.name = 'Error Fav';
                SherlockSearchController.saveFavorite(req);
                Test.stopTest();
                Assert.fail('Should have failed');
            } catch (AuraHandledException e) {
                Assert.isTrue(e.getMessage().contains('お気に入りの保存に失敗しました'), 'Error message mismatch: ' + e.getMessage());
            }
        }
    }

    @IsTest
    static void testUpdateRecord_Error() {
        User u = getTestUser();
        System.runAs(u) {
            Account acc = [SELECT Id, Name FROM Account LIMIT 1];
            acc.Name = ''; // Cause DmlException
            
            try {
                Test.startTest();
                SherlockSearchController.updateRecords(new List<SObject>{acc});
                Test.stopTest();
                Assert.fail('Update should have failed');
            } catch (AuraHandledException e) {
                Assert.isTrue(e.getMessage().contains('レコードの更新に失敗しました'), 'Error message mismatch: ' + e.getMessage());
            }
        }
    }

    @IsTest
    static void testDeleteRecord_Error() {
        User u = getTestUser();
        System.runAs(u) {
            Account acc = [SELECT Id FROM Account LIMIT 1];
            delete acc;
            try {
                Test.startTest();
                SherlockSearchController.deleteRecord(acc.Id);
                Test.stopTest();
                Assert.fail('Delete should have failed');
            } catch (AuraHandledException e) {
                Assert.isTrue(e.getMessage().contains('レコードの削除に失敗しました'), 'Error message mismatch');
            }
        }
    }
    
    @IsTest
    static void testExecuteSearch_NoPermission() {
        // Create a user WITHOUT permission
        User limitedUser = SherlockTestFactory.createTestUser('limited', true);
        
        System.runAs(limitedUser) {
            // Choose an object that the limited user is likely not to have access to.
            // If they have access to Account, try the custom object Sherlock_Config__c.
            String targetObj = 'Account';
            Schema.SObjectType stype = Schema.getGlobalDescribe().get(targetObj);
            if (stype != null && stype.getDescribe().isAccessible()) {
                targetObj = 'Sherlock_Config__c';
                stype = Schema.getGlobalDescribe().get(targetObj);
            }

            // If they happen to have access to both, skip the failure assertion as we cannot test it here.
            if (stype != null && stype.getDescribe().isAccessible()) {
                return;
            }
            
            SherlockQueryBuilder.SearchRequest req = new SherlockQueryBuilder.SearchRequest();
            req.targetObject = targetObj;
            req.selectFields = new List<String>{'Name'};
            
            try {
                Test.startTest();
                SherlockSearchController.executeSearch(req);
                Test.stopTest();
                Assert.fail('Should have failed due to no permission for ' + targetObj);
            } catch (AuraHandledException e) {
                Assert.isTrue(e.getMessage().contains('アクセス権'), 'Error message should mention permissions: ' + e.getMessage());
            }
        }
    }

    @IsTest
    static void testExecuteSearch_RelationshipError() {
        User u = getTestUser();
        System.runAs(u) {
            SherlockQueryBuilder.SearchRequest req = new SherlockQueryBuilder.SearchRequest();
            req.targetObject = 'Contact';
            req.selectFields = new List<String>{'InvalidRel__r.Name'};
            
            try {
                Test.startTest();
                SherlockSearchController.executeSearch(req);
                Test.stopTest();
                Assert.fail('Should have failed due to invalid relationship');
            } catch (AuraHandledException e) {
                Assert.isTrue(e.getMessage().contains('権限が不足しているか'), 'Error message mismatch: ' + e.getMessage());
                Assert.isTrue(e.getMessage().contains('InvalidRel__r'), 'Relationship name not found: ' + e.getMessage());
            }
        }
    }
}
