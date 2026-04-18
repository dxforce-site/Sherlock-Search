@IsTest
private class SherlockDmlServiceTest {

    @TestSetup
    static void setup() {
        SherlockTestFactory.createAccounts(2, true);
    }

    @IsTest
    static void testUpdateRecords() {
        List<Account> accs = [SELECT Id, Name FROM Account];
        for (Account a : accs) {
            a.Name += ' Updated';
        }
        
        Test.startTest();
        SherlockDmlService.updateRecords(accs);
        Test.stopTest();
        
        Account updated = [SELECT Name FROM Account WHERE Id = :accs[0].Id];
        Assert.isTrue(updated.Name.contains('Updated'));
    }

    @IsTest
    static void testDeleteRecord() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        Id accId = acc.Id;
        
        Test.startTest();
        SherlockDmlService.deleteRecord(accId);
        Test.stopTest();
        
        Integer count = [SELECT count() FROM Account WHERE Id = :accId];
        Assert.areEqual(0, count);
    }

    @IsTest
    static void testUpdateRecords_Error() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        acc.Name = ''; // Assuming Name is required
        
        try {
            Test.startTest();
            SherlockDmlService.updateRecords(new List<Account>{acc});
            Test.stopTest();
            Assert.fail('Should have failed with standard Exception');
        } catch (Exception e) {
            // サービス層では AuraHandledException を投げないように変更したため、標準例外を期待する
            Assert.isFalse(e instanceof AuraHandledException, 'Should not throw AuraHandledException from service layer');
        }
    }

    @IsTest
    static void testDeleteRecord_Error() {
        // Use a non-existent ID to trigger error
        // Or delete first, then delete again
        Account acc = [SELECT Id FROM Account LIMIT 1];
        delete acc;
        
        try {
            Test.startTest();
            SherlockDmlService.deleteRecord(acc.Id);
            Test.stopTest();
            Assert.fail('Should have failed with standard Exception');
        } catch (Exception e) {
            // サービス層では AuraHandledException を投げないように変更したため、標準例外を期待する
            Assert.isFalse(e instanceof AuraHandledException, 'Should not throw AuraHandledException from service layer');
        }
    }
}
