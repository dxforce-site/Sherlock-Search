public with sharing class SherlockCpeHelper {
    
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getAvailableObjects() {
        List<Map<String, String>> objList = new List<Map<String, String>>();
        
        for(Schema.SObjectType objTyp : Schema.getGlobalDescribe().values()){
            Schema.DescribeSObjectResult describeRes = objTyp.getDescribe();
            String name = describeRes.getName();
            
            if(describeRes.isQueryable() && describeRes.isAccessible()) {
                // Determine if it's a "Major" object to show as default suggestions
                Boolean isMajor = name.endsWith('__c') || 
                   name == 'Account' || 
                   name == 'Contact' || 
                   name == 'Lead' || 
                   name == 'Opportunity' || 
                   name == 'Case' ||
                   name == 'Campaign' ||
                   name == 'User' ||
                   name == 'Task' ||
                   name == 'Event';
                        
                objList.add(new Map<String, String>{
                    'label' => describeRes.getLabel() + ' (' + name + ')',
                    'value' => name,
                    'isMajor' => String.valueOf(isMajor)
                });
            }
        }
        return objList;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getObjectFields(String objectApiName) {
        List<Map<String, Object>> fieldList = new List<Map<String, Object>>();
        if (String.isBlank(objectApiName)) return fieldList;

        SObjectType objType = Schema.getGlobalDescribe().get(objectApiName);
        if (objType == null) return fieldList;

        Map<String, Schema.SObjectField> fieldMap = objType.getDescribe().fields.getMap();
        
        for (String fieldName : fieldMap.keySet()) {
            Schema.DescribeFieldResult fieldDescribe = fieldMap.get(fieldName).getDescribe();
            if (fieldDescribe.isAccessible()) {
                Map<String, Object> fieldInfo = new Map<String, Object>{
                    'label' => fieldDescribe.getLabel() + ' (' + fieldDescribe.getName() + ')',
                    'value' => fieldDescribe.getName(),
                    'type' => String.valueOf(fieldDescribe.getType())
                };

                // Add options for picklists
                if (fieldDescribe.getType() == Schema.DisplayType.Picklist) {
                    List<Map<String, String>> options = new List<Map<String, String>>();
                    for (Schema.PicklistEntry pe : fieldDescribe.getPicklistValues()) {
                        if (pe.isActive()) {
                            options.add(new Map<String, String>{ 'label' => pe.getLabel(), 'value' => pe.getValue() });
                        }
                    }
                    fieldInfo.put('options', options);
                } 
                // Add options for booleans (True/False dropdown)
                else if (fieldDescribe.getType() == Schema.DisplayType.Boolean) {
                    List<Map<String, String>> options = new List<Map<String, String>>();
                    options.add(new Map<String, String>{ 'label' => 'True (はい)', 'value' => 'true' });
                    options.add(new Map<String, String>{ 'label' => 'False (いいえ)', 'value' => 'false' });
                    fieldInfo.put('options', options);
                }
                // Add reference info for record picker
                else if (fieldDescribe.getType() == Schema.DisplayType.Reference) {
                    List<Schema.SObjectType> refs = fieldDescribe.getReferenceTo();
                    if (!refs.isEmpty()) {
                        fieldInfo.put('referenceTo', String.valueOf(refs[0]));
                        fieldInfo.put('relationshipName', fieldDescribe.getRelationshipName());
                    }
                }

                fieldList.add(fieldInfo);
            }
        }

        return fieldList;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getAvailableFlows() {
        List<Map<String, String>> flowList = new List<Map<String, String>>();
        
        // Query active Screen Flows
        for(FlowDefinitionView flow : [SELECT ApiName, Label FROM FlowDefinitionView WHERE IsActive = true AND ProcessType = 'Flow' ORDER BY Label LIMIT 1000]){
            flowList.add(new Map<String, String>{
                'label' => flow.Label + ' (' + flow.ApiName + ')',
                'value' => flow.ApiName
            });
        }
        return flowList;
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getChildRelationships(String objectApiName) {
        List<Map<String, String>> relationships = new List<Map<String, String>>();
        if (String.isBlank(objectApiName)) return relationships;

        SObjectType objType = Schema.getGlobalDescribe().get(objectApiName);
        if (objType == null) return relationships;

        for (Schema.ChildRelationship cr : objType.getDescribe().getChildRelationships()) {
            Schema.DescribeSObjectResult childDescribe = cr.getChildSObject().getDescribe();
            // 必須要件：取得できアクセス可能なもののみ
            if (childDescribe.isAccessible() && childDescribe.isQueryable()) {
                String childObjectApiName = childDescribe.getName();
                String fieldName = cr.getField().getDescribe().getName();
                String relationshipName = cr.getRelationshipName();
                String relLabel = childDescribe.getLabel() + ' (' + fieldName + ')';
                
                relationships.add(new Map<String, String>{
                    'label' => relLabel,
                    'value' => childObjectApiName + '::' + fieldName,
                    'childObjectApiName' => childObjectApiName,
                    'childRelationshipField' => fieldName,
                    'relationshipName' => relationshipName
                });
            }
        }
        
        // ラベル順にソート（必要に応じて）
        return relationships;
    }
}