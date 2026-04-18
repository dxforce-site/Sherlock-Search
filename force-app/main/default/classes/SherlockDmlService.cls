public with sharing class SherlockDmlService {
    
    public static void updateRecords(List<SObject> records) {
        if (records != null && !records.isEmpty()) {
            Database.update(records, AccessLevel.USER_MODE);
        }
    }

    public static void deleteRecord(Id recordId) {
        if (recordId != null) {
            SObject obj = recordId.getSobjectType().newSObject(recordId);
            Database.delete(obj, AccessLevel.USER_MODE);
        }
    }
}
