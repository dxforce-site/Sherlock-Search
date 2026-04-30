public inherited sharing class SherlockSecurityUtils {
    
    // Cache for describe results to improve performance
    private static Map<String, Schema.SObjectType> cachedGlobalDescribe;
    
    private static Map<String, Schema.SObjectType> getGlobalDescribe() {
        if (cachedGlobalDescribe == null) {
            cachedGlobalDescribe = Schema.getGlobalDescribe();
        }
        return cachedGlobalDescribe;
    }

    /**
     * Checks if a field (including cross-object references like Account.Name) is accessible to the current user.
     * @param baseObjectName API Name of the base object (e.g., 'Contact')
     * @param fieldPath Field path (e.g., 'Email', 'Account.Name', 'Account.Owner.Name')
     * @return Boolean indicating accessibility
     */
    public static Boolean isFieldAccessible(String baseObjectName, String fieldPath) {
        if (String.isBlank(baseObjectName) || String.isBlank(fieldPath)) return false;
        
        Schema.SObjectType currentObjectType = getGlobalDescribe().get(baseObjectName);
        if (currentObjectType == null) return false;
        
        // Split path (e.g. "Account.Name" -> ["Account", "Name"])
        List<String> parts = fieldPath.split('\\.');
        
        for (Integer i = 0; i < parts.size(); i++) {
            String part = parts[i];
            Boolean isLastPart = (i == parts.size() - 1);
            
            Map<String, Schema.SObjectField> fieldMap = currentObjectType.getDescribe().fields.getMap();
            
            if (isLastPart) {
                // Final field in the path
                Schema.SObjectField fld = fieldMap.get(part.toLowerCase());
                if (fld == null || !fld.getDescribe().isAccessible()) {
                    return false;
                }
            } else {
                // Relationship part (e.g. "Account")
                Schema.SObjectField matchingLookupField = null;
                
                // First try standard custom relationship suffix '__r' -> '__c'
                if (part.endsWithIgnoreCase('__r')) {
                    String customFieldName = part.replaceAll('(?i)__r$', '__c').toLowerCase();
                    matchingLookupField = fieldMap.get(customFieldName);
                }
                
                // If not found, iterate over all fields to find matching relationship name
                if (matchingLookupField == null) {
                    for (Schema.SObjectField fld : fieldMap.values()) {
                        Schema.DescribeFieldResult dfr = fld.getDescribe();
                        if (dfr.getRelationshipName() != null && dfr.getRelationshipName().equalsIgnoreCase(part)) {
                            matchingLookupField = fld;
                            break;
                        }
                    }
                }
                
                if (matchingLookupField == null || !matchingLookupField.getDescribe().isAccessible()) {
                    return false;
                }
                
                // Traverse to the parent object
                List<Schema.SObjectType> referenceTo = matchingLookupField.getDescribe().getReferenceTo();
                if (referenceTo == null || referenceTo.isEmpty()) {
                    return false;
                }
                currentObjectType = referenceTo[0]; // Take primary reference
            }
        }
        
        return true;
    }

    /**
     * Parses the Sherlock Search JSON configuration and removes any fields or child objects
     * that the current user does not have read access to.
     * @param configJson The original JSON configuration string
     * @return The filtered JSON string
     */
    public static String filterConfigForUser(String configJson) {
        if (String.isBlank(configJson)) return configJson;
        
        try {
            Map<String, Object> configMap = (Map<String, Object>) JSON.deserializeUntyped(configJson);
            
            String targetObject = (String) configMap.get('targetObject');
            if (String.isBlank(targetObject)) return configJson;
            
            // If target object itself is not accessible, do NOT filter out targetObject, 
            // so that the caller can handle the error appropriately (as agreed, base object access is an error).
            Schema.SObjectType objType = getGlobalDescribe().get(targetObject);
            if (objType == null || !objType.getDescribe().isAccessible()) {
                return configJson;
            }
            
            // 1. Filter columns
            if (configMap.containsKey('columns')) {
                List<Object> rawColumns = (List<Object>) configMap.get('columns');
                List<Object> filteredColumns = new List<Object>();
                for (Object colObj : rawColumns) {
                    Map<String, Object> col = (Map<String, Object>) colObj;
                    String fieldName = (String) col.get('fieldName');
                    if (String.isBlank(fieldName) || isFieldAccessible(targetObject, fieldName)) {
                        filteredColumns.add(colObj);
                    }
                }
                configMap.put('columns', filteredColumns);
            }
            
            // 2. Filter searchFields
            if (configMap.containsKey('searchFields')) {
                List<Object> rawSearchFields = (List<Object>) configMap.get('searchFields');
                List<Object> filteredSearchFields = new List<Object>();
                for (Object fldObj : rawSearchFields) {
                    Map<String, Object> fld = (Map<String, Object>) fldObj;
                    String fieldName = (String) fld.get('fieldName');
                    if (String.isBlank(fieldName) || isFieldAccessible(targetObject, fieldName)) {
                        filteredSearchFields.add(fldObj);
                    }
                }
                configMap.put('searchFields', filteredSearchFields);
            }
            
            // 3. Filter sortOptions
            if (configMap.containsKey('sortOptions')) {
                List<Object> rawSortOptions = (List<Object>) configMap.get('sortOptions');
                List<Object> filteredSortOptions = new List<Object>();
                for (Object optObj : rawSortOptions) {
                    Map<String, Object> opt = (Map<String, Object>) optObj;
                    String fieldName = (String) opt.get('value');
                    if (String.isBlank(fieldName) || isFieldAccessible(targetObject, fieldName)) {
                        filteredSortOptions.add(optObj);
                    }
                }
                configMap.put('sortOptions', filteredSortOptions);
            }
            
            // 4. Handle Child Object config
            String childObj = (String) configMap.get('childObjectApiName');
            if (String.isNotBlank(childObj)) {
                Schema.SObjectType childType = getGlobalDescribe().get(childObj);
                if (childType == null || !childType.getDescribe().isAccessible()) {
                    // Remove child config entirely
                    configMap.remove('childObjectApiName');
                    configMap.remove('childRelationshipField');
                    configMap.remove('childFields');
                    configMap.remove('childParentFields');
                } else {
                    // Filter childFields
                    if (configMap.containsKey('childFields')) {
                        List<Object> rawChildFields = (List<Object>) configMap.get('childFields');
                        List<Object> filteredChildFields = new List<Object>();
                        for (Object fldObj : rawChildFields) {
                            Map<String, Object> fld = (Map<String, Object>) fldObj;
                            String fieldName = (String) fld.get('fieldName');
                            if (String.isBlank(fieldName) || isFieldAccessible(childObj, fieldName)) {
                                filteredChildFields.add(fldObj);
                            }
                        }
                        configMap.put('childFields', filteredChildFields);
                    }
                    // Filter childParentFields (these are fields on the parent targetObject)
                    if (configMap.containsKey('childParentFields')) {
                        List<Object> rawChildParentFields = (List<Object>) configMap.get('childParentFields');
                        List<Object> filteredChildParentFields = new List<Object>();
                        for (Object fldObj : rawChildParentFields) {
                            String fieldName = '';
                            if (fldObj instanceof String) {
                                fieldName = (String) fldObj;
                            } else if (fldObj instanceof Map<String, Object>) {
                                fieldName = (String) ((Map<String, Object>)fldObj).get('fieldName');
                            }
                            if (String.isBlank(fieldName) || isFieldAccessible(targetObject, fieldName)) {
                                filteredChildParentFields.add(fldObj);
                            }
                        }
                        configMap.put('childParentFields', filteredChildParentFields);
                    }
                }
            }
            
            return JSON.serialize(configMap);
        } catch (Exception e) {
            System.debug('SherlockSecurityUtils.filterConfigForUser error: ' + e.getMessage());
            return configJson;
        }
    }
}
