@IsTest
private class SherlockFavoriteServiceTest {

    @TestSetup
    static void setup() {
        // Create settings in system context
        SherlockTestFactory.createConfig('inst1', '{"test": "json"}', true);
        
        // Create test user and assign permission set
        User testUser = SherlockTestFactory.createTestUser('sadmin', true);
        SherlockTestFactory.assignPermissionSet(testUser.Id, 'Sherlock_Search_Admin');
        
        // Create a favorite as the test user
        System.runAs(testUser) {
            SherlockTestFactory.createFavorite('inst1', 'Fav 1', '{"key": "val"}', true);
        }
    }

    private static User getTestUser() {
        return [SELECT Id FROM User WHERE Alias = 'sadmin' LIMIT 1];
    }

    @IsTest
    static void testGetFavorites() {
        User u = getTestUser();
        System.runAs(u) {
            Test.startTest();
            List<Sherlock_Favorite__c> results = SherlockFavoriteService.getFavorites('inst1');
            Test.stopTest();
            
            Assert.areEqual(1, results.size(), 'Should return one favorite');
            Assert.areEqual('Fav 1', results[0].Name, 'Favorite name mismatch');
        }
    }

    @IsTest
    static void testSaveFavorite_New() {
        User u = getTestUser();
        System.runAs(u) {
            SherlockSearchController.FavoriteSaveRequest req = new SherlockSearchController.FavoriteSaveRequest();
            req.instanceId = 'inst1';
            req.name = 'New Fav';
            req.criteriaJson = '{"new": "data"}';
            
            Test.startTest();
            Id favId = SherlockFavoriteService.saveFavorite(req);
            Test.stopTest();
            
            Assert.isNotNull(favId, 'Favorite ID should be returned');
            Sherlock_Favorite__c fav = [SELECT Name FROM Sherlock_Favorite__c WHERE Id = :favId];
            Assert.areEqual('New Fav', fav.Name);
        }
    }

    @IsTest
    static void testSaveFavorite_Update() {
        User u = getTestUser();
        System.runAs(u) {
            Sherlock_Favorite__c existing = [SELECT Id FROM Sherlock_Favorite__c WHERE Name = 'Fav 1' LIMIT 1];
            
            SherlockSearchController.FavoriteSaveRequest req = new SherlockSearchController.FavoriteSaveRequest();
            req.instanceId = 'inst1';
            req.name = 'Updated Fav';
            req.criteriaJson = '{"updated": "data"}';
            req.favoriteId = existing.Id;
            
            Test.startTest();
            Id favId = SherlockFavoriteService.saveFavorite(req);
            Test.stopTest();
            
            Assert.areEqual(existing.Id, favId);
            Sherlock_Favorite__c fav = [SELECT Name FROM Sherlock_Favorite__c WHERE Id = :favId];
            Assert.areEqual('Updated Fav', fav.Name);
        }
    }

    @IsTest
    static void testDeleteFavorite() {
        User u = getTestUser();
        System.runAs(u) {
            Sherlock_Favorite__c existing = [SELECT Id FROM Sherlock_Favorite__c WHERE Name = 'Fav 1' LIMIT 1];
            
            Test.startTest();
            SherlockFavoriteService.deleteFavorite(existing.Id);
            Test.stopTest();
            
            Integer count = [SELECT count() FROM Sherlock_Favorite__c WHERE Id = :existing.Id];
            Assert.areEqual(0, count, 'Favorite should be deleted');
        }
    }

    @IsTest
    static void testSaveFavorite_Error() {
        User u = getTestUser();
        System.runAs(u) {
            SherlockSearchController.FavoriteSaveRequest req = new SherlockSearchController.FavoriteSaveRequest();
            req.instanceId = 'X'.repeat(300); // Too long for field
            req.name = 'Error Fav';
            
            try {
                Test.startTest();
                SherlockFavoriteService.saveFavorite(req);
                Test.stopTest();
                Assert.fail('Should have failed with standard Exception');
            } catch (Exception e) {
                Assert.isFalse(e instanceof AuraHandledException, 'Should not throw AuraHandledException from service layer');
            }
        }
    }
}
