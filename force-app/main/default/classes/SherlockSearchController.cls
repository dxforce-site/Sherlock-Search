public with sharing class SherlockSearchController {
    
    @AuraEnabled
    public static List<SObject> executeSearch(SherlockQueryBuilder.SearchRequest request) {
        try {
            // 0. Pre-validate object access
            validateObjectAccess(request.targetObject);

            // 1. Build the query
            SherlockQueryBuilder.QueryContext ctx = SherlockQueryBuilder.buildQuery(request);
            
            // 2. Execute using bind variables to avoid SOQL injection
            // Using AccessLevel.USER_MODE along with WITH SECURITY_ENFORCED ensures tight FLS checks.
            List<SObject> results = Database.queryWithBinds(
                ctx.queryString,
                ctx.bindMap,
                AccessLevel.USER_MODE
            );
            
            return results;
        } catch (System.QueryException e) {
            String msg;
            String errorDetail = e.getMessage();
            
            // 権限不足またはメタデータ不整合に関連するエラーパターン
            Boolean isSecurityError = errorDetail.containsIgnoreCase('Insufficient permissions') || 
                                     errorDetail.containsIgnoreCase('inaccessible') || 
                                     errorDetail.containsIgnoreCase('No such column') || 
                                     errorDetail.containsIgnoreCase('No such relation') || 
                                     errorDetail.containsIgnoreCase('Didn\'t understand relationship');

            if (isSecurityError) {
                String itemName = '';
                try {
                    // エラー文から項目名、オブジェクト名、またはリレーション名を抽出
                    Pattern p = Pattern.compile('(?i)(?:relationship|relation|column|field|object) \'(.+?)\'');
                    Matcher m = p.matcher(errorDetail);
                    if (m.find()) {
                        itemName = m.group(1);
                    }
                } catch (Exception ex) { /* Ignore regex error */ }
                
                msg = '検索を実行するための権限が不足しているか、設定（項目名・オブジェクト名）に誤りがあります。システム管理者に確認してください。';
                if (String.isNotBlank(itemName)) {
                    msg += '（対象: ' + itemName + '）';
                }
                msg += ' 詳細: ' + errorDetail;
            } else {
                msg = '検索論理式の指定に誤りがあります。条件番号や AND/OR の組み合わせを確認してください。詳細: ' + errorDetail;
            }
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        } catch (AuraHandledException e) {
            throw e; // Pass through
        } catch (Exception e) {
            String msg = '検索の実行に失敗しました: ' + e.getMessage();
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
    }

    public class ChildSearchRequest {
        @AuraEnabled public Id parentRecordId { get; set; }
        @AuraEnabled public String childObjectApiName { get; set; }
        @AuraEnabled public String childRelationshipField { get; set; } // WHERE句のキー
        @AuraEnabled public List<String> childFields { get; set; }
    }

    @AuraEnabled
    public static List<SObject> getChildRecords(ChildSearchRequest request) {
        try {
            if (request.parentRecordId == null || String.isBlank(request.childObjectApiName) || String.isBlank(request.childRelationshipField)) {
                return new List<SObject>();
            }

            // 0. Pre-validate object access
            validateObjectAccess(request.childObjectApiName);

            // 1. Select
            String selectClause = 'SELECT Id';
            if (request.childFields != null && !request.childFields.isEmpty()) {
                Set<String> fieldSet = new Set<String>();
                for (String field : request.childFields) {
                    if (field.toLowerCase() != 'id') {
                        fieldSet.add(field);
                    }
                }
                if (!fieldSet.isEmpty()) {
                    selectClause += ', ' + String.join(new List<String>(fieldSet), ', ');
                }
            }

            // 2. From & Where
            String queryString = selectClause + 
                                 ' FROM ' + String.escapeSingleQuotes(request.childObjectApiName) +
                                 ' WHERE ' + String.escapeSingleQuotes(request.childRelationshipField) + ' = :parentId' +
                                 ' ORDER BY CreatedDate DESC NULLS LAST LIMIT 2000';

            Map<String, Object> bindMap = new Map<String, Object>{
                'parentId' => request.parentRecordId
            };

            // 3. Execute
            return Database.queryWithBinds(
                queryString,
                bindMap,
                AccessLevel.USER_MODE
            );
        } catch (Exception e) {
            String msg = '子レコードの取得に失敗しました: ' + e.getMessage();
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
    }

    @AuraEnabled
    public static String getConfig(String instanceId) {
        try {
            String rawConfig = SherlockConfigService.getConfig(instanceId);
            return SherlockSecurityUtils.filterConfigForUser(rawConfig);
        } catch (Exception e) {
            String msg = '設定の取得に失敗しました: ' + e.getMessage();
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
    }

    @AuraEnabled
    public static void saveConfig(String instanceId, String configJson) {
        try {
            SherlockConfigService.saveConfig(instanceId, configJson);
        } catch (Exception e) {
            String msg = '設定の保存に失敗しました: ' + e.getMessage();
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
    }

    @AuraEnabled
    public static void deleteConfig(String instanceId) {
        try {
            SherlockConfigService.deleteConfig(instanceId);
        } catch (Exception e) {
            String msg = '設定の削除に失敗しました: ' + e.getMessage();
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
    }

    @AuraEnabled
    public static void updateRecords(List<SObject> records) {
        try {
            SherlockDmlService.updateRecords(records);
        } catch (DmlException e) {
            String msg = 'レコードの更新に失敗しました: ' + e.getDmlMessage(0);
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        } catch (Exception e) {
            String msg = '予期しないエラーが発生しました: ' + e.getMessage();
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
    }

    @AuraEnabled
    public static void deleteRecord(Id recordId) {
        try {
            SherlockDmlService.deleteRecord(recordId);
        } catch (Exception e) {
            String msg = 'レコードの削除に失敗しました: ' + e.getMessage();
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
    }

    // --- My Search Favorites ([SS-S05]) ---

    @AuraEnabled(cacheable=false)
    public static List<Sherlock_Favorite__c> getFavorites(String instanceId) {
        try {
            return SherlockFavoriteService.getFavorites(instanceId);
        } catch (Exception e) {
            String msg = 'お気に入りの取得に失敗しました: ' + e.getMessage();
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
    }

    @AuraEnabled
    public static Id saveFavorite(FavoriteSaveRequest request) {
        try {
            return SherlockFavoriteService.saveFavorite(request);
        } catch (Exception e) {
            String msg = 'お気に入りの保存に失敗しました: ' + e.getMessage();
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
    }

    @AuraEnabled
    public static void deleteFavorite(Id favoriteId) {
        try {
            SherlockFavoriteService.deleteFavorite(favoriteId);
        } catch (Exception e) {
            String msg = 'お気に入り情報の削除に失敗しました: ' + e.getMessage();
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<String> getAllInstanceIds() {
        try {
            return SherlockConfigService.getAllInstanceIds();
        } catch (Exception e) {
            String msg = 'インスタンスIDの取得に失敗しました: ' + e.getMessage();
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
    }
    @AuraEnabled(cacheable=true)
    public static Boolean isCommunitySite() {
        try {
            return Site.getSiteId() != null;
        } catch (Exception e) {
            String msg = 'サイトコンテキストの判定に失敗しました: ' + e.getMessage();
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
    }

    private static void validateObjectAccess(String objectApiName) {
        if (String.isBlank(objectApiName)) {
            String msg = 'オブジェクト名が指定されていません。';
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
        
        SObjectType objType = Schema.getGlobalDescribe().get(objectApiName);
        if (objType == null) {
            String msg = 'オブジェクト「' + objectApiName + '」が見つかりません。API名の指定が正しいか、または現在のユーザーにアクセス権があるかを確認してください。';
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
        
        DescribeSObjectResult dr = objType.getDescribe();
        if (!dr.isAccessible()) {
            String msg = 'オブジェクト「' + dr.getLabel() + ' (' + dr.getName() + ')」へのアクセス権（参照権限）がありません。システム管理者に確認してください。';
            AuraHandledException ahe = new AuraHandledException(msg);
            ahe.setMessage(msg);
            throw ahe;
        }
    }

    public class FavoriteSaveRequest {
        @AuraEnabled public String instanceId { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String criteriaJson { get; set; }
        @AuraEnabled public String favoriteId { get; set; }
    }
}