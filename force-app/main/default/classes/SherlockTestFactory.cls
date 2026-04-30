@IsTest
public class SherlockTestFactory {
    
    public static Account createAccount(String name, Boolean isInsert) {
        Account acc = new Account(Name = name);
        if (isInsert) insert acc;
        return acc;
    }

    public static List<Account> createAccounts(Integer num, Boolean isInsert) {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < num; i++) {
            accounts.add(new Account(Name = 'Test Account ' + i, Phone = '03-1234-567' + i));
        }
        if (isInsert) insert accounts;
        return accounts;
    }

    public static Sherlock_Config__c createConfig(String instanceId, String jsonContent, Boolean isInsert) {
        Sherlock_Config__c config = new Sherlock_Config__c(
            Name = instanceId,
            Config_JSON__c = jsonContent
        );
        if (isInsert) insert config;
        return config;
    }

    public static Sherlock_Favorite__c createFavorite(String instanceId, String name, String criteriaJson, Boolean isInsert) {
        Sherlock_Favorite__c fav = new Sherlock_Favorite__c(
            Instance_ID__c = instanceId,
            Name = name,
            Criteria_JSON__c = criteriaJson
        );
        if (isInsert) insert fav;
        return fav;
    }

    public static User createTestUser(String alias, Boolean isInsert) {
        Id profileId;
        try {
            // Try to find a standard Salesforce profile that is NOT an admin
            List<Profile> profiles = [SELECT Id FROM Profile 
                         WHERE UserLicense.Name = 'Salesforce' 
                         AND (NOT Name LIKE '%Admin%') 
                         AND (NOT Name LIKE '%管理者%') 
                         AND (NOT Name LIKE '%Integration%') 
                         LIMIT 1];
            if (!profiles.isEmpty()) {
                profileId = profiles[0].Id;
            } else {
                // Fallback to any profile that works
                profileId = [SELECT Id FROM Profile WHERE UserType = 'Standard' LIMIT 1].Id;
            }
        } catch (Exception e) {
            profileId = UserInfo.getProfileId();
        }
        
        User u = new User(
            Alias = alias,
            Email = alias + '@test.com',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Testing',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = profileId,
            TimeZoneSidKey = 'America/Los_Angeles',
            UserName = alias + '@test.sherlock.com'
        );
        if (isInsert) insert u;
        return u;
    }

    public static void assignPermissionSet(Id userId, String permSetName) {
        PermissionSet ps = [SELECT Id FROM PermissionSet WHERE Name = :permSetName LIMIT 1];
        insert new PermissionSetAssignment(AssigneeId = userId, PermissionSetId = ps.Id);
    }

    public static void grantStandardObjectPermissions(Id userId, String sObjectType) {
        // Create unique name by appending timestamp/random for stability in tests
        String psName = 'Test_Perms_' + sObjectType + '_' + String.valueOf(userId).left(15);
        PermissionSet ps = new PermissionSet(
            Label = 'Test Perms ' + sObjectType,
            Name = psName
        );
        insert ps;
        
        ObjectPermissions op = new ObjectPermissions(
            ParentId = ps.Id,
            SobjectType = sObjectType,
            PermissionsRead = true,
            PermissionsCreate = true,
            PermissionsEdit = true,
            PermissionsDelete = true,
            PermissionsViewAllRecords = true,
            PermissionsModifyAllRecords = true
        );
        insert op;
        
        insert new PermissionSetAssignment(AssigneeId = userId, PermissionSetId = ps.Id);
    }
}
