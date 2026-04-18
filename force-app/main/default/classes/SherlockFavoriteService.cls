public with sharing class SherlockFavoriteService {
    
    public static List<Sherlock_Favorite__c> getFavorites(String instanceId) {
        return [
            SELECT Id, Name, Criteria_JSON__c 
            FROM Sherlock_Favorite__c 
            WHERE Instance_ID__c = :instanceId 
            AND OwnerId = :UserInfo.getUserId()
            WITH SECURITY_ENFORCED
            ORDER BY Name ASC
        ];
    }

    public static Id saveFavorite(SherlockSearchController.FavoriteSaveRequest request) {
        Sherlock_Favorite__c fav = new Sherlock_Favorite__c(
            Name = request.name,
            Instance_ID__c = request.instanceId,
            Criteria_JSON__c = request.criteriaJson
        );
        if (String.isNotBlank(request.favoriteId)) {
            fav.Id = request.favoriteId;
            Database.update(fav, AccessLevel.USER_MODE);
        } else {
            Database.insert(fav, AccessLevel.USER_MODE);
        }
        return fav.Id;
    }

    public static void deleteFavorite(Id favoriteId) {
        Sherlock_Favorite__c fav = new Sherlock_Favorite__c(Id = favoriteId);
        Database.delete(fav, AccessLevel.USER_MODE);
    }
}
