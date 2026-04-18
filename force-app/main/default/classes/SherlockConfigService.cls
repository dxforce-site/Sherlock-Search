public with sharing class SherlockConfigService {
    
    public static String getConfig(String instanceId) {
        List<Sherlock_Config__c> configs = [SELECT Config_JSON__c FROM Sherlock_Config__c WHERE Name = :instanceId WITH SECURITY_ENFORCED LIMIT 1];
        if (!configs.isEmpty()) {
            return configs[0].Config_JSON__c;
        }
        return null;
    }

    public static void saveConfig(String instanceId, String configJson) {
        List<Sherlock_Config__c> existing = [SELECT Id FROM Sherlock_Config__c WHERE Name = :instanceId WITH SECURITY_ENFORCED LIMIT 1];
        Sherlock_Config__c record = new Sherlock_Config__c();
        record.Config_JSON__c = configJson;
        
        if(!existing.isEmpty()) {
            record.Id = existing[0].Id;
            Database.update(record, AccessLevel.USER_MODE);
        } else {
            record.Name = instanceId;
            Database.insert(record, AccessLevel.USER_MODE);
        }
    }

    public static void deleteConfig(String instanceId) {
        List<Sherlock_Config__c> existing = [SELECT Id FROM Sherlock_Config__c WHERE Name = :instanceId WITH SECURITY_ENFORCED LIMIT 1];
        if (!existing.isEmpty()) {
            Database.delete(existing[0], AccessLevel.USER_MODE);
        }
    }

    public static List<String> getAllInstanceIds() {
        List<String> ids = new List<String>();
        for (Sherlock_Config__c config : [SELECT Name FROM Sherlock_Config__c WITH SECURITY_ENFORCED ORDER BY Name ASC]) {
            ids.add(config.Name);
        }
        return ids;
    }
}
